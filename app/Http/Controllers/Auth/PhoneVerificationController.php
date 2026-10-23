<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\OtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PhoneVerificationController extends Controller
{
    public function __construct(protected OtpService $otp)
    {
    }

    /**
     * Show the phone verification screen.
     */
    public function notice(Request $request): RedirectResponse|Response
    {
        $user = $request->user();

        if ($user->isPhoneVerified()) {
            return redirect()->route($this->nextRoute($user));
        }

        $refreshed = $this->otp->refreshIfExpired($user, 'phone_otp');

        return Inertia::render('Auth/VerifyPhone', [
            'phone' => $user->phone,
            'status' => $refreshed
                ? 'Your previous code had expired, so we sent you a new one.'
                : session('status'),
            'expiresIn' => OtpService::secondsLeft($user, 'phone_otp'),
            // Local environments show the code so the flow can be tested without WhatsApp.
            'devMode' => app()->environment('local'),
            'devOtp' => OtpService::developmentCode('phone_otp'),
        ]);
    }

    /**
     * Verify the submitted code.
     */
    public function store(Request $request): JsonResponse|RedirectResponse
    {
        $request->validate([
            'otp' => ['required', 'string', 'size:6'],
        ]);

        $user = $request->user();

        $result = $this->otp->verifyPhoneOtp($user, $request->input('otp'));

        if ($result !== OtpService::VALID) {
            $message = OtpService::failureMessage($result);

            if ($this->wantsJson($request)) {
                return response()->json([
                    'message' => $message,
                    'errors' => ['otp' => [$message]],
                ], 422);
            }

            return back()->withErrors(['otp' => $message]);
        }

        if ($this->wantsJson($request)) {
            return response()->json([
                'message' => 'Phone number verified successfully.',
                'user' => MobileAuthController::userData($user->fresh()),
            ]);
        }

        return redirect()->route($this->nextRoute($user));
    }

    /**
     * Send a fresh code.
     */
    public function resend(Request $request): JsonResponse|RedirectResponse
    {
        $user = $request->user();

        if ($user->isPhoneVerified()) {
            if ($this->wantsJson($request)) {
                return response()->json(['message' => 'Phone number already verified.']);
            }

            return redirect()->route($this->nextRoute($user));
        }

        $this->otp->sendPhoneOtp($user);

        if ($this->wantsJson($request)) {
            return response()->json([
                'message' => 'We sent a new verification code to your phone by SMS.',
            ]);
        }

        return back()->with('status', 'We sent a new verification code to your phone by SMS.');
    }

    protected function nextRoute($user): string
    {
        if (! $user->profile_completed) {
            return 'profile.complete';
        }

        return 'dashboard';
    }

    /**
     * API consumers always get JSON, even without an explicit Accept header.
     */
    protected function wantsJson(Request $request): bool
    {
        return $request->expectsJson() || $request->is('api/*');
    }
}
