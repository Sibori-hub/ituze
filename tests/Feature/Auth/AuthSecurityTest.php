<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Notifications\OtpCodeMail;
use App\Services\OtpService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AuthSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['auth.login_otp_enabled' => true]);
        Notification::fake();
    }

    private function owner(array $attributes = []): User
    {
        return User::factory()->create([
            'role' => 'owner',
            'status' => 'approved',
            'expires_at' => now()->addYear(),
            'phone' => '0781234567',
            'phone_verified_at' => now(),
            ...$attributes,
        ]);
    }

    private function sentLoginCode(User $user): string
    {
        $code = null;
        Notification::assertSentTo($user, OtpCodeMail::class, function ($notification) use (&$code) {
            $code = $notification->code;

            return true;
        });

        return $code;
    }

    public function test_mobile_login_code_cannot_be_used_without_the_password_challenge(): void
    {
        $user = $this->owner();

        // The code goes to both the email address and the WhatsApp number.
        $login = $this->postJson('/api/mobile/login', [
            'phone' => $user->phone,
            'password' => 'password',
        ])->assertOk()->assertJsonPath('otp_required', true);

        $challenge = $login->json('challenge');
        $this->assertSame(64, strlen($challenge));
        $code = $this->sentLoginCode($user);

        // The old attack: identifier + code only.
        $this->postJson('/api/mobile/login-otp', ['phone' => $user->phone, 'code' => $code])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('challenge');
        $this->postJson('/api/mobile/login-otp/resend', ['phone' => $user->phone])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('challenge');
        $this->postJson('/api/mobile/login-otp', ['challenge' => str_repeat('a', 64), 'code' => $code])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('challenge');

        $this->postJson('/api/mobile/login-otp', ['challenge' => $challenge, 'code' => $code])
            ->assertOk()
            ->assertJsonStructure(['token']);

        // A challenge is single use.
        $this->postJson('/api/mobile/login-otp', ['challenge' => $challenge, 'code' => $code])
            ->assertUnprocessable();
    }

    public function test_the_same_login_code_goes_to_email_and_whatsapp(): void
    {
        $user = $this->owner();
        $whatsappCode = null;
        $this->mock(\App\Services\WhatsAppCloudService::class, function ($mock) use ($user, &$whatsappCode) {
            $mock->shouldReceive('isConfigured')->andReturn(true);
            $mock->shouldReceive('sendOtp')->once()
                ->withArgs(function ($phone, $code, $purpose) use ($user, &$whatsappCode) {
                    $whatsappCode = $code;

                    return $phone === $user->phone && $purpose === 'login';
                });
        });

        // Signing in by email: the code still reaches the phone too, and vice versa.
        $this->post('/login', ['email' => $user->email, 'password' => 'password'])
            ->assertRedirect(route('login.otp.notice'));

        $this->assertSame($whatsappCode, $this->sentLoginCode($user), 'Email and WhatsApp must carry the same code.');

        $this->get(route('login.otp.notice'))
            ->assertInertia(fn ($page) => $page
                ->component('Auth/VerifyLoginOtp')
                ->has('destinations', 2)
                ->where('destinations.0.channel', 'email')
                ->where('destinations.1.channel', 'whatsapp')
                ->where('expiresIn', fn ($seconds) => $seconds > 0));

        // Either copy signs the visitor in.
        $this->post(route('login.otp.verify'), ['otp' => $whatsappCode])->assertRedirect(route('dashboard', absolute: false));
        $this->assertAuthenticatedAs($user);
    }

    public function test_mobile_login_reports_both_code_destinations(): void
    {
        $user = $this->owner();

        $this->postJson('/api/mobile/login', ['email' => $user->email, 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('otp_required', true)
            ->assertJsonPath('channels', ['email', 'whatsapp'])
            ->assertJsonPath('channel', 'both')
            ->assertJsonPath('destinations.email', $user->email)
            ->assertJsonPath('destinations.whatsapp', $user->phone);
    }

    public function test_codes_are_hashed_and_burned_after_too_many_wrong_guesses(): void
    {
        $user = $this->owner();
        $otp = app(OtpService::class);

        $otp->sendLoginOtp($user);
        $code = $this->sentLoginCode($user);
        $this->assertNotSame($code, $user->fresh()->login_otp);

        $wrong = $code === '000000' ? '111111' : '000000';
        for ($i = 1; $i < OtpService::MAX_ATTEMPTS; $i++) {
            $this->assertSame(OtpService::INVALID, $otp->verifyLoginOtp($user->fresh(), $wrong));
        }
        $this->assertSame(OtpService::LOCKED, $otp->verifyLoginOtp($user->fresh(), $wrong));

        // Even the right code no longer works once the code is burned.
        $this->assertNotSame(OtpService::VALID, $otp->verifyLoginOtp($user->fresh(), $code));
    }

    public function test_admins_must_clear_the_login_code_too(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved', 'phone' => '0781111111']);

        $this->post('/login', ['email' => $admin->email, 'password' => 'password'])
            ->assertRedirect(route('login.otp.notice'));

        $this->assertGuest();
        // WhatsApp is not configured in tests, so the code falls back to email.
        Notification::assertSentTo($admin, OtpCodeMail::class);
    }

    public function test_disabling_an_account_revokes_tokens_and_blocks_existing_sessions(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved']);
        $owner = $this->owner();
        $token = $owner->createToken('phone')->plainTextToken;

        $this->actingAs($admin)->post(route('admin.users.disable', $owner))->assertRedirect();
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $owner->id]);

        // A web session that was already open is signed out on its next request.
        $this->actingAs($owner->fresh())->get('/profile')->assertRedirect(route('login'));
        $this->assertGuest();
    }

    public function test_disabled_accounts_cannot_use_a_still_valid_mobile_token(): void
    {
        $owner = $this->owner();
        $token = $owner->createToken('phone')->plainTextToken;
        $owner->forceFill(['status' => 'disabled', 'disabled_at' => now()])->save();

        $this->getJson('/api/mobile/me', ['Authorization' => 'Bearer '.$token])->assertForbidden();
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $owner->id]);
    }

    public function test_changing_the_phone_number_requires_verification_and_must_be_unique(): void
    {
        $this->owner(['phone' => '0789999999']);
        $user = $this->owner(['phone' => '0781234567']);

        $this->actingAs($user)->patch('/profile', [
            'first_name' => 'Test',
            'last_name' => 'Owner',
            'email' => $user->email,
            'phone' => '0789999999',
        ])->assertSessionHasErrors('phone');

        $this->actingAs($user)->patch('/profile', [
            'first_name' => 'Test',
            'last_name' => 'Owner',
            'email' => $user->email,
            'phone' => 'not-a-phone',
        ])->assertSessionHasErrors('phone');

        $this->actingAs($user)->patch('/profile', [
            'first_name' => 'Test',
            'last_name' => 'Owner',
            'email' => $user->email,
            'phone' => '0722222222',
        ])->assertRedirect(route('phone.notice'));

        $user->refresh();
        $this->assertSame('0722222222', $user->phone);
        $this->assertNull($user->phone_verified_at);
        $this->assertTrue($user->awaitingPhoneVerification());
        $this->actingAs($user)->get('/dashboard')->assertRedirect(route('phone.notice'));
    }

    public function test_phone_step_replaces_a_code_that_expired_during_the_email_step(): void
    {
        $user = $this->owner(['phone_verified_at' => null]);
        app(OtpService::class)->sendPhoneOtp($user);

        // The visitor spends longer than the code's lifetime on the email step.
        $this->travel(OtpService::CODE_TTL_MINUTES + 1)->minutes();

        $this->actingAs($user)->get(route('phone.notice'))
            ->assertInertia(fn ($page) => $page
                ->component('Auth/VerifyPhone')
                ->where('status', 'Your previous code had expired, so we sent you a new one.')
                ->where('expiresIn', fn ($seconds) => $seconds > (OtpService::CODE_TTL_MINUTES * 60) - 5));

        $this->assertTrue($user->fresh()->phone_otp_expires_at->isFuture());

        // Reloading straight away does not send yet another code.
        $expiry = $user->fresh()->phone_otp_expires_at;
        $this->actingAs($user)->get(route('phone.notice'))->assertOk();
        $this->assertEquals($expiry, $user->fresh()->phone_otp_expires_at);
    }

    public function test_profile_completion_requires_a_16_digit_nida_or_a_valid_passport(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        $sectorId = \Illuminate\Support\Facades\DB::table('sectors')->insertGetId(['name' => 'Kimihurura', 'district_id' => \Illuminate\Support\Facades\DB::table('districts')->insertGetId(['name' => 'Gasabo', 'province_id' => \Illuminate\Support\Facades\DB::table('provinces')->insertGetId(['name' => 'Kigali'])])]);
        $user = $this->owner(['status' => 'pending', 'expires_at' => null, 'profile_completed' => false]);

        $submit = fn (string $type, string $number) => $this->actingAs($user)->post(route('profile.complete.store'), [
            'identity_document_type' => $type,
            'national_id' => $number,
            'sector_id' => $sectorId,
            'profile_photo' => \Illuminate\Http\UploadedFile::fake()->image('me.jpg'),
        ]);

        $submit('nida', '119908001234567')->assertSessionHasErrors(['national_id' => 'A NIDA number has exactly 16 digits.']);
        $submit('nida', '11990800123456789')->assertSessionHasErrors('national_id');
        $submit('passport', 'P-1')->assertSessionHasErrors('national_id');

        // Spaces as printed on the card are accepted and stored as plain digits.
        $submit('nida', '1 1990 8 0012345 0 12')->assertSessionHasNoErrors();
        $this->assertSame('1199080012345012', $user->fresh()->national_id);
        $this->assertTrue($user->fresh()->profile_completed);
    }

    public function test_admin_can_approve_an_owner_from_the_mobile_api(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved']);
        $pending = $this->owner(['status' => 'pending', 'expires_at' => null]);
        $headers = ['Authorization' => 'Bearer '.$admin->createToken('phone')->plainTextToken];

        $this->postJson("/api/mobile/workspace/approvals/{$pending->id}/approve", [], $headers)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('payment_verified');

        $this->postJson("/api/mobile/workspace/approvals/{$pending->id}/approve", ['payment_verified' => true], $headers)
            ->assertOk()
            ->assertJsonPath('user.status', 'approved');

        $this->assertTrue($pending->fresh()->expires_at->isFuture());
    }

    public function test_public_inquiries_are_rate_limited(): void
    {
        $owner = $this->owner();
        $property = \App\Models\Property::query()->forceCreate(['owner_id' => $owner->id, 'name' => 'Rate Limit House', 'address' => 'KG 1 Ave']);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson("/spaces/{$property->id}/inquiries", [])->assertUnprocessable();
        }

        $this->postJson("/spaces/{$property->id}/inquiries", [])->assertStatus(429);
    }

    public function test_the_ai_description_endpoint_is_for_approved_workspaces_only(): void
    {
        $pending = $this->owner(['status' => 'pending', 'expires_at' => null]);

        $this->actingAs($pending)
            ->postJson('/api/ai/generate-property-description', ['name' => 'Test'])
            ->assertRedirect(route('account.status'));
    }

    public function test_admin_user_list_returns_filtered_users_and_tab_counts(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved']);
        $this->owner(['phone' => '0781111001']);
        $this->owner(['status' => 'pending', 'phone' => '0781111002']);
        User::factory()->create(['role' => 'advertiser', 'status' => 'pending']);

        $this->actingAs($admin)->get(route('admin.users', ['status' => 'pending']))
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Users')
                ->has('users.data', 2)
                ->where('counts.all', 4)
                ->where('counts.roles.owner', 2)
                ->where('counts.roles.advertiser', 1)
                ->where('counts.statuses.pending', 2));
    }

    private function managedAccountPayload(array $overrides = []): array
    {
        $sectorId = \Illuminate\Support\Facades\DB::table('sectors')->insertGetId([
            'name' => 'Kimihurura',
            'district_id' => \Illuminate\Support\Facades\DB::table('districts')->insertGetId([
                'name' => 'Gasabo',
                'province_id' => \Illuminate\Support\Facades\DB::table('provinces')->insertGetId(['name' => 'Kigali']),
            ]),
        ]);

        return [
            'role' => 'owner',
            'first_name' => 'Jeanne',
            'last_name' => 'Mukamana',
            'email' => 'jeanne.owner@example.com',
            'phone' => '+250 788 555 111',
            'identity_document_type' => 'nida',
            'national_id' => '1 1985 7 0012345 0 99',
            'sector_id' => $sectorId,
            'profile_photo' => \Illuminate\Http\UploadedFile::fake()->image('jeanne.jpg'),
            ...$overrides,
        ];
    }

    public function test_admin_creates_a_managed_owner_who_cannot_sign_in(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved', 'name' => 'Ituze Admin']);

        $this->actingAs($admin)->get(route('admin.users.create'))->assertOk()
            ->assertInertia(fn ($page) => $page->component('Admin/CreateUser')->has('locations.sectors'));

        $this->actingAs($admin)->post(route('admin.users.store'), $this->managedAccountPayload())
            ->assertRedirect(route('admin.users', ['source' => 'managed']))
            ->assertSessionHas('success');

        $owner = User::query()->where('email', 'jeanne.owner@example.com')->firstOrFail();
        $this->assertSame($admin->id, $owner->created_by);
        $this->assertTrue($owner->isManaged());
        $this->assertFalse($owner->login_enabled);
        $this->assertSame('approved', $owner->status);
        $this->assertTrue($owner->expires_at->isFuture());
        $this->assertTrue($owner->profile_completed);
        $this->assertSame('0788555111', $owner->phone);
        $this->assertSame('1198570012345099', $owner->national_id);
        $this->assertNotNull($owner->email_verified_at);
        \Illuminate\Support\Facades\Storage::disk('public')->assertExists($owner->profile_photo);

        // Q.R.A manages the account: no sign-in on the web or the mobile app.
        auth()->logout();
        $this->post('/login', ['email' => $owner->email, 'password' => 'anything'])->assertSessionHasErrors('email');
        $this->assertGuest();

        // Listed as managed, with the admin who added it.
        $this->actingAs($admin)->get(route('admin.users', ['source' => 'managed']))
            ->assertInertia(fn ($page) => $page
                ->has('users.data', 1)
                ->where('users.data.0.email', 'jeanne.owner@example.com')
                ->where('users.data.0.creator.name', 'Ituze Admin')
                ->where('counts.sources.managed', 1));
    }

    public function test_managed_accounts_are_refused_by_the_mobile_login_even_with_a_password(): void
    {
        $owner = $this->owner(['created_by' => User::factory()->create(['role' => 'admin'])->id]);
        $owner->forceFill(['login_enabled' => false])->save();

        $this->postJson('/api/mobile/login', ['email' => $owner->email, 'password' => 'password'])
            ->assertForbidden()
            ->assertJsonPath('message', 'This account is managed by ITUZE GREEN PLATFORM. Please contact us for more information.');
    }

    public function test_admin_can_create_a_managed_advertiser_and_validation_matches_registration(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved']);
        $this->owner(['email' => 'taken@example.com', 'phone' => '0788555222']);

        $this->actingAs($admin)->post(route('admin.users.store'), $this->managedAccountPayload([
            'email' => 'taken@example.com',
            'phone' => '0788555222',
            'national_id' => '12345',
        ]))->assertSessionHasErrors(['email', 'phone', 'national_id']);

        $this->actingAs($admin)->post(route('admin.users.store'), $this->managedAccountPayload([
            'role' => 'advertiser',
            'email' => 'brand@example.com',
            'phone' => '0722555333',
        ]))->assertSessionHasNoErrors();

        $advertiser = User::query()->where('email', 'brand@example.com')->firstOrFail();
        $this->assertSame('advertiser', $advertiser->role);
        $this->assertSame('approved', $advertiser->status);
        $this->assertNull($advertiser->expires_at);
        $this->assertTrue($advertiser->isManaged());
    }

    public function test_only_admins_can_create_managed_accounts(): void
    {
        $owner = $this->owner();

        $this->actingAs($owner)->get(route('admin.users.create'))->assertForbidden();
        $this->actingAs($owner)->post(route('admin.users.store'), [])->assertForbidden();
    }

    public function test_csv_export_neutralises_spreadsheet_formulas(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved']);
        $this->owner(['name' => '=HYPERLINK("http://evil.test")']);

        $csv = $this->actingAs($admin)->get(route('admin.users.export.excel'))->streamedContent();

        $this->assertStringContainsString("'=HYPERLINK", $csv);
    }
}
