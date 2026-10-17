<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Admin\ApprovalController;
use App\Http\Controllers\Auth\MobileAuthController;
use App\Models\Lease;
use App\Models\Cell;
use App\Models\Property;
use App\Models\PropertyInquiry;
use App\Models\RentCharge;
use App\Models\RentPayment;
use App\Models\Tenant;
use App\Models\Tenancy;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Response;

class MobileWorkspaceController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->authorizeWorkspace($user);

        if ($user->isAdmin()) {
            $owners = User::query()->where('role', 'owner');
            $approvedOwners = (clone $owners)->where('status', 'approved');
            $unitCounts = Unit::query()
                ->selectRaw('status, COUNT(*) as aggregate')
                ->whereHas('property')
                ->groupBy('status')
                ->pluck('aggregate', 'status');

            return response()->json([
                'role' => 'admin',
                'summary' => [
                    'totalAccounts' => User::query()->count(),
                    'totalOwners' => (clone $owners)->count(),
                    'pendingApprovals' => (clone $owners)
                        ->where('status', 'pending')
                        ->where('profile_completed', true)
                        ->whereNotNull('email_verified_at')
                        ->count(),
                    'activeSubscriptions' => (clone $approvedOwners)
                        ->whereNotNull('expires_at')
                        ->where('expires_at', '>', now())
                        ->count(),
                    'expiredSubscriptions' => (clone $approvedOwners)
                        ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '<=', now()))
                        ->count(),
                    'properties' => Property::query()->count(),
                    'units' => Unit::query()->count(),
                    'tenants' => Tenant::query()->count(),
                    'leases' => Lease::query()->count(),
                    'payments' => RentPayment::query()->count(),
                    'newInquiries' => PropertyInquiry::query()->where('status', 'new')->count(),
                    'occupancy' => [
                        'occupied' => (int) $unitCounts->get('occupied', 0),
                        'available' => (int) $unitCounts->get('available', 0),
                        'maintenance' => (int) $unitCounts->get('maintenance', 0),
                    ],
                ],
            ]);
        }

        $properties = Property::query()
            ->where('owner_id', $user->id)
            ->with('images')
            ->withCount([
                'units',
                'units as occupied_units_count' => fn ($query) => $query->where('status', 'occupied'),
                'units as available_units_count' => fn ($query) => $query->where('status', 'available'),
                'units as maintenance_units_count' => fn ($query) => $query->where('status', 'maintenance'),
            ])
            ->latest()
            ->get();
        $units = $properties->sum('units_count');
        $occupied = $properties->sum('occupied_units_count');
        $recentTenancies = Tenancy::query()
            ->with(['tenant:id,name', 'unit:id,property_id,unit_number', 'unit.property:id,name'])
            ->where('status', 'active')
            ->whereHas('unit.property', fn ($query) => $query->where('owner_id', $user->id))
            ->latest('start_date')
            ->get()
            ->map(function (Tenancy $tenancy): array {
                $rentCents = (int) round((float) $tenancy->monthly_rent * 100);
                $vatRate = (float) config('finance.rwanda_vat_rate');
                $vatCents = (int) round($rentCents * $vatRate / 100);

                return [
                    ...$tenancy->toArray(),
                    'end_date' => $tenancy->end_date?->toDateString(),
                    'vat_rate' => number_format($vatRate, 2, '.', ''),
                    'vat_amount' => number_format($vatCents / 100, 2, '.', ''),
                    'rent_including_vat' => number_format(($rentCents + $vatCents) / 100, 2, '.', ''),
                ];
            });

        return response()->json([
            'role' => 'owner',
            'summary' => [
                'properties' => $properties->count(),
                'units' => $units,
                'occupiedUnits' => $occupied,
                'availableUnits' => $properties->sum('available_units_count'),
                'maintenanceUnits' => $properties->sum('maintenance_units_count'),
                'occupancyRate' => $units ? round(($occupied / $units) * 100) : 0,
            ],
            'recentProperties' => $properties->take(4)->values(),
            'recentTenancies' => $recentTenancies,
            'recentInquiries' => PropertyInquiry::query()
                ->with(['property:id,name', 'unit:id,unit_number'])
                ->where('owner_id', $user->id)
                ->latest()
                ->take(6)
                ->get([
                    'id',
                    'property_id',
                    'unit_id',
                    'visitor_name',
                    'visitor_email',
                    'visitor_phone',
                    'message',
                    'status',
                    'created_at',
                ]),
        ]);
    }

    public function properties(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->authorizeWorkspace($user);
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'owner_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'owner'))],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $properties = Property::query()
            ->with(['images', 'cell.sector.district.province'])
            ->withCount([
                'units',
                'units as units_available_count' => fn ($query) => $query->where('status', 'available'),
                'units as units_occupied_count' => fn ($query) => $query->where('status', 'occupied'),
                'units as units_maintenance_count' => fn ($query) => $query->where('status', 'maintenance'),
            ])
            ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id))
            ->when($user->isAdmin() && isset($filters['owner_id']), fn ($query) => $query->where('owner_id', $filters['owner_id']))
            ->when($filters['search'] ?? null, fn ($query, $search) => $query->where(
                fn ($query) => $query->where('name', 'like', '%'.$search.'%')->orWhere('address', 'like', '%'.$search.'%'),
            ))
            ->latest()
            ->paginate(10);

        return response()->json($properties);
    }

    public function cells(Request $request): JsonResponse
    {
        $this->authorizeWorkspace($request->user());
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
        ]);

        $cells = Cell::query()
            ->with('sector.district.province')
            ->when($filters['search'] ?? null, fn ($query, $search) => $query->where(
                fn ($query) => $query
                    ->where('name', 'like', '%'.$search.'%')
                    ->orWhereHas('sector', fn ($related) => $related->where('name', 'like', '%'.$search.'%'))
                    ->orWhereHas('sector.district', fn ($related) => $related->where('name', 'like', '%'.$search.'%'))
                    ->orWhereHas('sector.district.province', fn ($related) => $related->where('name', 'like', '%'.$search.'%')),
            ))
            ->orderBy('name')
            ->paginate(20);

        return response()->json($cells);
    }

    public function owners(Request $request): JsonResponse
    {
        $this->authorizeWorkspace($request->user());
        abort_unless($request->user()->isAdmin(), 403);

        return response()->json([
            'data' => User::query()
                ->where('role', 'owner')
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    public function storeProperty(Request $request): JsonResponse|RedirectResponse
    {
        $this->authorizeWorkspace($request->user());

        return app(PropertyController::class)->store($request);
    }

    public function updateProperty(Request $request, Property $property): JsonResponse|RedirectResponse
    {
        $this->authorizeWorkspace($request->user());

        return app(PropertyController::class)->update($request, $property);
    }

    public function destroyProperty(Request $request, Property $property): JsonResponse|RedirectResponse
    {
        $this->authorizeWorkspace($request->user());

        return app(PropertyController::class)->destroy($request, $property);
    }

    public function storeUnit(Request $request, Property $property): JsonResponse|RedirectResponse
    {
        $this->authorizeWorkspace($request->user());

        return app(UnitController::class)->store($request, $property);
    }

    public function updateUnit(Request $request, Property $property, Unit $unit): JsonResponse|RedirectResponse
    {
        $this->authorizeWorkspace($request->user());

        return app(UnitController::class)->update($request, $property, $unit);
    }

    public function destroyUnit(Request $request, Property $property, Unit $unit): JsonResponse|RedirectResponse
    {
        $this->authorizeWorkspace($request->user());

        return app(UnitController::class)->destroy($request, $property, $unit);
    }

    public function storeChargePayment(
        Request $request,
        Property $property,
        Unit $unit,
        Tenancy $tenancy,
        RentCharge $charge,
    ): JsonResponse|RedirectResponse {
        $this->authorizeWorkspace($request->user());

        return app(TenancyController::class)->storePayment($request, $property, $unit, $tenancy, $charge);
    }

    public function moveOut(
        Request $request,
        Property $property,
        Unit $unit,
        Tenancy $tenancy,
    ): JsonResponse|RedirectResponse {
        $this->authorizeWorkspace($request->user());

        return app(TenancyController::class)->moveOut($request, $property, $unit, $tenancy);
    }

    public function tenants(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->authorizeWorkspace($user);
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $tenants = Tenant::query()
            ->withCount('activeTenancies')
            ->when(! $user->isAdmin(), fn ($query) => $query->where(
                fn ($query) => $query->where('created_by', $user->id)
                    ->orWhereHas('tenancies.unit.property', fn ($property) => $property->where('owner_id', $user->id)),
            ))
            ->when($filters['search'] ?? null, fn ($query, $search) => $query->where(
                fn ($query) => $query->where('name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%')
                    ->orWhere('phone', 'like', '%'.$search.'%'),
            ))
            ->latest()
            ->paginate(12);

        return response()->json($tenants);
    }

    public function tenancies(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->authorizeWorkspace($user);
        $tenancies = Tenancy::query()
            ->with([
                'tenant:id,name',
                'unit:id,unit_number,property_id',
                'unit.property:id,name,owner_id',
                'rentCharges.payments',
            ])
            ->whereIn('status', ['active', 'scheduled'])
            ->whereHas('unit.property', fn ($query) => $query
                ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id)))
            ->latest('start_date')
            ->paginate(15);

        return response()->json($tenancies);
    }

    public function reports(Request $request): JsonResponse|Response
    {
        $this->authorizeWorkspace($request->user());

        return app(ManagementController::class)->reports($request);
    }

    public function storeTenant(Request $request): JsonResponse|RedirectResponse
    {
        $this->authorizeWorkspace($request->user());

        return app(TenantController::class)->store($request);
    }

    public function updateTenant(Request $request, Tenant $tenant): JsonResponse|RedirectResponse
    {
        $this->authorizeWorkspace($request->user());

        return app(TenantController::class)->update($request, $tenant);
    }

    public function units(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->authorizeWorkspace($user);
        $filters = $request->validate([
            'property_id' => ['nullable', 'integer', Rule::exists('properties', 'id')],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $units = Unit::query()
            ->with(['unitType:id,name', 'images', 'property:id,name,owner_id'])
            ->whereHas('property', fn ($query) => $query
                ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id))
                ->when(isset($filters['property_id']), fn ($query) => $query->whereKey($filters['property_id'])))
            ->latest()
            ->paginate(15);

        return response()->json($units);
    }

    public function unitTypes(Request $request): JsonResponse
    {
        $this->authorizeWorkspace($request->user());

        return response()->json([
            'data' => \App\Models\UnitType::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function leases(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->authorizeWorkspace($user);
        $leases = Lease::query()
            ->with(['tenancy.tenant:id,name', 'tenancy.unit:id,unit_number,property_id', 'tenancy.unit.property:id,name,owner_id'])
            ->whereHas('tenancy.unit.property', fn ($query) => $query
                ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id)))
            ->latest()
            ->paginate(15);

        return response()->json($leases);
    }

    public function payments(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->authorizeWorkspace($user);
        $payments = RentPayment::query()
            ->with(['charge.tenancy.tenant:id,name', 'charge.tenancy.unit:id,unit_number,property_id', 'charge.tenancy.unit.property:id,name,owner_id'])
            ->whereHas('charge.tenancy.unit.property', fn ($query) => $query
                ->when(! $user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id)))
            ->latest('paid_at')
            ->paginate(20);

        return response()->json($payments);
    }

    public function approvals(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), 403);

        return response()->json([
            'data' => User::query()
                ->whereIn('role', ApprovalController::REVIEWABLE_ROLES)
                ->where('status', 'pending')
                ->where('profile_completed', true)
                ->whereNotNull('email_verified_at')
                ->with('sector.district.province')
                ->latest()
                ->get(),
        ]);
    }

    public function approveOwner(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), 403);
        abort_unless(in_array($user->role, ApprovalController::REVIEWABLE_ROLES, true), 404);

        $request->validate([
            'payment_verified' => ['required', 'accepted'],
        ]);

        abort_unless($user->status === 'pending', 409, 'This account is no longer pending approval.');
        abort_unless($user->hasVerifiedEmail() && $user->profile_completed, 422, 'The account must verify their email and complete their profile before approval.');

        $user->approveAccount();

        return response()->json([
            'message' => $user->roleLabel().' account approved.',
            'user' => MobileAuthController::userData($user->fresh()),
        ]);
    }

    public function rejectOwner(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), 403);
        abort_unless(in_array($user->role, ApprovalController::REVIEWABLE_ROLES, true), 404);

        $user->update(['status' => 'rejected']);

        return response()->json(['message' => 'Account rejected.']);
    }

    private function authorizeWorkspace(User $user): void
    {
        abort_unless(in_array($user->role, ['admin', 'owner'], true), 403);
        abort_unless($user->hasVerifiedEmail(), 403, 'Verify your email before opening management tools.');
        abort_if($user->awaitingPhoneVerification(), 403, 'Verify your phone number before opening management tools.');
        abort_unless($user->isAdmin() || $user->profile_completed, 403, 'Complete your profile before opening management tools.');

        if (! $user->isAdmin()) {
            abort_unless($user->isApproved() && ! $user->isExpired(), 403, 'Owner approval or an active subscription is required.');
        }
    }
}
