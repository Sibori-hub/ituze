<?php

namespace App\Http\Controllers;

use App\Models\Property;
use App\Models\Unit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Suggestions under the home page search box: places and buildings that
 * match what the visitor is typing and still have a space to rent.
 */
class SearchSuggestionController extends Controller
{
    private const LIMIT = 5;

    public function __invoke(Request $request): JsonResponse
    {
        $term = Str::lower(trim((string) $request->query('q', '')));

        if (mb_strlen($term) < 2 || mb_strlen($term) > 120) {
            return response()->json(['places' => [], 'properties' => []]);
        }

        // Only buildings with a listed unit, so a suggestion never leads to nothing.
        $listed = Unit::query()->publiclyListed()
            ->selectRaw('property_id, count(*) as available, min(id) as first_unit_id')
            ->groupBy('property_id')
            ->get()
            ->keyBy('property_id');

        $properties = Property::query()
            ->whereIn('id', $listed->keys())
            ->with('cell.sector.district.province')
            ->get(['id', 'name', 'address', 'cell_id']);

        $places = [];
        $buildings = [];

        foreach ($properties as $property) {
            $available = (int) $listed[$property->id]->available;
            $sector = $property->cell?->sector;
            $district = $sector?->district;
            $province = $district?->province;

            foreach ([
                ['province', $province, ['province_id' => $province?->id]],
                ['district', $district, ['province_id' => $province?->id, 'district_id' => $district?->id]],
                ['sector', $sector, ['province_id' => $province?->id, 'district_id' => $district?->id, 'sector_id' => $sector?->id]],
            ] as [$type, $place, $filters]) {
                if (! $place || ! str_contains(Str::lower($place->name), $term)) {
                    continue;
                }
                $key = $type.':'.$place->id;
                $places[$key] ??= [
                    'type' => $type,
                    'name' => $place->name,
                    'context' => match ($type) {
                        'sector' => $district?->name,
                        'district' => $province?->name,
                        default => null,
                    },
                    'filters' => array_map('strval', $filters),
                    'available' => 0,
                ];
                $places[$key]['available'] += $available;
            }

            if (str_contains(Str::lower($property->name), $term) || str_contains(Str::lower((string) $property->address), $term)) {
                $buildings[] = [
                    'id' => $property->id,
                    'name' => $property->name,
                    'context' => collect([$sector?->name, $district?->name])->filter()->implode(', '),
                    'available' => $available,
                    // One space left: open it; several: open the building.
                    'url' => $available === 1
                        ? route('public.units.show', [$property->id, $listed[$property->id]->first_unit_id])
                        : route('public.properties.show', $property->id),
                ];
            }
        }

        return response()->json([
            'places' => $this->best(array_values($places), $term),
            'properties' => $this->best($buildings, $term),
        ]);
    }

    /** Names that start with the text first, then the ones with most spaces. */
    private function best(array $items, string $term): array
    {
        usort($items, fn ($a, $b) => [! Str::startsWith(Str::lower($a['name']), $term), -$a['available'], $a['name']]
            <=> [! Str::startsWith(Str::lower($b['name']), $term), -$b['available'], $b['name']]);

        return array_slice($items, 0, self::LIMIT);
    }
}
