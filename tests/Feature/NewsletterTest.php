<?php

namespace Tests\Feature;

use App\Models\NewsletterIssue;
use App\Models\NewsletterSubscriber;
use App\Models\User;
use App\Notifications\NewsletterConfirmation;
use App\Notifications\NewsletterMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class NewsletterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
    }

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'approved']);
    }

    public function test_subscribing_needs_a_confirmation_click_before_any_newsletter(): void
    {
        $this->post(route('newsletter.subscribe'), ['email' => ' Aline@Example.com ', 'locale' => 'fr'])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('newsletterSent', true);

        $subscriber = NewsletterSubscriber::sole();
        $this->assertSame('aline@example.com', $subscriber->email);
        $this->assertSame('fr', $subscriber->locale);
        $this->assertSame('pending', $subscriber->status());

        Notification::assertSentOnDemand(NewsletterConfirmation::class, function ($notification, $channels, $notifiable) {
            return $notifiable->routes['mail'] === 'aline@example.com';
        });

        $this->get(route('newsletter.confirm', $subscriber->token))->assertRedirect('/?newsletter=confirmed#newsletter');
        $this->assertSame('active', $subscriber->fresh()->status());

        // Signing up again while subscribed sends nothing and answers the same way.
        $this->post(route('newsletter.subscribe'), ['email' => 'aline@example.com'])->assertSessionHas('newsletterSent', true);
        Notification::assertSentOnDemandTimes(NewsletterConfirmation::class, 1);

        $this->get(route('newsletter.confirm', 'not-a-real-token'))->assertRedirect('/?newsletter=invalid#newsletter');
        $this->post(route('newsletter.subscribe'), ['email' => 'not-an-email'])->assertSessionHasErrors('email');
    }

    public function test_unsubscribing_stops_the_news_and_old_links_stop_working(): void
    {
        $subscriber = NewsletterSubscriber::create(['email' => 'jean@example.com']);
        $subscriber->forceFill(['confirmed_at' => now()])->save();
        $oldToken = $subscriber->token;

        $this->get(route('newsletter.unsubscribe', $oldToken))->assertRedirect('/?newsletter=unsubscribed#newsletter');

        $subscriber->refresh();
        $this->assertSame('unsubscribed', $subscriber->status());
        $this->assertNotSame($oldToken, $subscriber->token);
        $this->get(route('newsletter.confirm', $oldToken))->assertRedirect('/?newsletter=invalid#newsletter');
    }

    public function test_the_admin_sends_a_newsletter_only_to_confirmed_subscribers(): void
    {
        $active = NewsletterSubscriber::create(['email' => 'active@example.com']);
        $active->forceFill(['confirmed_at' => now()])->save();
        NewsletterSubscriber::create(['email' => 'pending@example.com']);
        $gone = NewsletterSubscriber::create(['email' => 'gone@example.com']);
        $gone->forceFill(['confirmed_at' => now(), 'unsubscribed_at' => now()])->save();

        $owner = User::factory()->create(['role' => 'owner', 'status' => 'approved']);
        $this->actingAs($owner)->post(route('admin.newsletter.send'), ['subject' => 'Hi', 'body' => 'Some news for you.'])->assertForbidden();

        $admin = $this->admin();
        $this->actingAs($admin)->get(route('admin.newsletter'))
            ->assertInertia(fn ($page) => $page->component('Admin/Newsletter')->where('counts.active', 1)->where('counts.pending', 1)->where('counts.unsubscribed', 1));

        $this->actingAs($admin)->post(route('admin.newsletter.send'), [
            'subject' => 'New offices in Kigali',
            'body' => "Three new offices are free.\n\nVisit ITUZE to see them.",
        ])->assertSessionHas('success');

        $issue = NewsletterIssue::sole();
        $this->assertSame(1, $issue->recipients);
        Notification::assertSentOnDemandTimes(NewsletterMessage::class, 1);
        Notification::assertSentOnDemand(NewsletterMessage::class, function ($notification, $channels, AnonymousNotifiable $notifiable) use ($active) {
            $mail = $notification->toMail($notifiable);

            return $notifiable->routes['mail'] === 'active@example.com'
                && $mail->subject === 'New offices in Kigali'
                && in_array('Visit ITUZE to see them.', $mail->introLines, true)
                && str_contains(implode(' ', $mail->outroLines), route('newsletter.unsubscribe', $active->token));
        });

        $csv = $this->actingAs($admin)->get(route('admin.newsletter.export'))->streamedContent();
        $this->assertStringContainsString('active@example.com', $csv);
        $this->assertStringNotContainsString('pending@example.com', $csv);
        $this->assertStringNotContainsString('gone@example.com', $csv);
    }

    public function test_nothing_is_sent_when_nobody_confirmed(): void
    {
        NewsletterSubscriber::create(['email' => 'pending@example.com']);

        $this->actingAs($this->admin())->post(route('admin.newsletter.send'), ['subject' => 'Hi', 'body' => 'Some news for you.'])
            ->assertSessionHas('error');

        $this->assertSame(0, NewsletterIssue::count());
        Notification::assertNothingSent();
    }
}
