<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PhonePasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private const SENT = 'If this number has an account, we sent a 6-digit code by SMS.';

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.sms.driver' => 'pindo', 'services.sms.pindo.token' => 'test-token']);
        Http::fake(['api.pindo.io/*' => Http::response(['ok' => true])]);
    }

    /** The code inside the last SMS sent to Pindo. */
    private function lastSmsCode(): ?string
    {
        $code = null;
        Http::assertSent(function ($request) use (&$code) {
            if (preg_match('/ITUZE code: (\d{6})\./', (string) $request['text'], $match)) {
                $code = $match[1];
            }

            return true;
        });

        return $code;
    }

    public function test_a_code_by_sms_resets_the_password_once(): void
    {
        $user = User::factory()->create(['phone' => '0781234567', 'password' => Hash::make('old-password')]);

        $this->post(route('password.phone.send'), ['phone' => '+250 781 234 567'])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('status', self::SENT);
        Http::assertSent(fn ($request) => $request['to'] === '+250781234567');
        $code = $this->lastSmsCode();

        $this->get(route('password.request'))
            ->assertInertia(fn ($page) => $page->where('phoneReset.phone', '078****567')->where('phoneReset.verified', false));

        // No new password before the code is confirmed.
        $this->post(route('password.phone.reset'), [
            'password' => 'New-password-2026',
            'password_confirmation' => 'New-password-2026',
        ])->assertSessionHasErrors('otp');
        $this->assertTrue(Hash::check('old-password', $user->fresh()->password));
        $this->post(route('password.phone.send'), ['phone' => '0781234567']);
        $code = $this->lastSmsCode();

        // A wrong code does not open the password step.
        $this->post(route('password.phone.verify'), ['otp' => $code === '000000' ? '111111' : '000000'])->assertSessionHasErrors('otp');
        $this->get(route('password.request'))->assertInertia(fn ($page) => $page->where('phoneReset.verified', false));

        // The right code does.
        $this->post(route('password.phone.verify'), ['otp' => $code])->assertSessionHasNoErrors();
        $this->get(route('password.request'))->assertInertia(fn ($page) => $page->where('phoneReset.verified', true));
        $this->assertNull($user->fresh()->password_otp, 'The code is used up once confirmed.');

        $this->post(route('password.phone.reset'), [
            'password' => 'New-password-2026',
            'password_confirmation' => 'New-password-2026',
        ])->assertRedirect(route('login'));
        $this->assertTrue(Hash::check('New-password-2026', $user->fresh()->password));

        // The step closes after saving, and the same code cannot be used again.
        $this->post(route('password.phone.reset'), [
            'password' => 'Another-password-1',
            'password_confirmation' => 'Another-password-1',
        ])->assertSessionHasErrors('otp');
        $this->withSession(['password_reset.phone' => '0781234567'])
            ->post(route('password.phone.verify'), ['otp' => $code])->assertSessionHasErrors('otp');
        $this->assertTrue(Hash::check('New-password-2026', $user->fresh()->password));
    }

    public function test_an_unknown_number_gets_the_same_answer_and_no_sms(): void
    {
        $this->post(route('password.phone.send'), ['phone' => '0789999999'])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('status', self::SENT);
        Http::assertNothingSent();

        $this->post(route('password.phone.verify'), ['otp' => '123456'])->assertSessionHasErrors('otp');
    }

    public function test_wrong_codes_lock_the_code_and_requests_are_limited(): void
    {
        // The per-minute route limit would stop the 6th try first; this test checks the code lock itself.
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        $user = User::factory()->create(['phone' => '0781234567', 'password' => Hash::make('old-password')]);
        $this->post(route('password.phone.send'), ['phone' => '0781234567']);
        $code = $this->lastSmsCode();
        $wrong = $code === '000000' ? '111111' : '000000';

        for ($i = 0; $i < 5; $i++) {
            $this->post(route('password.phone.verify'), ['otp' => $wrong])->assertSessionHasErrors('otp');
        }

        // Five wrong tries burn the code, so even the right one fails now.
        $this->post(route('password.phone.verify'), ['otp' => $code])->assertSessionHasErrors('otp');
        $this->assertTrue(Hash::check('old-password', $user->fresh()->password));

        // At most 3 codes per number every 10 minutes.
        $this->post(route('password.phone.send'), ['phone' => '0781234567'])->assertSessionHasNoErrors();
        $this->post(route('password.phone.send'), ['phone' => '0781234567'])->assertSessionHasNoErrors();
        $this->post(route('password.phone.send'), ['phone' => '0781234567'])->assertSessionHasErrors('phone');
    }

    public function test_an_invalid_number_is_refused(): void
    {
        $this->post(route('password.phone.send'), ['phone' => '12345'])->assertSessionHasErrors('phone');
        Http::assertNothingSent();
    }
}
