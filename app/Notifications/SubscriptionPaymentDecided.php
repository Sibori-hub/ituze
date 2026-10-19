<?php

namespace App\Notifications;

use App\Models\SubscriptionPayment;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Tells the owner their subscription payment was accepted (new paid-until
 * date) or not (with the reason).
 */
class SubscriptionPaymentDecided extends Notification implements ShouldQueue
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

    private function approved(): bool
    {
        return $this->payment->status === SubscriptionPayment::APPROVED;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $payment = $this->payment;
        $amount = number_format((float) $payment->amount, 0).' RWF';
        $mail = (new MailMessage)->greeting('Hello '.($notifiable->first_name ?? $notifiable->name).',');

        if ($this->approved()) {
            return $mail
                ->subject('Subscription paid until '.$payment->period_end?->format('j M Y'))
                ->line('We received your payment of '.$amount.' for '.$payment->months.' month'.($payment->months > 1 ? 's' : '').'.')
                ->line('Your ITUZE subscription is now paid until '.$payment->period_end?->format('j F Y').'.')
                ->line('Receipt number: '.$payment->receipt_number)
                ->action('View my subscription', url('/subscription'))
                ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
        }

        return $mail
            ->subject('Subscription payment not accepted')
            ->line('We could not accept your payment of '.$amount.'.')
            ->line('Reason: '.($payment->rejection_reason ?: 'not given'))
            ->line('Please check the details and send the payment again.')
            ->action('Pay my subscription', url('/subscription'))
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    public function toSms(object $notifiable): string
    {
        $payment = $this->payment;

        return $this->approved()
            ? 'ITUZE: Payment of '.number_format((float) $payment->amount, 0).' RWF received. Your subscription is paid until '.$payment->period_end?->format('j M Y').'. Receipt '.$payment->receipt_number.'.'
            : 'ITUZE: Your subscription payment was not accepted: '.str($payment->rejection_reason ?: 'see your email')->limit(80).' Please pay again at '.url('/subscription');
    }
}
