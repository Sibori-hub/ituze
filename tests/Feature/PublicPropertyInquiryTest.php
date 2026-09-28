<?php

namespace Tests\Feature;

use App\Models\Property;
use App\Models\PropertyInquiry;
use App\Models\Unit;
use App\Models\UnitType;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PublicPropertyInquiryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach (['move_out_inspections', 'rent_payments', 'rent_charges', 'leases', 'property_inquiries', 'unit_images', 'tenancies', 'tenants', 'units', 'unit_types', 'properties', 'users'] as $table) {
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
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
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

        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->foreignId('unit_type_id')->constrained();
            $table->string('unit_number');
            $table->integer('floor_number')->nullable();
            $table->decimal('rent_amount', 12, 2);
            $table->string('rent_frequency')->default('monthly');
            $table->decimal('size_sqm', 12, 2)->nullable();
            $table->text('description')->nullable();
            $table->string('status')->default('available');
            $table->timestamps();
        });

        Schema::create('property_inquiries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->foreignId('unit_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('visitor_name');
            $table->string('visitor_email');
            $table->string('visitor_phone', 40);
            $table->text('message');
            $table->string('status')->default('new');
            $table->timestamp('responded_at')->nullable();
            $table->timestamp('whatsapp_sent_at')->nullable();
            $table->text('whatsapp_error')->nullable();
            $table->timestamps();
        });
    }

    public function test_inquiry_requires_visitor_email_and_phone(): void
    {
        [$owner, $property, $unit] = $this->makeListing();

        $this->from(route('public.units.show', [$property, $unit]))
            ->post(route('public.properties.inquiries.store', $property), [
                'unit_id' => $unit->id,
                'visitor_name' => 'Jean Visitor',
                'message' => 'Please send more information.',
            ])
            ->assertSessionHasErrors(['visitor_email', 'visitor_phone']);

        $this->assertDatabaseCount('property_inquiries', 0);
    }

    public function test_valid_inquiry_is_saved_as_new_for_the_property_owner(): void
    {
        [$owner, $property, $unit] = $this->makeListing();

        $this->from(route('public.units.show', [$property, $unit]))
            ->post(route('public.properties.inquiries.store', $property), $this->inquiryData($unit))
            ->assertRedirect(route('public.units.show', [$property, $unit]))
            ->assertSessionHas('success', 'Your inquiry was received and sent to the property owner.');

        $this->assertDatabaseHas('property_inquiries', [
            'property_id' => $property->id,
            'unit_id' => $unit->id,
            'owner_id' => $owner->id,
            'visitor_email' => 'visitor@example.com',
            'visitor_phone' => '+250783000111',
            'status' => 'new',
        ]);
    }

    public function test_duplicate_property_inquiry_is_blocked_until_owner_marks_previous_inquiry_read(): void
    {
        [$owner, $property, $unit, $otherUnit] = $this->makeListing(true);
        $this->submitInquiry($property, $unit);

        $this->from(route('public.units.show', [$property, $otherUnit]))
            ->post(route('public.properties.inquiries.store', $property), $this->inquiryData($otherUnit))
            ->assertSessionHasErrors('inquiry');
        $this->from(route('public.units.show', [$property, $otherUnit]))
            ->post(route('public.properties.inquiries.store', $property), [
                ...$this->inquiryData($otherUnit),
                'visitor_phone' => '+250783999999',
            ])
            ->assertSessionHasErrors('inquiry');
        $this->from(route('public.units.show', [$property, $otherUnit]))
            ->post(route('public.properties.inquiries.store', $property), [
                ...$this->inquiryData($otherUnit),
                'visitor_email' => 'another@example.com',
                'visitor_phone' => '0783 000 111',
            ])
            ->assertSessionHasErrors('inquiry');
        $this->assertDatabaseCount('property_inquiries', 1);

        $inquiry = PropertyInquiry::query()->firstOrFail();
        $this->actingAs($owner)
            ->post(route('inquiries.read', $inquiry))
            ->assertSessionHas('success', 'Inquiry marked as read. The visitor can submit another inquiry.');
        $this->assertDatabaseHas('property_inquiries', ['id' => $inquiry->id, 'status' => 'read']);

        $this->submitInquiry($property, $otherUnit);
        $this->assertDatabaseCount('property_inquiries', 2);
    }

    public function test_same_visitor_can_inquire_about_a_different_property(): void
    {
        [$owner, $property, $unit] = $this->makeListing();
        [, $otherProperty, $otherUnit] = $this->makeListing(false, $owner);
        $this->submitInquiry($property, $unit);

        $this->submitInquiry($otherProperty, $otherUnit);

        $this->assertDatabaseCount('property_inquiries', 2);
    }

    private function makeListing(bool $withSecondUnit = false, ?User $existingOwner = null): array
    {
        $owner = $existingOwner ?? User::factory()->create([
            'role' => 'owner',
            'status' => 'approved',
            'profile_completed' => true,
            'expires_at' => now()->addYear(),
            'email_verified_at' => now(),
        ]);
        $property = Property::query()->create([
            'owner_id' => $owner->id,
            'name' => 'Test Rental Property',
            'address' => 'Kigali',
        ]);
        $unitType = UnitType::query()->create(['name' => 'Office']);
        $unit = $this->makeUnit($property, $unitType, 'A-101');
        $otherUnit = $withSecondUnit ? $this->makeUnit($property, $unitType, 'A-102') : null;

        return [$owner, $property, $unit, $otherUnit];
    }

    private function makeUnit(Property $property, UnitType $unitType, string $number): Unit
    {
        return Unit::query()->create([
            'property_id' => $property->id,
            'unit_type_id' => $unitType->id,
            'unit_number' => $number,
            'rent_amount' => 250000,
            'rent_frequency' => 'monthly',
            'status' => 'available',
        ]);
    }

    private function inquiryData(Unit $unit): array
    {
        return [
            'unit_id' => $unit->id,
            'visitor_name' => 'Jean Visitor',
            'visitor_email' => 'Visitor@Example.com',
            'visitor_phone' => '+250783000111',
            'message' => 'Please send more information.',
        ];
    }

    private function submitInquiry(Property $property, Unit $unit): void
    {
        $this->from(route('public.units.show', [$property, $unit]))
            ->post(route('public.properties.inquiries.store', $property), $this->inquiryData($unit))
            ->assertRedirect(route('public.units.show', [$property, $unit]));
    }
}
