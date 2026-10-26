<?php

namespace App\Notifications;

use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Q.R.A did something in a building it manages for the owner (a rental, a
 * payment, a renewal, a move-out, a lease, a unit, utilities). The owner is
 * told each time by email and SMS.
 */
class ManagedOwnerActivity extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $description,
        public ?string $propertyName,
        public ?float $amount,
        public string $when,
    ) {
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
            ->subject('ITUZE: news from '.($this->propertyName ?: 'your buildings'))
            ->greeting('Hello '.($notifiable->first_name ?: $notifiable->name).',')
            ->line('Q.R.A GROUP LTD, who manages your buildings, just did this on '.$this->when.':')
            ->line('**'.$this->description.'**');
        if ($this->amount !== null) {
            $mail->line('Amount: **'.number_format($this->amount).' RWF**');
        }

        return $mail->action('See it on ITUZE', route('dashboard'))
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    /** One SMS (about 160 characters). */
    public function toSms(object $notifiable): string
    {
        $amount = $this->amount !== null ? ' ('.number_format($this->amount).' RWF)' : '';

        return 'ITUZE: '.str($this->description)->limit(120 - mb_strlen($amount), '…').$amount;
    }
}
