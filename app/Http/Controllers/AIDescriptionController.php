<?php

namespace App\Http\Controllers;

use App\Services\PropertyDescriptionGenerator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AIDescriptionController extends Controller
{
    public function generatePropertyDescription(Request $request)
    {
        try {
            $validated = $request->validate([
                'name' => 'nullable|string|max:255',
                'property_type_id' => 'nullable|exists:property_types,id',
                'address' => 'nullable|string|max:255',
                'total_units' => 'nullable|integer|min:0',
                // Floors above the ground floor, as the property form asks for them.
                'total_floors' => 'nullable|integer|min:0|max:200',
                'basement_floors' => 'nullable|integer|min:0|max:20',
                'amenities' => 'nullable|array',
                'proximity' => 'nullable|array',
                'cell_id' => 'nullable|exists:cells,id',
                'province_name' => 'nullable|string|max:255',
                'district_name' => 'nullable|string|max:255',
                'sector_name' => 'nullable|string|max:255',
                'cell_name' => 'nullable|string|max:255',
                'unit_size_range' => 'nullable|string|max:255',
            ]);

            $inputs = [
                'name' => $validated['name'] ?? null,
                'property_type_name' => null,
                'address' => $validated['address'] ?? null,
                'total_units' => $validated['total_units'] ?? null,
                ...$this->floorInputs($validated),
                'amenities' => array_keys(array_filter($request->input('amenities', []))),
                'proximity' => array_keys(array_filter($request->input('proximity', []))),
                'location_parts' => [
                    'province' => $validated['province_name'] ?? null,
                    'district' => $validated['district_name'] ?? null,
                    'sector' => $validated['sector_name'] ?? null,
                    'cell' => $validated['cell_name'] ?? null,
                ],
                'unit_size_range' => $validated['unit_size_range'] ?? null,
            ];

            if (!empty($validated['property_type_id'])) {
                $inputs['property_type_name'] = \App\Models\PropertyType::find($validated['property_type_id'])?->name;
            }

            $service = new PropertyDescriptionGenerator();
            $result = $service->generate($inputs);

            return response()->json([
                'description' => $result['description'],
                'source' => $result['source'],
            ], 200);
        } catch (\Exception $e) {
            Log::error('AI generate failed: ' . $e->getMessage());

            $validated = $request->all();
            $inputs = [
                'name' => $validated['name'] ?? null,
                'property_type_name' => null,
                'address' => $validated['address'] ?? null,
                'total_units' => $validated['total_units'] ?? null,
                ...$this->floorInputs($validated),
                'amenities' => array_keys(array_filter($request->input('amenities', []))),
                'proximity' => array_keys(array_filter($request->input('proximity', []))),
                'location_parts' => [
                    'province' => $validated['province_name'] ?? null,
                    'district' => $validated['district_name'] ?? null,
                    'sector' => $validated['sector_name'] ?? null,
                    'cell' => $validated['cell_name'] ?? null,
                ],
                'unit_size_range' => $validated['unit_size_range'] ?? null,
            ];

            if (!empty($validated['property_type_id'])) {
                $inputs['property_type_name'] = \App\Models\PropertyType::find($validated['property_type_id'])?->name;
            }

            $service = new PropertyDescriptionGenerator();
            $fallback = $service->generateTemplate($inputs);

            $description = $fallback['description'] . ' [Note: AI service temporarily unavailable — using local template.]';

            return response()->json([
                'description' => $description,
                'source' => 'fallback',
            ], 200);
        }
    }

    /**
     * Description for a unit (a category on one floor) from the popup's details.
     */
    public function generateUnitDescription(Request $request, \App\Models\Property $property)
    {
        $user = $request->user();
        abort_unless($user->isAdmin() || $property->owner_id === $user->id, 403);

        $data = $request->validate([
            'category_name' => ['required', 'string', 'max:100'],
            'floor_number' => ['required', 'integer', \Illuminate\Validation\Rule::in($property->floorNumbers())],
        ], [
            'category_name.required' => 'Type the category name first.',
        ]);

        $property->loadMissing('cell.sector.district');
        $flags = fn ($values) => array_keys(array_filter((array) $values, fn ($on) => in_array($on, [true, 1, '1'], true)));

        return response()->json((new PropertyDescriptionGenerator())->generateUnit([
            'property' => $property->name,
            'category' => trim($data['category_name']),
            'floor' => \App\Models\PropertyUnit::floorLabel((int) $data['floor_number']),
            'location' => array_values(array_filter([
                $property->cell?->sector?->name,
                $property->cell?->sector?->district?->name,
            ])),
            'amenities' => $flags($property->amenities),
            'proximity' => $flags($property->proximity),
        ]));
    }

    /**
     * Description for one room, from the form's details plus its building.
     */
    public function generateRoomDescription(Request $request, \App\Models\Property $property)
    {
        $user = $request->user();
        abort_unless($user->isAdmin() || $property->owner_id === $user->id, 403);

        $data = $request->validate([
            'property_unit_id' => ['required', 'integer'],
            'unit_number' => ['nullable', 'string', 'max:50'],
            'size_sqm' => ['nullable', 'numeric', 'min:0'],
            'rent_amount' => ['nullable', 'numeric', 'min:0'],
            'rent_frequency' => ['nullable', 'in:monthly,daily'],
            'bedrooms' => ['nullable', 'integer', 'between:0,50'],
            'bathrooms' => ['nullable', 'numeric', 'between:0,30'],
        ]);

        $unit = $property->propertyUnits()->with('unitType:id,name')->findOrFail($data['property_unit_id']);
        $property->loadMissing('cell.sector.district');
        $flags = fn ($values) => array_keys(array_filter((array) $values, fn ($on) => in_array($on, [true, 1, '1'], true)));

        $result = (new PropertyDescriptionGenerator())->generateRoom([
            'property' => $property->name,
            'category' => (string) $unit->unitType?->name,
            'floor' => \App\Models\PropertyUnit::floorLabel($unit->floor_number),
            'room_number' => trim((string) ($data['unit_number'] ?? '')) ?: '—',
            'size_sqm' => isset($data['size_sqm']) ? (float) $data['size_sqm'] : null,
            'rent_amount' => isset($data['rent_amount']) ? (float) $data['rent_amount'] : null,
            'rent_frequency' => $data['rent_frequency'] ?? 'monthly',
            'bedrooms' => isset($data['bedrooms']) ? (int) $data['bedrooms'] : null,
            'bathrooms' => isset($data['bathrooms']) ? (float) $data['bathrooms'] : null,
            'location' => array_values(array_filter([
                $property->cell?->sector?->name,
                $property->cell?->sector?->district?->name,
            ])),
            'amenities' => $flags($property->amenities),
            'proximity' => $flags($property->proximity),
        ]);

        return response()->json($result);
    }

    /**
     * The generator counts floors including the ground floor.
     */
    private function floorInputs(array $input): array
    {
        $upper = $input['total_floors'] ?? null;

        return [
            'total_floors' => is_numeric($upper) ? (int) $upper + 1 : null,
            'basement_floors' => is_numeric($input['basement_floors'] ?? null) ? (int) $input['basement_floors'] : null,
        ];
    }
}
