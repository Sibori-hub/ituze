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

        return back()->with('status', 'If this number has an account, we sent a 6-digit code by SMS.');
    }

    /**
     * Check the code and save the new password.
     */
    public function update(Request $request): RedirectResponse
    {
        $request->validate([
            'otp' => ['required', 'string', 'size:6'],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $phone = $request->session()->get(self::SESSION_PHONE);
        $user = $phone ? User::query()->where('phone', $phone)->first() : null;
        $result = $user ? $this->otp->verifyPasswordResetOtp($user, $request->input('otp')) : OtpService::INVALID;

        if ($result !== OtpService::VALID) {
            throw ValidationException::withMessages(['otp' => OtpService::failureMessage($result)]);
        }

        $user->forceFill([
            'password' => Hash::make($request->input('password')),
            'remember_token' => Str::random(60),
        ])->save();

        event(new PasswordReset($user));
        $request->session()->forget(self::SESSION_PHONE);

        return redirect()->route('login')->with('status', __('passwords.reset'));
    }

    /**
     * Start again with another number.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->session()->forget(self::SESSION_PHONE);

        return back();
    }

    /**
     * What the forgot-password page needs for the code step, if a code was requested.
     *
     * @return array{phone: string, expiresIn: int}|null
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
        ];
    }
}
