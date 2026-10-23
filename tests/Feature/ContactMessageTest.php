<?php

namespace Tests\Feature;

use App\Models\ContactMessage;
use App\Models\User;
use App\Notifications\Channels\SmsChannel;
use App\Notifications\NewContactMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class ContactMessageTest extends TestCase
{
    use RefreshDatabase;

    private function form(array $overrides = []): array
    {
        return [
            'name' => 'Aline Uwase',
            'phone' => '0788123456',
            'email' => 'Aline@Example.com',
            'topic' => 'rent',
            'message' => 'I am looking for an office in Kigali for 10 people.',
            ...$overrides,
        ];
    }

    public function test_a_message_is_saved_and_the_admin_gets_an_sms_and_email(): void
    {
        Notification::fake();
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved', 'phone' => '0783163187']);

        $this->post(route('contact.store'), $this->form(['phone' => '+250 788 123 456']))
            ->assertSessionHasNoErrors()
            ->assertSessionHas('contactSent', true);

        $contact = ContactMessage::sole();
        $this->assertSame('0788123456', $contact->phone);
        $this->assertSame('aline@example.com', $contact->email);
        $this->assertSame('Rent a space', $contact->topicLabel());

        Notification::assertSentTo($admin, NewContactMessage::class, function ($notification, $channels) use ($admin) {
            $sms = $notification->toSms($admin);

            return $channels === ['mail', SmsChannel::class]
                && str_starts_with($sms, 'ITUZE: new message from Aline Uwase 0788123456 (Rent a space)')
                && mb_strlen($sms) <= 160;
        });
    }

    public function test_bad_input_is_refused_and_bots_are_ignored(): void
    {
        Notification::fake();
        User::factory()->create(['role' => 'admin', 'status' => 'approved']);

        $this->post(route('contact.store'), $this->form(['phone' => '12345']))->assertSessionHasErrors('phone');
        $this->post(route('contact.store'), $this->form(['topic' => 'spam']))->assertSessionHasErrors('topic');
        $this->post(route('contact.store'), $this->form(['message' => 'hi']))->assertSessionHasErrors('message');
        $this->post(route('contact.store'), $this->form(['email' => 'not-an-email']))->assertSessionHasErrors('email');
        $this->post(route('contact.store'), $this->form(['email' => '']))->assertSessionHasNoErrors();

        // A filled hidden field means a bot: it is thanked but nothing is saved or sent.
        $this->post(route('contact.store'), $this->form(['website' => 'http://spam.example']))->assertSessionHas('contactSent', true);

        $this->assertSame(1, ContactMessage::count());
        Notification::assertCount(1);
    }

    public function test_one_visitor_can_send_at_most_ten_messages_in_ten_minutes(): void
    {
        Notification::fake();

        for ($i = 0; $i < 10; $i++) {
            $this->post(route('contact.store'), $this->form())->assertSessionHasNoErrors();
        }

        $this->post(route('contact.store'), $this->form())->assertStatus(429);
        $this->assertSame(10, ContactMessage::count());
    }
}
