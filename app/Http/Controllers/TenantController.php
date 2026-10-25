<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Models\Unit;
use App\Services\TenantLocationService;
use App\Support\TenantProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TenantController extends Controller
{
    public function store(Request $request): JsonResponse|RedirectResponse
    {
        $user = $request->user();
        abort_unless($user && in_array($user->role, ['admin', 'owner', 'manager'], true), 403);
        $data = $request->validate([
            ...app(TenantLocationService::class)->validationRules($request),
            'type' => ['required', 'in:individual,company'],
            'first_name' => ['required_if:type,individual', 'nullable', 'string', 'max:255'],
            'last_name' => ['required_if:type,individual', 'nullable', 'string', 'max:255'],
            'company_name' => ['required_if:type,company', 'nullable', 'string', 'max:255'],
            'identity_type' => ['required', 'in:national_id,passport'],
            'identity_number' => ['required', 'string', 'max:100', Rule::when($request->input('identity_type') === 'national_id', ['digits:16'])],
            'tax_identification_number' => ['required_if:type,company', 'nullable', 'string', 'max:100'],
            'contact_person' => ['required_if:type,company', 'nullable', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'regex:/^(078|079|072|073)[0-9]{7}$/'],
            // The phone app cannot send the photo and ID copy yet; the website always does.
            ...TenantProfile::rules(creating: ! $request->is('api/*')),
        ], TenantProfile::messages());
        unset($data['photo'], $data['identity_document']);

        $tenant = Tenant::create(TenantProfile::details($data) + $data + [
            'name' => $data['company_name'] ?? trim(($data['first_name'] ?? '').' '.($data['last_name'] ?? '')),
            'national_id' => $data['identity_type'] === 'national_id' ? $data['identity_number'] : null,
            'registration_number' => null,
            'address' => app(TenantLocationService::class)->address($data),
            // Who added the record. Owners reach tenants through their properties,
            // so an admin never links a tenant to an owner directly.
            'created_by' => $user->id,
            'status' => 'active',
        ]);

        TenantProfile::storeFiles($request, $tenant);

        if ($request->expectsJson()) {
            return response()->json(['tenant' => $tenant], 201);
        }

        return back()->with('success', 'Tenant created successfully.');
    }

    public function update(Request $request, Tenant $tenant): JsonResponse|RedirectResponse
    {
        $user = $request->user();
        abort_unless($user && in_array($user->role, ['admin', 'owner', 'manager'], true), 403);
        $this->authorizeTenantAccess($user, $tenant);

        $data = $request->validate([
            ...app(TenantLocationService::class)->validationRules($request),
            'type' => ['required', 'in:individual,company'],
            'first_name' => ['required_if:type,individual', 'nullable', 'string', 'max:255'],
            'last_name' => ['required_if:type,individual', 'nullable', 'string', 'max:255'],
            'company_name' => ['required_if:type,company', 'nullable', 'string', 'max:255'],
            'identity_type' => ['required', 'in:national_id,passport'],
            'identity_number' => ['required', 'string', 'max:100', Rule::when($request->input('identity_type') === 'national_id', ['digits:16'])],
            'tax_identification_number' => ['required_if:type,company', 'nullable', 'string', 'max:100'],
            'contact_person' => ['required_if:type,company', 'nullable', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'regex:/^(078|079|072|073)[0-9]{7}$/'],
            ...TenantProfile::rules(creating: false),
        ], TenantProfile::messages());
        unset($data['photo'], $data['identity_document']);
        // Gender and marital status stay as they are when the edit form leaves them out.
        $profile = $data['type'] === 'company'
            ? ['gender' => null, 'marital_status' => null]
            : array_filter(TenantProfile::details($data));
        unset($data['gender'], $data['marital_status']);

        $tenant->update([
            ...$data,
            ...$profile,
            'address' => app(TenantLocationService::class)->address($data),
            'name' => $data['type'] === 'company'
                ? $data['company_name']
                : trim($data['first_name'].' '.$data['last_name']),
            'first_name' => $data['type'] === 'individual' ? $data['first_name'] : null,
            'last_name' => $data['type'] === 'individual' ? $data['last_name'] : null,
            'company_name' => $data['type'] === 'company' ? $data['company_name'] : null,
            'registration_number' => null,
            'tax_identification_number' => $data['type'] === 'company' ? $data['tax_identification_number'] : null,
            'contact_person' => $data['type'] === 'company' ? $data['contact_person'] : null,
            'national_id' => $data['identity_type'] === 'national_id' ? $data['identity_number'] : null,
        ]);

        TenantProfile::storeFiles($request, $tenant);

        if ($request->expectsJson()) {
            return response()->json(['tenant' => $tenant->fresh()]);
        }

        return back()->with('success', 'Tenant details updated successfully.');
    }

    /**
     * Streams a tenant's private profile photo or ID document to accounts that can see the tenant.
     */
    public function file(Request $request, Tenant $tenant, string $file): StreamedResponse
    {
        $user = $request->user();
        abort_unless($user && in_array($user->role, ['admin', 'owner', 'manager'], true), 403);
        $this->authorizeTenantAccess($user, $tenant);
        $path = $file === 'photo' ? $tenant->photo : $tenant->identity_document;
        abort_unless($path && Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path, ($file === 'photo' ? 'tenant-photo-' : 'tenant-id-').$tenant->id.'.'.pathinfo($path, PATHINFO_EXTENSION), [
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    public function index(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user && in_array($user->role, ['admin', 'owner', 'manager'], true), 403);
        $ownerId = null;
        $owners = collect();
        if ($user->isAdmin()) {
            $filters = $request->validate([
                'owner_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'owner'))],
            ]);
            $ownerId = isset($filters['owner_id']) ? (int) $filters['owner_id'] : null;
            $owners = \App\Models\User::query()->where('role', 'owner')->orderBy('name')->get(['id', 'name']);
        }
        $query = Tenant::query()
            ->with(['activeTenancies.unit.property'])
            ->withCount('activeTenancies')
            ->visibleTo($user)
            ->when($ownerId, function ($query, $ownerId) {
                $query->where(function ($query) use ($ownerId) {
                    $query->where('created_by', $ownerId)
                        ->orWhereHas('tenancies.unit.property', fn ($property) => $property->where('owner_id', $ownerId));
                });
            })
            ->when($request->search, function ($query, $search) {
                $query->where(fn ($q) => $q
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%"));
            })
            ->latest();

        return Inertia::render('Tenants/Index', [
            'tenants' => $query->paginate(12)->withQueryString(),
            'filters' => ['search' => $request->search, 'owner_id' => $ownerId],
            'isAdmin' => $user->isAdmin(),
            'owners' => $owners,
        ]);
    }

    public function show(Request $request, Tenant $tenant): Response
    {
        $user = $request->user();
        abort_unless($user && in_array($user->role, ['admin', 'owner', 'manager'], true), 403);

        $tenant = Tenant::query()->whereKey($tenant->id)->visibleTo($user)
            ->with([
                // Only the leases in rooms this account can work on.
                'tenancies' => fn ($query) => $query->when(! $user->isAdmin(), fn ($tenancies) => $tenancies
                    ->whereHas('unit', fn ($room) => $room->visibleTo($user))),
                'tenancies.unit.property',
                'tenancies.rentCharges.payments',
                'tenancies.leases',
                'tenancies.moveOutInspection',
            ])
            ->findOrFail($tenant->id);

        $availableUnits = Unit::query()
            ->with(['property:id,name,owner_id', 'unitType:id,name'])
            ->visibleTo($user)
            ->where(function ($query) {
                $query->where(function ($available) {
                    $available->where('status', 'available')
                        ->whereDoesntHave('tenancies', fn ($tenancies) => $tenancies->whereIn('status', ['active', 'scheduled']));
                })->orWhere(function ($apartment) {
                    $apartment->whereIn('status', ['available', 'reserved', 'occupied'])
                        ->whereHas('unitType', fn ($type) => $type->matchingFilter('apartments'));
                });
            })
            ->orderBy('property_id')
            ->orderBy('unit_number')
            ->get(['id', 'property_id', 'unit_type_id', 'unit_number', 'rent_amount', 'rent_frequency', 'bedrooms', 'bathrooms']);

        return Inertia::render('Tenants/Show', [
            'tenant' => $tenant,
            'availableUnits' => $availableUnits,
        ]);
    }

    private function authorizeTenantAccess($user, Tenant $tenant): void
    {
        if (! $user->isAdmin() && ! $tenant->newQuery()
            ->whereKey($tenant->id)
            ->visibleTo($user)
            ->exists()) {
            abort(404);
        }
    }
}
