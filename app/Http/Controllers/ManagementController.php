<?php

namespace App\Http\Controllers;

use App\Models\Lease;
use App\Models\Property;
use App\Models\RentCharge;
use App\Models\RentPayment;
use App\Models\Tenancy;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ManagementController extends Controller
{
    /** Days before the end date when a lease counts as "ending soon". */
    public const ENDING_SOON_DAYS = 60;

    public function leases(Request $request): Response
    {
        $user = $request->user();
        $ownerId = $this->ownerFilter($request, $user);
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['all', 'active', 'ending_soon', 'expired', 'scheduled', 'ended'])],
            'search' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', Rule::in(['end_date', 'start_date', 'tenant', 'rent', 'uploaded'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', Rule::in([15, 25, 50, 100])],
        ]);
        $sort = $filters['sort'] ?? 'end_date';
        $direction = $filters['direction'] ?? 'asc';
        $perPage = (int) ($filters['per_page'] ?? 25);
        $status = $filters['status'] ?? 'all';
        $search = trim($filters['search'] ?? '');

        $base = Lease::query()
            ->whereHas('tenancy.unit.property', fn ($query) => $query
                ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id))
                ->when($ownerId, fn ($query) => $query->where('owner_id', $ownerId)))
            ->when($search !== '', function ($query) use ($search) {
                $like = '%'.$search.'%';
                $query->where(fn ($inner) => $inner
                    ->where('reference_number', 'like', $like)
                    ->orWhere('original_name', 'like', $like)
                    ->orWhereHas('tenancy.tenant', fn ($tenant) => $tenant->where('name', 'like', $like))
                    ->orWhereHas('tenancy.unit', fn ($unit) => $unit->where('unit_number', 'like', $like))
                    ->orWhereHas('tenancy.unit.property', fn ($property) => $property->where('name', 'like', $like)));
            });

        $counts = collect(['all', 'active', 'ending_soon', 'expired', 'scheduled', 'ended'])
            ->mapWithKeys(fn ($key) => [$key => $this->applyLeaseStatus(clone $base, $key)->count()]);

        $leases = $this->applyLeaseStatus($base, $status)
            ->with([
                'tenancy.tenant:id,name,phone,email,type',
                'tenancy.unit.property:id,name,owner_id',
                'tenancy.unit.unitType:id,name',
                'tenancy.rentCharges.payments',
                'tenancy.renewals:id,renewed_from_id,status,start_date,end_date',
            ])
            ->tap(fn ($query) => $this->sortLeases($query, $sort, $direction))
            ->paginate($perPage)
            ->withQueryString();

        $leases->through(fn (Lease $lease) => $this->describeLease($lease));

        return Inertia::render('Leases/Index', [
            'leases' => $leases,
            'isAdmin' => $user->isAdmin(),
            'canManage' => $user->isAdmin() || ($user->isOwner() && ! $user->isReadOnly()),
            'owners' => $this->ownerOptions($user),
            'counts' => $counts,
            'endingSoonDays' => self::ENDING_SOON_DAYS,
            'filters' => ['owner_id' => $ownerId, 'status' => $status, 'search' => $search, 'sort' => $sort, 'direction' => $direction, 'per_page' => $perPage],
        ]);
    }

    /**
     * Lease tabs. "Expired" means the end date has passed while the tenancy is
     * still active and nothing renews it: someone has to act.
     */
    private function applyLeaseStatus($query, string $status)
    {
        $today = CarbonImmutable::today()->toDateString();
        $soon = CarbonImmutable::today()->addDays(self::ENDING_SOON_DAYS)->toDateString();
        $notRenewed = fn ($tenancy) => $tenancy->whereDoesntHave('renewals', fn ($renewal) => $renewal->whereIn('status', ['active', 'scheduled']));

        return match ($status) {
            'active' => $query->whereHas('tenancy', fn ($t) => $t->where('status', 'active')
                ->where(fn ($end) => $end->whereNull('end_date')->orWhere('end_date', '>', $soon)
                    ->orWhere(fn ($renewed) => $renewed->where('end_date', '>=', $today)->whereHas('renewals', fn ($r) => $r->whereIn('status', ['active', 'scheduled']))))),
            'ending_soon' => $query->whereHas('tenancy', fn ($t) => $notRenewed($t->where('status', 'active')->whereBetween('end_date', [$today, $soon]))),
            'expired' => $query->whereHas('tenancy', fn ($t) => $notRenewed($t->where('status', 'active')->where('end_date', '<', $today))),
            'scheduled' => $query->whereHas('tenancy', fn ($t) => $t->where('status', 'scheduled')),
            'ended' => $query->whereHas('tenancy', fn ($t) => $t->whereIn('status', ['ended', 'cancelled'])),
            default => $query,
        };
    }

    /** Sort leases by a column of their tenancy or tenant; ties by newest document. */
    private function sortLeases($query, string $sort, string $direction): void
    {
        $tenancyColumn = fn (string $column) => Tenancy::query()->select($column)->whereColumn('tenancies.id', 'leases.tenancy_id')->limit(1);

        match ($sort) {
            'start_date' => $query->orderBy($tenancyColumn('start_date'), $direction),
            'rent' => $query->orderBy($tenancyColumn('monthly_rent'), $direction),
            'tenant' => $query->orderBy(
                \App\Models\Tenant::query()->select('tenants.name')
                    ->join('tenancies', 'tenancies.tenant_id', '=', 'tenants.id')
                    ->whereColumn('tenancies.id', 'leases.tenancy_id')->limit(1),
                $direction,
            ),
            'uploaded' => $query->orderBy('leases.created_at', $direction),
            default => $query->orderBy($tenancyColumn('end_date'), $direction),
        };
        $query->orderByDesc('leases.id');
    }

    private function describeLease(Lease $lease): Lease
    {
        $tenancy = $lease->tenancy;
        $today = CarbonImmutable::today();
        $endDate = $tenancy?->end_date ? CarbonImmutable::parse($tenancy->end_date)->startOfDay() : null;
        $startDate = $tenancy?->start_date ? CarbonImmutable::parse($tenancy->start_date)->startOfDay() : null;
        $daysRemaining = $endDate ? (int) $today->diffInDays($endDate, false) : null;
        $renewal = $tenancy?->renewals->first(fn ($renewal) => in_array($renewal->status, ['active', 'scheduled'], true));

        $termStatus = match ($tenancy?->status) {
            'scheduled' => 'Scheduled',
            'ended' => 'Ended',
            'cancelled' => 'Cancelled',
            default => match (true) {
                ! $endDate => 'Ongoing',
                (bool) $renewal => 'Renewed',
                $daysRemaining < 0 => 'Expired',
                $daysRemaining <= self::ENDING_SOON_DAYS => 'Expiring soon',
                default => 'Active',
            },
        };
        $countdownLabel = match ($termStatus) {
            'Scheduled' => $startDate && $startDate->greaterThan($today) ? 'Starts in '.$today->diffInDays($startDate).' days' : 'Starts today',
            'Ended' => 'Ended '.($tenancy->actual_end_date?->format('j M Y') ?? $tenancy->end_date?->format('j M Y')),
            'Cancelled' => 'Lease cancelled',
            'Ongoing' => 'No end date',
            'Renewed' => 'Renewed from '.CarbonImmutable::parse($renewal->start_date)->format('j M Y'),
            'Expired' => abs($daysRemaining).' days past end',
            default => $daysRemaining === 0 ? 'Ends today' : $daysRemaining.' days remaining',
        };

        $dueCharges = $tenancy?->rentCharges->filter(fn ($charge) => ! $charge->voided_at && $charge->due_date->lte(today())) ?? collect();
        $dueBalances = $dueCharges->groupBy('charge_type')->map(fn ($charges) => $charges->sum(function ($charge) {
            return max(0, (int) round((float) $charge->amount * 100) - (int) round((float) $charge->payments->sum('amount') * 100));
        }));
        $balanceCents = (int) $dueBalances->sum();
        $amountPaid = $dueCharges->sum(fn ($charge) => (float) $charge->payments->sum('amount'));
        $hasOverdueCharge = $dueCharges->contains(fn ($charge) => $charge->due_date->lt(today())
            && (int) round((float) $charge->amount * 100) > (int) round((float) $charge->payments->sum('amount') * 100));
        $paymentStatus = match (true) {
            $dueCharges->isEmpty() => 'Up to date',
            $balanceCents <= 0 => 'Paid',
            $hasOverdueCharge => 'Overdue',
            $amountPaid > 0 => 'Partially paid',
            default => 'Due',
        };

        $totalDays = $startDate && $endDate ? max(1, $startDate->diffInDays($endDate)) : null;
        $elapsed = $startDate ? max(0, min($totalDays ?? 0, $startDate->diffInDays($today, false))) : 0;

        $lease->setAttribute('days_remaining', $daysRemaining);
        $lease->setAttribute('term_status', $termStatus);
        $lease->setAttribute('countdown_label', $countdownLabel);
        $lease->setAttribute('progress_percent', $totalDays ? (int) round($elapsed / $totalDays * 100) : null);
        $lease->setAttribute('payment_status', $paymentStatus);
        $lease->setAttribute('payment_balance', $balanceCents / 100);
        $lease->setAttribute('rent_due_balance', ((int) $dueBalances->get('rent', 0)) / 100);
        $lease->setAttribute('deposit_due_balance', ((int) $dueBalances->get('deposit', 0)) / 100);
        $lease->setAttribute('damage_due_balance', ((int) $dueBalances->get('damage', 0)) / 100);
        // Renewal is offered on the active lease that nothing has renewed yet.
        $lease->setAttribute('can_renew', $tenancy?->status === 'active' && ! $renewal && ! $tenancy->moveOutInspection()->exists());
        $tenancy?->unsetRelation('rentCharges');

        return $lease;
    }

    public function payments(Request $request): Response
    {
        $user = $request->user();
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', Rule::in(['all', 'rent', 'deposit'])],
            'method' => ['nullable', Rule::in(['cash', 'bank_transfer', 'mobile_money', 'cheque', 'other'])],
            'sort' => ['nullable', Rule::in(['date', 'amount'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', Rule::in([15, 25, 50, 100])],
        ]);
        $ownerId = $this->ownerFilter($request, $user);
        $search = trim($validated['search'] ?? '');
        $type = $validated['type'] ?? 'all';
        $method = $validated['method'] ?? null;
        $sort = $validated['sort'] ?? 'date';
        $direction = $validated['direction'] ?? 'desc';
        $perPage = (int) ($validated['per_page'] ?? 25);
        $agreementReports = $this->agreementFinanceReports($user, $ownerId);
        $agreementsByTenancy = collect($agreementReports)->keyBy('tenancy_id');
        $sumOf = fn (array $agreement, string $chargeType) => collect($agreement['payment_records'] ?? [])
            ->where('charge_type', $chargeType)
            ->sum(fn ($payment) => (float) $payment['amount']);
        $reportTotals = collect($agreementReports)->reduce(fn (array $totals, array $agreement) => [
            'paid' => $totals['paid'] + (float) $agreement['total_paid'],
            'deposits_received' => $totals['deposits_received'] + $sumOf($agreement, 'deposit'),
            'rent_received' => $totals['rent_received'] + $sumOf($agreement, 'rent'),
            'taxable_rent' => $totals['taxable_rent'] + (float) $agreement['taxable_rent'],
            'vat_collected' => $totals['vat_collected'] + (float) $agreement['vat_collected'],
            'vat_unrecorded_payments' => $totals['vat_unrecorded_payments'] + (int) $agreement['vat_unrecorded_payments'],
            'deposit_credit' => $totals['deposit_credit'] + (float) $agreement['deposit_credit'],
        ], ['paid' => 0, 'deposits_received' => 0, 'rent_received' => 0, 'taxable_rent' => 0, 'vat_collected' => 0, 'vat_unrecorded_payments' => 0, 'deposit_credit' => 0]);
        // Q.R.A commission: each managed owner's rate on the rent actually collected
        // (deposits are refundable, so they are never commissioned).
        $managedRent = RentPayment::query()
            ->whereHas('charge', fn ($charge) => $charge->where('charge_type', 'rent'))
            ->whereHas('charge.tenancy.unit.property', fn ($query) => $query
                ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id))
                ->when($ownerId, fn ($query) => $query->where('owner_id', $ownerId))
                ->whereHas('owner', fn ($owner) => $owner->where('role', 'owner')->whereNotNull('created_by')))
            ->with('charge.tenancy.unit.property.owner:id,role,created_by,management_fee_percent')
            ->get(['id', 'rent_charge_id', 'amount']);
        $reportTotals['managed_rent'] = round($managedRent->sum(fn ($payment) => (float) $payment->amount), 2);
        $reportTotals['commission'] = round($managedRent->sum(fn ($payment) => (float) $payment->amount
            * ($payment->charge?->tenancy?->unit?->property?->owner?->managementFeeRate() ?? 0) / 100), 2);
        $reportTotals['owner_payout'] = round($reportTotals['managed_rent'] - $reportTotals['commission'], 2);

        $matchingPayments = RentPayment::query()
            ->whereHas('charge.tenancy.unit.property', fn ($query) => $query
                ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id))
                ->when($ownerId, fn ($query) => $query->where('owner_id', $ownerId)))
            ->when($type !== 'all', fn ($query) => $query->whereHas('charge', fn ($charge) => $charge->where('charge_type', $type)))
            ->when($method, fn ($query) => $query->where('method', $method))
            ->when($search !== '', function ($query) use ($search) {
                $term = '%'.$search.'%';
                $query->where(function ($query) use ($term) {
                    $query->where('receipt_number', 'like', $term)
                        ->orWhere('reference', 'like', $term)
                        ->orWhere('notes', 'like', $term)
                        ->orWhereHas('charge.tenancy.tenant', fn ($query) => $query->where('name', 'like', $term))
                        ->orWhereHas('charge.tenancy.unit', fn ($query) => $query->where('unit_number', 'like', $term))
                        ->orWhereHas('charge.tenancy.unit.property', fn ($query) => $query->where('name', 'like', $term))
                        ->orWhereHas('charge.tenancy.leases', fn ($query) => $query->where('reference_number', 'like', $term));
                });
            });
        $payments = (clone $matchingPayments)
            ->select('transaction_id')
            ->selectRaw('MAX(paid_at) as latest_paid_at, SUM(amount) as total_amount')
            ->groupBy('transaction_id')
            ->orderBy($sort === 'amount' ? 'total_amount' : 'latest_paid_at', $direction)
            ->orderByDesc('latest_paid_at')
            ->paginate($perPage)
            ->withQueryString();
        $transactionIds = collect($payments->items())->pluck('transaction_id');
        $allocationsByTransaction = RentPayment::query()
            ->with([
                'charge.tenancy.tenant',
                'charge.tenancy.unit.property.owner:id,role,created_by,management_fee_percent',
                'charge.tenancy.leases' => fn ($query) => $query->oldest('id'),
            ])
            ->whereIn('transaction_id', $transactionIds)
            ->orderBy('id')
            ->get()
            ->groupBy('transaction_id');
        $payments->setCollection($transactionIds->map(function (string $transactionId) use ($allocationsByTransaction, $agreementsByTenancy) {
            $allocations = $allocationsByTransaction->get($transactionId, collect());
            $payment = $allocations->first();
            $charge = $payment->charge;
            $tenancy = $charge->tenancy;
            $unit = $tenancy->unit;
            $agreement = $agreementsByTenancy->get($tenancy->id, []);
            // VAT applies to rent only; a refundable deposit carries none.
            $taxedAllocations = $allocations->filter(fn ($allocation) => $allocation->charge?->charge_type === 'rent');
            $taxedAllocations = $taxedAllocations->isEmpty() ? $allocations : $taxedAllocations;
            $vatIsRecorded = $taxedAllocations->every(fn ($allocation) => $allocation->vat_amount !== null);
            $feeRate = $unit->property?->owner?->managementFeeRate() ?? 0;
            $rentPart = $allocations->filter(fn ($allocation) => $allocation->charge?->charge_type === 'rent')->sum(fn ($allocation) => (float) $allocation->amount);
            $commission = $feeRate > 0 && $rentPart > 0 ? round($rentPart * $feeRate / 100, 2) : null;
            $periods = $allocations->map(function ($allocation) {
                $charge = $allocation->charge;

                return [
                    'charge_type' => $charge->charge_type,
                    'period_label' => $charge->period_start && $charge->period_end
                        ? $charge->period_start->format('d M Y').' – '.$charge->period_end->format('d M Y')
                        : null,
                ];
            });

            return [
                'id' => $payment->id,
                'amount' => number_format($allocations->sum(fn ($allocation) => (float) $allocation->amount), 2, '.', ''),
                'taxable_amount' => $vatIsRecorded
                    ? number_format($taxedAllocations->sum(fn ($allocation) => (float) $allocation->taxable_amount), 2, '.', '')
                    : null,
                'vat_rate' => $taxedAllocations->first()?->vat_rate ?? $payment->vat_rate,
                'vat_amount' => $vatIsRecorded
                    ? number_format($taxedAllocations->sum(fn ($allocation) => (float) $allocation->vat_amount), 2, '.', '')
                    : null,
                'commission' => $commission,
                'commission_rate' => $feeRate > 0 ? $feeRate : null,
                'owner_share' => $commission !== null ? round($rentPart - $commission, 2) : null,
                'method' => $payment->method,
                'receipt_number' => $allocations->first(fn ($allocation) => $allocation->receipt_number)?->receipt_number,
                'reference' => $payment->reference,
                'notes' => $payment->notes,
                'paid_at' => $payment->paid_at,
                'allocations' => $allocations->map(function ($allocation) {
                    $charge = $allocation->charge;

                    return [
                        'id' => $allocation->id,
                        'amount' => $allocation->amount,
                        'taxable_amount' => $allocation->taxable_amount,
                        'vat_rate' => $allocation->vat_rate,
                        'vat_amount' => $allocation->vat_amount,
                        'receipt_number' => $allocation->receipt_number,
                        'reference' => $allocation->reference,
                        'paid_at' => $allocation->paid_at,
                        'notes' => $allocation->notes,
                        'charge' => [
                            'charge_type' => $charge->charge_type,
                            'period_label' => $charge->period_start && $charge->period_end
                                ? $charge->period_start->format('d M Y').' – '.$charge->period_end->format('d M Y')
                                : null,
                        ],
                    ];
                })->values(),
                'period_labels' => $periods->pluck('period_label')->filter()->unique()->values(),
                'charge' => [
                    'charge_type' => $periods->pluck('charge_type')->unique()->count() > 1
                        ? 'combined'
                        : $charge->charge_type,
                    'period_label' => $periods->pluck('period_label')->filter()->unique()->implode(', '),
                ],
                'tenant' => ['name' => $tenancy->tenant?->name],
                'property' => ['name' => $unit->property?->name],
                'unit' => ['unit_number' => $unit->unit_number],
                'agreement' => [
                    'reference' => $tenancy->leases->first()?->reference_number,
                    'total_paid' => $agreement['total_paid'] ?? '0.00',
                    'deposit_credit' => $agreement['deposit_credit'] ?? '0.00',
                ],
            ];
        }));

        return Inertia::render('Payments/Index', [
            'payments' => $payments,
            'reportTotals' => $reportTotals,
            'filters' => ['search' => $search, 'owner_id' => $ownerId, 'type' => $type, 'method' => $method, 'sort' => $sort, 'direction' => $direction, 'per_page' => $perPage],
            'isAdmin' => $user->isAdmin(),
            'owners' => $this->ownerOptions($user),
            'vatRate' => config('finance.rwanda_vat_rate'),
        ]);
    }

    public function reports(Request $request): JsonResponse|Response
    {
        $user = $request->user();
        $ownerId = $this->ownerFilter($request, $user);
        $propertyScope = fn ($query) => $query
            ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id))
            ->when($ownerId, fn ($query) => $query->where('owner_id', $ownerId));
        $propertiesQuery = Property::query()
            ->where($propertyScope);
        $chargeQuery = RentCharge::query()
            ->whereNull('voided_at')
            ->whereIn('charge_type', ['rent', 'damage'])
            ->whereHas('tenancy.unit.property', $propertyScope);
        $activeTenancies = Tenancy::query()
            ->where('status', 'active')
            ->whereHas('unit.property', $propertyScope);

        $paymentsQuery = RentPayment::query()
            ->whereHas('charge.tenancy.unit.property', $propertyScope);
        $chargePaymentsQuery = RentPayment::query()
            ->whereHas('charge', fn ($query) => $query
                ->whereIn('charge_type', ['rent', 'damage'])
                ->whereHas('tenancy.unit.property', $propertyScope));

        $properties = $propertiesQuery
            ->withCount([
                'units',
                'units as occupied_units_count' => fn ($query) => $query->where('status', 'occupied'),
                'units as available_units_count' => fn ($query) => $query->where('status', 'available'),
            ])
            ->with(['units.activeTenancy.tenant'])
            ->orderBy('name')
            ->get()
            ->map(fn (Property $property) => [
                'id' => $property->id,
                'name' => $property->name,
                'units_count' => $property->units_count,
                'occupied_units_count' => $property->occupied_units_count,
                'available_units_count' => $property->available_units_count,
                'occupancy_rate' => $property->units_count
                    ? round(($property->occupied_units_count / $property->units_count) * 100)
                    : 0,
                'active_tenants' => $property->units
                    ->filter(fn ($unit) => $unit->activeTenancy)
                    ->map(fn ($unit) => [
                        'tenant' => $unit->activeTenancy->tenant?->name,
                        'unit' => $unit->unit_number,
                        'rent' => $unit->activeTenancy->monthly_rent,
                    ])
                    ->values(),
            ])
            ->values();

        $collectedThisMonth = (clone $paymentsQuery)
            ->whereMonth('paid_at', now()->month)
            ->whereYear('paid_at', now()->year)
            ->sum('amount');
        $agreementReports = $this->agreementFinanceReports($user, $ownerId);

        $report = [
            'summary' => [
                'properties' => $properties->count(),
                'units' => $properties->sum('units_count'),
                'occupied_units' => $properties->sum('occupied_units_count'),
                'occupancy_rate' => $properties->sum('units_count')
                    ? round(($properties->sum('occupied_units_count') / $properties->sum('units_count')) * 100)
                    : 0,
                'active_leases' => (clone $activeTenancies)->count(),
                'expiring_leases' => (clone $activeTenancies)
                    ->whereNotNull('end_date')
                    ->whereBetween('end_date', [today(), today()->addDays(30)])
                    ->count(),
                'charges_total' => (clone $chargeQuery)->sum('amount'),
                'payments_received' => (clone $paymentsQuery)->sum('amount'),
                'remaining_charges' => max(
                    0,
                    (float) (clone $chargeQuery)->sum('amount') - (float) (clone $chargePaymentsQuery)->sum('amount'),
                ),
                'past_due_charges' => max(
                    0,
                    (float) (clone $chargeQuery)->whereDate('due_date', '<', today())->sum('amount')
                    - (float) (clone $chargePaymentsQuery)->whereHas('charge', fn ($query) => $query->whereDate('due_date', '<', today()))->sum('amount'),
                ),
                'collected_this_month' => $collectedThisMonth,
            ],
            'properties' => $properties,
            'agreementReports' => $agreementReports,
            'managementFee' => $this->managementFeeReport($user, $ownerId),
            'isAdmin' => $user->isAdmin(),
            'owners' => $this->ownerOptions($user),
            'filters' => ['owner_id' => $ownerId],
            'vatRate' => config('finance.rwanda_vat_rate'),
        ];

        if ($request->expectsJson()) {
            return response()->json($report);
        }

        return Inertia::render('Reports/Index', $report);
    }

    /**
     * Q.R.A's management fee on the rent it collects for managed owners, month
     * by month for the last 12 months: rent collected, fee kept, owner's payout.
     * Only rent counts; deposits and damage charges are excluded. Returns null
     * when nobody in view pays a management fee.
     */
    private function managementFeeReport(User $user, ?int $ownerId): ?array
    {
        $owners = User::query()
            ->where('role', 'owner')
            ->whereNotNull('created_by')
            ->when(! $user->isAdmin(), fn ($query) => $query->whereKey($user->id))
            ->when($ownerId, fn ($query) => $query->whereKey($ownerId))
            ->get(['id', 'name', 'created_by', 'role', 'management_fee_percent'])
            ->keyBy('id');

        if ($owners->isEmpty()) {
            return null;
        }

        $since = now()->startOfMonth()->subMonths(11);
        $payments = RentPayment::query()
            ->where('paid_at', '>=', $since)
            ->whereHas('charge', fn ($query) => $query
                ->where('charge_type', 'rent')
                ->whereNull('voided_at')
                ->whereHas('tenancy.unit.property', fn ($property) => $property->whereIn('owner_id', $owners->keys())))
            ->with('charge.tenancy.unit.property:id,owner_id')
            ->get(['id', 'rent_charge_id', 'amount', 'paid_at']);

        $byMonth = $payments->groupBy(fn (RentPayment $payment) => $payment->paid_at->format('Y-m'));
        $months = collect(range(0, 11))->map(function (int $offset) use ($since, $byMonth, $owners) {
            $month = $since->copy()->addMonths($offset)->format('Y-m');
            $collected = 0.0;
            $fee = 0.0;

            foreach ($byMonth->get($month, collect()) as $payment) {
                $owner = $owners->get($payment->charge?->tenancy?->unit?->property?->owner_id);
                $amount = (float) $payment->amount;
                $collected += $amount;
                $fee += $amount * ($owner?->managementFeeRate() ?? 0) / 100;
            }

            return [
                'month' => $month,
                'collected' => round($collected, 2),
                'fee' => round($fee, 2),
                'net' => round($collected - $fee, 2),
            ];
        })->reverse()->values();

        $rates = $owners->map(fn (User $owner) => $owner->managementFeeRate())->unique()->values();

        return [
            'rate' => $rates->count() === 1 ? $rates->first() : null,
            'owners' => $owners->count(),
            'months' => $months,
            'totals' => [
                'collected' => round($months->sum('collected'), 2),
                'fee' => round($months->sum('fee'), 2),
                'net' => round($months->sum('net'), 2),
            ],
        ];
    }

    private function ownerFilter(Request $request, $user): ?int
    {
        if (! $user->isAdmin()) {
            return null;
        }

        $validated = $request->validate([
            'owner_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'owner')),
            ],
        ]);

        return isset($validated['owner_id']) ? (int) $validated['owner_id'] : null;
    }

    private function ownerOptions($user)
    {
        return $user->isAdmin()
            ? User::query()->where('role', 'owner')->orderBy('name')->get(['id', 'name'])
            : collect();
    }

    private function agreementFinanceReports($user, ?int $ownerId = null): array
    {
        $tenancies = Tenancy::query()
            ->with([
                'tenant:id,name',
                'unit:id,property_id,unit_number',
                'unit.property:id,name,owner_id',
                'leases' => fn ($query) => $query->oldest('id'),
                'rentCharges.payments',
                'moveOutInspection',
            ])
            ->whereHas('unit.property', fn ($query) => $query
                ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id))
                ->when($ownerId, fn ($query) => $query->where('owner_id', $ownerId)))
            ->orderByDesc('start_date')
            ->get();

        $tenanciesById = $tenancies->keyBy('id');
        $rootIds = [];
        foreach ($tenancies as $tenancy) {
            $root = $tenancy;
            while ($root->renewed_from_id && $tenanciesById->has($root->renewed_from_id)) {
                $root = $tenanciesById->get($root->renewed_from_id);
            }
            $rootIds[$tenancy->id] = $root->id;
        }

        $chainsByRoot = $tenancies->groupBy(fn (Tenancy $tenancy) => $rootIds[$tenancy->id]);
        $today = CarbonImmutable::today();

        return $tenancies->map(function (Tenancy $tenancy) use ($chainsByRoot, $rootIds, $today) {
            /** @var Collection<int, Tenancy> $chain */
            $chain = $chainsByRoot->get($rootIds[$tenancy->id], collect());
            $isLatestAgreement = $chain->max('id') === $tenancy->id;
            $depositReceivedCents = 0;
            $depositAppliedToRentCents = 0;

            foreach ($chain as $linkedTenancy) {
                foreach ($linkedTenancy->rentCharges as $charge) {
                    if ($charge->charge_type === 'deposit') {
                        $depositReceivedCents += (int) round(
                            (float) $charge->payments->sum('amount') * 100,
                        );
                    }
                    if ($charge->charge_type === 'rent') {
                        // Only rent actually taken from the deposit reduces it (nightly stays);
                        // monthly rent is paid separately and the deposit stays aside.
                        $depositAppliedToRentCents += (int) round(
                            (float) $charge->payments
                                ->filter(fn ($payment) => str_starts_with((string) $payment->notes, TenancyController::DEPOSIT_FUNDED_RENT_NOTE))
                                ->sum('amount') * 100,
                        );
                    }
                }
            }

            $inspection = $chain->first(fn (Tenancy $linkedTenancy) => $linkedTenancy->moveOutInspection);
            $damageCostCents = $inspection
                ? (int) round((float) ($inspection->moveOutInspection->damage_cost ?? $inspection->moveOutInspection->deposit_deducted) * 100)
                : 0;
            $refundCents = $inspection
                ? (int) round((float) $inspection->moveOutInspection->deposit_refunded * 100)
                : 0;
            $totalPaidCents = $tenancy->rentCharges
                ->flatMap(fn ($charge) => $charge->payments)
                ->sum(fn ($payment) => (int) round((float) $payment->amount * 100));
            $paymentRecords = $tenancy->rentCharges
                ->flatMap(fn ($charge) => $charge->payments->map(fn ($payment) => [
                    'payment' => $payment,
                    'charge_type' => $charge->charge_type,
                ]))
                ->sortBy(fn ($record) => $record['payment']->paid_at)
                ->map(function ($record) {
                    $payment = $record['payment'];
                    $chargeType = $record['charge_type'];

                    return [
                        'id' => $payment->id,
                        'amount' => $payment->amount,
                        'charge_type' => $chargeType,
                        'taxable_amount' => $payment->taxable_amount,
                        'vat_rate' => $payment->vat_rate,
                        'vat_amount' => $payment->vat_amount,
                        'method' => $payment->method,
                        'receipt_number' => $payment->receipt_number,
                        'reference' => $payment->reference,
                        'paid_at' => $payment->paid_at,
                        'notes' => $payment->notes,
                    ];
                })
                ->values()
                ->all();
            $taxableRentCents = collect($paymentRecords)
                ->filter(fn ($payment) => $payment['charge_type'] === 'rent')
                ->sum(fn ($payment) => $payment['taxable_amount'] === null
                    ? 0
                    : (int) round((float) $payment['taxable_amount'] * 100));
            $vatCollectedCents = collect($paymentRecords)
                ->sum(fn ($payment) => $payment['vat_amount'] === null
                    ? 0
                    : (int) round((float) $payment['vat_amount'] * 100));
            $vatUnrecordedPayments = collect($paymentRecords)
                ->filter(fn ($payment) => $payment['vat_amount'] === null)
                ->count();
            $endDate = $tenancy->end_date
                ? CarbonImmutable::parse($tenancy->end_date)->startOfDay()
                : null;

            return [
                'tenancy_id' => $tenancy->id,
                'property_id' => $tenancy->unit?->property_id,
                'unit_id' => $tenancy->unit_id,
                'agreement_id' => $tenancy->leases->first()?->reference_number,
                'tenant' => $tenancy->tenant?->name,
                'property' => $tenancy->unit?->property?->name,
                'unit' => $tenancy->unit?->unit_number,
                'start_date' => $tenancy->start_date?->toDateString(),
                'end_date' => $endDate?->toDateString(),
                'status' => $tenancy->status,
                'days_remaining' => $endDate ? max(0, (int) $today->diffInDays($endDate, false)) : null,
                'total_paid' => number_format($totalPaidCents / 100, 2, '.', ''),
                'taxable_rent' => number_format($taxableRentCents / 100, 2, '.', ''),
                'vat_collected' => number_format($vatCollectedCents / 100, 2, '.', ''),
                'vat_unrecorded_payments' => $vatUnrecordedPayments,
                'payment_records' => $paymentRecords,
                'deposit_credit' => number_format(
                    ($isLatestAgreement
                        ? max(0, $depositReceivedCents - $depositAppliedToRentCents - min($damageCostCents, $depositReceivedCents) - $refundCents)
                        : 0) / 100,
                    2,
                    '.',
                    '',
                ),
            ];
        })->values()->all();
    }
}
