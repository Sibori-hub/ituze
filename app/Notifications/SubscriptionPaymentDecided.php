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
            $name = $payment->property?->name ?? 'Your property';

            return $mail
                ->subject($name.' is paid until '.$payment->period_end?->format('j M Y'))
                ->line('We received your payment of '.$amount.' for '.$payment->planLabel().'.')
                ->line($name.' is now paid until '.$payment->period_end?->format('j F Y').'. You can add its units, rooms and tenants.')
                ->line('Receipt number: '.$payment->receipt_number)
                ->action('Add units and rooms', $this->propertyLink())
                ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
        }

        return $mail
            ->subject('Subscription payment not accepted')
            ->line('We could not accept your payment of '.$amount.'.')
            ->line('Reason: '.($payment->rejection_reason ?: 'not given'))
            ->line('Please check the details and send the payment again.')
            ->action('Pay again', $this->payLink())
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    public function toSms(object $notifiable): string
    {
        $payment = $this->payment;

        return $this->approved()
            ? 'ITUZE: Payment approved. '.str($payment->property?->name ?? 'Your property')->limit(30).' is paid until '.$payment->period_end?->format('j M Y').'. Add units and rooms: '.$this->propertyLink()
            : 'ITUZE: Your payment was not accepted: '.str($payment->rejection_reason ?: 'see your email')->limit(60).' Pay again: '.$this->payLink();
    }

    private function propertyLink(): string
    {
        return $this->payment->property_id ? route('properties.show', $this->payment->property_id) : url('/subscription');
    }

    private function payLink(): string
    {
        return $this->payment->property_id ? route('properties.pay', $this->payment->property_id) : url('/subscription');
    }
}
