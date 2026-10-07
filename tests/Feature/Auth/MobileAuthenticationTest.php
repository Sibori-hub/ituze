<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MobileAuthenticationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->unique();
            $table->string('phone')->nullable()->unique();
            $table->string('role')->nullable();
            $table->string('status')->nullable();
            $table->boolean('profile_completed')->default(false);
            $table->string('national_id')->nullable();
            $table->string('identity_document_type')->nullable();
            $table->string('address')->nullable();
            $table->string('profile_photo')->nullable();
            $table->unsignedBigInteger('sector_id')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('email_otp', 6)->nullable();
            $table->timestamp('email_otp_expires_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->string('password');
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->text('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('sectors', function (Blueprint $table) {
            $table->id();
        });

        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('owner_id');
            $table->string('name');
            $table->string('address')->nullable();
            $table->timestamps();
        });

        Schema::create('property_images', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('property_id');
        });

        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('property_id');
            $table->unsignedBigInteger('unit_type_id')->nullable();
            $table->string('unit_number');
            $table->unsignedTinyInteger('bedrooms')->nullable();
            $table->decimal('bathrooms', 3, 1)->nullable();
            $table->string('status');
            $table->timestamps();
        });

        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('name');
        });

        Schema::create('tenancies', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('unit_id');
            $table->unsignedBigInteger('tenant_id');
            $table->string('status');
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->time('check_in_time')->nullable();
            $table->time('check_out_time')->nullable();
            $table->decimal('monthly_rent', 12, 2);
            $table->string('rent_frequency')->default('monthly');
            $table->timestamps();
        });

        Schema::create('property_inquiries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('owner_id');
            $table->unsignedBigInteger('property_id');
            $table->unsignedBigInteger('unit_id')->nullable();
            $table->string('visitor_name');
            $table->string('visitor_email');
            $table->string('visitor_phone');
            $table->string('status');
            $table->text('message');
            $table->timestamps();
        });
    }

    public function test_mobile_users_can_obtain_and_use_an_api_token(): void
    {
        $user = User::factory()->create();

        $response = $this->postJson('/api/mobile/login', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'test-device',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonStructure(['token', 'user' => ['id', 'role', 'status']]);

        $this->getJson('/api/mobile/me', [
            'Authorization' => 'Bearer '.$response->json('token'),
        ])->assertOk()->assertJsonPath('user.id', $user->id);
    }

    public function test_mobile_login_rejects_invalid_credentials(): void
    {
        $user = User::factory()->create();

        $this->postJson('/api/mobile/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ])->assertUnauthorized();
    }

    public function test_mobile_logout_revokes_the_current_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test-device')->plainTextToken;

        $this->postJson('/api/mobile/logout', [], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $user->id]);
        Auth::forgetGuards();

        $this->getJson('/api/mobile/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnauthorized();
    }

    public function test_mobile_registration_creates_a_pending_owner_and_token_in_the_shared_users_table(): void
    {
        $response = $this->postJson('/api/mobile/register', [
            'first_name' => 'Aline',
            'last_name' => 'Owner',
            'email' => 'aline@example.com',
            'phone' => '0781234567',
            'password' => 'password',
            'password_confirmation' => 'password',
            'device_name' => 'test-device',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('user.email', 'aline@example.com')
            ->assertJsonPath('user.phone', '0781234567')
            ->assertJsonPath('user.role', 'owner')
            ->assertJsonPath('user.status', 'pending')
            ->assertJsonPath('user.profile_completed', false)
            ->assertJsonPath('verification_required', false)
            ->assertJsonStructure(['token', 'user' => ['id', 'email', 'role', 'status']]);

        $user = User::query()->where('email', 'aline@example.com')->firstOrFail();
        $this->assertSame('Aline Owner', $user->name);
        $this->assertSame('0781234567', $user->phone);
        $this->assertNotSame('password', $user->password);
        $this->assertSame('owner', $user->role);
        $this->assertSame('pending', $user->status);
        $this->assertNotNull($user->email_verified_at);
        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'name' => 'test-device',
        ]);
    }

    public function test_mobile_registration_uses_the_existing_email_otp_verification_flow(): void
    {
        Notification::fake();
        config(['auth.email_otp_enabled' => true]);

        $response = $this->postJson('/api/mobile/register', [
            'first_name' => 'Aline',
            'last_name' => 'Owner',
            'email' => 'otp-owner@example.com',
            'phone' => '0781234567',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertCreated()
            ->assertJsonPath('verification_required', true)
            ->assertJsonPath('user.email_verified', false);

        $user = User::query()->where('email', 'otp-owner@example.com')->firstOrFail();
        Notification::assertSentTo($user, \App\Notifications\EmailVerificationOtp::class);
        $headers = ['Authorization' => 'Bearer '.$response->json('token')];

        $this->postJson('/api/mobile/verify-email-otp', ['otp' => '000000'], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('otp');

        $this->postJson('/api/mobile/verify-email-otp', ['otp' => $user->email_otp], $headers)
            ->assertOk()
            ->assertJsonPath('message', 'Email verified successfully.');

        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->assertNull($user->fresh()->email_otp);
    }

    public function test_mobile_registration_validates_password_confirmation_email_and_rwanda_phone(): void
    {
        $this->postJson('/api/mobile/register', [
            'first_name' => 'Aline',
            'last_name' => 'Owner',
            'email' => 'not-an-email',
            'phone' => '0791234567',
            'password' => 'password',
            'password_confirmation' => 'different',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'phone', 'password']);
    }

    public function test_mobile_owner_can_complete_profile_and_remains_pending_admin_approval(): void
    {
        Storage::fake('public');
        $user = User::factory()->create([
            'role' => 'owner',
            'status' => 'pending',
            'profile_completed' => false,
            'email_verified_at' => now(),
        ]);
        $sectorId = DB::table('sectors')->insertGetId([]);
        $token = $user->createToken('test-device')->plainTextToken;

        $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
            'Accept' => 'application/json',
        ])->post('/api/mobile/complete-profile', [
            'national_id' => '1199080012345678',
            'identity_document_type' => 'nida',
            'address' => 'Kigali, Rwanda',
            'sector_id' => $sectorId,
            'profile_photo' => UploadedFile::fake()->createWithContent(
                'profile.png',
                base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/mH8AAAAASUVORK5CYII=')
            ),
        ])->assertOk()
            ->assertJsonPath('user.profile_completed', true)
            ->assertJsonPath('user.status', 'pending')
            ->assertJsonPath('message', 'Profile completed successfully. Your account is waiting for admin approval.');

        $user->refresh();
        $this->assertTrue($user->profile_completed);
        $this->assertSame('pending', $user->status);
        Storage::disk('public')->assertExists($user->profile_photo);

        $this->getJson('/api/mobile/dashboard', [
            'Authorization' => 'Bearer '.$token,
        ])->assertForbidden();
    }

    public function test_mobile_owner_dashboard_includes_rent_vat_and_each_active_lease_end_date(): void
    {
        config(['finance.rwanda_vat_rate' => 18]);
        $user = User::factory()->create([
            'role' => 'owner',
            'status' => 'approved',
            'profile_completed' => true,
            'email_verified_at' => now(),
            'expires_at' => now()->addYear(),
        ]);
        $propertyId = DB::table('properties')->insertGetId([
            'owner_id' => $user->id,
            'name' => 'Owner property',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $unitId = DB::table('units')->insertGetId([
            'property_id' => $propertyId,
            'unit_number' => 'A-01',
            'status' => 'occupied',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $tenantId = DB::table('tenants')->insertGetId(['name' => 'Tenant Example']);
        DB::table('tenancies')->insert([
            'unit_id' => $unitId,
            'tenant_id' => $tenantId,
            'status' => 'active',
            'start_date' => '2026-01-01',
            'end_date' => '2026-12-31',
            'monthly_rent' => '250000.00',
            'rent_frequency' => 'monthly',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('property_inquiries')->insert([
            'owner_id' => $user->id,
            'property_id' => $propertyId,
            'unit_id' => $unitId,
            'visitor_name' => 'Jean Visitor',
            'visitor_email' => 'jean@example.com',
            'visitor_phone' => '+250783000111',
            'status' => 'new',
            'message' => 'I would like to view this space.',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $token = $user->createToken('test-device')->plainTextToken;

        $this->getJson('/api/mobile/dashboard', [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()
            ->assertJsonPath('summary.occupiedUnits', 1)
            ->assertJsonPath('recentTenancies.0.monthly_rent', '250000.00')
            ->assertJsonPath('recentTenancies.0.vat_rate', '18.00')
            ->assertJsonPath('recentTenancies.0.vat_amount', '45000.00')
            ->assertJsonPath('recentTenancies.0.rent_including_vat', '295000.00')
            ->assertJsonPath('recentTenancies.0.end_date', '2026-12-31')
            ->assertJsonPath('recentTenancies.0.unit.property.name', 'Owner property')
            ->assertJsonPath('recentInquiries.0.visitor_name', 'Jean Visitor')
            ->assertJsonPath('recentInquiries.0.visitor_email', 'jean@example.com')
            ->assertJsonPath('recentInquiries.0.visitor_phone', '+250783000111')
            ->assertJsonPath('recentInquiries.0.message', 'I would like to view this space.');
    }
}
