<?php

namespace Tests\Feature;

use App\Models\Property;
use App\Models\PropertyInquiry;
use App\Models\Tenancy;
use App\Models\Unit;
use App\Models\UnitType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UnitsOnFloorsTest extends TestCase
{
    use RefreshDatabase;

    private function photo(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('unit.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGn0AAAAASUVORK5CYII='));
    }

    public function test_a_unit_is_a_space_on_a_floor_with_photos_and_its_use_is_chosen_with_each_client(): void
    {
        Storage::fake('public');
        Storage::fake('local');
        Notification::fake();
        $owner = User::factory()->create(['role' => 'owner', 'status' => 'approved', 'profile_completed' => true, 'phone' => '0788000002']);
        $owner->forceFill(['email_verified_at' => now(), 'phone_verified_at' => now()])->save();
        $property = Property::create(['owner_id' => $owner->id, 'name' => 'Remera Plaza', 'address' => 'KG 11 Ave', 'total_floors' => 2, 'paid_until' => now()->addMonth()]);

        // Number, size, monthly rent and photos on floor 1; no category.
        $unit = ['floor_number' => 1, 'unit_number' => '001', 'size_sqm' => 45, 'rent_amount' => 350000, 'rent_frequency' => 'monthly'];
        $this->actingAs($owner)->post(route('properties.units.store', $property), $unit)->assertSessionHasErrors('images');
        $this->post(route('properties.units.store', $property), [...$unit, 'images' => [$this->photo()]])->assertSessionHasNoErrors();

        $space = Unit::query()->where('unit_number', '001')->firstOrFail();
        $this->assertSame([1, UnitType::SPACE, 'monthly', 1], [$space->floor_number, $space->unitType->name, $space->rent_frequency, $space->images()->count()]);
        $this->assertSame(1, $space->propertyUnit->floor_number);

        // Rented as a salon: the use is kept on the rental, not on the unit.
        $this->post(route('properties.units.tenancy.store', [$property, $space]), [
            'business_use' => 'Salon',
            'tenant_type' => 'individual', 'first_name' => 'Aline', 'last_name' => 'Uwase',
            'email' => 'aline@example.com', 'phone' => '0788123456', 'identity_type' => 'passport', 'identity_number' => 'PC123456',
            'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(12)->subDay()->toDateString(),
            'monthly_rent' => 350000, 'rent_frequency' => 'monthly',
            'payment_method' => 'cash', 'lease' => UploadedFile::fake()->create('lease.pdf', 50, 'application/pdf'),
            ...$this->location(),
        ])->assertSessionHasNoErrors();
        $this->assertSame('Salon', Tenancy::query()->where('unit_id', $space->id)->value('business_use'));
        $this->assertSame(UnitType::SPACE, $space->fresh()->unitType->name);
    }

    public function test_a_visitor_says_what_business_they_will_run(): void
    {
        Notification::fake();
        $owner = User::factory()->create(['role' => 'owner', 'status' => 'approved']);
        $property = Property::create(['owner_id' => $owner->id, 'name' => 'Remera Plaza', 'address' => 'KG 11 Ave', 'total_floors' => 1, 'paid_until' => now()->addMonth()]);
        $space = Unit::create(['property_id' => $property->id, 'unit_type_id' => UnitType::space()->id, 'floor_number' => 0, 'unit_number' => '002', 'rent_amount' => 200000, 'rent_frequency' => 'monthly', 'status' => 'available']);

        $this->post(route('public.properties.inquiries.store', $property), [
            'unit_id' => $space->id, 'visitor_name' => 'Jean', 'visitor_email' => 'jean@example.com', 'visitor_phone' => '0788999888',
            'business_use' => 'Pharmacy', 'message' => 'Can I visit on Monday?',
        ])->assertSessionHasNoErrors();

        $this->assertSame('Pharmacy', PropertyInquiry::query()->value('business_use'));
    }

    /** A valid Rwandan address for a new tenant. */
    private function location(): array
    {
        $province = \App\Models\Province::create(['name' => 'Kigali City']);
        $district = \App\Models\District::create(['name' => 'Gasabo', 'province_id' => $province->id]);
        $sector = \App\Models\Sector::create(['name' => 'Remera', 'district_id' => $district->id]);

        return ['province_id' => $province->id, 'district_id' => $district->id, 'sector_id' => $sector->id];
    }
}
