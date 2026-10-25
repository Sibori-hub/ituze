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

    public function test_the_tenant_pays_the_first_rent_to_the_owners_own_momo_pay_code(): void
    {
        Storage::fake('local');
        Notification::fake();
        $owner = User::factory()->create(['role' => 'owner', 'status' => 'approved', 'profile_completed' => true, 'phone' => '0788000002']);
        $owner->forceFill(['email_verified_at' => now(), 'phone_verified_at' => now()])->save();
        $this->actingAs($owner)->patch(route('profile.momo-pay'), ['momo_pay_code' => '55 1234', 'momo_pay_name' => 'KAMANZI JEAN'])->assertSessionHasNoErrors();
        $this->assertSame(['551234', 'KAMANZI JEAN'], [$owner->fresh()->momo_pay_code, $owner->fresh()->momo_pay_name]);

        $property = Property::create(['owner_id' => $owner->id, 'name' => 'Remera Plaza', 'address' => 'KG 11 Ave', 'total_floors' => 1, 'paid_until' => now()->addMonth()]);
        $space = fn (string $number) => Unit::create(['property_id' => $property->id, 'unit_type_id' => UnitType::space()->id, 'floor_number' => 0, 'unit_number' => $number, 'rent_amount' => 200000, 'rent_frequency' => 'monthly', 'status' => 'available']);
        $first = $space('001');
        $location = $this->location();
        $assign = fn (Unit $unit, array $payment) => $this->post(route('properties.units.tenancy.store', [$property, $unit]), [
            'business_use' => 'Office', 'tenant_type' => 'individual', 'first_name' => 'Aline', 'last_name' => 'Uwase',
            'email' => 'aline'.$unit->id.'@example.com', 'phone' => '0788123456', 'identity_type' => 'passport', 'identity_number' => 'PC12345'.$unit->id,
            'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(12)->subDay()->toDateString(),
            'monthly_rent' => 200000, 'rent_frequency' => 'monthly', 'payment_method' => 'mobile_money',
            'lease' => UploadedFile::fake()->create('lease.pdf', 50, 'application/pdf'),
            ...$location, ...$payment,
        ]);

        // The details from the MoMo SMS are required.
        $assign($first, ['payment_reference' => '1234567890'])->assertSessionHasErrors(['payer_name', 'payer_phone', 'paid_at']);
        $sms = ['payment_reference' => '1234567890', 'payer_name' => 'Aline Uwase', 'payer_phone' => '0788123456',
            'paid_at' => now('Africa/Kigali')->subMinutes(20)->format('Y-m-d\TH:i'), 'payment_proof' => $this->photo()];
        $assign($first, $sms)->assertSessionHasNoErrors();

        $payment = \App\Models\RentPayment::query()->where('reference', '1234567890')->firstOrFail();
        $this->assertSame(['Aline Uwase', '0788123456'], [$payment->payer_name, $payment->payer_phone]);
        $this->assertTrue($payment->paid_at->lt(now()->subMinutes(15)), 'The time from the SMS is kept, not the time of saving.');
        $this->get($payment->proof_url)->assertOk();
        $this->actingAs(User::factory()->create(['role' => 'owner', 'status' => 'approved', 'profile_completed' => true]))
            ->get($payment->proof_url)->assertNotFound();

        // One MoMo payment pays one rental.
        $this->actingAs($owner);
        $assign($space('002'), [...$sms, 'payment_proof' => null])->assertSessionHasErrors('payment_reference');
    }

    public function test_the_owner_is_told_when_a_manager_rents_a_unit_and_the_price_stays_the_owners(): void
    {
        Storage::fake('local');
        Notification::fake();
        $owner = User::factory()->create(['role' => 'owner', 'status' => 'approved', 'profile_completed' => true, 'phone' => '0788000002']);
        $owner->forceFill(['email_verified_at' => now(), 'phone_verified_at' => now()])->save();
        $property = Property::create(['owner_id' => $owner->id, 'name' => 'Ikaze Building', 'address' => 'KG 7 Ave', 'total_floors' => 1, 'paid_until' => now()->addMonth()]);
        $space = Unit::create(['property_id' => $property->id, 'unit_type_id' => UnitType::space()->id, 'floor_number' => 0, 'unit_number' => '001', 'rent_amount' => 200000, 'rent_frequency' => 'monthly', 'status' => 'available']);
        $manager = User::factory()->create(['role' => 'manager', 'status' => 'approved', 'profile_completed' => true, 'phone' => '0788000003']);
        $manager->forceFill(['employer_id' => $owner->id, 'email_verified_at' => now(), 'phone_verified_at' => now(), 'terms_accepted_at' => now()])->save();
        \App\Models\ManagerAssignment::create(['manager_id' => $manager->id, 'property_id' => $property->id]);

        $this->actingAs($manager)->post(route('properties.units.tenancy.store', [$property, $space]), [
            'business_use' => 'Shop', 'tenant_type' => 'individual', 'first_name' => 'Eric', 'last_name' => 'Mugisha',
            'email' => 'eric@example.com', 'phone' => '0788123456', 'identity_type' => 'passport', 'identity_number' => 'PC765432',
            'start_date' => now()->toDateString(), 'end_date' => now()->addMonths(12)->subDay()->toDateString(),
            // A lower rent typed by the manager is ignored: the owner sets the price.
            'monthly_rent' => 1000, 'rent_frequency' => 'monthly',
            'payment_method' => 'cash', 'lease' => UploadedFile::fake()->create('lease.pdf', 50, 'application/pdf'),
            ...$this->location(),
        ])->assertSessionHasNoErrors();

        $this->assertEquals(200000, Tenancy::query()->where('unit_id', $space->id)->value('monthly_rent'));
        Notification::assertSentTo($owner, \App\Notifications\ManagerAssignedTenant::class, fn ($notification, $channels) => $notification->rentReceived === 400000.0
            && $notification->depositReceived === 200000.0
            && in_array('mail', $channels, true) && in_array(\App\Notifications\Channels\SmsChannel::class, $channels, true));

        // The owner's dashboard lists the payment with rent and deposit apart.
        $this->actingAs($owner)->get(route('dashboard'))->assertInertia(fn (\Inertia\Testing\AssertableInertia $page) => $page
            ->where('ownerReport.recent_payments.0.rent', fn ($rent) => (float) $rent === 400000.0)
            ->where('ownerReport.recent_payments.0.deposit', fn ($deposit) => (float) $deposit === 200000.0)
            ->where('ownerReport.recent_payments.0.amount', fn ($amount) => (float) $amount === 600000.0));
    }

    /** A valid Rwandan address for a new tenant. */
    private function location(int $n = 0): array
    {
        $province = \App\Models\Province::create(['name' => 'Kigali City '.$n]);
        $district = \App\Models\District::create(['name' => 'Gasabo '.$n, 'province_id' => $province->id]);
        $sector = \App\Models\Sector::create(['name' => 'Remera '.$n, 'district_id' => $district->id]);

        return ['province_id' => $province->id, 'district_id' => $district->id, 'sector_id' => $sector->id];
    }
}
