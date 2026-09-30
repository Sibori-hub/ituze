<?php

namespace App\Http\Controllers;

use App\Models\Lease;
use App\Models\Property;
use App\Models\RentCharge;
use App\Models\RentPayment;
use App\Models\Tenancy;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ManagementController extends Controller
{
    public function leases(Request $request): Response
    {
        $user = $request->user();
        $ownerId = $this->ownerFilter($request, $user);
        $leases = Lease::query()
            ->with(['tenancy.tenant', 'tenancy.unit.property', 'tenancy.rentCharges.payments'])
            ->whereHas('tenancy.unit.property', fn ($query) => $query
                ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id))
                ->when($ownerId, fn ($query) => $query->where('owner_id', $ownerId)))
            ->latest()
            ->paginate(15)
            ->withQueryString();

        $leases->through(function (Lease $lease) {
            $tenancy = $lease->tenancy;
            $endDate = $tenancy?->end_date
                ? CarbonImmutable::parse($tenancy->end_date)->startOfDay()
                : null;
            $daysRemaining = $endDate
                ? (int) CarbonImmutable::today()->diffInDays($endDate, false)
                : null;
            $startDate = $tenancy?->start_date
                ? CarbonImmutable::parse($tenancy->start_date)->startOfDay()
                : null;

            $termStatus = match ($tenancy?->status) {
                'scheduled' => 'Scheduled',
                'ended' => 'Ended',
                'cancelled' => 'Cancelled',
                default => match (true) {
                    ! $endDate => 'Ongoing',
                    $daysRemaining < 0 => 'Expired',
                    $daysRemaining <= 30 => 'Expiring soon',
                    default => 'Active',
                },
            };
            $countdownLabel = match ($termStatus) {
                'Scheduled' => $startDate && $startDate->greaterThan(CarbonImmutable::today())
                    ? 'Starts in '.CarbonImmutable::today()->diffInDays($startDate).' days'
                    : 'Starts today',
                'Ended' => 'Ended '.($tenancy->actual_end_date?->format('Y-m-d') ?? $tenancy->end_date?->format('Y-m-d')),
                'Cancelled' => 'Lease cancelled',
                'Ongoing' => 'No end date',
                default => match (true) {
                    $daysRemaining < 0 => abs($daysRemaining).' days past end',
                    $daysRemaining === 0 => 'Ends today',
                    default => $daysRemaining.' days remaining',
                },
            };

            $dueCharges = $tenancy?->rentCharges
                ->filter(fn ($charge) => ! $charge->voided_at && $charge->due_date->lte(today()))
                ?? collect();
            $dueBalances = $dueCharges
                ->groupBy('charge_type')
                ->map(fn ($charges) => $charges->sum(function ($charge) {
                    $chargeCents = (int) round((float) $charge->amount * 100);
                    $paidCents = (int) round((float) $charge->payments->sum('amount') * 100);

                    return max(0, $chargeCents - $paidCents);
                }));
            $balanceCents = (int) $dueBalances->sum();
            $amountPaid = $dueCharges->sum(
                fn ($charge) => (float) $charge->payments->sum('amount'),
            );
            $rentBalance = (int) $dueBalances->get('rent', 0);
            $depositBalance = (int) $dueBalances->get('deposit', 0);
            $damageBalance = (int) $dueBalances->get('damage', 0);
            $hasOverdueCharge = $dueCharges->contains(
                fn ($charge) => $charge->due_date->lt(today())
                    && (int) round((float) $charge->amount * 100)
                        > (int) round((float) $charge->payments->sum('amount') * 100),
            );
            $paymentStatus = match (true) {
                $dueCharges->isEmpty() => 'Up to date',
                $balanceCents <= 0 => 'Paid',
                $hasOverdueCharge => 'Overdue',
                $amountPaid > 0 => 'Partially paid',
                default => 'Due',
            };

            $lease->setAttribute('days_remaining', $daysRemaining);
            $lease->setAttribute('term_status', $termStatus);
            $lease->setAttribute('countdown_label', $countdownLabel);
            $lease->setAttribute('payment_status', $paymentStatus);
            $lease->setAttribute('payment_balance', $balanceCents / 100);
            $lease->setAttribute('rent_due_balance', $rentBalance / 100);
            $lease->setAttribute('deposit_due_balance', $depositBalance / 100);
            $lease->setAttribute('damage_due_balance', $damageBalance / 100);

            return $lease;
        });

        return Inertia::render('Leases/Index', [
            'leases' => $leases,
            'isAdmin' => $user->isAdmin(),
            'owners' => $this->ownerOptions($user),
            'filters' => ['owner_id' => $ownerId],
        ]);
    }

    public function payments(Request $request): Response
    {
        $user = $request->user();
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
        ]);
        $ownerId = $this->ownerFilter($request, $user);
        $search = trim($validated['search'] ?? '');
        $agreementReports = $this->agreementFinanceReports($user, $ownerId);
        $agreementsByTenancy = collect($agreementReports)->keyBy('tenancy_id');
        $reportTotals = collect($agreementReports)->reduce(fn (array $totals, array $agreement) => [
            'paid' => $totals['paid'] + (float) $agreement['total_paid'],
            'taxable_rent' => $totals['taxable_rent'] + (float) $agreement['taxable_rent'],
            'vat_collected' => $totals['vat_collected'] + (float) $agreement['vat_collected'],
            'vat_unrecorded_payments' => $totals['vat_unrecorded_payments'] + (int) $agreement['vat_unrecorded_payments'],
            'deposit_credit' => $totals['deposit_credit'] + (float) $agreement['deposit_credit'],
        ], ['paid' => 0, 'taxable_rent' => 0, 'vat_collected' => 0, 'vat_unrecorded_payments' => 0, 'deposit_credit' => 0]);
        $matchingPayments = RentPayment::query()
            ->whereHas('charge.tenancy.unit.property', fn ($query) => $query
                ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id))
                ->when($ownerId, fn ($query) => $query->where('owner_id', $ownerId)))
            ->whereHas('charge', fn ($query) => $query->where('charge_type', '!=', 'deposit'))
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
            ->selectRaw('MAX(paid_at) as latest_paid_at')
            ->groupBy('transaction_id')
            ->orderByDesc('latest_paid_at')
            ->paginate(20)
            ->withQueryString();
        $transactionIds = collect($payments->items())->pluck('transaction_id');
        $allocationsByTransaction = RentPayment::query()
            ->with([
                'charge.tenancy.tenant',
                'charge.tenancy.unit.property',
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
            $vatIsRecorded = $allocations->every(fn ($allocation) => $allocation->vat_amount !== null);
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
                    ? number_format($allocations->sum(fn ($allocation) => (float) $allocation->taxable_amount), 2, '.', '')
                    : null,
                'vat_rate' => $payment->vat_rate,
                'vat_amount' => $vatIsRecorded
                    ? number_format($allocations->sum(fn ($allocation) => (float) $allocation->vat_amount), 2, '.', '')
                    : null,
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
            'filters' => ['search' => $search, 'owner_id' => $ownerId],
            'isAdmin' => $user->isAdmin(),
            'owners' => $this->ownerOptions($user),
            'vatRate' => config('finance.rwanda_vat_rate'),
        ]);
    }

    public function reports(Request $request): Response
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

        return Inertia::render('Reports/Index', [
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
            'isAdmin' => $user->isAdmin(),
            'owners' => $this->ownerOptions($user),
            'filters' => ['owner_id' => $ownerId],
            'vatRate' => config('finance.rwanda_vat_rate'),
        ]);
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
                        $depositAppliedToRentCents += (int) round(
                            (float) $charge->payments->sum('amount') * 100,
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
