<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class VerifyEmailOtpController extends Controller
{
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

            return redirect()->route($user->profile_completed ? 'dashboard' : 'profile.complete');
        }

        if (! $user->email_otp || $user->email_otp !== $request->otp) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'The code you entered is incorrect.',
                    'errors' => ['otp' => ['The code you entered is incorrect.']],
                ], 422);
            }

            return back()->withErrors(['otp' => 'The code you entered is incorrect.']);
        }

        if (! $user->email_otp_expires_at || $user->email_otp_expires_at->isPast()) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'This code has expired. Please request a new one.',
                    'errors' => ['otp' => ['This code has expired. Please request a new one.']],
                ], 422);
            }

            return back()->withErrors(['otp' => 'This code has expired. Please request a new one.']);
        }

        $user->forceFill([
            'email_verified_at' => now(),
            'email_otp' => null,
            'email_otp_expires_at' => null,
        ])->save();

        if ($request->expectsJson()) {
            return response()->json(['message' => 'Email verified successfully.']);
        }

        return redirect()->route($user->profile_completed ? 'dashboard' : 'profile.complete');
    }
}