<?php

namespace App\Http\Controllers;

use App\Models\Property;
use Illuminate\Validation\ValidationException;
use App\Models\PropertyUnit;
use App\Models\RentPayment;
use App\Models\Unit;
use App\Models\UnitType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UnitController extends Controller
{
    // Middleware is handled in routes/web.php

    /**
     * Display a listing of units for a property.
     */
    public function index(Request $request, Property $property): Response
    {
        $this->authorizePropertyAccess($request->user(), $property);

        $units = Unit::with(['unitType', 'images', 'activeTenancy.tenant'])
            ->where('property_id', $property->id)
            ->when($request->status, function ($query, $status) {
                return $query->where('status', $status);
            })
            ->when($request->search, function ($query, $search) {
                return $query->where('unit_number', 'like', "%{$search}%");
            })
            ->latest()
            ->paginate(10)
            ->withQueryString();

        $unitTypes = $this->availableUnitTypes();
        $tenants = \App\Models\Tenant::where('status', 'active')
            ->when(!$request->user()->isAdmin(), function ($query) use ($request) {
                $query->where(function ($query) use ($request) {
                    $query->where('created_by', $request->user()->id)
                        ->orWhereHas('tenancies.unit.property', function ($property) use ($request) {
                            $property->where('owner_id', $request->user()->id);
                    });
                });
            })
            ->when($request->tenant_search, function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->limit(100)
            ->get(['id', 'type', 'name', 'email', 'phone']);

        return Inertia::render('Units/Index', [
            'property' => $property->load('cell.sector.district.province'),
            'units' => $units,
            'unitTypes' => $unitTypes,
            'tenants' => $tenants,
            'filters' => [
                'status' => $request->status,
                'search' => $request->search,
            ],
        ]);
    }

    /**
     * Show the form for creating a new unit.
     */
    public function create(Request $request, Property $property): Response
    {
        $this->authorizePropertyAccess($request->user(), $property);

        $unitTypes = $this->availableUnitTypes();

        return Inertia::render('Units/Create', [
            'property' => $property,
            'unitTypes' => $unitTypes,
            'propertyUnits' => $this->propertyUnitOptions($property),
            'selectedPropertyUnitId' => $request->integer('property_unit_id') ?: null,
        ]);
    }

    /**
     * Store a newly created unit in storage.
     */
    public function store(Request $request, Property $property): JsonResponse|RedirectResponse
    {
        try {
            $this->authorizePropertyAccess($request->user(), $property);
            $this->applyParentUnit($request, $property);

            $isApartment = $this->isApartmentUnitType($request->input('unit_type_id'));
            $data = $request->validate([
                'unit_type_id' => 'required|exists:unit_types,id',
                'unit_number' => 'required|string|max:50',
                'rent_amount' => 'required|numeric|min:0',
                'size_sqm' => 'nullable|numeric|min:0',
                'bedrooms' => $isApartment ? ['required', 'integer', 'between:0,50'] : ['prohibited'],
                'bathrooms' => $isApartment ? ['required', 'numeric', 'decimal:0,1', 'between:0,30'] : ['prohibited'],
                'description' => 'nullable|string',
                'floor_number' => 'nullable|integer|min:-10|max:200',
                'rent_frequency' => ['required', Rule::in($isApartment ? ['monthly', 'daily'] : ['monthly'])],
                'images' => 'nullable|array|max:10',
                'images.*' => 'image|mimes:jpeg,png,jpg,gif,webp|max:2048',
            ]);

            $unit = Unit::create([
                'property_id' => $property->id,
                'property_unit_id' => $this->parentUnitId($property, $data),
                'unit_type_id' => $data['unit_type_id'],
                'unit_number' => $data['unit_number'],
                'floor_number' => $data['floor_number'] ?? null,
                'rent_amount' => $data['rent_amount'],
                'rent_frequency' => $data['rent_frequency'],
                'size_sqm' => $data['size_sqm'] ?? null,
                'bedrooms' => $isApartment ? $data['bedrooms'] : null,
                'bathrooms' => $isApartment ? $data['bathrooms'] : null,
                'description' => $data['description'] ?? null,
                // New rooms are always available; the status changes later (edit, tenancy).
                'status' => 'available',
            ]);

            $this->storeImages($unit, $request->file('images', []));

            Log::info('Unit created: #' . $unit->id . ' ('. $unit->unit_number .') for property #' . $property->id);

            if ($request->expectsJson()) {
                return response()->json([
                    'unit' => $unit->load(['unitType', 'images']),
                ], 201);
            }

            return redirect()->route('properties.show', $property)
                ->with('success', '✅ Room "' . $unit->unit_number . '" added.');

        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::warning('Unit store validation failed: ' . json_encode($e->errors()));
            throw $e;
        } catch (\Exception $e) {
            Log::error('Unit store error: ' . $e->getMessage());
            if ($request->expectsJson()) {
                throw $e;
            }

            return back()
                ->with('error', '❌ Failed to save unit: ' . $e->getMessage())
                ->withInput();
        }
    }

    /**
     * Display the specified unit.
     */
    public function show(Request $request, Property $property, Unit $unit): Response
    {
        $this->authorizePropertyAccess($request->user(), $property);
        
        if ($unit->property_id !== $property->id) {
            abort(404);
        }

        $unit->load([
            'unitType',
            'property',
            'images',
            'scheduledTenancy.tenant',
            'scheduledTenancy.rentCharges.payments',
            'activeTenancy.tenant',
            'activeTenancy.leases',
            'activeTenancy.rentCharges.payments',
            'activeTenancy.renewals',
            'activeTenancy.moveOutInspection',
            'tenancies.tenant',
            'tenancies.rentCharges.payments',
            'tenancies.renewedFrom',
            'tenancies.moveOutInspection',
        ]);
        if ($unit->activeTenancy) {
            $chainIds = $unit->activeTenancy->renewalChain()->pluck('id');
            $depositPaid = RentPayment::query()
                ->whereHas('charge', fn ($query) => $query
                    ->whereIn('tenancy_id', $chainIds)
                    ->where('charge_type', 'deposit'))
                ->sum('amount');
            $unit->activeTenancy->setAttribute('deposit_received_amount', number_format((float) $depositPaid, 2, '.', ''));
        }

        return Inertia::render('Units/Show', [
            'property' => $property,
            'unit' => $unit,
        ]);
    }

    /**
     * Show the form for editing the specified unit.
     */
    public function edit(Request $request, Property $property, Unit $unit): Response
    {
        $this->authorizePropertyAccess($request->user(), $property);
        
        if ($unit->property_id !== $property->id) {
            abort(404);
        }

        $unitTypes = $this->availableUnitTypes();

        return Inertia::render('Units/Edit', [
            'property' => $property,
            'unit' => $unit->load('unitType', 'images'),
            'unitTypes' => $unitTypes,
            'propertyUnits' => $this->propertyUnitOptions($property),
        ]);
    }

    /**
     * Update the specified unit in storage.
     */
    public function update(Request $request, Property $property, Unit $unit): JsonResponse|RedirectResponse
    {
        try {
            $this->authorizePropertyAccess($request->user(), $property);

            if ($unit->property_id !== $property->id) {
                abort(404);
            }
            $this->applyParentUnit($request, $property);

            $isApartment = $this->isApartmentUnitType($request->input('unit_type_id'));
            $data = $request->validate([
                'unit_type_id' => 'required|exists:unit_types,id',
                'unit_number' => 'required|string|max:50',
                'rent_amount' => 'required|numeric|min:0',
                'size_sqm' => 'nullable|numeric|min:0',
                'bedrooms' => $isApartment ? ['required', 'integer', 'between:0,50'] : ['prohibited'],
                'bathrooms' => $isApartment ? ['required', 'numeric', 'decimal:0,1', 'between:0,30'] : ['prohibited'],
                'description' => 'nullable|string',
                'floor_number' => 'nullable|integer|min:-10|max:200',
                'rent_frequency' => ['required', Rule::in($isApartment ? ['monthly', 'daily'] : ['monthly'])],
                'status' => 'required|in:available,occupied,maintenance,reserved,inactive',
                'images' => 'nullable|array|max:10',
                'images.*' => 'image|mimes:jpeg,png,jpg,gif,webp|max:2048',
                'delete_images' => 'nullable|array',
                'delete_images.*' => [
                    'integer',
                    Rule::exists('unit_images', 'id')->where('unit_id', $unit->id),
                ],
            ]);

            DB::transaction(function () use ($request, $unit, $data, $isApartment) {
                $lockedUnit = Unit::query()->whereKey($unit->id)->lockForUpdate()->firstOrFail();
                if (
                    $lockedUnit->unit_type_id !== (int) $data['unit_type_id']
                    && $lockedUnit->tenancies()->whereIn('status', ['active', 'scheduled'])->exists()
                ) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'unit_type_id' => 'The unit category cannot change while an active or future tenancy exists.',
                    ]);
                }
                if ($lockedUnit->tenancies()->where('status', 'active')->exists() && $request->status !== 'occupied') {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'status' => 'A unit with an active tenancy must remain occupied.',
                    ]);
                }
                if ($lockedUnit->tenancies()->where('status', 'scheduled')->whereNull('renewed_from_id')->exists()
                    && $request->status !== 'reserved') {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'status' => 'A unit with a scheduled move-in must remain reserved.',
                    ]);
                }

                $lockedUnit->update([
                    'property_unit_id' => $this->parentUnitId($lockedUnit->property, $data),
                    'unit_type_id' => $data['unit_type_id'],
                    'unit_number' => $data['unit_number'],
                    'floor_number' => $data['floor_number'] ?? null,
                    'rent_amount' => $data['rent_amount'],
                    'rent_frequency' => $data['rent_frequency'],
                    'size_sqm' => $data['size_sqm'] ?? null,
                    'bedrooms' => $isApartment ? $data['bedrooms'] : null,
                    'bathrooms' => $isApartment ? $data['bathrooms'] : null,
                    'description' => $data['description'] ?? null,
                    'status' => $data['status'],
                ]);
            });

            foreach ($request->input('delete_images', []) as $imageId) {
                $image = $unit->images()->findOrFail($imageId);
                $this->deleteImageFile($image->image_path);
                $image->delete();
            }

            if (!$unit->images()->where('is_cover', true)->exists()) {
                $unit->images()->oldest('id')->first()?->update(['is_cover' => true]);
            }

            $this->storeImages($unit, $request->file('images', []));

            Log::info('Unit updated: #' . $unit->id . ' (' . $unit->unit_number . ')');

            if ($request->expectsJson()) {
                return response()->json([
                    'unit' => $unit->fresh()->load(['unitType', 'images']),
                ]);
            }

            return redirect()->route('properties.show', $property)
                ->with('success', '✅ Room "' . $unit->unit_number . '" updated.');

        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::warning('Unit update validation failed: ' . json_encode($e->errors()));
            throw $e;
        } catch (\Exception $e) {
            Log::error('Unit update error: ' . $e->getMessage());
            if ($request->expectsJson()) {
                throw $e;
            }

            return back()
                ->with('error', '❌ Failed to update unit: ' . $e->getMessage())
                ->withInput();
        }
    }

    /**
     * Remove the specified unit from storage.
     */
    public function destroy(Request $request, Property $property, Unit $unit): JsonResponse|RedirectResponse
    {
        try {
            $this->authorizePropertyAccess($request->user(), $property);

            if ($unit->property_id !== $property->id) {
                abort(404);
            }

            $imagePaths = DB::transaction(function () use ($unit) {
                $lockedUnit = Unit::query()->whereKey($unit->id)->lockForUpdate()->firstOrFail();
                if ($lockedUnit->tenancies()->exists()) {
                    return null;
                }

                $paths = $lockedUnit->images()->pluck('image_path')->all();
                $lockedUnit->delete();

                return $paths;
            });
            if ($imagePaths === null) {
                if ($request->expectsJson()) {
                    return response()->json([
                        'message' => 'This unit has tenancy history and cannot be deleted.',
                    ], 409);
                }

                return back()->with('error', 'This unit has tenancy history and cannot be deleted.');
            }

            $unitNum = $unit->unit_number;
            foreach ($imagePaths as $imagePath) {
                $this->deleteImageFile($imagePath);
            }

            Log::info('Unit deleted: ' . $unitNum . ' (property #' . $property->id . ')');

            if ($request->expectsJson()) {
                return response()->json(['message' => 'Unit deleted successfully.']);
            }

            return redirect()->route('properties.units.index', $property)
                ->with('success', '🗑️ Room "' . $unitNum . '" deleted.');

        } catch (\Exception $e) {
            Log::error('Unit destroy error: ' . $e->getMessage());
            if ($request->expectsJson()) {
                throw $e;
            }

            return back()
                ->with('error', '❌ Failed to delete unit: ' . $e->getMessage());
        }
    }

    /**
     * Check if user can access the property.
     */
    /**
     * A room is added inside a unit (category on a floor): when the form names
     * the unit, the room takes that unit's category and floor.
     */
    private function applyParentUnit(Request $request, Property $property): void
    {
        if (! $request->filled('property_unit_id')) {
            return;
        }

        $parent = PropertyUnit::query()
            ->where('property_id', $property->id)
            ->find($request->input('property_unit_id'));

        if (! $parent) {
            throw ValidationException::withMessages([
                'property_unit_id' => 'Choose one of this property\'s units.',
            ]);
        }

        $request->merge([
            'unit_type_id' => $parent->unit_type_id,
            'floor_number' => $parent->floor_number,
        ]);
    }

    /**
     * The unit a room belongs to. Clients that still send only a category and
     * floor (older app versions) get the matching unit, created if needed.
     */
    /**
     * The property's units for the room form: "Office · Floor 2".
     *
     * @return \Illuminate\Support\Collection<int, array<string, mixed>>
     */
    private function propertyUnitOptions(Property $property)
    {
        return $property->propertyUnits()->with('unitType:id,name')->get()->map(fn (PropertyUnit $unit) => [
            'id' => $unit->id,
            'unit_type_id' => $unit->unit_type_id,
            'category' => $unit->unitType?->name,
            'floor_number' => $unit->floor_number,
        ]);
    }

    private function parentUnitId(Property $property, array $data): int
    {
        return PropertyUnit::query()->firstOrCreate([
            'property_id' => $property->id,
            'unit_type_id' => $data['unit_type_id'],
            'floor_number' => (int) ($data['floor_number'] ?? 0),
        ])->id;
    }

    private function authorizePropertyAccess($user, $property)
    {
        if (!$user->isAdmin() && $property->owner_id !== $user->id) {
            abort(403, 'You do not have permission to access this property.');
        }
    }

    private function availableUnitTypes()
    {
        return UnitType::query()
            ->whereNotIn('name', ['1 Bedroom', '2 Bedrooms', '3 Bedrooms', '4+ Bedrooms'])
            ->orderBy('name')
            ->get();
    }

    private function isApartmentUnitType(mixed $unitTypeId): bool
    {
        $name = UnitType::query()->whereKey($unitTypeId)->value('name');

        return UnitType::isResidentialName($name);
    }

    private function storeImages(Unit $unit, array $images): void
    {
        foreach ($images as $image) {
            $path = $image->store('unit-images', 'public');
            $isCover = !$unit->images()->where('is_cover', true)->exists();

            $unit->images()->create([
                'image_path' => $path,
                'is_cover' => $isCover,
            ]);
        }
    }

    private function deleteImageFile(string $path): void
    {
        if (!preg_match('/^https?:\/\//i', $path)) {
            Storage::disk('public')->delete($path);
        }
    }
}