<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\OtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

class MobileAuthController extends Controller
{
    public function __construct(protected OtpService $otp)
    {
    }

    /**
     * Step one of the mobile sign in. A correct password either issues a token
     * or, when the second factor is on, sends a code and returns a short-lived
     * challenge. The challenge proves the password step happened and must be
     * sent back with the code, so a code alone can never open an account.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'identifier' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:80'],
        ]);

        $raw = $validated['identifier'] ?? $validated['email'] ?? $validated['phone'] ?? '';

        if (trim((string) $raw) === '') {
            return response()->json([
                'message' => 'Enter the email address or mobile number linked to your account.',
                'errors' => ['identifier' => ['Enter the email address or mobile number linked to your account.']],
            ], 422);
        }

        $user = $this->resolveUser((string) $raw);

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return response()->json(['message' => trans('auth.failed')], 401);
        }

        if ($user->isDisabled()) {
            return response()->json([
                'message' => 'This account has been disabled. Please contact support if you believe this is a mistake.',
            ], 403);
        }

        if (! config('auth.email_otp_enabled') && ! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
        }

        $channel = $this->otp->loginOtpChannelFor($user, $this->identifierType((string) $raw));

        if (config('auth.login_otp_enabled')
            && ! in_array($user->role, config('auth.login_otp_exempt_roles', []), true)
            && $this->otp->canReceiveOtp($user, $channel)) {
            $this->otp->sendLoginOtp($user, $channel);

            return response()->json([
                'otp_required' => true,
                'challenge' => $this->createChallenge($user, $channel),
                'channel' => $channel,
                'destination' => $channel === OtpService::CHANNEL_WHATSAPP ? $user->phone : $user->email,
                'expires_in_minutes' => OtpService::CODE_TTL_MINUTES,
                'message' => $channel === OtpService::CHANNEL_WHATSAPP
                    ? 'We sent a code to your WhatsApp number. Confirm it to finish signing in.'
                    : 'We sent a code to your email address. Confirm it to finish signing in.',
            ]);
        }

        return response()->json($this->tokenPayload($user, $validated['device_name'] ?? null));
    }

    /**
     * Step two: exchange the challenge and the code for a token.
     */
    public function verifyLoginOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'challenge' => ['required', 'string', 'size:64'],
            'code' => ['required', 'string', 'size:6'],
            'device_name' => ['nullable', 'string', 'max:80'],
        ]);

        [$user] = $this->resolveChallenge($validated['challenge']);

        if (! $user) {
            return $this->expiredChallengeResponse();
        }

        if ($user->isDisabled()) {
            $this->forgetChallenge($validated['challenge']);

            return response()->json([
                'message' => 'This account has been disabled. Please contact support if you believe this is a mistake.',
            ], 403);
        }

        $result = $this->otp->verifyLoginOtp($user, $validated['code']);

        if ($result !== OtpService::VALID) {
            $message = OtpService::failureMessage($result);

            return response()->json([
                'message' => $message,
                'errors' => ['code' => [$message]],
            ], 422);
        }

        $this->forgetChallenge($validated['challenge']);

        return response()->json($this->tokenPayload($user, $validated['device_name'] ?? null));
    }

    /**
     * Re-send the sign-in code for a challenge that is still open.
     */
    public function resendLoginOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'challenge' => ['required', 'string', 'size:64'],
        ]);

        [$user, $channel] = $this->resolveChallenge($validated['challenge']);

        if (! $user || $user->isDisabled()) {
            return $this->expiredChallengeResponse();
        }

        $this->otp->sendLoginOtp($user, $channel);

        return response()->json([
            'message' => 'We sent a new code.',
            'channel' => $channel,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->userData($request->user())]);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->user()->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return response()->json(['message' => 'Logged out successfully.']);
    }

    protected function createChallenge(User $user, string $channel): string
    {
        $challenge = Str::random(64);

        Cache::put($this->challengeKey($challenge), [
            'user_id' => $user->id,
            'channel' => $channel,
        ], now()->addMinutes(OtpService::CODE_TTL_MINUTES));

        return $challenge;
    }

    /**
     * @return array{0: ?User, 1: ?string}
     */
    protected function resolveChallenge(string $challenge): array
    {
        $pending = Cache::get($this->challengeKey($challenge));

        if (! is_array($pending)) {
            return [null, null];
        }

        return [User::query()->find($pending['user_id']), $pending['channel']];
    }

    protected function forgetChallenge(string $challenge): void
    {
        Cache::forget($this->challengeKey($challenge));
    }

    protected function challengeKey(string $challenge): string
    {
        return 'mobile-login-challenge:'.hash('sha256', $challenge);
    }

    protected function expiredChallengeResponse(): JsonResponse
    {
        return response()->json([
            'message' => 'This sign-in attempt has expired. Please sign in again.',
            'errors' => ['challenge' => ['This sign-in attempt has expired. Please sign in again.']],
        ], 422);
    }

    protected function resolveUser(string $identifier): ?User
    {
        $identifier = trim($identifier);

        if ($identifier === '') {
            return null;
        }

        return User::query()
            ->when(
                str_contains($identifier, '@'),
                fn ($query) => $query->where('email', Str::lower($identifier)),
                fn ($query) => $query->where('phone', $this->normalizePhone($identifier)),
            )
            ->first();
    }

    protected function identifierType(string $identifier): string
    {
        return str_contains($identifier, '@') ? 'email' : 'phone';
    }

    protected function normalizePhone(string $value): string
    {
        $digits = preg_replace('/\D/', '', $value) ?? '';

        if (str_starts_with($digits, '250')) {
            $digits = substr($digits, 3);
        }

        return str_starts_with($digits, '0') ? $digits : '0'.$digits;
    }

    protected function tokenPayload(User $user, ?string $deviceName): array
    {
        return [
            'otp_required' => false,
            'token' => $user->createToken($deviceName ?: 'ituze-mobile')->plainTextToken,
            'user' => $this->userData($user),
        ];
    }

    public static function userData(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'role' => $user->role,
            'status' => $user->status,
            'profile_completed' => $user->profile_completed,
            'email_verified' => $user->hasVerifiedEmail(),
            'phone_verified' => $user->isPhoneVerified(),
            'terms_accepted' => $user->hasAcceptedTerms(),
        ];
    }
}
