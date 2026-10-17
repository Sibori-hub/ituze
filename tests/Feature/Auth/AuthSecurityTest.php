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

        // Signing in with the phone sends the code to the email address.
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

    public function test_codes_are_hashed_and_burned_after_too_many_wrong_guesses(): void
    {
        $user = $this->owner();
        $otp = app(OtpService::class);

        $otp->sendLoginOtp($user, OtpService::CHANNEL_EMAIL);
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

    public function test_csv_export_neutralises_spreadsheet_formulas(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved']);
        $this->owner(['name' => '=HYPERLINK("http://evil.test")']);

        $csv = $this->actingAs($admin)->get(route('admin.users.export.excel'))->streamedContent();

        $this->assertStringContainsString("'=HYPERLINK", $csv);
    }
}
