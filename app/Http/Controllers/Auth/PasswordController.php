<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class PasswordController extends Controller
{
    /**
     * Update the user's password.
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', Password::defaults(), 'confirmed'],
        ]);

        $request->user()->update([
            'password' => Hash::make($validated['password']),
        ]);
        // A manager is told by email and SMS, so a change they did not make is noticed.
        if ($request->user()->isManager() || ($request->user()->isOwner() && $request->user()->isManaged())) {
            $request->user()->notify(new \App\Notifications\ManagerPasswordChanged());
        }

        return back();
    }
}
