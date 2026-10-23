<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Auth\RegisteredUserController;
use App\Models\ContactMessage;
use App\Models\User;
use App\Notifications\NewContactMessage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;

class ContactMessageController extends Controller
{
    /**
     * Save a "Contact us" message and tell the admins by email and SMS.
     */
    public function store(Request $request): RedirectResponse
    {
        // Bots fill every field; people never see this one.
        if (filled($request->input('website'))) {
            return back()->with('contactSent', true);
        }

        $request->merge(['phone' => RegisteredUserController::normalizeRwandaPhone((string) $request->input('phone'))]);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'regex:/^(072|073|078|079)\d{7}$/'],
            'email' => ['nullable', 'email', 'max:255'],
            'topic' => ['required', Rule::in(array_keys(ContactMessage::TOPICS))],
            'message' => ['required', 'string', 'min:5', 'max:2000'],
        ], [
            'phone.regex' => 'Enter a valid 10-digit Rwanda mobile number (072, 073, 078, or 079).',
        ]);

        $contact = ContactMessage::create([
            ...$validated,
            'email' => isset($validated['email']) ? strtolower(trim($validated['email'])) : null,
            'ip_address' => $request->ip(),
        ]);

        Notification::send(
            User::query()->where('role', 'admin')->whereNull('disabled_at')->get(),
            new NewContactMessage($contact),
        );

        return back()->with('contactSent', true);
    }
}
