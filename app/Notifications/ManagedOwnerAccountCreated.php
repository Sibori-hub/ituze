<?php

namespace App\Notifications;

use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Q.R.A added an owner whose buildings it manages. Tells the owner by email
 * and SMS their username and how to sign in to follow their buildings (read
 * only). The temporary password is never sent: Q.R.A gives it in person.
 */
class ManagedOwnerAccountCreated extends Notification implements ShouldQueue
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

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your ITUZE account: Q.R.A manages your buildings')
            ->greeting('Hello '.($notifiable->first_name ?: $notifiable->name).',')
            ->line('Q.R.A GROUP LTD now manages your buildings on ITUZE GREEN PLATFORM.')
            ->line('Your username: **'.$notifiable->username.'** (you can also sign in with your phone number).')
            ->line('Q.R.A will give you your temporary password. At your first sign-in you choose your own password.')
            ->line('You can follow everything about your buildings: tenants, rent, deposits, payments, utilities and your statement. Q.R.A does the work; you are told by email and SMS each time.')
            ->action('Sign in', route('login'))
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    /** One SMS (about 160 characters). */
    public function toSms(object $notifiable): string
    {
        return 'ITUZE: Q.R.A now manages your buildings. Username: '.$notifiable->username.'. Password: ask Q.R.A. Sign in: '.route('login');
    }
}
