<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\OtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class VerifyEmailOtpController extends Controller
{
    public function __construct(protected OtpService $otp)
    {
    }

    public function store(Request $request): JsonResponse|RedirectResponse
    {
        $request->validate([
            'otp' => 'required|string|size:6',
        ]);

        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Email already verified.']);
            }

            return redirect()->route($this->nextRoute($user));
        }

        $result = $this->otp->verifyEmailOtp($user, $request->input('otp'));

        if ($result !== OtpService::VALID) {
            $message = $result === OtpService::INVALID
                ? 'The code you entered is incorrect.'
                : OtpService::failureMessage($result);

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => $message,
                    'errors' => ['otp' => [$message]],
                ], 422);
            }

            return back()->withErrors(['otp' => $message]);
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Email verified successfully.']);
        }

        return redirect()->route($this->nextRoute($user));
    }

    /**
     * Send the user straight to the next onboarding step instead of letting
     * middleware bounce them through pages they cannot open yet.
     */
    protected function nextRoute($user): string
    {
        if ($user->awaitingPhoneVerification()) {
            return 'phone.notice';
        }

        return $user->profile_completed ? 'dashboard' : 'profile.complete';
    }
}
