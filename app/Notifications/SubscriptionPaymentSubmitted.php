<?php

namespace App\Notifications;

use App\Models\SubscriptionPayment;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Admins: an owner sent a bank slip or cheque that needs checking.
 */
class SubscriptionPaymentSubmitted extends Notification implements ShouldQueue
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

    private function method(): string
    {
        return match ($this->payment->method) {
            'cheque' => 'cheque',
            'momo_pay' => 'MoMo Pay',
            default => 'bank transfer',
        };
    }

    public function toMail(object $notifiable): MailMessage
    {
        $payment = $this->payment->loadMissing('owner:id,name,email,phone');

        return (new MailMessage)
            ->subject('Subscription payment to check: '.$payment->owner?->name)
            ->greeting('Hello,')
            ->line($payment->owner?->name.' paid '.number_format((float) $payment->amount, 0).' RWF by '.$this->method().' for '.$payment->planLabel().'.')
            ->line(($payment->method === 'momo_pay' ? 'MoMo transaction ID: ' : 'Reference: ').$payment->reference)
            ->lineIf($payment->method === 'momo_pay', 'Sender: '.$payment->sender_name.' · '.$payment->sender_phone.' · paid '.$payment->paid_at?->format('j M Y, H:i'))
            ->line($payment->method === 'momo_pay'
                ? 'Please compare it with the MoMo Pay statement, then approve or reject it.'
                : 'Please check the attached proof and approve or reject it.')
            ->action('Review subscription payments', url('/admin/subscriptions'))
            ->salutation('ITUZE GREEN PLATFORM');
    }

    public function toSms(object $notifiable): string
    {
        $payment = $this->payment->loadMissing('owner:id,name');

        return 'ITUZE: '.$payment->owner?->name.' sent a '.$this->method().' of '.number_format((float) $payment->amount, 0).' RWF for the subscription. Please review: '.url('/admin/subscriptions');
    }
}
