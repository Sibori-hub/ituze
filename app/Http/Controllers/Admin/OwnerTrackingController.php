<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Property;
use App\Models\RentPayment;
use App\Models\SubscriptionPayment;
use App\Models\Tenancy;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Private, read-only view for admins of everything a self-registered (SaaS)
 * owner does on ITUZE: buildings, units, tenants, rentals, the rent they
 * record and what they pay for their subscription.
 */
class OwnerTrackingController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['all', 'approved', 'pending', 'rejected', 'disabled'])],
        ]);
        $search = trim($filters['search'] ?? '');
        $status = $filters['status'] ?? 'all';

        $owners = $this->selfRegistered()
            ->when($status === 'disabled', fn ($query) => $query->whereNotNull('disabled_at'))
            ->when(! in_array($status, ['all', 'disabled'], true), fn ($query) => $query->where('status', $status)->whereNull('disabled_at'))
            ->when($search !== '', fn ($query) => $query->where(fn ($inner) => $inner
                ->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
                ->orWhere('phone', 'like', "%{$search}%")
                ->orWhereHas('properties', fn ($property) => $property->where('name', 'like', "%{$search}%"))))
            ->withCount(['properties', 'managers'])
            ->latest()
            ->paginate(20)
            ->withQueryString();

        $ids = $owners->getCollection()->pluck('id');
        $units = $this->unitCounts($ids);
        $rentals = Tenancy::query()->where('tenancies.status', 'active')
            ->join('units', 'units.id', '=', 'tenancies.unit_id')->join('properties', 'properties.id', '=', 'units.property_id')
            ->whereIn('properties.owner_id', $ids)->selectRaw('properties.owner_id, COUNT(*) as aggregate')
            ->groupBy('properties.owner_id')->pluck('aggregate', 'owner_id');
        $rentThisMonth = $this->rentTotals($ids, now()->startOfMonth());
        $subscriptionPaid = SubscriptionPayment::query()->where('status', SubscriptionPayment::APPROVED)->whereIn('owner_id', $ids)
            ->selectRaw('owner_id, SUM(amount) as aggregate')->groupBy('owner_id')->pluck('aggregate', 'owner_id');
        $paidUntil = Property::query()->whereIn('owner_id', $ids)->selectRaw('owner_id, MIN(paid_until) as soonest')
            ->groupBy('owner_id')->pluck('soonest', 'owner_id');

        $owners->through(fn (User $owner) => [
            'id' => $owner->id,
            'name' => $owner->name,
            'email' => $owner->email,
            'phone' => $owner->phone,
            'status' => $owner->disabled_at ? 'disabled' : $owner->status,
            'joined' => $owner->created_at?->toIso8601String(),
            'properties' => $owner->properties_count,
            'managers' => $owner->managers_count,
            'units' => (int) ($units[$owner->id]['total'] ?? 0),
            'occupied' => (int) ($units[$owner->id]['occupied'] ?? 0),
            'active_rentals' => (int) ($rentals[$owner->id] ?? 0),
            'rent_this_month' => (float) ($rentThisMonth[$owner->id] ?? 0),
            'subscription_paid' => (float) ($subscriptionPaid[$owner->id] ?? 0),
            'soonest_paid_until' => $paidUntil[$owner->id] ?? null,
        ]);

        $all = $this->selfRegistered()->pluck('id');

        return Inertia::render('Admin/Owners', [
            'owners' => $owners,
            'filters' => ['search' => $search, 'status' => $status],
            'totals' => [
                'owners' => $all->count(),
                'properties' => Property::query()->whereIn('owner_id', $all)->count(),
                'units' => Unit::query()->whereHas('property', fn ($query) => $query->whereIn('owner_id', $all))->count(),
                'active_rentals' => Tenancy::query()->where('status', 'active')->whereHas('unit.property', fn ($query) => $query->whereIn('owner_id', $all))->count(),
                'rent_this_month' => (float) $this->rentTotals($all, now()->startOfMonth())->sum(),
                'subscription_paid' => (float) SubscriptionPayment::query()->where('status', SubscriptionPayment::APPROVED)->whereIn('owner_id', $all)->sum('amount'),
            ],
        ]);
    }

    public function show(User $owner): Response
    {
        abort_unless($owner->role === 'owner' && $owner->paysSubscription(), 404);

        $properties = Property::query()->where('owner_id', $owner->id)->withCount('units')->orderBy('name')->get();
        $units = Unit::query()->whereIn('property_id', $properties->pluck('id'))
            ->with(['property:id,name', 'activeTenancy.tenant:id,name,phone'])
            ->orderBy('property_id')->orderBy('floor_number')->orderBy('unit_number')->get();
        $tenancies = Tenancy::query()->whereHas('unit', fn ($query) => $query->whereIn('property_id', $properties->pluck('id')))
            ->with(['unit:id,property_id,unit_number,floor_number', 'unit.property:id,name', 'tenant:id,name'])
            ->latest('start_date')->get();
        $tenants = Tenant::query()->where(fn ($query) => $query
            ->whereIn('created_by', $owner->managers()->pluck('id')->push($owner->id))
            ->orWhereIn('id', $tenancies->pluck('tenant_id')))
            ->withCount('activeTenancies')->orderBy('name')->get();
        $payments = RentPayment::query()
            ->whereHas('charge.tenancy.unit', fn ($query) => $query->whereIn('property_id', $properties->pluck('id')))
            ->with(['charge:id,tenancy_id,charge_type', 'charge.tenancy:id,unit_id,tenant_id', 'charge.tenancy.unit:id,property_id,unit_number', 'charge.tenancy.unit.property:id,name', 'charge.tenancy.tenant:id,name', 'recordedBy:id,name'])
            ->latest('paid_at')->limit(200)->get();
        $subscriptions = SubscriptionPayment::query()->where('owner_id', $owner->id)->with('property:id,name')->latest('id')->get();
        $monthStart = now()->startOfMonth();
        $sum = fn (Collection $rows, string $type) => (float) $rows->filter(fn ($payment) => $payment->charge?->charge_type === $type)->sum('amount');
        $thisMonth = $payments->filter(fn ($payment) => $payment->paid_at?->gte($monthStart));

        return Inertia::render('Admin/OwnerShow', [
            'owner' => [
                ...$owner->only(['id', 'name', 'email', 'phone', 'status', 'national_id', 'identity_document_type', 'momo_pay_code', 'momo_pay_name']),
                'disabled' => (bool) $owner->disabled_at,
                'joined' => $owner->created_at?->toIso8601String(),
                'has_identity_document' => (bool) $owner->identity_document,
                'address' => $owner->address,
            ],
            'managers' => $owner->managers()->get(['id', 'name', 'email', 'phone', 'status'])->all(),
            'summary' => [
                'properties' => $properties->count(),
                'units' => $units->count(),
                'occupied' => $units->where('status', 'occupied')->count(),
                'available' => $units->where('status', 'available')->count(),
                'tenants' => $tenants->count(),
                'active_rentals' => $tenancies->where('status', 'active')->count(),
                'rent_this_month' => $sum($thisMonth, 'rent'),
                'deposits_this_month' => $sum($thisMonth, 'deposit'),
                'rent_all_time' => (float) RentPayment::query()->whereHas('charge', fn ($query) => $query->where('charge_type', 'rent'))
                    ->whereHas('charge.tenancy.unit', fn ($query) => $query->whereIn('property_id', $properties->pluck('id')))->sum('amount'),
                'subscription_paid' => (float) $subscriptions->where('status', SubscriptionPayment::APPROVED)->sum('amount'),
            ],
            'properties' => $properties->map(fn (Property $property) => [
                'id' => $property->id,
                'name' => $property->name,
                'address' => $property->address,
                'floors' => $property->total_floors,
                'units' => $property->units_count,
                'state' => $property->subscriptionState(),
                'paid_until' => $property->paid_until?->toDateString(),
                'created_at' => $property->created_at?->toIso8601String(),
            ])->all(),
            'units' => $units->map(fn (Unit $unit) => [
                'id' => $unit->id,
                'property_id' => $unit->property_id,
                'property' => $unit->property?->name,
                'floor' => $unit->floor_number,
                'number' => $unit->unit_number,
                'size' => $unit->size_sqm,
                'rent' => (float) $unit->rent_amount,
                'status' => $unit->status,
                'tenant' => $unit->activeTenancy?->tenant?->name,
                'business_use' => $unit->activeTenancy?->business_use,
            ])->all(),
            'tenants' => $tenants->map(fn (Tenant $tenant) => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'type' => $tenant->type,
                'phone' => $tenant->phone,
                'email' => $tenant->email,
                'photo_url' => $tenant->photo_url,
                'identity_document_url' => $tenant->identity_document_url,
                'active_rentals' => $tenant->active_tenancies_count,
                'created_at' => $tenant->created_at?->toIso8601String(),
            ])->all(),
            'rentals' => $tenancies->map(fn (Tenancy $tenancy) => [
                'id' => $tenancy->id,
                'property_id' => $tenancy->unit?->property_id,
                'unit_id' => $tenancy->unit_id,
                'property' => $tenancy->unit?->property?->name,
                'unit' => $tenancy->unit?->unit_number,
                'floor' => $tenancy->unit?->floor_number,
                'tenant' => $tenancy->tenant?->name,
                'tenant_id' => $tenancy->tenant_id,
                'business_use' => $tenancy->business_use,
                'start' => $tenancy->start_date?->toDateString(),
                'end' => $tenancy->end_date?->toDateString(),
                'rent' => (float) $tenancy->monthly_rent,
                'status' => $tenancy->status,
            ])->all(),
            'payments' => $payments->map(fn (RentPayment $payment) => [
                'id' => $payment->id,
                'paid_at' => $payment->paid_at?->toIso8601String(),
                'type' => $payment->charge?->charge_type,
                'property' => $payment->charge?->tenancy?->unit?->property?->name,
                'unit' => $payment->charge?->tenancy?->unit?->unit_number,
                'tenant' => $payment->charge?->tenancy?->tenant?->name,
                'amount' => (float) $payment->amount,
                'method' => $payment->method,
                'reference' => $payment->reference,
                'receipt_number' => $payment->receipt_number,
                'payer_name' => $payment->payer_name,
                'payer_phone' => $payment->payer_phone,
                'proof_url' => $payment->proof_url,
                'recorded_by' => $payment->recordedBy?->name,
            ])->all(),
            'subscriptions' => $subscriptions->map(fn (SubscriptionPayment $payment) => [
                'id' => $payment->id,
                'created_at' => $payment->created_at?->toIso8601String(),
                'property' => $payment->property?->name,
                'months' => $payment->months,
                'amount' => (float) $payment->amount,
                'method' => $payment->method,
                'reference' => $payment->reference,
                'status' => $payment->status,
            ])->all(),
        ]);
    }

    /** Owners who signed up themselves and pay the monthly subscription (not managed by Q.R.A). */
    private function selfRegistered()
    {
        return User::query()->where('role', 'owner')->whereNull('created_by');
    }

    /** @return array<int, array{total: int, occupied: int}> */
    private function unitCounts(Collection $ownerIds): array
    {
        return Unit::query()->join('properties', 'properties.id', '=', 'units.property_id')
            ->whereIn('properties.owner_id', $ownerIds)
            ->selectRaw("properties.owner_id, COUNT(*) as total, SUM(CASE WHEN units.status = 'occupied' THEN 1 ELSE 0 END) as occupied")
            ->groupBy('properties.owner_id')->get()
            ->mapWithKeys(fn ($row) => [$row->owner_id => ['total' => (int) $row->total, 'occupied' => (int) $row->occupied]])->all();
    }

    /** Rent (deposits left out) recorded since $from, per owner. */
    private function rentTotals(Collection $ownerIds, $from): Collection
    {
        return RentPayment::query()
            ->join('rent_charges', 'rent_charges.id', '=', 'rent_payments.rent_charge_id')
            ->join('tenancies', 'tenancies.id', '=', 'rent_charges.tenancy_id')
            ->join('units', 'units.id', '=', 'tenancies.unit_id')
            ->join('properties', 'properties.id', '=', 'units.property_id')
            ->where('rent_charges.charge_type', 'rent')
            ->where('rent_payments.paid_at', '>=', $from)
            ->whereIn('properties.owner_id', $ownerIds)
            ->selectRaw('properties.owner_id, SUM(rent_payments.amount) as aggregate')
            ->groupBy('properties.owner_id')
            ->pluck('aggregate', 'owner_id');
    }
}
