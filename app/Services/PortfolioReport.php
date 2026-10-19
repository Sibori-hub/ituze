<?php

namespace App\Services;

use App\Models\RentCharge;
use App\Models\RentPayment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Figures behind the Reports tabs: money in a chosen period, who owes what,
 * and what each owner is due. Everything is limited to the properties the
 * viewer may see (an owner sees only their own; an admin all, or one owner).
 */
class PortfolioReport
{
    public const PRESETS = ['this_month', 'last_month', 'this_quarter', 'this_year', 'last_12_months', 'custom'];

    public function __construct(private User $user, private ?int $ownerId = null)
    {
    }

    /**
     * @return array{preset: string, from: CarbonImmutable, to: CarbonImmutable}
     */
    public static function period(?string $preset, ?string $from = null, ?string $to = null): array
    {
        $today = CarbonImmutable::today();
        $preset = in_array($preset, self::PRESETS, true) ? $preset : 'this_month';

        [$start, $end] = match ($preset) {
            'last_month' => [$today->subMonthNoOverflow()->startOfMonth(), $today->subMonthNoOverflow()->endOfMonth()],
            'this_quarter' => [$today->startOfQuarter(), $today->endOfQuarter()],
            'this_year' => [$today->startOfYear(), $today->endOfYear()],
            'last_12_months' => [$today->subMonthsNoOverflow(11)->startOfMonth(), $today->endOfMonth()],
            'custom' => [
                $from ? CarbonImmutable::parse($from)->startOfDay() : $today->startOfMonth(),
                $to ? CarbonImmutable::parse($to)->startOfDay() : $today,
            ],
            default => [$today->startOfMonth(), $today->endOfMonth()],
        };

        return ['preset' => $preset, 'from' => $start->startOfDay(), 'to' => $end->startOfDay()];
    }

    /** Payments joined to their property, limited to what the viewer may see. */
    private function paymentsQuery(): Builder
    {
        return RentPayment::query()
            ->join('rent_charges', 'rent_charges.id', '=', 'rent_payments.rent_charge_id')
            ->join('tenancies', 'tenancies.id', '=', 'rent_charges.tenancy_id')
            ->join('units', 'units.id', '=', 'tenancies.unit_id')
            ->join('properties', 'properties.id', '=', 'units.property_id')
            ->when(! $this->user->isAdmin(), fn ($query) => $query->where('properties.owner_id', $this->user->id))
            ->when($this->ownerId, fn ($query) => $query->where('properties.owner_id', $this->ownerId));
    }

    private function chargesQuery(): Builder
    {
        return RentCharge::query()
            ->join('tenancies', 'tenancies.id', '=', 'rent_charges.tenancy_id')
            ->join('units', 'units.id', '=', 'tenancies.unit_id')
            ->join('properties', 'properties.id', '=', 'units.property_id')
            ->whereNull('rent_charges.voided_at')
            ->when(! $this->user->isAdmin(), fn ($query) => $query->where('properties.owner_id', $this->user->id))
            ->when($this->ownerId, fn ($query) => $query->where('properties.owner_id', $this->ownerId));
    }

    /** Money received in the period per owner and charge type. */
    private function receivedByOwner(CarbonImmutable $from, CarbonImmutable $to): Collection
    {
        return $this->paymentsQuery()
            ->whereBetween('rent_payments.paid_at', [$from->startOfDay(), $to->endOfDay()])
            ->groupBy('properties.owner_id', 'rent_charges.charge_type')
            ->get([
                'properties.owner_id',
                'rent_charges.charge_type',
                DB::raw('SUM(rent_payments.amount) as total'),
                DB::raw('SUM(COALESCE(rent_payments.vat_amount, 0)) as vat'),
            ]);
    }

    /** @return Collection<int, User> */
    private function ownersById(Collection $ids): Collection
    {
        return User::query()
            ->whereKey($ids->filter()->unique()->values())
            ->get(['id', 'name', 'email', 'phone', 'role', 'created_by', 'management_fee_percent'])
            ->keyBy('id');
    }

