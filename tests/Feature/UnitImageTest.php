<?php

namespace Tests\Feature;

use App\Models\Cell;
use App\Models\District;
use App\Models\Property;
use App\Models\Province;
use App\Models\Sector;
use App\Models\Unit;
use App\Models\UnitImage;
use App\Models\UnitType;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UnitImageTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach (['move_out_inspections', 'rent_payments', 'rent_charges', 'leases', 'unit_images', 'property_images', 'tenancies', 'tenants', 'units', 'property_units', 'unit_types', 'properties', 'cells', 'sectors', 'districts', 'provinces', 'users'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->string('role')->default('owner');
            $table->string('status')->default('pending');
            $table->timestamp('expires_at')->nullable();
            $table->string('national_id')->nullable();
            $table->string('identity_document_type')->nullable();
            $table->string('identity_document_front')->nullable();
            $table->string('identity_document_back')->nullable();
            $table->string('address')->nullable();
            $table->unsignedBigInteger('sector_id')->nullable();
            $table->string('profile_photo')->nullable();
            $table->boolean('profile_completed')->default(false);
            $table->string('password');
            $table->timestamp('email_verified_at')->nullable();
            $table->string('remember_token')->nullable();
            $table->timestamps();
        });

        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->boolean('requires_listing')->default(false);
            $table->timestamp('listed_until')->nullable();
            $table->unsignedSmallInteger('total_floors')->default(0);
            $table->unsignedTinyInteger('basement_floors')->default(0);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('cell_id')->nullable();
            $table->string('name');
            $table->string('address');
            $table->text('description')->nullable();
            $table->json('amenities')->nullable();
            $table->json('proximity')->nullable();
            $table->timestamps();
        });

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
        Schema::create('property_images', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('property_id');
            $table->string('image_path');
            $table->boolean('is_cover')->default(false);
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
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->foreignId('unit_type_id')->constrained();
            $table->string('unit_number');
            $table->integer('floor_number')->nullable();
            $table->decimal('rent_amount', 12, 2);
            $table->string('rent_frequency')->default('monthly');
            $table->decimal('size_sqm', 12, 2)->nullable();
            $table->unsignedTinyInteger('bedrooms')->nullable();
            $table->decimal('bathrooms', 3, 1)->nullable();
            $table->text('description')->nullable();
            $table->string('status')->default('available');
            $table->timestamps();
        });

        Schema::create('tenancies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('unit_id')->constrained()->cascadeOnDelete();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('unit_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('unit_id')->constrained()->cascadeOnDelete();
            $table->string('image_path');
            $table->boolean('is_cover')->default(false);
            $table->timestamps();
        });
    }

    public function test_owner_can_upload_images_when_creating_a_unit(): void
    {
        Storage::fake('public');
        [$owner, $property, $unitType] = $this->makeOwnerPropertyAndUnitType();

        $this->actingAs($owner)
            ->post(route('properties.units.store', $property), [
                'unit_type_id' => $unitType->id,
                'unit_number' => 'A-101',
                'floor_number' => 1,
                'rent_amount' => 250000,
                'rent_frequency' => 'monthly',
                'bedrooms' => 2,
                'bathrooms' => 1,
                'status' => 'available',
                'images' => [
                    $this->fakeImage('living-room.png'),
                    $this->fakeImage('bedroom.png'),
                ],
            ])
            ->assertRedirect(route('properties.show', $property));

        $unit = Unit::query()->where('unit_number', 'A-101')->firstOrFail();
        $this->assertCount(2, $unit->images);
        $this->assertSame(2, $unit->bedrooms);
        $this->assertSame('1.0', $unit->bathrooms);
        $this->assertTrue($unit->images->first()->is_cover);
        $this->assertFalse($unit->images->last()->is_cover);

        foreach ($unit->images as $image) {
            Storage::disk('public')->assertExists($image->image_path);
        }
    }

    public function test_non_apartment_unit_categories_are_restricted_to_monthly_rent(): void
    {
        [$owner, $property] = $this->makeOwnerPropertyAndUnitType();
        $officeType = UnitType::query()->create(['name' => 'Office']);

        $this->actingAs($owner)
            ->post(route('properties.units.store', $property), [
                'unit_type_id' => $officeType->id,
                'unit_number' => 'OFF-1',
                'rent_amount' => 250000,
                'rent_frequency' => 'daily',
                'status' => 'available',
            ])
            ->assertSessionHasErrors('rent_frequency');

        $this->assertDatabaseCount('units', 0);
    }

    public function test_mobile_owner_can_create_update_and_delete_a_unit_through_the_workspace_api(): void
    {
        [$owner, $property, $unitType] = $this->makeOwnerPropertyAndUnitType();

        $createResponse = $this->actingAs($owner)
            ->postJson('/api/mobile/workspace/properties/'.$property->id.'/units', [
                'unit_type_id' => $unitType->id,
                'unit_number' => 'M-101',
                'floor_number' => 1,
                'rent_amount' => 250000,
                'rent_frequency' => 'monthly',
                'bedrooms' => 2,
                'bathrooms' => 1,
                'size_sqm' => 45,
                'description' => 'Mobile-created unit',
                'status' => 'available',
            ])
            ->assertCreated()
            ->assertJsonPath('unit.unit_number', 'M-101');

        $unitId = $createResponse->json('unit.id');

        $this->putJson('/api/mobile/workspace/properties/'.$property->id.'/units/'.$unitId, [
            'unit_type_id' => $unitType->id,
            'unit_number' => 'M-102',
            'floor_number' => 2,
            'rent_amount' => 300000,
            'rent_frequency' => 'monthly',
            'bedrooms' => 2,
            'bathrooms' => 1,
            'size_sqm' => 50,
            'description' => 'Updated from mobile',
            'status' => 'available',
        ])
            ->assertOk()
            ->assertJsonPath('unit.unit_number', 'M-102')
            ->assertJsonPath('unit.rent_amount', '300000.00');

        $this->deleteJson('/api/mobile/workspace/properties/'.$property->id.'/units/'.$unitId)
            ->assertOk()
            ->assertJsonPath('message', 'Unit deleted successfully.');
        $this->assertDatabaseMissing('units', ['id' => $unitId]);
    }

    public function test_mobile_owner_can_update_and_delete_a_property_and_cannot_edit_another_owners_property(): void
    {
        [$owner, $property] = $this->makeOwnerPropertyAndUnitType();
        $province = Province::query()->create(['name' => 'Kigali']);
        $district = District::query()->create(['name' => 'Gasabo', 'province_id' => $province->id]);
        $sector = Sector::query()->create(['name' => 'Kacyiru', 'district_id' => $district->id]);
        $cell = Cell::query()->create(['name' => 'Kamatamu', 'sector_id' => $sector->id]);

        $this->actingAs($owner)
            ->putJson('/api/mobile/workspace/properties/'.$property->id, [
                'name' => 'Updated property',
                'address' => 'New address',
                'description' => 'Updated from the mobile app',
                'cell_id' => $cell->id,
            ])
            ->assertOk()
            ->assertJsonPath('property.name', 'Updated property')
            ->assertJsonPath('property.cell.name', 'Kamatamu');

        $otherOwner = User::factory()->create([
            'role' => 'owner',
            'status' => 'approved',
            'profile_completed' => true,
            'expires_at' => now()->addYear(),
            'email_verified_at' => now(),
        ]);
        $otherProperty = Property::query()->create([
            'owner_id' => $otherOwner->id,
            'name' => 'Another owner property',
            'address' => 'Kigali',
        ]);

        $this->putJson('/api/mobile/workspace/properties/'.$otherProperty->id, [
            'name' => 'Unauthorized change',
            'address' => 'Kigali',
            'cell_id' => $cell->id,
        ])->assertForbidden();

        $this->deleteJson('/api/mobile/workspace/properties/'.$property->id)
            ->assertOk()
            ->assertJsonPath('message', 'Property deleted successfully.');
        $this->assertDatabaseMissing('properties', ['id' => $property->id]);
    }

    public function test_owner_can_remove_and_replace_unit_images(): void
    {
        Storage::fake('public');
        [$owner, $property, $unitType] = $this->makeOwnerPropertyAndUnitType();
        $unit = Unit::query()->create([
            'property_id' => $property->id,
            'unit_type_id' => $unitType->id,
            'unit_number' => 'A-101',
            'rent_amount' => 250000,
            'rent_frequency' => 'monthly',
            'status' => 'available',
        ]);
        $oldImagePath = 'unit-images/old-cover.jpg';
        Storage::disk('public')->put($oldImagePath, 'old image');
        $oldImage = UnitImage::query()->create([
            'unit_id' => $unit->id,
            'image_path' => $oldImagePath,
            'is_cover' => true,
        ]);

        $this->actingAs($owner)
            ->put(route('properties.units.update', [$property, $unit]), [
                'unit_type_id' => $unitType->id,
                'unit_number' => 'A-101',
                'floor_number' => '',
                'rent_amount' => 250000,
                'rent_frequency' => 'monthly',
                'bedrooms' => 2,
                'bathrooms' => 1,
                'size_sqm' => '',
                'description' => '',
                'status' => 'available',
                'delete_images' => [$oldImage->id],
                'images' => [$this->fakeImage('new-cover.png')],
            ])
            ->assertRedirect(route('properties.show', $property));

        $this->assertDatabaseMissing('unit_images', ['id' => $oldImage->id]);
        Storage::disk('public')->assertMissing($oldImagePath);

        $newImage = $unit->fresh()->images()->firstOrFail();
        $this->assertTrue($newImage->is_cover);
        Storage::disk('public')->assertExists($newImage->image_path);
    }

    public function test_deleting_a_unit_removes_its_uploaded_image_files(): void
    {
        Storage::fake('public');
        [$owner, $property, $unitType] = $this->makeOwnerPropertyAndUnitType();
        $unit = Unit::query()->create([
            'property_id' => $property->id,
            'unit_type_id' => $unitType->id,
            'unit_number' => 'A-101',
            'rent_amount' => 250000,
            'rent_frequency' => 'monthly',
            'bedrooms' => 2,
            'bathrooms' => 1,
            'status' => 'available',
        ]);
        $imagePath = 'unit-images/cover.jpg';
        Storage::disk('public')->put($imagePath, 'unit image');
        $image = UnitImage::query()->create([
            'unit_id' => $unit->id,
            'image_path' => $imagePath,
            'is_cover' => true,
        ]);

        $this->actingAs($owner)
            ->delete(route('properties.units.destroy', [$property, $unit]))
            ->assertRedirect(route('properties.units.index', $property));

        $this->assertDatabaseMissing('unit_images', ['id' => $image->id]);
        $this->assertDatabaseMissing('units', ['id' => $unit->id]);
        Storage::disk('public')->assertMissing($imagePath);
    }

    private function makeOwnerPropertyAndUnitType(): array
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'status' => 'approved',
            'profile_completed' => true,
            'expires_at' => now()->addYear(),
            'email_verified_at' => now(),
        ]);
        $property = Property::query()->create([
            'owner_id' => $owner->id,
            'name' => 'Test Property',
            'address' => 'Kigali',
        ]);
        $unitType = UnitType::query()->create(['name' => 'Apartment']);

        return [$owner, $property, $unitType];
    }

    private function fakeImage(string $name): UploadedFile
    {
        $contents = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGn0AAAAASUVORK5CYII=');

        return UploadedFile::fake()->createWithContent($name, $contents);
    }
}
