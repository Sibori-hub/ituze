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

        foreach (['chat_messages', 'chat_conversations', 'move_out_inspections', 'rent_payments', 'rent_charges', 'leases', 'property_inquiries', 'unit_images', 'tenancies', 'tenants', 'units', 'property_units', 'unit_types', 'properties', 'users'] as $table) {
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
            $table->string('identity_document')->nullable();
            $table->string('address')->nullable();
            $table->unsignedBigInteger('sector_id')->nullable();
            $table->string('profile_photo')->nullable();
            $table->boolean('profile_completed')->default(false);
            $table->string('password');
            $table->timestamp('email_verified_at')->nullable();
            $table->string('remember_token')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        // The menu counts unread support chats.
        Schema::create('chat_conversations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();
        });
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('conversation_id');
            $table->unsignedBigInteger('sender_id')->nullable();
            $table->boolean('from_support')->default(false);
            $table->text('body')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->boolean('requires_listing')->default(false);
            $table->timestamp('listed_until')->nullable();
            // Paid per property: these test buildings are paid.
            $table->dateTime('paid_until')->nullable()->default('2099-12-31 00:00:00');
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
            $table->text('description')->nullable();
            $table->string('status')->default('available');
            $table->timestamps();
        });

        // Only what the public listing checks: a room's current or upcoming tenancy.
        Schema::create('tenancies', function (Blueprint $table) {
            $table->id();
            $table->string('business_use', 120)->nullable();
            $table->unsignedBigInteger('unit_id');
            $table->string('status');
            $table->unsignedBigInteger('renewed_from_id')->nullable();
            $table->timestamps();
        });

        Schema::create('property_inquiries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->foreignId('unit_id')->nullable()->constrained()->nullOnDelete();
            $table->string('business_use', 120)->nullable();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('visitor_name');
            $table->string('visitor_email');
            $table->string('visitor_phone', 40);
            $table->text('message');
            $table->text('response_message')->nullable();
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

    public function test_new_inquiry_alerts_owner_and_admins_by_email_and_sms(): void
    {
        \Illuminate\Support\Facades\Notification::fake();
        [$owner, $property, $unit] = $this->makeListing();
        $owner->update(['phone' => '0788111222']);
        $admin = User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'phone' => '0788999000', 'role' => 'admin', 'status' => 'approved', 'password' => bcrypt('password')]);
        $otherOwner = User::create(['name' => 'Other', 'email' => 'other@example.com', 'phone' => '0788555666', 'role' => 'owner', 'status' => 'approved', 'password' => bcrypt('password')]);

        $this->post(route('public.properties.inquiries.store', $property), $this->inquiryData($unit))->assertSessionHasNoErrors();

        foreach ([$owner, $admin] as $user) {
            \Illuminate\Support\Facades\Notification::assertSentTo($user, \App\Notifications\NewPropertyInquiry::class, function ($notification, array $channels) use ($user) {
                $sms = $notification->toSms($user);

                return in_array('mail', $channels, true)
                    && in_array(\App\Notifications\Channels\SmsChannel::class, $channels, true)
                    && str_contains($sms, '+250783000111')
                    && str_contains($notification->toMail($user)->subject, 'New inquiry');
            });
        }
        \Illuminate\Support\Facades\Notification::assertNotSentTo($otherOwner, \App\Notifications\NewPropertyInquiry::class);
    }

    public function test_sms_service_sends_through_pindo_or_africastalking_and_only_logs_by_default(): void
    {
        \Illuminate\Support\Facades\Http::fake(['*' => \Illuminate\Support\Facades\Http::response(['ok' => true], 201)]);
        $sms = app(\App\Services\SmsService::class);

        config(['services.sms.driver' => 'log']);
        $sms->send('0788 123 456', 'Hello');
        \Illuminate\Support\Facades\Http::assertNothingSent();

        config(['services.sms.driver' => 'pindo', 'services.sms.pindo.token' => 'test-token', 'services.sms.pindo.sender' => 'ITUZE']);
        $sms->send('0788 123 456', 'Hello');
        \Illuminate\Support\Facades\Http::assertSent(fn ($request) => $request->url() === 'https://api.pindo.io/v1/sms/'
            && $request['to'] === '+250788123456' && $request['sender'] === 'ITUZE' && $request->hasHeader('Authorization', 'Bearer test-token'));

        config(['services.sms.driver' => 'africastalking', 'services.sms.africastalking.username' => 'sandbox', 'services.sms.africastalking.api_key' => 'k']);
        $sms->send('788123456', 'Hi');
        \Illuminate\Support\Facades\Http::assertSent(fn ($request) => str_starts_with($request->url(), 'https://api.sandbox.africastalking.com/')
            && $request['to'] === '+250788123456' && $request['username'] === 'sandbox' && $request->hasHeader('apiKey', 'k'));
    }

    public function test_mobile_inquiry_endpoint_returns_json_and_preserves_duplicate_protection(): void
    {
        [$owner, $property, $unit] = $this->makeListing();
        $data = $this->inquiryData($unit);

        $response = $this->postJson('/api/mobile/properties/'.$property->id.'/inquiries', $data)
            ->assertCreated()
            ->assertJsonPath('message', 'Your inquiry was received and sent to the property owner.')
            ->assertJsonStructure(['inquiry' => ['id']]);

        $this->assertDatabaseHas('property_inquiries', [
            'property_id' => $property->id,
            'unit_id' => $unit->id,
            'owner_id' => $owner->id,
            'visitor_email' => 'visitor@example.com',
            'visitor_phone' => '+250783000111',
            'status' => 'new',
        ]);

        $this->postJson('/api/mobile/properties/'.$property->id.'/inquiries', $data)
            ->assertUnprocessable()
            ->assertJsonPath('errors.inquiry.0', 'We already have your inquiry for this property. The owner will review it shortly. You can send another inquiry after the owner marks this one as read.');
        $this->assertDatabaseCount('property_inquiries', 1);
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
            ->post(route('inquiries.read', $inquiry), ['reply_message' => 'Hello Jean, the office is available.'])
            ->assertSessionHas('success', 'Reply prepared. The inquiry was marked as read.');
        $this->assertDatabaseHas('property_inquiries', [
            'id' => $inquiry->id,
            'status' => 'read',
            'response_message' => 'Hello Jean, the office is available.',
        ]);

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
