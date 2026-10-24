<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\NewsletterIssue;
use App\Models\NewsletterSubscriber;
use App\Notifications\NewsletterMessage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Admin → Newsletter: subscribers, CSV export, and sending a newsletter to
 * everyone who confirmed.
 */
class NewsletterController extends Controller
{
    public function index(Request $request): Response
    {
        $status = $request->query('status', 'all');
        $search = trim((string) $request->query('search', ''));

        $subscribers = NewsletterSubscriber::query()
            ->when($status === 'active', fn ($query) => $query->active())
            ->when($status === 'pending', fn ($query) => $query->whereNull('confirmed_at')->whereNull('unsubscribed_at'))
            ->when($status === 'unsubscribed', fn ($query) => $query->whereNotNull('unsubscribed_at'))
            ->when($search !== '', fn ($query) => $query->where('email', 'like', '%'.$search.'%'))
            ->latest()
            ->paginate(25)
            ->withQueryString()
            ->through(fn (NewsletterSubscriber $subscriber) => [
                'id' => $subscriber->id,
                'email' => $subscriber->email,
                'locale' => $subscriber->locale,
                'status' => $subscriber->status(),
                'created_at' => $subscriber->created_at,
                'confirmed_at' => $subscriber->confirmed_at,
            ]);

        return Inertia::render('Admin/Newsletter', [
            'subscribers' => $subscribers,
            'filters' => ['status' => $status, 'search' => $search],
            'counts' => [
                'all' => NewsletterSubscriber::query()->count(),
                'active' => NewsletterSubscriber::query()->active()->count(),
                'pending' => NewsletterSubscriber::query()->whereNull('confirmed_at')->whereNull('unsubscribed_at')->count(),
                'unsubscribed' => NewsletterSubscriber::query()->whereNotNull('unsubscribed_at')->count(),
            ],
            'issues' => NewsletterIssue::query()->with('sender:id,name')->latest()->limit(10)->get(['id', 'subject', 'sent_by', 'recipients', 'created_at']),
        ]);
    }

    public function send(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'subject' => ['required', 'string', 'max:150'],
            'body' => ['required', 'string', 'min:10', 'max:10000'],
        ]);

        $recipients = NewsletterSubscriber::query()->active()->count();

        if ($recipients === 0) {
            return back()->with('error', 'Nobody has confirmed a subscription yet, so there is no one to send to.');
        }

        $issue = NewsletterIssue::create([
            ...$validated,
            'sent_by' => $request->user()->id,
            'recipients' => $recipients,
        ]);

        // Each email goes through the background queue with its own unsubscribe link.
        NewsletterSubscriber::query()->active()->orderBy('id')->chunkById(200, function ($subscribers) use ($issue) {
            foreach ($subscribers as $subscriber) {
                Notification::route('mail', $subscriber->email)->notify(new NewsletterMessage($issue, $subscriber));
            }
        });

        return back()->with('success', 'The newsletter "'.$issue->subject.'" is being sent to '.$recipients.' subscriber'.($recipients === 1 ? '' : 's').'.');
    }

    public function export(): StreamedResponse
    {
        return response()->streamDownload(function () {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['email', 'language', 'subscribed', 'confirmed']);
            NewsletterSubscriber::query()->active()->orderBy('id')->each(function (NewsletterSubscriber $subscriber) use ($out) {
                fputcsv($out, [$subscriber->email, $subscriber->locale, $subscriber->created_at?->toDateString(), $subscriber->confirmed_at?->toDateString()]);
            });
            fclose($out);
        }, 'ituze-newsletter-subscribers-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv']);
    }

    public function destroy(NewsletterSubscriber $subscriber): RedirectResponse
    {
        $subscriber->delete();

        return back()->with('success', $subscriber->email.' was removed from the newsletter list.');
    }
}
