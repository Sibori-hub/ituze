<?php

namespace App\Http\Controllers;

use App\Models\Property;
use App\Models\PropertyUnit;
use App\Models\PropertyImage;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PropertyController extends Controller
{
    // Middleware is handled in routes/web.php

    /**
     * Display a listing of the user's properties.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $ownerId = null;
        $owners = collect();
        if ($user->isAdmin()) {
            $filters = $request->validate([
                'owner_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where(fn ($query) => $query->where('role', 'owner'))],
            ]);
            $ownerId = isset($filters['owner_id']) ? (int) $filters['owner_id'] : null;
            $owners = User::query()->where('role', 'owner')->whereNotNull('created_by')->orderBy('name')->get(['id', 'name']);
        }

        // A manager given single units only counts the rooms in those units.
        $rooms = fn ($q) => $user->isManager() ? $q->visibleTo($user) : $q;
        $query = Property::with(['owner', 'cell.sector.district.province', 'images'])
            ->withCount([
                'units' => $rooms,
                'units as units_available_count' => function ($q) use ($rooms) { $rooms($q)->where('status', 'available'); },
                'units as units_occupied_count' => function ($q) use ($rooms) { $rooms($q)->where('status', 'occupied'); },
                'units as units_maintenance_count' => function ($q) use ($rooms) { $rooms($q)->where('status', 'maintenance'); },
            ])
            ->withSum(['units as units_monthly_rent_sum' => $rooms], 'rent_amount')
            // Admins see every property, owners their own, managers the ones assigned to them.
            ->inWorkspaceOf($user)
            ->when($ownerId, fn ($query) => $query->where('owner_id', $ownerId))
            ->when($request->search, function ($query, $search) {
                return $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('address', 'like', "%{$search}%");
                });
            })
            ->latest();

        $properties = $query->paginate(10)->withQueryString();

        return Inertia::render('Properties/Index', [
            'properties' => $properties,
            'filters' => [
                'search' => $request->search,
                'owner_id' => $ownerId,
            ],
            'isAdmin' => $user->isAdmin(),
            'currentUserId' => $user->id,
            'owners' => $owners,
            'canCreate' => ! $user->isManager(),
        ]);
    }

    /**
     * Show the form for creating a new property.
     */
    public function create(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        abort_if($user->isManager(), 403, 'Only the owner can add a property.');
        $ownerId = null;
        $owners = collect();

        if ($user->isAdmin()) {
            $filters = $request->validate([
                'owner_id' => ['nullable', 'integer', $this->managedOwnerRule()],
            ]);
            $ownerId = $filters['owner_id'] ?? null;
            $owners = User::query()->where('role', 'owner')->whereNotNull('created_by')->orderBy('name')->get(['id', 'name']);
        }

        return Inertia::render('Properties/Create', [
            'isAdmin' => $user->isAdmin(),
            'owners' => $owners,
            'selectedOwnerId' => $ownerId,
        ]);
    }

    /**
     * Store a newly created property in storage.
     */
    public function store(Request $request): JsonResponse|RedirectResponse
    {
        abort_if($request->user()->isManager(), 403, 'Only the owner can add a property.');
        try {
            $user = $request->user();
            $rules = [
                'name' => 'required|string|max:255',
                'address' => 'nullable|string|max:255',
                'description' => 'nullable|string',
                ...$this->floorRules($request),
                'cell_id' => 'required|exists:cells,id',
                'amenities' => 'nullable|array',
                'amenities.*' => 'boolean',
                'proximity' => 'nullable|array',
                'proximity.*' => 'boolean',
                'images' => 'nullable|array',
                'images.*' => 'image|mimes:jpeg,png,jpg,gif,webp|max:2048',
            ];
            if ($user->isAdmin()) {
                $rules['owner_id'] = ['required', 'integer', $this->managedOwnerRule()];
            }

            $data = $request->validate(
                $rules,
                [
                    'name.required' => '❌ Please enter a property name.',
                    'owner_id.exists' => 'Choose an owner created by an administrator.',
                    'total_floors.required' => '🏢 Enter how many floors the building has above the ground floor (0 if it is ground floor only).',
                    'basement_floors.required' => '🏢 Enter the number of basements (0 if there is no basement).',
                    'cell_id.required' => '📍 Please select the property location (down to Cell level).',
                    'cell_id.exists' => '📍 The selected cell is not valid.',
                    'images.*.image' => '📸 One of the uploaded files is not a valid image.',
                    'images.*.mimes' => '📸 Only JPG, PNG, GIF and WebP images are allowed.',
                    'images.*.max'   => '📸 One of your property images is too large. Each image must be 2 MB or smaller.',
                ]
            );

            $property = Property::create([
                'owner_id' => $user->isAdmin() ? $data['owner_id'] : $user->id,
                'requires_listing' => $user->isAdvertiser(),
                'created_by' => $user->id,
                'cell_id' => $data['cell_id'],
                'name' => $data['name'],
                'address' => $data['address'] ?? null,
                'total_floors' => $data['total_floors'] ?? 0,
                'basement_floors' => $data['basement_floors'] ?? 0,
                'description' => $data['description'] ?? null,
                'amenities' => $request->input('amenities'),
                'proximity' => $request->input('proximity'),
            ]);

            // Handle image uploads
            if ($request->hasFile('images')) {
                foreach ($request->file('images') as $image) {
                    $path = $image->store('property-images', 'public');
                    PropertyImage::create([
                        'property_id' => $property->id,
                        'image_path' => $path,
                    ]);
                }
            }

            Log::info('Property created: #' . $property->id . ' by user #' . $request->user()->id);

            if ($request->expectsJson()) {
                return response()->json([
                    'property' => $property->load(['images', 'cell.sector.district.province']),
                ], 201);
            }

            // A self-registered owner pays for the property as step 2 of creating it.
            if ($user->paysSubscription()) {
                return redirect()
                    ->route('properties.pay', $property)
                    ->with('success', 'Step 1 done: "'.$property->name.'" is saved. Now pay for it; units, rooms and tenants unlock once ITUZE approves the payment.');
            }

            return redirect()
                ->route('properties.index')
                ->with('success', '🏠 Property "' . $property->name . '" created successfully!');

        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::warning('Property store validation failed: ' . json_encode($e->errors()));
            throw $e;
        } catch (\Exception $e) {
            Log::error('Property store error: ' . $e->getMessage());
            if ($request->expectsJson()) {
                throw $e;
            }

            return back()
                ->with('error', '❌ Failed to save property: ' . $e->getMessage())
                ->withInput();
        }
    }

    /**
     * Admins add properties only for owners they created (managed owners);
     * self-registered owners add their own.
     */
    private function managedOwnerRule()
    {
        return Rule::exists('users', 'id')->where(fn ($query) => $query
            ->where('role', 'owner')
            ->whereNotNull('created_by')
            ->whereNull('deleted_at'));
    }

    /**
     * Floors above ground and basements. The web form always sends them; the
     * mobile app does not yet, so for it they are optional.
     *
     * @return array<string, string>
     */
    private function floorRules(Request $request): array
    {
        $presence = $request->expectsJson() ? 'sometimes' : 'required';

        return [
            'total_floors' => $presence.'|integer|min:0|max:200',
            'basement_floors' => $presence.'|integer|min:0|max:20',
        ];
    }

    /**
     * Display the specified property.
     */
    public function show(Request $request, Property $property): Response
    {
        $this->authorizePropertyAccess($request->user(), $property);

        $property->load([
            'owner', 'creator:id,name,role', 'cell.sector.district.province', 'images', 'units.unitType', 'units.images',
            'propertyUnits.unitType:id,name',
            'propertyUnits.rooms' => fn ($rooms) => $rooms->with(['images', 'activeTenancy.tenant:id,name'])->orderBy('unit_number'),
        ]);
        $property->loadCount([
            'units',
            'units as units_available_count' => function ($q) { $q->where('status', 'available'); },
            'units as units_occupied_count' => function ($q) { $q->where('status', 'occupied'); },
            'units as units_maintenance_count' => function ($q) { $q->where('status', 'maintenance'); },
        ]);
        $property->loadSum('units as units_monthly_rent_sum', 'rent_amount');
        $user = $request->user();

        // A manager given single units sees only those units and their rooms.
        if ($user->isManager() && ! $user->canManageWholeProperty($property)) {
            $units = $property->propertyUnits->filter(fn (PropertyUnit $unit) => $user->canAccessPropertyUnit($unit))->values();
            $rooms = $property->units->filter(fn ($room) => $user->canAccessRoom($room))->values();
            $property->setRelation('propertyUnits', $units);
            $property->setRelation('units', $rooms);
            $property->units_count = $rooms->count();
            $property->units_available_count = $rooms->where('status', 'available')->count();
            $property->units_occupied_count = $rooms->where('status', 'occupied')->count();
            $property->units_maintenance_count = $rooms->where('status', 'maintenance')->count();
            $property->units_monthly_rent_sum = $rooms->sum('rent_amount');
        }

        return Inertia::render('Properties/Show', [
            'property' => $property,
            // A manager given single units only sees the floors of those units.
            'floorNumbers' => $user->isManager() && ! $user->canManageWholeProperty($property)
                ? $property->propertyUnits->pluck('floor_number')->unique()->sort()->values()->all()
                : $property->floorNumbers(),
            'isAdmin' => $user->isAdmin(),
            // Rooms (and the units given to a manager) can be changed.
            // Floors, units and prices are the owner's; a manager runs tenants, payments and utilities.
            'canEdit' => ! $user->isReadOnly() && ! $user->isManager(),
            // The property itself: details, floors and new units.
            'canEditProperty' => ! $user->isReadOnly() && ! $user->isManager(),
            'canDeleteProperty' => ! $user->isReadOnly() && ! $user->isManager(),
            // Paid per property: units, rooms and tenants wait for an approved payment.
            'subscription' => $this->propertySubscription($property),
        ]);
    }

    /**
     * Step 2 of creating a property: pay for it. Also used later to renew it.
     */
    public function pay(Request $request, Property $property): Response|RedirectResponse
    {
        $user = $request->user();
        abort_unless($property->owner_id === $user->id && $user->paysSubscription(), 403);

        return Inertia::render('Properties/Pay', [
            'property' => $property->only(['id', 'name', 'address']),
            'subscription' => $this->propertySubscription($property),
            'monthlyPrice' => \App\Services\SubscriptionService::monthlyPrice(),
            'monthOptions' => \App\Services\SubscriptionService::monthOptions(),
            'phone' => $user->phone,
            'bank' => config('legal.qra_bank'),
            'momoPay' => ['code' => config('services.momo_pay.code'), 'name' => config('services.momo_pay.name')],
            'momoApi' => SubscriptionController::mobileMoneyApiAvailable(),
        ]);
    }

    /** Where the property's payment stands: state, paid-until date and any payment being checked. */
    private function propertySubscription(Property $property): array
    {
        $property->loadMissing('owner');
        $pending = $property->subscriptionPayments()->where('status', 'pending')->latest('id')->first();

        return [
            'needed' => $property->needsSubscription(),
            'state' => $property->subscriptionState(),
            'active' => $property->subscriptionIsActive(),
            'paid_until' => $property->paid_until?->toIso8601String(),
            'pending' => $pending ? [
                'amount' => (float) $pending->amount,
                'months' => $pending->months,
                'method' => $pending->method,
                'sent_at' => $pending->created_at?->toIso8601String(),
            ] : null,
        ];
    }

    /**
     * Show the form for editing the specified property.
     */
    public function edit(Request $request, Property $property): Response
    {
        $this->authorizePropertyAccess($request->user(), $property);
        abort_unless($request->user()->canManageWholeProperty($property), 403, 'Only the owner or a manager of the whole property can change it.');

        $property->load(['owner', 'cell.sector.district.province', 'images']);

        return Inertia::render('Properties/Edit', [
            'property' => $property,
            'isAdmin' => $request->user()->isAdmin(),
            'canEdit' => ! $request->user()->isReadOnly() && ! $request->user()->isManager(),
        ]);
    }

    /**
     * Update the specified property in storage.
     */
    public function update(Request $request, Property $property): JsonResponse|RedirectResponse
    {
        $this->authorizePropertyAccess($request->user(), $property);
        abort_unless($request->user()->canManageWholeProperty($property), 403, 'Only the owner or a manager of the whole property can change it.');

        $request->validate(
            [
                'name' => 'required|string|max:255',
                'address' => 'nullable|string|max:255',
                'description' => 'nullable|string',
                ...$this->floorRules($request),
                'cell_id' => 'required|exists:cells,id',
                'amenities' => 'nullable|array',
                'amenities.*' => 'boolean',
                'proximity' => 'nullable|array',
                'proximity.*' => 'boolean',
                'images' => 'nullable|array',
                'images.*' => 'image|mimes:jpeg,png,jpg,gif,webp|max:2048',
                'delete_images' => 'nullable|array',
                'delete_images.*' => 'exists:property_images,id',
            ],
            [
                'name.required' => '❌ Please enter a property name.',
                'total_floors.required' => '🏢 Enter how many floors the building has above the ground floor (0 if it is ground floor only).',
                'basement_floors.required' => '🏢 Enter the number of basements (0 if there is no basement).',
                'cell_id.required' => '📍 Please select the property location (down to Cell level).',
                'images.*.max' => '📸 One of your property images is too large. Each image must be 2 MB or smaller.',
                'images.*.mimes' => '📸 Only JPG, PNG, GIF and WebP images are allowed.',
            ]
        );

        $totalFloors = $request->has('total_floors') ? $request->integer('total_floors') : (int) $property->total_floors;
        $basementFloors = $request->has('basement_floors') ? $request->integer('basement_floors') : (int) $property->basement_floors;
        $outsideBuilding = $property->propertyUnits()
            ->where(fn ($query) => $query->where('floor_number', '>', $totalFloors)->orWhere('floor_number', '<', -$basementFloors))
            ->exists();
        if ($outsideBuilding) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'total_floors' => '🏢 Some units are on floors this change would remove. Move or delete those units first.',
            ]);
        }

        $property->update([
            'cell_id' => $request->cell_id,
            'name' => $request->name,
            'address' => $request->address,
            'total_floors' => $totalFloors,
            'basement_floors' => $basementFloors,
            'description' => $request->description,
            'amenities' => $request->input('amenities'),
            'proximity' => $request->input('proximity'),
        ]);

        // Handle image deletions
        if ($request->delete_images) {
            foreach ($request->delete_images as $imageId) {
                $image = PropertyImage::find($imageId);
                if ($image && $image->property_id === $property->id) {
                    Storage::disk('public')->delete($image->image_path);
                    $image->delete();
                }
            }
        }

        // Handle new image uploads
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $image) {
                $path = $image->store('property-images', 'public');
                PropertyImage::create([
                    'property_id' => $property->id,
                    'image_path' => $path,
                ]);
            }
        }

        if ($request->expectsJson()) {
            return response()->json([
                'property' => $property->fresh()->load(['images', 'cell.sector.district.province']),
            ]);
        }

        return redirect()->route('properties.index')
            ->with('success', 'Property updated successfully.');
    }

    /**
     * Remove the specified property from storage.
     */
    public function destroy(Request $request, Property $property): JsonResponse|RedirectResponse
    {
        $this->authorizePropertyAccess($request->user(), $property);
        abort_if($request->user()->isManager(), 403, 'Only the owner can delete a property.');

        // Delete associated images
        foreach ($property->images as $image) {
            Storage::disk('public')->delete($image->image_path);
        }

        $property->delete();

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Property deleted successfully.']);
        }

        return redirect()->route('properties.index')
            ->with('success', 'Property deleted successfully.');
    }

    /**
     * Check if user can access the property.
     */
    private function authorizePropertyAccess($user, $property)
    {
        if (! $user->canAccessProperty($property)) {
            abort(403, 'You do not have permission to access this property.');
        }
    }

}