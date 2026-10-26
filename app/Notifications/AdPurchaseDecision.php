<?php

namespace App\Notifications;

use App\Models\AdPurchase;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A listing payment was sent for checking (to admins), or an admin rejected
 * one (to the advertiser). Approval sends AdPurchasePaid instead.
 */
class AdPurchaseDecision extends Notification implements ShouldQueue
{
    use Queueable;

    public const SUBMITTED = 'submitted';
    public const REJECTED = 'rejected';

    public function __construct(public AdPurchase $purchase, public string $kind)
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

    private function method(): string
    {
        return ['momo_pay' => 'MoMo Pay', 'bank_transfer' => 'bank transfer', 'cheque' => 'cheque'][$this->purchase->method] ?? str_replace('_', ' ', $this->purchase->method);
    }

    public function toMail(object $notifiable): MailMessage
    {
        $purchase = $this->purchase->loadMissing('advertiser');
        $amount = number_format((float) $purchase->amount).' RWF';

        if ($this->kind === self::SUBMITTED) {
            return (new MailMessage)
                ->subject('Listing payment to check: '.$purchase->advertiser?->name)
                ->greeting('Hello,')
                ->line($purchase->advertiser?->name.' paid **'.$amount.'** for '.$purchase->listings.' listing(s) by '.$this->method().'.')
                ->line('Reference: '.($purchase->reference ?: '—').($purchase->sender_name ? ' · paid by '.$purchase->sender_name : ''))
                ->line('Check it, then approve or reject it.')
                ->action('Check ad payments', route('admin.ad-payments'))
                ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
        }

        return (new MailMessage)
            ->subject('Your ITUZE listing payment was not approved')
            ->greeting('Hello '.($notifiable->first_name ?: $notifiable->name).',')
            ->line('We could not approve your payment of '.$amount.' for '.$purchase->listings.' listing(s).')
            ->line('Reason: **'.$purchase->rejection_reason.'**')
            ->line('Please check the details and send the payment again, or contact us.')
            ->action('Open my listings', route('dashboard'))
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    /** One SMS (about 160 characters). */
    public function toSms(object $notifiable): string
    {
        $purchase = $this->purchase->loadMissing('advertiser');
        $amount = number_format((float) $purchase->amount);

        return $this->kind === self::SUBMITTED
            ? 'ITUZE admin: '.str($purchase->advertiser?->name)->limit(25, '').' paid '.$amount.' RWF for '.$purchase->listings.' listing(s) by '.$this->method().'. Check: '.route('admin.ad-payments')
            : 'ITUZE: your listing payment of '.$amount.' RWF was not approved: '.str($purchase->rejection_reason)->limit(70).'. Please pay again.';
    }
}
