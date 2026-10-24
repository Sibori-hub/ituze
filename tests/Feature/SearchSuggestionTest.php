<?php

namespace Tests\Feature;

use App\Models\Cell;
use App\Models\District;
use App\Models\Property;
use App\Models\Province;
use App\Models\Sector;
use App\Models\Unit;
use App\Models\UnitType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SearchSuggestionTest extends TestCase
{
    use RefreshDatabase;

    private function building(string $name, string $sectorName, int $available, int $rented = 0): Property
    {
        $province = Province::firstOrCreate(['name' => 'Kigali City']);
        $district = District::firstOrCreate(['name' => 'Gasabo', 'province_id' => $province->id]);
        $sector = Sector::firstOrCreate(['name' => $sectorName, 'district_id' => $district->id]);
        $cell = Cell::firstOrCreate(['name' => $sectorName.' Cell', 'sector_id' => $sector->id]);
        $owner = User::factory()->create(['role' => 'owner', 'status' => 'approved']);
        $type = UnitType::firstOrCreate(['name' => 'Offices']);
        $property = Property::create(['paid_until' => now()->addYear(), 'owner_id' => $owner->id, 'cell_id' => $cell->id, 'name' => $name, 'address' => 'KG 1 Ave', 'total_floors' => 1]);

        foreach (range(1, $available + $rented) as $number) {
            Unit::create([
                'property_id' => $property->id, 'unit_type_id' => $type->id, 'floor_number' => 0, 'unit_number' => 'U'.$number,
                'rent_amount' => 300000, 'rent_frequency' => 'monthly', 'status' => $number <= $available ? 'available' : 'occupied',
            ]);
        }

        return $property;
    }

    public function test_it_suggests_places_and_buildings_that_have_a_space_to_rent(): void
    {
        $tower = $this->building('Kimihurura Tower', 'Kimihurura', available: 2);
        $single = $this->building('Kacyiru House', 'Kacyiru', available: 1);
        $this->building('Kimironko Full', 'Kimironko', available: 0, rented: 1);

        $response = $this->getJson(route('search.suggestions', ['q' => 'kimi']))->assertOk();

        $response->assertJsonCount(1, 'places')
            ->assertJsonPath('places.0.name', 'Kimihurura')
            ->assertJsonPath('places.0.type', 'sector')
            ->assertJsonPath('places.0.available', 2)
            ->assertJsonCount(1, 'properties')
            ->assertJsonPath('properties.0.name', 'Kimihurura Tower')
            ->assertJsonPath('properties.0.url', route('public.properties.show', $tower->id));

        // A building with one free space opens that space directly.
        $this->getJson(route('search.suggestions', ['q' => 'kacyiru house']))
            ->assertJsonPath('properties.0.url', route('public.units.show', [$single->id, $single->units()->first()->id]));

        // The district matches every building in it, adding up the free spaces.
        $this->getJson(route('search.suggestions', ['q' => 'gasa']))
            ->assertJsonPath('places.0.name', 'Gasabo')
            ->assertJsonPath('places.0.available', 3);
    }

    public function test_one_letter_returns_nothing(): void
    {
        $this->building('Kimihurura Tower', 'Kimihurura', available: 1);

        $this->getJson(route('search.suggestions', ['q' => 'k']))->assertExactJson(['places' => [], 'properties' => []]);
    }
}
