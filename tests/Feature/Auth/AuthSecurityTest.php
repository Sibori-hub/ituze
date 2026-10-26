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

    public function test_the_phone_code_goes_by_sms_when_pindo_is_set_up(): void
    {
        config(['services.sms.driver' => 'pindo', 'services.sms.pindo.token' => 'test-token']);
        \Illuminate\Support\Facades\Http::fake(['api.pindo.io/*' => \Illuminate\Support\Facades\Http::response(['ok' => true])]);
        $this->mock(\App\Services\WhatsAppCloudService::class, fn ($mock) => $mock->shouldNotReceive('sendOtp'));
        $user = $this->owner();

        $this->post('/login', ['email' => $user->email, 'password' => 'password'])
            ->assertRedirect(route('login.otp.notice'));

        $smsCode = null;
        \Illuminate\Support\Facades\Http::assertSent(function ($request) use (&$smsCode) {
            preg_match('/ITUZE code: (\d{6})\./', (string) $request['text'], $match);
            $smsCode = $match[1] ?? null;

            return $request->url() === 'https://api.pindo.io/v1/sms/' && $request['to'] === '+250781234567';
        });
        $this->assertSame($smsCode, $this->sentLoginCode($user), 'Email and SMS must carry the same code.');

        $this->post(route('login.otp.verify'), ['otp' => $smsCode])->assertRedirect(route('dashboard', absolute: false));
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

    public function test_owners_cannot_change_their_own_phone_number(): void
    {
        $user = $this->owner(['phone' => '0781234567']);

        $this->actingAs($user)->patch('/profile', [
            'first_name' => 'Test',
            'last_name' => 'Owner',
            'email' => $user->email,
            'phone' => '0722222222',
        ])->assertSessionHasNoErrors()->assertRedirect(route('profile.edit'));

        $user->refresh();
        $this->assertSame('0781234567', $user->phone, 'Only an admin changes phone numbers.');
        $this->assertNotNull($user->phone_verified_at);
    }

    public function test_only_the_admin_changes_a_phone_and_the_new_number_must_be_confirmed(): void
    {
        config(['services.sms.driver' => 'pindo', 'services.sms.pindo.token' => 'test-token']);
        \Illuminate\Support\Facades\Http::fake(['api.pindo.io/*' => \Illuminate\Support\Facades\Http::response(['ok' => true])]);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved', 'phone' => '0783163187']);
        $this->owner(['phone' => '0789999999']);
        $user = $this->owner(['phone' => '0781234567']);

        // Other users cannot use the admin action.
        $this->actingAs($user)->patch(route('admin.users.phone', $user), ['phone' => '0722222222'])->assertForbidden();

        // The number must be valid and free.
        $this->actingAs($admin)->patch(route('admin.users.phone', $user), ['phone' => '0789999999'])
            ->assertSessionHasErrors(['phone' => 'This phone number is already registered.']);
        $this->actingAs($admin)->patch(route('admin.users.phone', $user), ['phone' => 'not-a-phone'])
            ->assertSessionHasErrors('phone');
        $this->actingAs($admin)->patch(route('admin.users.phone', $admin), ['phone' => '0722222222'])->assertNotFound();

        $this->actingAs($admin)->patch(route('admin.users.phone', $user), ['phone' => '+250 722 222 222'])
            ->assertSessionHasNoErrors();

        $user->refresh();
        $this->assertSame('0722222222', $user->phone);
        $this->assertNull($user->phone_verified_at);
        $this->assertTrue($user->awaitingPhoneVerification());
        \Illuminate\Support\Facades\Http::assertSent(fn ($request) => $request['to'] === '+250781234567'
            && str_contains((string) $request['text'], 'phone number on your account was changed'));
        \Illuminate\Support\Facades\Http::assertSent(fn ($request) => $request['to'] === '+250722222222'
            && str_contains((string) $request['text'], 'ITUZE code:'));

        // At the next sign-in the new number must be confirmed first.
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
            'identity_document' => \Illuminate\Http\UploadedFile::fake()->image('id.jpg'),
        ]);
        \Illuminate\Support\Facades\Storage::fake('local');

        $submit('nida', '119908001234567')->assertSessionHasErrors(['national_id' => 'A NIDA number has exactly 16 digits.']);
        $submit('nida', '11990800123456789')->assertSessionHasErrors('national_id');
        $submit('passport', 'P-1')->assertSessionHasErrors('national_id');

        // Spaces as printed on the card are accepted and stored as plain digits.
        $submit('nida', '1 1990 8 0012345 0 12')->assertSessionHasNoErrors();
        $this->assertSame('1199080012345012', $user->fresh()->national_id);
        $this->assertTrue($user->fresh()->profile_completed);
    }

    public function test_profile_completion_requires_one_private_id_file_that_only_admins_can_open(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        \Illuminate\Support\Facades\Storage::fake('local');
        $sectorId = \Illuminate\Support\Facades\DB::table('sectors')->insertGetId(['name' => 'Kimihurura', 'district_id' => \Illuminate\Support\Facades\DB::table('districts')->insertGetId(['name' => 'Gasabo', 'province_id' => \Illuminate\Support\Facades\DB::table('provinces')->insertGetId(['name' => 'Kigali'])])]);
        $user = $this->owner(['status' => 'pending', 'expires_at' => null, 'profile_completed' => false]);
        $form = fn (array $extra) => [
            'identity_document_type' => 'nida',
            'national_id' => '1199080012345012',
            'sector_id' => $sectorId,
            'profile_photo' => \Illuminate\Http\UploadedFile::fake()->image('me.jpg'),
            ...$extra,
        ];

        // The ID file is required and must be a photo or PDF.
        $this->actingAs($user)->post(route('profile.complete.store'), $form([]))
            ->assertSessionHasErrors(['identity_document' => 'Please upload a photo of your ID document.']);
        $this->actingAs($user)->post(route('profile.complete.store'), $form([
            'identity_document' => \Illuminate\Http\UploadedFile::fake()->create('id.exe', 10),
        ]))->assertSessionHasErrors('identity_document');
        $this->assertFalse($user->fresh()->profile_completed);

        // One file is enough for a NIDA card (both sides in one photo or PDF).
        $this->actingAs($user)->post(route('profile.complete.store'), $form([
            'identity_document' => \Illuminate\Http\UploadedFile::fake()->create('nida.pdf', 200, 'application/pdf'),
        ]))->assertSessionHasNoErrors();
        $user->refresh();
        $this->assertTrue($user->profile_completed);
        \Illuminate\Support\Facades\Storage::disk('local')->assertExists($user->identity_document);
        $this->assertStringStartsWith("identity-documents/{$user->id}/", $user->identity_document);
        $this->assertArrayNotHasKey('identity_document', $user->toArray(), 'The file path must not be sent to pages.');

        // Only admins can open the file, and the approvals page says it exists.
        $this->actingAs($user)->get(route('admin.approvals.identity-document', $user))->assertForbidden();
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved']);
        $this->actingAs($admin)->get(route('admin.approvals.identity-document', $user))->assertOk();
        $this->actingAs($admin)->get(route('admin.approvals'))
            ->assertInertia(fn ($page) => $page
                ->where('pendingUsers.0.id', $user->id)
                ->where('pendingUsers.0.has_identity_document', true));

        // Sending the profile again replaces the old file.
        $old = $user->identity_document;
        $this->actingAs($user)->post(route('profile.complete.store'), $form([
            'identity_document' => \Illuminate\Http\UploadedFile::fake()->image('new-id.jpg'),
        ]))->assertSessionHasNoErrors();
        \Illuminate\Support\Facades\Storage::disk('local')->assertMissing($old);
        \Illuminate\Support\Facades\Storage::disk('local')->assertExists($user->fresh()->identity_document);
    }

    public function test_admins_get_one_sms_when_a_new_registration_waits_for_approval(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        \Illuminate\Support\Facades\Storage::fake('local');
        $sectorId = \Illuminate\Support\Facades\DB::table('sectors')->insertGetId(['name' => 'Kimihurura', 'district_id' => \Illuminate\Support\Facades\DB::table('districts')->insertGetId(['name' => 'Gasabo', 'province_id' => \Illuminate\Support\Facades\DB::table('provinces')->insertGetId(['name' => 'Kigali'])])]);
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved', 'phone' => '0783163187']);
        $disabledAdmin = User::factory()->create(['role' => 'admin', 'status' => 'approved', 'phone' => '0788000001', 'disabled_at' => now()]);
        $user = $this->owner(['first_name' => 'Jean', 'last_name' => 'Uwase', 'status' => 'pending', 'expires_at' => null, 'profile_completed' => false]);
        $submit = fn () => $this->actingAs($user)->post(route('profile.complete.store'), [
            'identity_document_type' => 'nida',
            'national_id' => '1199080012345012',
            'sector_id' => $sectorId,
            'profile_photo' => \Illuminate\Http\UploadedFile::fake()->image('me.jpg'),
            'identity_document' => \Illuminate\Http\UploadedFile::fake()->image('id.jpg'),
        ])->assertSessionHasNoErrors();

        $submit();
        $submit(); // a resubmission does not alert the admins again

        Notification::assertSentToTimes($admin, \App\Notifications\NewRegistrationAwaitingApproval::class, 1);
        Notification::assertNotSentTo($disabledAdmin, \App\Notifications\NewRegistrationAwaitingApproval::class);
        Notification::assertSentTo($admin, \App\Notifications\NewRegistrationAwaitingApproval::class, function ($notification, $channels) use ($admin) {
            $sms = $notification->toSms($admin);

            return in_array(\App\Notifications\Channels\SmsChannel::class, $channels, true)
                && str_starts_with($sms, 'Hello Admin, Jean Uwase (owner, 0781234567) registered on ITUZEAPP')
                && mb_strlen($sms) <= 160;
        });
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

        // Approved, but no free time: the first month is paid in the app.
        $this->assertNull($pending->fresh()->expires_at);
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
            'username' => 'jeanne.mukamana',
            'first_name' => 'Jeanne',
            'last_name' => 'Mukamana',
            'email' => 'jeanne.owner@example.com',
            'phone' => '+250 788 555 111',
            'identity_document_type' => 'nida',
            'national_id' => '1 1985 7 0012345 0 99',
            'sector_id' => $sectorId,
            'profile_photo' => \Illuminate\Http\UploadedFile::fake()->image('jeanne.jpg'),
            'password' => 'Temp#Pass2026',
            'password_confirmation' => 'Temp#Pass2026',
            'management_fee_percent' => '10',
            ...$overrides,
        ];
    }

    public function test_admin_creates_a_managed_owner_with_a_temporary_password(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved', 'name' => 'Ituze Admin']);

        $this->actingAs($admin)->get(route('admin.users.create'))->assertOk()
            ->assertInertia(fn ($page) => $page->component('Admin/CreateUser')->has('locations.sectors'));

        $this->actingAs($admin)->post(route('admin.users.store'), $this->managedAccountPayload([
            'management_fee_percent' => '12.5',
        ]))
            ->assertRedirect(route('admin.users', ['source' => 'managed']))
            ->assertSessionHas('success');

        $owner = User::query()->where('email', 'jeanne.owner@example.com')->firstOrFail();
        $this->assertSame($admin->id, $owner->created_by);
        $this->assertTrue($owner->isManaged());
        $this->assertTrue($owner->isReadOnly());
        $this->assertTrue($owner->login_enabled);
        $this->assertTrue($owner->must_change_password);
        $this->assertSame(12.5, $owner->managementFeeRate());
        $this->assertNull($owner->expires_at, 'Managed owners pay a fee, not a subscription.');
        $this->assertFalse($owner->isExpired());
        $this->assertSame('approved', $owner->status);
        $this->assertSame('0788555111', $owner->phone);
        $this->assertSame('1198570012345099', $owner->national_id);
        \Illuminate\Support\Facades\Storage::disk('public')->assertExists($owner->profile_photo);

        // Listed as managed, with the admin who added it.
        $this->actingAs($admin)->get(route('admin.users', ['source' => 'managed']))
            ->assertInertia(fn ($page) => $page
                ->has('users.data', 1)
                ->where('users.data.0.creator.name', 'Ituze Admin')
                ->where('counts.sources.managed', 1));
    }

    public function test_managed_owner_must_replace_the_temporary_password_at_first_sign_in(): void
    {
        $owner = $this->managedOwner();

        // Same sign-in as everyone: password, then the code sent to email and WhatsApp.
        $this->post('/login', ['email' => $owner->email, 'password' => 'Temp#Pass2026'])
            ->assertRedirect(route('login.otp.notice'));
        $this->post(route('login.otp.verify'), ['otp' => $this->sentLoginCode($owner)])->assertRedirect();
        $this->assertAuthenticatedAs($owner);

        // Everything leads to the change-password page until it is done.
        $this->get('/dashboard')->assertRedirect(route('password.change'));
        $this->get(route('reports.index'))->assertRedirect(route('password.change'));
        $this->get(route('password.change'))->assertInertia(fn ($page) => $page->component('Auth/ChangeTemporaryPassword'));

        $this->post(route('password.change.update'), [
            'current_password' => 'Temp#Pass2026',
            'password' => 'Temp#Pass2026',
            'password_confirmation' => 'Temp#Pass2026',
        ])->assertSessionHasErrors('password');

        $this->post(route('password.change.update'), [
            'current_password' => 'Temp#Pass2026',
            'password' => 'MyOwn#Secret2026',
            'password_confirmation' => 'MyOwn#Secret2026',
        ])->assertRedirect(route('dashboard'));

        $this->assertFalse($owner->fresh()->must_change_password);
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('MyOwn#Secret2026', $owner->fresh()->password));
        $this->get('/dashboard')->assertOk();
    }

    public function test_managed_owner_is_view_only(): void
    {
        $owner = $this->managedOwner(['must_change_password' => false]);

        $this->actingAs($owner)->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('auth.readOnly', true));
        $this->get(route('properties.index'))->assertOk();
        $this->get(route('tenants.index'))->assertOk();
        $this->get(route('reports.index'))->assertOk();

        // Any change is refused, on the web and in the mobile API.
        $this->from(route('properties.index'))
            ->post(route('properties.store'), ['name' => 'Sneaky', 'address' => 'Kigali'])
            ->assertRedirect(route('properties.index'))
            ->assertSessionHas('error', \App\Http\Middleware\EnsureOwnerCanWrite::MESSAGE);
        $this->assertDatabaseMissing('properties', ['name' => 'Sneaky']);
        $this->post(route('tenants.store'), [])->assertSessionHas('error');

        $token = $owner->createToken('phone')->plainTextToken;
        $this->postJson('/api/mobile/workspace/tenants', [], ['Authorization' => 'Bearer '.$token])
            ->assertForbidden()
            ->assertJsonPath('read_only', true);

        // Their own account still works: profile and sign-out.
        $this->actingAs($owner)->post(route('logout'))->assertRedirect('/');
    }

    public function test_admin_can_reset_a_managed_password_and_change_the_fee(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved']);
        $owner = $this->managedOwner(['must_change_password' => false, 'login_enabled' => false]);
        $selfRegistered = $this->owner(['phone' => '0788777000']);

        $this->actingAs($admin)->post(route('admin.users.password', $owner), [
            'password' => 'Reset#Pass2026',
            'password_confirmation' => 'Reset#Pass2026',
        ])->assertSessionHas('success');
        $owner->refresh();
        $this->assertTrue($owner->login_enabled, 'Setting a password turns sign-in on for older managed accounts.');
        $this->assertTrue($owner->must_change_password);
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('Reset#Pass2026', $owner->password));

        $this->patch(route('admin.users.fee', $owner), ['management_fee_percent' => 8])->assertSessionHas('success');
        $this->assertSame(8.0, $owner->fresh()->managementFeeRate());
        $this->patch(route('admin.users.fee', $owner), ['management_fee_percent' => 150])->assertSessionHasErrors('management_fee_percent');

        // Only managed accounts have these actions.
        $this->post(route('admin.users.password', $selfRegistered), ['password' => 'X#y2abcdefg', 'password_confirmation' => 'X#y2abcdefg'])->assertNotFound();
        $this->patch(route('admin.users.fee', $selfRegistered), ['management_fee_percent' => 5])->assertNotFound();
    }

    public function test_fee_report_keeps_the_management_fee_from_collected_rent_only(): void
    {
        $owner = $this->managedOwner(['must_change_password' => false, 'management_fee_percent' => 10]);
        $property = \App\Models\Property::query()->forceCreate(['owner_id' => $owner->id, 'name' => 'Fee Plaza', 'address' => 'KN 1 Rd']);
        $unitType = \App\Models\UnitType::query()->create(['name' => 'Office']);
        $unit = \App\Models\Unit::query()->forceCreate([
            'property_id' => $property->id, 'unit_type_id' => $unitType->id, 'unit_number' => 'F-1',
            'rent_amount' => 200000, 'rent_frequency' => 'monthly', 'status' => 'occupied',
        ]);
        $tenant = \App\Models\Tenant::query()->forceCreate([
            'type' => 'individual', 'name' => 'Fee Tenant', 'first_name' => 'Fee', 'last_name' => 'Tenant',
            'email' => 'fee-tenant@example.com', 'phone' => '0788123000', 'status' => 'active',
        ]);
        $tenancy = \App\Models\Tenancy::query()->forceCreate([
            'unit_id' => $unit->id, 'tenant_id' => $tenant->id, 'assigned_by' => $owner->created_by,
            'start_date' => now()->startOfMonth(), 'end_date' => now()->addYear(),
            'monthly_rent' => 200000, 'rent_frequency' => 'monthly', 'deposit_amount' => 200000, 'status' => 'active',
        ]);
        $pay = function (string $type, int $amount) use ($tenancy) {
            $charge = \App\Models\RentCharge::query()->create([
                'tenancy_id' => $tenancy->id, 'charge_type' => $type, 'period_start' => now()->startOfMonth(),
                'period_end' => now()->endOfMonth(), 'due_date' => now()->startOfMonth(), 'amount' => $amount,
            ]);
            \App\Models\RentPayment::query()->forceCreate([
                'rent_charge_id' => $charge->id, 'amount' => $amount, 'method' => 'cash', 'paid_at' => now(), 'recorded_by' => $tenancy->assigned_by,
            ]);
        };
        $pay('rent', 200000);
        $pay('deposit', 200000); // never part of the fee

        $this->actingAs($owner)->get(route('reports.index'))
            ->assertInertia(fn ($page) => $page
                ->where('managementFee.rate', 10)
                ->where('managementFee.totals.collected', 200000)
                ->where('managementFee.totals.fee', 20000)
                ->where('managementFee.totals.net', 180000)
                ->where('managementFee.months.0.month', now()->format('Y-m'))
                ->where('managementFee.months.0.fee', 20000));

        // Self-registered owners pay a subscription, so they see no fee report.
        $selfRegistered = $this->owner(['phone' => '0788777111']);
        $this->actingAs($selfRegistered)->get(route('reports.index'))
            ->assertInertia(fn ($page) => $page->where('managementFee', null));
    }

    private function managedOwner(array $attributes = []): User
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved']);
        $owner = $this->owner([
            'created_by' => $admin->id,
            'expires_at' => null,
            'password' => 'Temp#Pass2026',
            'phone' => '0788999'.random_int(100, 999),
        ]);
        $owner->forceFill([
            'login_enabled' => true,
            'must_change_password' => true,
            'management_fee_percent' => 10,
            ...$attributes,
        ])->save();

        return $owner->fresh();
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
            'management_fee_percent' => null,
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