    public function overview(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $received = $this->receivedByOwner($from, $to);
        $owners = $this->ownersById($received->pluck('owner_id'));
        $sumOf = fn (string $type) => (float) $received->where('charge_type', $type)->sum('total');
        $rent = $sumOf('rent');
        $commission = $received->where('charge_type', 'rent')
            ->sum(fn ($row) => (float) $row->total * ($owners->get($row->owner_id)?->managementFeeRate() ?? 0) / 100);

        // Rent that fell due in the period, and how much of it has been paid so far.
        $dueCharges = $this->chargesQuery()
            ->where('rent_charges.charge_type', 'rent')
            ->whereBetween('rent_charges.due_date', [$from->toDateString(), $to->toDateString()]);
        $expected = (float) (clone $dueCharges)->sum('rent_charges.amount');
        $paidTowardDue = (float) RentPayment::query()
            ->whereIn('rent_charge_id', (clone $dueCharges)->select('rent_charges.id'))
            ->sum('amount');

        return [
            'rent_collected' => round($rent, 2),
            'deposits_received' => round($sumOf('deposit'), 2),
            'other_collected' => round((float) $received->whereNotIn('charge_type', ['rent', 'deposit'])->sum('total'), 2),
            'total_received' => round((float) $received->sum('total'), 2),
            'vat' => round((float) $received->where('charge_type', 'rent')->sum('vat'), 2),
            'commission' => round($commission, 2),
            'rent_expected' => round($expected, 2),
            'rent_paid_of_expected' => round(min($paidTowardDue, $expected), 2),
            'collection_rate' => $expected > 0 ? (int) round(min($paidTowardDue, $expected) / $expected * 100) : null,
            'arrears' => round($this->arrearsTotal(), 2),
            'months' => $this->monthlySeries($to),
        ];
    }

    /** Rent collected vs rent due for the 12 months ending with the period. */
    private function monthlySeries(CarbonImmutable $to): array
    {
        $start = $to->startOfMonth()->subMonthsNoOverflow(11);
        $end = $to->endOfMonth();
        $collected = $this->paymentsQuery()
            ->where('rent_charges.charge_type', 'rent')
            ->whereBetween('rent_payments.paid_at', [$start, $end])
            ->get(['rent_payments.paid_at', 'rent_payments.amount'])
            ->groupBy(fn ($row) => CarbonImmutable::parse($row->paid_at)->format('Y-m'))
            ->map(fn ($rows) => $rows->sum(fn ($row) => (float) $row->amount));
        $expected = $this->chargesQuery()
            ->where('rent_charges.charge_type', 'rent')
            ->whereBetween('rent_charges.due_date', [$start->toDateString(), $end->toDateString()])
            ->get(['rent_charges.due_date', 'rent_charges.amount'])
            ->groupBy(fn ($row) => CarbonImmutable::parse($row->due_date)->format('Y-m'))
            ->map(fn ($rows) => $rows->sum(fn ($row) => (float) $row->amount));

        return collect(range(0, 11))->map(function (int $offset) use ($start, $collected, $expected) {
            $month = $start->addMonthsNoOverflow($offset)->format('Y-m');

            return [
                'month' => $month,
                'collected' => round((float) $collected->get($month, 0), 2),
                'expected' => round((float) $expected->get($month, 0), 2),
            ];
        })->all();
    }

    /** Unpaid rent and damage charges whose due date has passed. */
    private function overdueCharges(): Builder
    {
        return $this->chargesQuery()
            ->whereIn('rent_charges.charge_type', ['rent', 'damage'])
            ->whereDate('rent_charges.due_date', '<', CarbonImmutable::today()->toDateString())
            ->whereRaw('rent_charges.amount > (SELECT COALESCE(SUM(rp.amount), 0) FROM rent_payments rp WHERE rp.rent_charge_id = rent_charges.id) + 0.004');
    }

