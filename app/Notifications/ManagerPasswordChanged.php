<?php

namespace App\Notifications;

use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A manager's password changed: either the owner set a new temporary one, or
 * the manager changed it. Sent by email and SMS so a change nobody asked for
 * is noticed. The password itself is never sent.
 */
class ManagerPasswordChanged extends Notification implements ShouldQueue
{
    use Queueable;

    /** @param string|null $byOwner the owner's name when the owner reset it */
    public function __construct(public ?string $byOwner = null)
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
        $mail = (new MailMessage)
            ->subject('Your ITUZE password was changed')
            ->greeting('Hello '.($notifiable->first_name ?: $notifiable->name).',');

        $mail = $this->byOwner
            ? $mail->line($this->byOwner.' set a new temporary password for your manager account on '.now('Africa/Kigali')->format('j M Y, H:i').'.')
                ->line('Ask '.$this->byOwner.' for it. You will choose your own password at your next sign-in.')
            : $mail->line('The password of your manager account was changed on '.now('Africa/Kigali')->format('j M Y, H:i').'.')
                ->line('If you did not do this, contact the owner you work for or ITUZE at once.');

        return $mail->action('Sign in', route('login'))
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    /** One SMS (about 160 characters). */
    public function toSms(object $notifiable): string
    {
        return $this->byOwner
            ? 'ITUZE: '.str($this->byOwner)->limit(20, '').' set a new temporary password for you (username '.$notifiable->username.'). Ask them for it, then sign in: '.route('login')
            : 'ITUZE: your manager password was changed '.now('Africa/Kigali')->format('j M H:i').'. Not you? Contact your owner or ITUZE now.';
    }
}
