<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EmailVerificationPromptController extends Controller
{
    /**
     * Display the email verification prompt.
     */
    public function __invoke(Request $request): RedirectResponse|Response
    {
        return $request->user()->hasVerifiedEmail()
                    ? redirect()->route($request->user()->profile_completed ? 'dashboard' : 'profile.complete')
                    : Inertia::render('Auth/VerifyEmail', [
                        'status' => session('status'),
                        'devMode' => app()->environment('local'),
                        'devOtp' => \App\Services\OtpService::developmentCode('email_otp'),
                    ]);
    }
}