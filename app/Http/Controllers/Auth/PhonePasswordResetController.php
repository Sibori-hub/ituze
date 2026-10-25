<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\OtpService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;

/**
 * "Forgot password" by phone: a 6-digit code goes by SMS, then the code and a
 * new password reset the account. Answers never reveal whether a number is
 * registered.
 */
class PhonePasswordResetController extends Controller
{
    public const SESSION_PHONE = 'password_reset.phone';

    public const SESSION_VERIFIED = 'password_reset.verified';

    public function __construct(protected OtpService $otp)
    {
    }

    /**
     * Send a reset code to the number, if an account uses it.
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate(['phone' => ['required', 'string', 'max:20']]);
        $phone = RegisteredUserController::normalizeRwandaPhone((string) $request->input('phone'));

        if (! preg_match('/^07\d{8}$/', $phone)) {
            throw ValidationException::withMessages(['phone' => 'Enter a valid 10-digit Rwanda mobile number (072, 073, 078, or 079).']);
        }

        // At most 3 codes per number every 10 minutes, so nobody can flood a phone.
        $sent = RateLimiter::attempt('password-sms:'.$phone, 3, function () use ($phone) {
            $user = User::query()->where('phone', $phone)->first();

            if ($user) {
                $this->otp->sendPasswordResetOtp($user);
            }
        }, 600);

        if (! $sent) {
            throw ValidationException::withMessages(['phone' => 'Too many codes were requested for this number. Please wait a few minutes and try again.']);
        }

        $request->session()->put(self::SESSION_PHONE, $phone);
        $request->session()->forget(self::SESSION_VERIFIED);

        return back()->with('status', 'If this number has an account, we sent a 6-digit code by SMS.');
    }

    /**
     * Check the code first; only a correct code opens the new-password step.
     */
    public function verify(Request $request): RedirectResponse
    {
        $request->validate(['otp' => ['required', 'string', 'size:6']]);

        $phone = $request->session()->get(self::SESSION_PHONE);
        $user = $phone ? User::query()->where('phone', $phone)->first() : null;
        $result = $user ? $this->otp->verifyPasswordResetOtp($user, $request->input('otp')) : OtpService::INVALID;

        if ($result !== OtpService::VALID) {
            throw ValidationException::withMessages(['otp' => OtpService::failureMessage($result)]);
        }

        // The code is used up; this session may now set a new password for a short time.
        $request->session()->put(self::SESSION_VERIFIED, [
            'user_id' => $user->id,
            'until' => now()->addMinutes(OtpService::CODE_TTL_MINUTES)->getTimestamp(),
        ]);

        return back()->with('status', 'Code confirmed. Now choose a new password.');
    }

    /**
     * Save the new password, after a correct code.
     */
    public function update(Request $request): RedirectResponse
    {
        $user = self::verifiedUser($request);

        if (! $user) {
            $this->forget($request);

            return redirect()->route('password.request')
                ->withErrors(['otp' => 'This step has expired. Please request a new code.']);
        }

        $request->validate([
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $user->forceFill([
            'password' => Hash::make($request->input('password')),
            'remember_token' => Str::random(60),
        ])->save();

        event(new PasswordReset($user));
        if ($user->isManager()) {
            $user->notify(new \App\Notifications\ManagerPasswordChanged());
        }
        $this->forget($request);

        return redirect()->route('login')->with('status', __('passwords.reset'));
    }

    /**
     * Start again with another number.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $this->forget($request);

        return back();
    }

    private function forget(Request $request): void
    {
        $request->session()->forget([self::SESSION_PHONE, self::SESSION_VERIFIED]);
    }

    /** The account whose code was confirmed in this session, while that step is still open. */
    private static function verifiedUser(Request $request): ?User
    {
        $verified = $request->session()->get(self::SESSION_VERIFIED);

        if (! is_array($verified) || ($verified['until'] ?? 0) < now()->getTimestamp()) {
            return null;
        }

        return User::query()->find($verified['user_id'] ?? null);
    }

    /**
     * What the forgot-password page needs for the code step, if a code was requested.
     *
     * @return array{phone: string, expiresIn: int, verified: bool}|null
     */
    public static function pendingReset(Request $request): ?array
    {
        $phone = $request->session()->get(self::SESSION_PHONE);

        if (! $phone) {
            return null;
        }

        $user = User::query()->where('phone', $phone)->first();

        return [
            'phone' => substr($phone, 0, 3).'****'.substr($phone, -3),
            'expiresIn' => $user ? OtpService::secondsLeft($user, 'password_otp') : OtpService::CODE_TTL_MINUTES * 60,
            'verified' => self::verifiedUser($request) !== null,
        ];
    }
}
