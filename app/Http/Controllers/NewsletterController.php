<?php

namespace App\Http\Controllers;

use App\Models\NewsletterSubscriber;
use App\Notifications\NewsletterConfirmation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

/**
 * Home page newsletter: sign up, confirm by email (double opt-in), unsubscribe.
 */
class NewsletterController extends Controller
{
    public function subscribe(Request $request): RedirectResponse
    {
        // Bots fill every field; people never see this one.
        if (filled($request->input('website'))) {
            return back()->with('newsletterSent', true);
        }

        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'locale' => ['nullable', 'in:en,fr,rw'],
        ]);
        $email = strtolower(trim($validated['email']));

        $subscriber = NewsletterSubscriber::query()->firstOrNew(['email' => $email]);

        // Already receiving the news: nothing to do, and the answer stays the same
        // so the form never reveals who is subscribed.
        if (! $subscriber->isActive()) {
            $subscriber->fill([
                'locale' => $validated['locale'] ?? 'en',
                'ip_address' => $request->ip(),
            ]);
            $subscriber->unsubscribed_at = null;
            $subscriber->save();

            // At most 3 confirmation emails per address per hour.
            RateLimiter::attempt('newsletter-confirm:'.$email, 3, function () use ($subscriber) {
                Notification::route('mail', $subscriber->email)->notify(new NewsletterConfirmation($subscriber));
            }, 3600);
        }

        return back()->with('newsletterSent', true);
    }

    public function confirm(string $token): RedirectResponse
    {
        $subscriber = NewsletterSubscriber::query()->where('token', $token)->first();

        if (! $subscriber) {
            return redirect('/?newsletter=invalid#newsletter');
        }

        $subscriber->forceFill([
            'confirmed_at' => $subscriber->confirmed_at ?? now(),
            'unsubscribed_at' => null,
        ])->save();

        return redirect('/?newsletter=confirmed#newsletter');
    }

    public function unsubscribe(string $token): RedirectResponse
    {
        $subscriber = NewsletterSubscriber::query()->where('token', $token)->first();

        if ($subscriber && ! $subscriber->unsubscribed_at) {
            // A new secret, so the old links in past emails stop working.
            $subscriber->forceFill(['unsubscribed_at' => now(), 'token' => Str::random(48)])->save();
        }

        return redirect('/?newsletter=unsubscribed#newsletter');
    }
}
