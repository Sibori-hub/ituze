<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\OtpService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EmailVerificationPromptController extends Controller
{
    /**
     * Display the email verification prompt.
     */
    public function __invoke(Request $request, OtpService $otp): RedirectResponse|Response
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return redirect()->route($user->profile_completed ? 'dashboard' : 'profile.complete');
        }

        $refreshed = $otp->refreshIfExpired($user, 'email_otp');

        return Inertia::render('Auth/VerifyEmail', [
            'status' => $refreshed ? 'code-refreshed' : session('status'),
            'expiresIn' => OtpService::secondsLeft($user, 'email_otp'),
            'devMode' => app()->environment('local'),
            'devOtp' => OtpService::developmentCode('email_otp'),
        ]);
    }
}
