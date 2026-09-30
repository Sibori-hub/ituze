<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Register');
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'phone' => ['required', 'regex:/^(072|073|078|079)\d{7}$/', 'unique:'.User::class],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ], [
            'phone.regex' => 'Enter a valid 10-digit Rwanda mobile number (072, 073, 078, or 079).',
        ]);

        $user = User::create([
            'first_name' => $request->first_name,
            'last_name' => $request->last_name,
            'name' => $request->first_name.' '.$request->last_name,
            'email' => $request->email,
            'phone' => $request->phone,
            'role' => 'owner',
            'status' => 'pending',
            'expires_at' => null,
            'password' => Hash::make($request->password),
        ]);

        if (config('auth.email_otp_enabled')) {
            event(new Registered($user));
        } else {
            $user->markEmailAsVerified();
        }

        // TODO: Re-enable admin notification after queue worker is set up
        // $admins = User::where('role', 'admin')->get();
        // if ($admins->isNotEmpty()) {
        //     Notification::send($admins, new NewOwnerRegistered($user));
        // }

        Auth::login($user);

        return config('auth.email_otp_enabled')
            ? redirect()->route('verification.notice')
            : redirect()->route('profile.complete');
    }
}