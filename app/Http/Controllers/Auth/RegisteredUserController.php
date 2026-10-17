<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\OtpService;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    /**
     * The account types a visitor may sign up as. Administrators are never self-service.
     */
    public const SELF_SERVICE_ROLES = ['owner', 'advertiser'];

    public function __construct(protected OtpService $otp)
    {
    }

    /**
     * Display the registration view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Register', [
            'termsVersion' => config('legal.terms_version'),
            'termsUpdatedAt' => config('legal.terms_updated_at'),
        ]);
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws ValidationException
     */
    public function store(Request $request): JsonResponse|RedirectResponse
    {
        if ($request->filled('phone')) {
            $request->merge(['phone' => self::normalizeRwandaPhone((string) $request->input('phone'))]);
        }

        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:' . User::class,
            'phone' => ['required', 'regex:/^(072|073|078|079)\d{7}$/', 'unique:' . User::class],
            'role' => ['nullable', 'in:' . implode(',', self::SELF_SERVICE_ROLES)],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'terms' => ['accepted'],
            'device_name' => ['nullable', 'string', 'max:80'],
        ], [
            'phone.regex' => 'Enter a valid 10-digit Rwanda mobile number (072, 073, 078, or 079).',
            'terms.accepted' => 'You must accept the Terms and Conditions and the Privacy Policy to create an account.',
        ]);

        $validator->validate();

        $role = $request->input('role') ?: 'owner';

        $user = User::create([
            'first_name' => $request->first_name,
            'last_name' => $request->last_name,
            'name' => $request->first_name . ' ' . $request->last_name,
            'email' => $request->email,
            'phone' => $request->phone,
            'role' => $role,
            'status' => 'pending',
            'expires_at' => null,
            'profile_completed' => false,
            'terms_accepted_at' => now(),
            'terms_version' => config('legal.terms_version'),
            'terms_accepted_ip' => $request->ip(),
            'password' => Hash::make($request->password),
        ]);

        if (config('auth.email_otp_enabled')) {
            event(new Registered($user));
        } else {
            $user->markEmailAsVerified();
        }

        // Verify the phone number over WhatsApp as well.
        $this->otp->sendPhoneOtp($user);

        if ($request->expectsJson()) {
            return response()->json([
                'token' => $user->createToken($request->input('device_name', 'ituze-mobile'))->plainTextToken,
                'user' => MobileAuthController::userData($user),
                'verification_required' => ! $user->hasVerifiedEmail(),
                'phone_verification_required' => ! $user->isPhoneVerified(),
            ], 201);
        }

        Auth::login($user);

        return config('auth.email_otp_enabled')
            ? redirect()->route('verification.notice')
            : redirect()->route('phone.notice');
    }

    /**
     * Tell the sign-up form whether an email or phone number is still free, so a
     * duplicate is flagged before submit. It reveals no more than submitting the
     * form would, and the route is rate limited.
     */
    public function availability(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'field' => ['required', 'in:email,phone'],
            'value' => ['required', 'string', 'max:255'],
        ]);

        $value = $validated['field'] === 'phone'
            ? self::normalizeRwandaPhone($validated['value'])
            : strtolower(trim($validated['value']));

        // Same scope as the unique rule on store(): deleted accounts still hold their details.
        $taken = User::withTrashed()->where($validated['field'], $value)->exists();

        return response()->json([
            'available' => ! $taken,
            'message' => $taken
                ? ($validated['field'] === 'email'
                    ? 'This email is already registered.'
                    : 'This phone number is already registered.')
                : null,
        ]);
    }

    /**
     * Accept +250 788 123 456, 250788123456 or 0788123456 and store 0788123456.
     * Anything that is not a 9-digit mobile number is left for validation to reject.
     */
    public static function normalizeRwandaPhone(string $value): string
    {
        $digits = preg_replace('/\D/', '', $value) ?? '';

        if (strlen($digits) === 12 && str_starts_with($digits, '250')) {
            $digits = substr($digits, 3);
        }

        if (strlen($digits) === 9 && str_starts_with($digits, '7')) {
            return '0'.$digits;
        }

        return $digits === '' ? $value : $digits;
    }
}
