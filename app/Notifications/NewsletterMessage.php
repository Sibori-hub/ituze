<?php

namespace App\Notifications;

use App\Models\NewsletterIssue;
use App\Models\NewsletterSubscriber;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Symfony\Component\Mime\Email;

/**
 * One newsletter to one subscriber, with a one-click unsubscribe link.
 * Queued on the database queue so a large list is sent in the background.
 */
class NewsletterMessage extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public NewsletterIssue $issue, public NewsletterSubscriber $subscriber)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $unsubscribe = route('newsletter.unsubscribe', $this->subscriber->token);
        $mail = (new MailMessage)
            ->subject($this->issue->subject)
            ->greeting('Hello,');

        // Each blank-line separated paragraph becomes its own line in the email.
        foreach (preg_split('/\R{2,}/', trim($this->issue->body)) ?: [] as $paragraph) {
            $mail->line(trim($paragraph));
        }

        return $mail
            ->action('Visit ITUZE', url('/'))
            ->line('You receive this email because you subscribed to ITUZE news. Unsubscribe any time: '.$unsubscribe)
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD')
            ->withSymfonyMessage(function (Email $message) use ($unsubscribe) {
                $message->getHeaders()->addTextHeader('List-Unsubscribe', '<'.$unsubscribe.'>');
            });
    }
}
