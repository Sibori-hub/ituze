<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
                // Owners Q.R.A manages can look but not change anything.
                'readOnly' => (bool) $request->user()?->isReadOnly(),
                // Self-registered owners can add managers; a manager sees who they work for.
                'canHireManagers' => (bool) $request->user()?->canHireManagers(),
                'employer' => $request->user()?->isManager() ? $request->user()->employer?->only(['id', 'name']) : null,
                // Chats with unread messages: for admins, how many people wrote;
                // for everyone else, how many support replies they have not seen.
                'unreadChats' => $request->user()?->isAdmin()
                    ? \App\Models\ChatConversation::query()->whereHas('messages', fn ($query) => $query->where('from_support', false)->whereNull('read_at'))->count()
                    : null,
                'chatUnread' => $request->user() && ! $request->user()->isAdmin()
                    ? \App\Models\ChatMessage::query()->where('from_support', true)->whereNull('read_at')
                        ->whereHas('conversation', fn ($query) => $query->where('user_id', $request->user()->id))->count()
                    : null,
                // Admin menu badge: website messages not answered yet.
                'newMessages' => $request->user()?->isAdmin()
                    ? \App\Models\ContactMessage::query()->whereNull('read_at')->count()
                    : null,
                // Advertisers unlock their buildings with their first paid listing.
                'advertiserPaid' => $request->user()?->isAdvertiser() ? $request->user()->hasPaidForListings() : null,
                // Paid-until status for self-registered owners (reminder banner, menu).
                'subscription' => $request->user()?->paysSubscription() && $request->user()->status === 'approved'
                    ? \App\Http\Controllers\SubscriptionController::statusFor($request->user())
                    : null,
            ],
            // Read-only legal metadata so the Terms/Privacy dialog can show the
            // same version and contact details as the full pages.
            'legal' => [
                'termsVersion' => config('legal.terms_version'),
                'termsUpdatedAt' => config('legal.terms_updated_at'),
                'company' => [
                    'name' => config('legal.company_name'),
                    'email' => config('legal.contact_email'),
                    'phone' => config('legal.contact_phone'),
                    'address' => config('legal.contact_address'),
                ],
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error'   => fn () => $request->session()->get('error'),
                'warning' => fn () => $request->session()->get('warning'),
                'info'    => fn () => $request->session()->get('info'),
                'status'  => fn () => $request->session()->get('status'),
            ],
        ];
    }
}