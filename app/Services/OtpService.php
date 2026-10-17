<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\EmailVerificationOtp;
use App\Notifications\OtpCodeMail;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class OtpService
{
    public const CODE_TTL_MINUTES = 10;

    /**
     * Wrong guesses allowed against one code before it is burned.
     */
    public const MAX_ATTEMPTS = 5;

    public const CHANNEL_WHATSAPP = 'whatsapp';

    public const CHANNEL_EMAIL = 'email';

    public const VALID = 'valid';

    public const INVALID = 'invalid';

    public const EXPIRED = 'expired';

    public const LOCKED = 'locked';

    public function __construct(protected WhatsAppCloudService $whatsapp)
    {
    }

    public function generateCode(): string
    {
        return (string) random_int(100000, 999999);
    }

    /**
     * Codes are stored as a keyed hash so a database leak does not expose live codes.
     */
    public function hashCode(string $code): string
    {
        return hash_hmac('sha256', $code, (string) config('app.key'));
    }

    /**
     * User-facing message for a failed check.
     */
    public static function failureMessage(string $result): string
    {
        return match ($result) {
            self::EXPIRED => 'This code has expired. Please request a new one.',
            self::LOCKED => 'Too many incorrect attempts. Please request a new code.',
            default => 'The code you entered is incorrect or has expired.',
        };
    }

    /* ---------------------------------------------------------------------
     | Email verification
     * ------------------------------------------------------------------- */

    public function sendEmailVerificationOtp(User $user): void
    {
        $code = $this->issue($user, 'email_otp');

        try {
            $user->notify(new EmailVerificationOtp($code));
        } catch (\Throwable $e) {
            Log::warning('Verification email could not be sent: '.$e->getMessage());
        }
    }

    public function verifyEmailOtp(User $user, ?string $code): string
    {
        $result = $this->check($user, 'email_otp', $code);

        if ($result === self::VALID) {
            $user->forceFill([
                'email_verified_at' => $user->email_verified_at ?? now(),
            ])->save();
        }

        return $result;
    }

    /* ---------------------------------------------------------------------
     | Phone verification
     * ------------------------------------------------------------------- */

    public function sendPhoneOtp(User $user): void
    {
        $code = $this->issue($user, 'phone_otp');

        $this->deliverToPhone($user, $code, 'verification');
    }

    public function verifyPhoneOtp(User $user, ?string $code): string
    {
        $result = $this->check($user, 'phone_otp', $code);

        if ($result === self::VALID) {
            $user->forceFill([
                'phone_verified_at' => $user->phone_verified_at ?? now(),
            ])->save();
        }

        return $result;
    }

    /* ---------------------------------------------------------------------
     | Login second factor
     * ------------------------------------------------------------------- */

    public function sendLoginOtp(User $user, string $channel): void
    {
        $code = $this->issue($user, 'login_otp', ['login_otp_channel' => $channel]);

        if ($channel === self::CHANNEL_EMAIL) {
            $this->deliverToEmail($user, $code, 'login');

            return;
        }

        $this->deliverToPhone($user, $code, 'login');
    }

    public function verifyLoginOtp(User $user, ?string $code): string
    {
        $result = $this->check($user, 'login_otp', $code);

        if ($result === self::VALID) {
            $user->forceFill(['login_otp_channel' => null])->save();
        }

        return $result;
    }

    /**
     * The channel a sign-in code goes to: the *other* channel from the one used
     * to sign in. When WhatsApp is not set up the code falls back to email, so
     * an account can never be locked out by a missing integration.
     */
    public function loginOtpChannelFor(User $user, string $identifierType): string
    {
        if ($identifierType === 'phone') {
            return self::CHANNEL_EMAIL;
        }

        if ($user->phone && $this->whatsapp->isConfigured()) {
            return self::CHANNEL_WHATSAPP;
        }

        return self::CHANNEL_EMAIL;
    }

    public function canReceiveOtp(User $user, string $channel): bool
    {
        if ($channel === self::CHANNEL_EMAIL) {
            return (bool) $user->email;
        }

        return (bool) $user->phone;
    }

    /**
     * The plain code of the last one issued in this session, for local testing only.
     */
    public static function developmentCode(string $field): ?string
    {
        if (! app()->environment('local') || ! request()->hasSession()) {
            return null;
        }

        return request()->session()->get("dev_otp.{$field}");
    }

    /* ---------------------------------------------------------------------
     | Internals
     * ------------------------------------------------------------------- */

    /**
     * Store a fresh code for the given column and reset its attempt counter.
     */
    protected function issue(User $user, string $field, array $extra = []): string
    {
        $code = $this->generateCode();

        $user->forceFill([
            $field => $this->hashCode($code),
            "{$field}_expires_at" => now()->addMinutes(self::CODE_TTL_MINUTES),
            ...$extra,
        ])->save();

        Cache::forget($this->attemptsKey($user, $field));

        if (app()->environment('local') && request()->hasSession()) {
            request()->session()->put("dev_otp.{$field}", $code);
        }

        return $code;
    }

    /**
     * Compare a submitted code with the stored one. A correct code is consumed;
     * too many wrong ones expire the code so even a later correct guess fails.
     */
    protected function check(User $user, string $field, ?string $code): string
    {
        $stored = $user->{$field};
        $expiresAt = $user->{"{$field}_expires_at"};

        if (! $stored || ! $code) {
            return self::INVALID;
        }

        if (! $expiresAt || $expiresAt->isPast()) {
            return self::EXPIRED;
        }

        if (! $this->codeMatches($stored, (string) $code)) {
            $key = $this->attemptsKey($user, $field);
            Cache::add($key, 0, now()->addMinutes(self::CODE_TTL_MINUTES));

            if (Cache::increment($key) >= self::MAX_ATTEMPTS) {
                Cache::forget($key);
                $user->forceFill(["{$field}_expires_at" => now()->subSecond()])->save();

                return self::LOCKED;
            }

            return self::INVALID;
        }

        Cache::forget($this->attemptsKey($user, $field));
        $user->forceFill([
            $field => null,
            "{$field}_expires_at" => null,
        ])->save();

        return self::VALID;
    }

    protected function codeMatches(string $stored, string $code): bool
    {
        // Codes issued before hashing was introduced are still plain six digits.
        if (strlen($stored) === 6) {
            return hash_equals($stored, $code);
        }

        return hash_equals($stored, $this->hashCode($code));
    }

    protected function attemptsKey(User $user, string $field): string
    {
        return "otp-attempts:{$field}:{$user->id}";
    }

    protected function deliverToPhone(User $user, string $code, string $purpose): void
    {
        if (! $user->phone) {
            Log::warning("Cannot send {$purpose} OTP: user {$user->id} has no phone number on file.");

            return;
        }

        if (! $this->whatsapp->isConfigured()) {
            // Local fallback so the whole flow stays testable without WhatsApp credentials.
            Log::info("[OTP] {$purpose} code for {$user->phone}: {$code}");

            return;
        }

        try {
            $this->whatsapp->sendOtp($user->phone, $code, $purpose);
        } catch (\Throwable $e) {
            Log::warning("WhatsApp {$purpose} OTP could not be sent: ".$e->getMessage());
        }
    }

    protected function deliverToEmail(User $user, string $code, string $purpose): void
    {
        try {
            $user->notify(new OtpCodeMail($code, $purpose));
        } catch (\Throwable $e) {
            Log::warning("Email {$purpose} OTP could not be sent: ".$e->getMessage());
        }
    }
}
