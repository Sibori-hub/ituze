<?php

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Models\Unit;
use App\Services\TenantLocationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Validation\Rule;

class TenantController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user() && in_array($request->user()->role, ['admin', 'owner'], true), 403);
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
            'phone' => ['required', 'regex:/^(078|072|073)[0-9]{7}$/'],
        ]);

        Tenant::create($data + [
            'name' => $data['company_name'] ?? trim(($data['first_name'] ?? '').' '.($data['last_name'] ?? '')),
            'national_id' => $data['identity_type'] === 'national_id' ? $data['identity_number'] : null,
            'registration_number' => null,
            'address' => app(TenantLocationService::class)->address($data),
            'created_by' => $request->user()->id,
            'status' => 'active',
        ]);

        return back()->with('success', 'Tenant created successfully.');
    }

    public function update(Request $request, Tenant $tenant): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user && in_array($user->role, ['admin', 'owner'], true), 403);
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
            'phone' => ['required', 'regex:/^(078|072|073)[0-9]{7}$/'],
        ]);

        $tenant->update([
            ...$data,
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

        return back()->with('success', 'Tenant details updated successfully.');
    }

    public function index(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user && in_array($user->role, ['admin', 'owner'], true), 403);
        $query = Tenant::query()
            ->with(['activeTenancies.unit.property'])
            ->withCount('activeTenancies')
            ->when(! $user->isAdmin(), function ($query) use ($user) {
                $query->where(function ($query) use ($user) {
                    $query->where('created_by', $user->id)
                        ->orWhereHas('tenancies.unit.property', fn ($property) => $property->where('owner_id', $user->id));
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
            'filters' => ['search' => $request->search],
            'isAdmin' => $user->isAdmin(),
        ]);
    }

    public function show(Request $request, Tenant $tenant): Response
    {
        $user = $request->user();
        abort_unless($user && in_array($user->role, ['admin', 'owner'], true), 403);

        $tenantQuery = Tenant::query()->whereKey($tenant->id);
        if (! $user->isAdmin()) {
            $tenantQuery->where(function ($query) use ($user) {
                $query->where('created_by', $user->id)
                    ->orWhereHas('tenancies.unit.property', fn ($property) => $property->where('owner_id', $user->id));
            });
        }

        $tenant = $tenantQuery
            ->with([
                'tenancies' => fn ($query) => $query->when(! $user->isAdmin(), fn ($tenancies) => $tenancies
                    ->whereHas('unit.property', fn ($property) => $property->where('owner_id', $user->id))),
                'tenancies.unit.property',
                'tenancies.rentCharges.payments',
                'tenancies.leases',
                'tenancies.moveOutInspection',
            ])
            ->findOrFail($tenant->id);

        $availableUnits = Unit::query()
            ->with('property:id,name,owner_id')
            ->where('status', 'available')
            ->whereDoesntHave('tenancies', fn ($query) => $query->whereIn('status', ['active', 'scheduled']))
            ->whereHas('property', function ($query) use ($user) {
                $query->when(! $user->isAdmin(), fn ($properties) => $properties->where('owner_id', $user->id));
            })
            ->orderBy('property_id')
            ->orderBy('unit_number')
            ->get(['id', 'property_id', 'unit_number', 'rent_amount', 'rent_frequency']);

        return Inertia::render('Tenants/Show', [
            'tenant' => $tenant,
            'availableUnits' => $availableUnits,
        ]);
    }

    private function authorizeTenantAccess($user, Tenant $tenant): void
    {
        if (! $user->isAdmin() && ! $tenant->newQuery()
            ->whereKey($tenant->id)
            ->where(function ($query) use ($user) {
                $query->where('created_by', $user->id)
                    ->orWhereHas('tenancies.unit.property', fn ($property) => $property->where('owner_id', $user->id));
            })
            ->exists()) {
            abort(404);
        }
    }
}
