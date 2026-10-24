<?php

namespace App\Notifications;

use App\Models\NewsletterSubscriber;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Double opt-in: the newsletter starts only after this link is clicked.
 */
class NewsletterConfirmation extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public NewsletterSubscriber $subscriber)
    {
        $this->onConnection('deferred');
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Confirm your ITUZE newsletter subscription')
            ->greeting('Hello,')
            ->line('Someone (hopefully you) asked to receive ITUZE news: new spaces for rent, tips and offers.')
            ->action('Confirm subscription', route('newsletter.confirm', $this->subscriber->token))
            ->line('If you did not ask for this, ignore this email and you will not hear from us.')
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }
}
