<?php

namespace App\Http\Controllers;

use App\Models\Property;
use App\Models\PropertyUnit;
use App\Models\UnitType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Units of a property: a category (Office, Commercial space, Restaurant…) on
 * one floor. Rooms are then added inside a unit.
 */
class PropertyUnitController extends Controller
{
    public function store(Request $request, Property $property): JsonResponse|RedirectResponse
    {
        $this->authorizePropertyAccess($request, $property);
        abort_unless($request->user()->canManageWholeProperty($property), 403, 'Only the owner or a manager of the whole property can add units.');
        $data = $this->validated($request, $property);

        $unit = PropertyUnit::create([
            'property_id' => $property->id,
            'unit_type_id' => $this->categoryId($data),
            'floor_number' => $data['floor_number'],
            'description' => $data['description'] ?? null,
        ]);

        return $this->respond($request, $unit, 'Unit "'.$this->label($unit).'" added. You can now add its rooms.', 201);
    }

    public function update(Request $request, Property $property, PropertyUnit $propertyUnit): JsonResponse|RedirectResponse
    {
        $this->authorizePropertyAccess($request, $property);
        abort_unless($propertyUnit->property_id === $property->id, 404);
        abort_unless($request->user()->canAccessPropertyUnit($propertyUnit), 403, 'This unit is not assigned to you.');
        $data = $this->validated($request, $property, $propertyUnit);

        $previousCategory = $propertyUnit->unit_type_id;
        $propertyUnit->update([
            'unit_type_id' => $this->categoryId($data),
            'floor_number' => $data['floor_number'],
            'description' => $data['description'] ?? null,
        ]);
        // Rooms carry their unit's category and floor for search and reports.
        $propertyUnit->rooms()->update([
            'unit_type_id' => $propertyUnit->unit_type_id,
            'floor_number' => $propertyUnit->floor_number,
        ]);
        if ($previousCategory !== $propertyUnit->unit_type_id) {
            UnitType::pruneIfUnused($previousCategory);
        }

        return $this->respond($request, $propertyUnit, 'Unit "'.$this->label($propertyUnit).'" updated.');
    }

    public function destroy(Request $request, Property $property, PropertyUnit $propertyUnit): JsonResponse|RedirectResponse
    {
        $this->authorizePropertyAccess($request, $property);
        abort_unless($propertyUnit->property_id === $property->id, 404);
        abort_unless($request->user()->canManageWholeProperty($property), 403, 'Only the owner or a manager of the whole property can delete units.');

        if ($propertyUnit->rooms()->exists()) {
            throw ValidationException::withMessages([
                'unit' => 'Remove the rooms of this unit before deleting it.',
            ]);
        }

        $label = $this->label($propertyUnit);
        $category = $propertyUnit->unit_type_id;
        $propertyUnit->delete();
        UnitType::pruneIfUnused($category);

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Unit deleted.']);
        }

        return back()->with('success', 'Unit "'.$label.'" deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, Property $property, ?PropertyUnit $current = null): array
    {
        $request->merge(['category_name' => trim((string) $request->input('category_name')) ?: null]);

        $data = $request->validate([
            'unit_type_id' => ['required_without:category_name', 'nullable', 'exists:unit_types,id'],
            'category_name' => ['required_without:unit_type_id', 'nullable', 'string', 'max:100'],
            'floor_number' => ['required', 'integer', Rule::in($property->floorNumbers())],
            'description' => ['nullable', 'string', 'max:2000'],
        ], [
            'floor_number.in' => 'Choose a floor that exists in this building.',
            'unit_type_id.required_without' => 'Type the category name, for example Office.',
            'category_name.required_without' => 'Type the category name, for example Office.',
        ]);

        // Look the name up without creating it, so a refused form leaves nothing behind.
        $categoryId = $this->categoryId($data, create: false);
        $duplicate = $categoryId && PropertyUnit::query()
            ->where('property_id', $property->id)
            ->where('unit_type_id', $categoryId)
            ->where('floor_number', $data['floor_number'])
            ->when($current, fn ($query) => $query->whereKeyNot($current->id))
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages([
                'floor_number' => 'This building already has that category on this floor. Add the rooms to the existing unit.',
            ]);
        }

        return $data;
    }

    /**
     * The typed category name, reusing an existing name in any letter case.
     * Older clients may still send a category id.
     */
    private function categoryId(array $data, bool $create = true): ?int
    {
        if (empty($data['category_name'])) {
            return (int) $data['unit_type_id'];
        }

        $existing = UnitType::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($data['category_name'])])
            ->value('id');

        return $existing ?? ($create ? UnitType::query()->create(['name' => $data['category_name']])->id : null);
    }

    private function label(PropertyUnit $unit): string
    {
        return $unit->loadMissing('unitType')->unitType?->name.' · '.PropertyUnit::floorLabel($unit->floor_number);
    }

    private function respond(Request $request, PropertyUnit $unit, string $message, int $status = 200): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return response()->json(['unit' => $unit->load('unitType'), 'message' => $message], $status);
        }

        return back()->with('success', $message);
    }

    private function authorizePropertyAccess(Request $request, Property $property): void
    {
        $user = $request->user();
        abort_unless($user->canAccessProperty($property), 403, 'You do not have permission to access this property.');
    }
}