    private function arrearsTotal(): float
    {
        return (float) $this->overdueCharges()
            ->get(['rent_charges.amount', DB::raw('(SELECT COALESCE(SUM(rp.amount), 0) FROM rent_payments rp WHERE rp.rent_charge_id = rent_charges.id) as paid')])
            ->sum(fn ($charge) => (float) $charge->amount - (float) $charge->paid);
    }

    /**
     * One row per lease with overdue money, oldest debt first in each row,
     * split into how late it is: 1–30, 31–60, 61–90 and over 90 days.
     */
    public function arrears(): array
    {
        $today = CarbonImmutable::today();
        $charges = $this->overdueCharges()
            ->join('tenants', 'tenants.id', '=', 'tenancies.tenant_id')
            ->get([
                'rent_charges.id', 'rent_charges.tenancy_id', 'rent_charges.charge_type', 'rent_charges.due_date', 'rent_charges.amount',
                DB::raw('(SELECT COALESCE(SUM(rp.amount), 0) FROM rent_payments rp WHERE rp.rent_charge_id = rent_charges.id) as paid'),
                'tenancies.status as tenancy_status', 'tenancies.unit_id',
                'tenants.id as tenant_id', 'tenants.name as tenant_name', 'tenants.phone as tenant_phone', 'tenants.email as tenant_email',
                'units.unit_number', 'units.property_id', 'properties.name as property_name',
            ]);

        $rows = $charges->groupBy('tenancy_id')->map(function (Collection $items) use ($today) {
            $first = $items->first();
            $buckets = ['d30' => 0.0, 'd60' => 0.0, 'd90' => 0.0, 'over90' => 0.0];
            foreach ($items as $charge) {
                $owed = (float) $charge->amount - (float) $charge->paid;
                $late = CarbonImmutable::parse($charge->due_date)->diffInDays($today);
                $buckets[$late <= 30 ? 'd30' : ($late <= 60 ? 'd60' : ($late <= 90 ? 'd90' : 'over90'))] += $owed;
            }
            $oldest = $items->min(fn ($charge) => CarbonImmutable::parse($charge->due_date)->toDateString());

            return [
                'tenancy_id' => $first->tenancy_id,
                'tenancy_status' => $first->tenancy_status,
                'tenant' => ['id' => $first->tenant_id, 'name' => $first->tenant_name, 'phone' => $first->tenant_phone, 'email' => $first->tenant_email],
                'property' => ['id' => $first->property_id, 'name' => $first->property_name],
                'unit' => ['id' => $first->unit_id, 'unit_number' => $first->unit_number],
                'charges' => $items->count(),
                'oldest_due' => $oldest,
                'days_late' => (int) CarbonImmutable::parse($oldest)->diffInDays($today),
                'buckets' => array_map(fn ($value) => round($value, 2), $buckets),
                'total' => round(array_sum($buckets), 2),
            ];
        })->sortByDesc('total')->values();

        return [
            'rows' => $rows->all(),
            'totals' => [
                'tenants' => $rows->count(),
                'total' => round($rows->sum('total'), 2),
                'd30' => round($rows->sum('buckets.d30'), 2),
                'd60' => round($rows->sum('buckets.d60'), 2),
                'd90' => round($rows->sum('buckets.d90'), 2),
                'over90' => round($rows->sum('buckets.over90'), 2),
            ],
        ];
    }

