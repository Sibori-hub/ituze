<?php

namespace App\Notifications;

use App\Models\SubscriptionPayment;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Admins: an owner paid their subscription by mobile money and it was
 * applied automatically.
 */
class SubscriptionPaymentReceived extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public SubscriptionPayment $payment)
    {
        $this->onConnection('deferred');
    }

    public function via(object $notifiable): array
    {
        return array_values(array_filter(['mail', filled($notifiable->phone ?? null) ? SmsChannel::class : null]));
    }

    private function summary(): string
    {
        $payment = $this->payment->loadMissing('owner:id,name');

        return $payment->owner?->name.' paid '.number_format((float) $payment->amount, 0).' RWF by mobile money for '
            .$payment->planLabel().' (paid until '.$payment->period_end?->format('j M Y').').';
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Subscription paid: '.$this->payment->loadMissing('owner:id,name')->owner?->name)
            ->greeting('Hello,')
            ->line($this->summary())
            ->line('Receipt: '.$this->payment->receipt_number.' · Transaction: '.$this->payment->reference)
            ->action('Open subscriptions', url('/admin/subscriptions?status=approved'))
            ->salutation('ITUZE GREEN PLATFORM');
    }

    public function toSms(object $notifiable): string
    {
        return 'ITUZE: '.$this->summary();
    }
}
