<?php

namespace App\Notifications;

use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The admin approved a new account. Tells the owner or advertiser by SMS and
 * email, with what to do next.
 */
class AccountApproved extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct()
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

    private function nextStep(object $notifiable): string
    {
        return match (true) {
            $notifiable->paysSubscription() => 'Log in and pay your first month to start managing your properties.',
            $notifiable->isAdvertiser() => 'Log in to publish your first building.',
            default => 'You can now log in and start using ITUZE.',
        };
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your ITUZE account is approved')
            ->greeting('Hello '.($notifiable->first_name ?: $notifiable->name).',')
            ->line('Good news: we checked your details and your '.$notifiable->roleLabel().' account on ITUZE GREEN PLATFORM is approved.')
            ->line($this->nextStep($notifiable))
            ->action('Log in', route('login'))
            ->line('Questions? Reply to this email or call us.')
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    /** One SMS (about 160 characters). */
    public function toSms(object $notifiable): string
    {
        return 'ITUZE: Hello '.str($notifiable->first_name ?: $notifiable->name)->limit(20, '').', your account is approved. '
            .$this->nextStep($notifiable).' '.route('login');
    }
}
