<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Auth\MobileAuthController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Replacing the temporary password an administrator set for an account.
 */
class ForcedPasswordController extends Controller
{
    public function show(Request $request): RedirectResponse|Response
    {
        if (! $request->user()->must_change_password) {
            return redirect()->route('dashboard');
        }

        return Inertia::render('Auth/ChangeTemporaryPassword');
    }

    public function update(Request $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', 'different:current_password', Password::defaults()],
        ], [
            'password.different' => 'Choose a new password that is different from the temporary one.',
        ]);

        $user = $request->user();
        $user->forceFill([
            'password' => $validated['password'],
            'must_change_password' => false,
        ])->save();

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Your password has been changed.',
                'user' => MobileAuthController::userData($user->fresh()),
            ]);
        }

        return redirect()->route('dashboard')->with('success', 'Your password has been changed. Welcome to ITUZE GREEN PLATFORM.');
    }
}
