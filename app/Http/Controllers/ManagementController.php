<?php

namespace App\Http\Controllers;

use App\Models\Lease;
use App\Models\Property;
use App\Models\RentCharge;
use App\Models\RentPayment;
use App\Models\Tenancy;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ManagementController extends Controller
{
    public function leases(Request $request): Response
    {
        $user = $request->user();
        $leases = Lease::query()
            ->with(['tenancy.tenant', 'tenancy.unit.property', 'tenancy.rentCharges.payments'])
            ->whereHas('tenancy.unit.property', fn ($query) => $query
                ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id)))
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
            $amountDue = (float) $dueCharges->sum('amount');
            $amountPaid = (float) $dueCharges->sum(
                fn ($charge) => $charge->payments->sum('amount'),
            );
            $balance = max(0, round($amountDue - $amountPaid, 2));
            $hasOverdueCharge = $dueCharges->contains(
                fn ($charge) => $charge->due_date->lt(today())
                    && (float) $charge->amount > (float) $charge->payments->sum('amount'),
            );
            $paymentStatus = match (true) {
                $dueCharges->isEmpty() => 'Up to date',
                $balance <= 0 => 'Paid',
                $hasOverdueCharge => 'Overdue',
                $amountPaid > 0 => 'Partially paid',
                default => 'Due',
            };

            $lease->setAttribute('days_remaining', $daysRemaining);
            $lease->setAttribute('term_status', $termStatus);
            $lease->setAttribute('countdown_label', $countdownLabel);
            $lease->setAttribute('payment_status', $paymentStatus);
            $lease->setAttribute('payment_balance', $balance);

            return $lease;
        });

        return Inertia::render('Leases/Index', ['leases' => $leases]);
    }

    public function payments(Request $request): Response
    {
        $user = $request->user();
        $status = $request->string('status')->value() ?: 'all';
        abort_unless(in_array($status, ['all', 'outstanding', 'paid', 'overdue'], true), 422);

        $charges = RentCharge::query()
            ->with(['payments' => fn ($query) => $query->latest('paid_at'), 'tenancy.tenant', 'tenancy.unit.property'])
            ->whereHas('tenancy.unit.property', fn ($query) => $query
                ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id)))
            ->when($status === 'outstanding', fn ($query) => $query
                ->whereNull('voided_at')
                ->whereRaw('(SELECT COALESCE(SUM(rent_payments.amount), 0) FROM rent_payments WHERE rent_payments.rent_charge_id = rent_charges.id) < rent_charges.amount'))
            ->when($status === 'paid', fn ($query) => $query
                ->whereNull('voided_at')
                ->whereRaw('(SELECT COALESCE(SUM(rent_payments.amount), 0) FROM rent_payments WHERE rent_payments.rent_charge_id = rent_charges.id) >= rent_charges.amount'))
            ->when($status === 'overdue', fn ($query) => $query
                ->whereNull('voided_at')
                ->whereDate('due_date', '<', today())
                ->whereRaw('(SELECT COALESCE(SUM(rent_payments.amount), 0) FROM rent_payments WHERE rent_payments.rent_charge_id = rent_charges.id) < rent_charges.amount'))
            ->latest('due_date')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Payments/Index', [
            'charges' => $charges,
            'filters' => ['status' => $status],
        ]);
    }

    public function reports(Request $request): Response
    {
        $user = $request->user();
        $propertiesQuery = Property::query()
            ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id));
        $chargeQuery = RentCharge::query()
            ->whereNull('voided_at')
            ->whereHas('tenancy.unit.property', fn ($query) => $query
                ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id)));
        $activeTenancies = Tenancy::query()
            ->where('status', 'active')
            ->whereHas('unit.property', fn ($query) => $query
                ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id)));

        $paymentsQuery = RentPayment::query()
            ->whereHas('charge.tenancy.unit.property', fn ($query) => $query
                ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id)));

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
                'outstanding_balance' => max(
                    0,
                    (float) (clone $chargeQuery)->sum('amount') - (float) (clone $paymentsQuery)->sum('amount'),
                ),
                'overdue_balance' => max(
                    0,
                    (float) (clone $chargeQuery)->whereDate('due_date', '<', today())->sum('amount')
                    - (float) (clone $paymentsQuery)->whereHas('charge', fn ($query) => $query->whereDate('due_date', '<', today()))->sum('amount'),
                ),
                'collected_this_month' => $collectedThisMonth,
            ],
            'properties' => $properties,
        ]);
    }
}
