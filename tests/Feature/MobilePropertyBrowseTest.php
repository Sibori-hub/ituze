<?php

namespace Tests\Feature;

use App\Models\Cell;
use App\Models\District;
use App\Models\Property;
use App\Models\Province;
use App\Models\Sector;
use App\Models\Unit;
use App\Models\UnitType;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class MobilePropertyBrowseTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach (['tenancies', 'unit_images', 'property_images', 'units', 'property_units', 'unit_types', 'properties', 'cells', 'sectors', 'districts', 'provinces'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('provinces', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('districts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('province_id');
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('sectors', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('district_id');
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('cells', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('sector_id');
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('total_floors')->default(0);
            $table->unsignedTinyInteger('basement_floors')->default(0);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('owner_id')->nullable();
            $table->unsignedBigInteger('cell_id')->nullable();
            $table->string('name');
            $table->string('address');
            $table->text('description')->nullable();
            $table->json('amenities')->nullable();
            $table->json('proximity')->nullable();
            $table->timestamps();
        });

        Schema::create('unit_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('property_units', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('property_id');
            $table->unsignedBigInteger('unit_type_id');
            $table->smallInteger('floor_number')->default(0);
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('property_unit_id')->nullable();
            $table->unsignedBigInteger('property_id');
            $table->unsignedBigInteger('unit_type_id');
            $table->string('unit_number');
            $table->unsignedTinyInteger('bedrooms')->nullable();
            $table->decimal('bathrooms', 3, 1)->nullable();
            $table->integer('floor_number')->nullable();
            $table->decimal('rent_amount', 12, 2);
            $table->string('rent_frequency')->default('monthly');
            $table->decimal('size_sqm', 12, 2)->nullable();
            $table->text('description')->nullable();
            $table->string('status')->default('available');
            $table->timestamps();
        });

        // Only what the public listing checks: a room's current or upcoming tenancy.
        Schema::create('tenancies', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('unit_id');
            $table->string('status');
            $table->unsignedBigInteger('renewed_from_id')->nullable();
            $table->timestamps();
        });

        Schema::create('property_images', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('property_id');
            $table->string('image_path');
            $table->boolean('is_cover')->default(false);
            $table->timestamps();
        });

        Schema::create('unit_images', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('unit_id');
            $table->string('image_path');
            $table->boolean('is_cover')->default(false);
            $table->timestamps();
        });
    }

    public function test_browse_lists_available_units_with_property_and_location_details(): void
    {
        [$property, $unit] = $this->makeListing();
        Unit::query()->create([
            'property_id' => $property->id,
            'unit_type_id' => $unit->unit_type_id,
            'unit_number' => 'B-2',
            'rent_amount' => 350000,
            'rent_frequency' => 'monthly',
            'status' => 'occupied',
        ]);

        $this->getJson('/api/mobile/properties?search=Kigali&category=offices')
            ->assertOk()
            ->assertJsonPath('data.0.id', $unit->id)
            ->assertJsonPath('data.0.property.name', 'Ituze Business Centre')
            ->assertJsonPath('data.0.property.cell.sector.district.province.name', 'Kigali')
            ->assertJsonMissingPath('data.0.property.owner_id')
            ->assertJsonPath('total', 1);
    }

    public function test_room_with_a_current_tenancy_is_not_listed_even_if_marked_available(): void
    {
        [$property, $unit] = $this->makeListing();
        \Illuminate\Support\Facades\DB::table('tenancies')->insert([
            'unit_id' => $unit->id,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->getJson('/api/mobile/properties')
            ->assertOk()
            ->assertJsonPath('total', 0);
        $this->getJson('/api/mobile/properties/'.$property->id)
            ->assertNotFound();
    }
    public function test_property_details_only_include_currently_available_units(): void
    {
        [$property, $availableUnit] = $this->makeListing();
        Unit::query()->create([
            'property_id' => $property->id,
            'unit_type_id' => $availableUnit->unit_type_id,
            'unit_number' => 'B-2',
            'rent_amount' => 350000,
            'rent_frequency' => 'monthly',
            'status' => 'occupied',
        ]);

        $this->getJson('/api/mobile/properties/'.$property->id)
            ->assertOk()
            ->assertJsonPath('property.id', $property->id)
            ->assertJsonPath('property.units.0.id', $availableUnit->id)
            ->assertJsonCount(1, 'property.units');
    }

    public function test_property_details_preserve_enabled_amenities_and_nearby_features(): void
    {
        [$property, $unit] = $this->makeListing();
        $property->update([
            'description' => 'A bright, well-located business centre.',
            'amenities' => ['parking' => '1', 'wifi' => '0'],
            'proximity' => ['near_market' => '1'],
        ]);
        $unit->update([
            'floor_number' => 2,
            'description' => 'A spacious office with natural light.',
        ]);
        $property->images()->create([
            'image_path' => 'properties/business-centre.jpg',
            'is_cover' => true,
        ]);

        $this->getJson('/api/mobile/properties/'.$property->id)
            ->assertOk()
            ->assertJsonPath('property.name', 'Ituze Business Centre')
            ->assertJsonPath('property.address', 'Kigali, Rwanda')
            ->assertJsonPath('property.description', 'A bright, well-located business centre.')
            ->assertJsonPath('property.cell.sector.district.province.name', 'Kigali')
            ->assertJsonPath('property.images.0.image_path', 'properties/business-centre.jpg')
            ->assertJsonPath('property.amenities.parking', '1')
            ->assertJsonPath('property.proximity.near_market', '1')
            ->assertJsonPath('property.units.0.unit_number', 'A-1')
            ->assertJsonPath('property.units.0.unit_type.name', 'Office')
            ->assertJsonPath('property.units.0.floor_number', 2)
            ->assertJsonPath('property.units.0.size_sqm', '50.00')
            ->assertJsonPath('property.units.0.description', 'A spacious office with natural light.');
    }

    public function test_property_without_available_units_is_not_publicly_listed_or_visible(): void
    {
        [$property, $unit] = $this->makeListing();
        $unit->update(['status' => 'occupied']);

        $this->getJson('/api/mobile/properties')
            ->assertOk()
            ->assertJsonPath('total', 0);

        $this->getJson('/api/mobile/properties/'.$property->id)->assertNotFound();
    }

    private function makeListing(): array
    {
        $province = Province::query()->create(['name' => 'Kigali']);
        $district = District::query()->create(['name' => 'Gasabo', 'province_id' => $province->id]);
        $sector = Sector::query()->create(['name' => 'Kacyiru', 'district_id' => $district->id]);
        $cell = Cell::query()->create(['name' => 'Kamatamu', 'sector_id' => $sector->id]);
        $property = Property::query()->create([
            'name' => 'Ituze Business Centre',
            'address' => 'Kigali, Rwanda',
            'cell_id' => $cell->id,
        ]);
        $type = UnitType::query()->create(['name' => 'Office']);
        $unit = Unit::query()->create([
            'property_id' => $property->id,
            'unit_type_id' => $type->id,
            'unit_number' => 'A-1',
            'rent_amount' => 400000,
            'rent_frequency' => 'monthly',
            'size_sqm' => 50,
            'status' => 'available',
        ]);

        return [$property, $unit];
    }
}
