<?php

namespace App\Http\Controllers;

use App\Models\Property;
use App\Models\PropertyImage;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
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
        
        $query = Property::with(['owner', 'cell.sector.district.province', 'images'])
            ->withCount([
                'units',
                'units as units_available_count' => function ($q) { $q->where('status', 'available'); },
                'units as units_occupied_count' => function ($q) { $q->where('status', 'occupied'); },
                'units as units_maintenance_count' => function ($q) { $q->where('status', 'maintenance'); },
            ])
            ->withSum('units as units_monthly_rent_sum', 'rent_amount')
            ->when($user->isAdmin(), function ($query) {
                // Admins can see all properties
                return $query;
            }, function ($query) use ($user) {
                // Regular owners can only see their own properties
                return $query->where('owner_id', $user->id);
            })
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
            ],
            'isAdmin' => $user->isAdmin(),
            'currentUserId' => $user->id,
        ]);
    }

    /**
     * Show the form for creating a new property.
     */
    public function create(): Response
    {
        return Inertia::render('Properties/Create');
    }

    /**
     * Store a newly created property in storage.
     */
    public function store(Request $request): RedirectResponse
    {
        try {
            $request->validate(
                [
                    'name' => 'required|string|max:255',
                    'address' => 'required|string|max:255',
                    'description' => 'nullable|string',
                    'cell_id' => 'required|exists:cells,id',
                    'amenities' => 'nullable|array',
                    'amenities.*' => 'boolean',
                    'proximity' => 'nullable|array',
                    'proximity.*' => 'boolean',
                    'images' => 'nullable|array',
                    'images.*' => 'image|mimes:jpeg,png,jpg,gif|max:2048',
                ],
                [
                    'name.required' => '❌ Please enter a property name.',
                    'address.required' => '❌ Please enter the property address.',
                    'cell_id.required' => '📍 Please select the property location (down to Cell level).',
                    'cell_id.exists' => '📍 The selected cell is not valid.',
                    'images.*.image' => '📸 One of the uploaded files is not a valid image.',
                    'images.*.mimes' => '📸 Only JPG, JPEG, PNG, and GIF image formats are allowed.',
                    'images.*.max'   => '📸 One of your property images is too large. Each image must be 2 MB or smaller.',
                ]
            );

            $property = Property::create([
                'owner_id' => $request->user()->id,
                'cell_id' => $request->cell_id,
                'name' => $request->name,
                'address' => $request->address,
                'description' => $request->description,
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

            return redirect()
                ->route('properties.index')
                ->with('success', '🏠 Property "' . $property->name . '" created successfully!');

        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::warning('Property store validation failed: ' . json_encode($e->errors()));
            throw $e;
        } catch (\Exception $e) {
            Log::error('Property store error: ' . $e->getMessage());
            return back()
                ->with('error', '❌ Failed to save property: ' . $e->getMessage())
                ->withInput();
        }
    }

    /**
     * Display the specified property.
     */
    public function show(Request $request, Property $property): Response
    {
        $this->authorizePropertyAccess($request->user(), $property);

        $property->load(['owner', 'cell.sector.district.province', 'images', 'units.unitType', 'units.images']);
        $property->loadCount([
            'units as units_available_count' => function ($q) { $q->where('status', 'available'); },
            'units as units_occupied_count' => function ($q) { $q->where('status', 'occupied'); },
            'units as units_maintenance_count' => function ($q) { $q->where('status', 'maintenance'); },
        ]);
        $property->loadSum('units as units_monthly_rent_sum', 'rent_amount');

        return Inertia::render('Properties/Show', [
            'property' => $property,
            'isAdmin' => $request->user()->isAdmin(),
            'canEdit' => $request->user()->isAdmin() || $property->owner_id === $request->user()->id,
        ]);
    }

    /**
     * Show the form for editing the specified property.
     */
    public function edit(Request $request, Property $property): Response
    {
        $this->authorizePropertyAccess($request->user(), $property);

        $property->load(['owner', 'cell.sector.district.province', 'images']);

        return Inertia::render('Properties/Edit', [
            'property' => $property,
            'isAdmin' => $request->user()->isAdmin(),
            'canEdit' => $request->user()->isAdmin() || $property->owner_id === $request->user()->id,
        ]);
    }

    /**
     * Update the specified property in storage.
     */
    public function update(Request $request, Property $property): RedirectResponse
    {
        $this->authorizePropertyAccess($request->user(), $property);

        $request->validate(
            [
                'name' => 'required|string|max:255',
                'address' => 'required|string|max:255',
                'description' => 'nullable|string',
                'cell_id' => 'required|exists:cells,id',
                'amenities' => 'nullable|array',
                'amenities.*' => 'boolean',
                'proximity' => 'nullable|array',
                'proximity.*' => 'boolean',
                'images' => 'nullable|array',
                'images.*' => 'image|mimes:jpeg,png,jpg,gif|max:2048',
                'delete_images' => 'nullable|array',
                'delete_images.*' => 'exists:property_images,id',
            ],
            [
                'name.required' => '❌ Please enter a property name.',
                'address.required' => '❌ Please enter the property address.',
                'cell_id.required' => '📍 Please select the property location (down to Cell level).',
                'images.*.max' => '📸 One of your property images is too large. Each image must be 2 MB or smaller.',
                'images.*.mimes' => '📸 Only JPG, JPEG, PNG, and GIF image formats are allowed.',
            ]
        );

        $property->update([
            'cell_id' => $request->cell_id,
            'name' => $request->name,
            'address' => $request->address,
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

        return redirect()->route('properties.index')
            ->with('success', 'Property updated successfully.');
    }

    /**
     * Remove the specified property from storage.
     */
    public function destroy(Request $request, Property $property): RedirectResponse
    {
        $this->authorizePropertyAccess($request->user(), $property);

        // Delete associated images
        foreach ($property->images as $image) {
            Storage::disk('public')->delete($image->image_path);
        }

        $property->delete();

        return redirect()->route('properties.index')
            ->with('success', 'Property deleted successfully.');
    }

    /**
     * Check if user can access the property.
     */
    private function authorizePropertyAccess($user, $property)
    {
        if (!$user->isAdmin() && $property->owner_id !== $user->id) {
            abort(403, 'You do not have permission to access this property.');
        }
    }

}