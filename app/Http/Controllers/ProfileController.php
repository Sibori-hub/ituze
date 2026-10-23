<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use App\Models\Sector;
use App\Services\OtpService;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function __construct(protected OtpService $otp)
    {
    }

    /**
     * Display the user's profile form.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => session('status'),
            'sectors' => Sector::query()
                ->with('district.province')
                ->orderBy('name')
                ->get(),
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validated();
        $profilePhoto = $request->file('profile_photo');
        unset($validated['profile_photo']);
        $previousPhoto = $user->profile_photo;

        $user->fill($validated);
        $user->name = $validated['name'] ?? trim($validated['first_name'] . ' ' . $validated['last_name']);

        if ($user->isDirty('email')) {
            $user->email_verified_at = config('auth.email_otp_enabled') ? null : now();
        }

        // A new number is a new login identifier and code destination: prove it first.
        $phoneChanged = $user->isDirty('phone');

        if ($phoneChanged) {
            $user->phone_verified_at = null;
        }

        if ($profilePhoto) {
            $user->profile_photo = $profilePhoto->store('profile-photos', 'public');
        }

        $user->save();

        if ($profilePhoto && $previousPhoto && $previousPhoto !== $user->profile_photo) {
            Storage::disk('public')->delete($previousPhoto);
        }

        if ($phoneChanged) {
            $this->otp->sendPhoneOtp($user);

            return Redirect::route('phone.notice')
                ->with('status', 'We sent a verification code to your new phone number by SMS.');
        }

        return Redirect::route('profile.edit');
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->endAllSessions();
        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }
}
