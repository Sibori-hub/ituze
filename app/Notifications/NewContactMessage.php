<?php

namespace App\Notifications;

use App\Models\ContactMessage;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Someone used the "Contact us" form. Sent to every active admin, by email and SMS.
 */
class NewContactMessage extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public ContactMessage $contact)
    {
        $this->onConnection('deferred');
    }

    public function via(object $notifiable): array
    {
        return array_values(array_filter([
            filled($notifiable->email ?? null) ? 'mail' : null,
            filled($notifiable->phone ?? null) ? SmsChannel::class : null,
        ]));
    }

    public function toMail(object $notifiable): MailMessage
    {
        $contact = $this->contact;
        $mail = (new MailMessage)
            ->subject('New message from the website: '.$contact->topicLabel())
            ->greeting('Hello '.($notifiable->first_name ?? $notifiable->name ?? '').',')
            ->line($contact->name.' sent a message from the Contact us form.')
            ->line('Topic: '.$contact->topicLabel())
            ->line('Phone: '.$contact->phone)
            ->line('Email: '.($contact->email ?: '—'))
            ->line('Message: “'.str($contact->message)->limit(1500).'”');

        if ($contact->email) {
            $mail->replyTo($contact->email, $contact->name);
        }

        return $mail
            ->action('Open messages', route('admin.messages'))
            ->line('Reply by phone, WhatsApp or email soon.')
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    /** One or two SMS. */
    public function toSms(object $notifiable): string
    {
        $contact = $this->contact;

        return 'ITUZE: new message from '.str($contact->name)->limit(30).' '.$contact->phone.' ('.$contact->topicLabel().'): "'
            .str($contact->message)->squish()->limit(70).'"';
    }
}
