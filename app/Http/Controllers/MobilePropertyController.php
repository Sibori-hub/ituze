<?php

namespace App\Http\Controllers;

use App\Models\Property;
use App\Models\PropertyImage;
use App\Models\Unit;
use App\Models\UnitImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MobilePropertyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'category' => ['nullable', 'in:offices,apartments,coffee-shops,commercial-buildings,warehouses'],
            'price_range' => ['nullable', 'regex:/^(any|under-500000|500000-1500000|1500000-5000000|5000000-plus)$/'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $searchTerm = trim($filters['search'] ?? '');
        $category = $filters['category'] ?? null;
        $priceRange = $filters['price_range'] ?? 'any';

        $units = Unit::query()
            ->publiclyListed()
            ->when($category, fn ($query) => $query->whereHas(
                'unitType',
                fn ($typeQuery) => $typeQuery->matchingFilter($category),
            ))
            ->when($priceRange !== 'any', function ($query) use ($priceRange) {
                match ($priceRange) {
                    'under-500000' => $query->where('rent_amount', '<', 500000),
                    '500000-1500000' => $query->whereBetween('rent_amount', [500000, 1500000]),
                    '1500000-5000000' => $query->whereBetween('rent_amount', [1500000, 5000000]),
                    '5000000-plus' => $query->where('rent_amount', '>=', 5000000),
                    default => null,
                };
            })
            ->whereHas('property', function ($query) use ($searchTerm) {
                $query->when($searchTerm !== '', function ($propertyQuery) use ($searchTerm) {
                    $like = '%'.$searchTerm.'%';
                    $propertyQuery->where(function ($searchQuery) use ($like) {
                        $searchQuery
                            ->where('name', 'like', $like)
                            ->orWhere('address', 'like', $like)
                            ->orWhereHas('cell.sector', fn ($locationQuery) => $locationQuery->where('name', 'like', $like))
                            ->orWhereHas('cell.sector.district', fn ($locationQuery) => $locationQuery->where('name', 'like', $like))
                            ->orWhereHas('cell.sector.district.province', fn ($locationQuery) => $locationQuery->where('name', 'like', $like));
                    });
                });
            })
            ->with([
                'unitType',
                'images',
                'property.images',
                'property.cell.sector.district.province',
            ])
            ->latest()
            ->paginate(12)
            ->withQueryString()
            ->through(fn (Unit $unit): array => $this->unitData($unit, includeProperty: true));

        return response()->json($units);
    }

    public function show(Property $property): JsonResponse
    {
        $property->load([
            'images',
            'owner:id,name,first_name,last_name,phone',
            'cell.sector.district.province',
            'units' => fn ($query) => $query
                ->publiclyListed()
                ->with(['unitType', 'images'])
                ->orderBy('rent_amount'),
        ]);

        abort_if($property->units->isEmpty(), 404);

        return response()->json(['property' => $this->propertyData($property, includeUnits: true)]);
    }

    private function propertyData(Property $property, bool $includeUnits = false): array
    {
        $cell = $property->cell;
        $sector = $cell?->sector;
        $district = $sector?->district;

        return [
            'id' => $property->id,
            'name' => $property->name,
            'address' => $property->address,
            'description' => $property->description,
            'amenities' => $property->amenities,
            'proximity' => $property->proximity,
            'images' => $property->images->map(fn (PropertyImage $image): array => $this->imageData($image))->values(),
            ...($includeUnits ? [
                'owner' => $property->owner ? [
                    'name' => $property->owner->name
                        ?: trim(implode(' ', array_filter([$property->owner->first_name, $property->owner->last_name]))),
                    'phone' => $property->owner->phone,
                ] : null,
            ] : []),
            'cell' => $cell ? [
                'name' => $cell->name,
                'sector' => $sector ? [
                    'name' => $sector->name,
                    'district' => $district ? [
                        'name' => $district->name,
                        'province' => $district->province ? [
                            'name' => $district->province->name,
                        ] : null,
                    ] : null,
                ] : null,
            ] : null,
            ...($includeUnits ? [
                'units' => $property->units
                    ->map(fn (Unit $unit): array => $this->unitData($unit))
                    ->values(),
            ] : []),
        ];
    }

    private function unitData(Unit $unit, bool $includeProperty = false): array
    {
        return [
            'id' => $unit->id,
            'property_id' => $unit->property_id,
            'unit_type_id' => $unit->unit_type_id,
            'unit_number' => $unit->unit_number,
            'floor_number' => $unit->floor_number,
            'rent_amount' => $unit->rent_amount,
            'rent_frequency' => $unit->rent_frequency,
            'size_sqm' => $unit->size_sqm,
            'description' => $unit->description,
            'status' => $unit->status,
            'unit_type' => $unit->unitType ? [
                'id' => $unit->unitType->id,
                'name' => $unit->unitType->name,
            ] : null,
            'images' => $unit->images->map(fn (UnitImage $image): array => $this->imageData($image))->values(),
            ...($includeProperty ? ['property' => $this->propertyData($unit->property)] : []),
        ];
    }

    private function imageData(PropertyImage|UnitImage $image): array
    {
        return [
            'id' => $image->id,
            'image_path' => $image->image_path,
            'is_cover' => (bool) $image->is_cover,
        ];
    }
}
