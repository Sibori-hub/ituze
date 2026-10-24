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

class SeoTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_pages_have_link_previews_and_private_pages_are_not_indexed(): void
    {
        $province = Province::create(['name' => 'Kigali City']);
        $district = District::create(['name' => 'Gasabo', 'province_id' => $province->id]);
        $sector = Sector::create(['name' => 'Kimihurura', 'district_id' => $district->id]);
        $cell = Cell::create(['name' => 'Rugando', 'sector_id' => $sector->id]);
        $owner = User::factory()->create(['role' => 'owner', 'status' => 'approved']);
        $property = Property::create(['paid_until' => now()->addYear(), 'owner_id' => $owner->id, 'cell_id' => $cell->id, 'name' => 'Kigali Heights', 'address' => 'KG 7 Ave', 'total_floors' => 3]);
        $unit = Unit::create([
            'property_id' => $property->id, 'unit_type_id' => UnitType::create(['name' => 'Office'])->id, 'floor_number' => 2,
            'unit_number' => 'B2', 'rent_amount' => 850000, 'rent_frequency' => 'monthly', 'size_sqm' => 45, 'status' => 'available',
        ]);

        $this->get('/')
            ->assertOk()
            ->assertSee('<meta property="og:image" content="'.url('/images/og-ituze.jpg').'">', false)
            ->assertSee('<link rel="canonical" href="'.url('/').'">', false)
            ->assertSee('"@type":"Organization"', false)
            ->assertDontSee('noindex', false);

        $this->get(route('public.units.show', [$property->id, $unit->id]))
            ->assertOk()
            ->assertSee('<meta property="og:title" content="Office to rent · Kigali Heights, Kimihurura, Gasabo | ITUZE">', false)
            ->assertSee('850,000 RWF / month · 45 m² · Floor 2', false);

        $this->get(route('sitemap'))
            ->assertOk()
            ->assertHeader('Content-Type', 'application/xml; charset=UTF-8')
            ->assertSee('<loc>'.route('public.properties.show', $property->id).'</loc>', false)
            ->assertSee('<loc>'.route('public.units.show', [$property->id, $unit->id]).'</loc>', false);

        $this->get(route('login'))->assertSee('<meta name="robots" content="noindex, nofollow">', false);
    }
}