    /**
     * What each owner received in the period: rent, Q.R.A commission (managed
     * owners only) and the payout due. With a single owner in view, the rent
     * payments behind the figures are listed too, one line per payment.
     */
    public function ownerStatements(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $received = $this->receivedByOwner($from, $to)->groupBy('owner_id');
        $ownerIds = DB::table('properties')
            ->when(! $this->user->isAdmin(), fn ($query) => $query->where('owner_id', $this->user->id))
            ->when($this->ownerId, fn ($query) => $query->where('owner_id', $this->ownerId))
            ->distinct()
            ->pluck('owner_id');
        $owners = $this->ownersById($ownerIds);
        $propertyCounts = DB::table('properties')->whereIn('owner_id', $owners->keys())
            ->groupBy('owner_id')->selectRaw('owner_id, COUNT(*) as total')->pluck('total', 'owner_id');

        $rows = $owners->map(function (User $owner) use ($received, $propertyCounts) {
            $mine = $received->get($owner->id, collect());
            $rent = (float) $mine->where('charge_type', 'rent')->sum('total');
            $rate = $owner->managementFeeRate();
            $commission = round($rent * $rate / 100, 2);

            return [
                'owner' => ['id' => $owner->id, 'name' => $owner->name, 'email' => $owner->email, 'phone' => $owner->phone, 'managed' => $rate > 0],
                'properties' => (int) $propertyCounts->get($owner->id, 0),
                'rent_collected' => round($rent, 2),
                'vat' => round((float) $mine->where('charge_type', 'rent')->sum('vat'), 2),
                'commission_rate' => $rate > 0 ? $rate : null,
                'commission' => $commission,
                'payout' => round($rent - $commission, 2),
                'deposits_received' => round((float) $mine->where('charge_type', 'deposit')->sum('total'), 2),
                'other_collected' => round((float) $mine->whereNotIn('charge_type', ['rent', 'deposit'])->sum('total'), 2),
            ];
        })->sortBy(fn ($row) => mb_strtolower($row['owner']['name']))->values();

        $single = $owners->count() === 1 && (! $this->user->isAdmin() || $this->ownerId);

        return [
            'rows' => $rows->all(),
            'totals' => [
                'rent_collected' => round($rows->sum('rent_collected'), 2),
                'commission' => round($rows->sum('commission'), 2),
                'payout' => round($rows->sum('payout'), 2),
                'deposits_received' => round($rows->sum('deposits_received'), 2),
            ],
            'lines' => $single ? $this->statementLines($from, $to) : null,
        ];
    }

    /** Rent payments in the period, one line per payment (all months it covered). */
    private function statementLines(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return $this->paymentsQuery()
            ->join('tenants', 'tenants.id', '=', 'tenancies.tenant_id')
            ->where('rent_charges.charge_type', 'rent')
            ->whereBetween('rent_payments.paid_at', [$from->startOfDay(), $to->endOfDay()])
            ->orderBy('rent_payments.paid_at')
            ->get([
                'rent_payments.id', 'rent_payments.transaction_id', 'rent_payments.receipt_number', 'rent_payments.paid_at',
                'rent_payments.amount', 'rent_payments.method', 'rent_charges.period_start', 'rent_charges.period_end',
                'tenants.name as tenant_name', 'properties.name as property_name', 'units.unit_number',
            ])
            ->groupBy(fn ($row) => $row->transaction_id ?: 'payment-'.$row->id)
            ->map(function (Collection $items) {
                $first = $items->first();

                return [
                    'id' => $first->id,
                    'paid_at' => CarbonImmutable::parse($first->paid_at)->toDateString(),
                    'receipt_number' => $items->pluck('receipt_number')->filter()->first(),
                    'tenant' => $first->tenant_name,
                    'property' => $first->property_name,
                    'unit' => $first->unit_number,
                    'method' => $first->method,
                    'months' => $items->count(),
                    'period_start' => $items->min('period_start') ? CarbonImmutable::parse($items->min('period_start'))->toDateString() : null,
                    'period_end' => $items->max('period_end') ? CarbonImmutable::parse($items->max('period_end'))->toDateString() : null,
                    'amount' => round($items->sum(fn ($row) => (float) $row->amount), 2),
                ];
            })
            ->values()
            ->all();
    }
}
