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
}
