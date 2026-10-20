<?php

namespace App\Notifications;

use App\Models\AdPurchase;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * An advertiser paid for listings: a receipt for them, a notice for admins.
 */
class AdPurchasePaid extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public AdPurchase $purchase)
    {
        $this->onConnection('deferred');
    }

    public function via(object $notifiable): array
    {
        return array_values(array_filter(['mail', filled($notifiable->phone ?? null) ? SmsChannel::class : null]));
    }

    private function forAdmin(object $notifiable): bool
    {
        return ($notifiable->role ?? null) === 'admin';
    }

    private function listings(): string
    {
        $purchase = $this->purchase;
        $total = $purchase->listings + $purchase->bonus;

        return $total.' listing'.($total > 1 ? 's' : '').($purchase->bonus ? ' ('.$purchase->listings.' paid + '.$purchase->bonus.' free)' : '');
    }

    public function toMail(object $notifiable): MailMessage
    {
        $purchase = $this->purchase->loadMissing('advertiser:id,name');
        $amount = number_format((float) $purchase->amount, 0).' RWF';

        if ($this->forAdmin($notifiable)) {
            return (new MailMessage)
                ->subject('Advertiser paid: '.$purchase->advertiser?->name)
                ->greeting('Hello,')
                ->line($purchase->advertiser?->name.' paid '.$amount.' by mobile money for '.$this->listings().'.')
                ->line('Receipt: '.$purchase->receipt_number.' · Transaction: '.$purchase->reference)
                ->salutation('ITUZE GREEN PLATFORM');
        }

        return (new MailMessage)
            ->subject('Your ITUZE listings are ready')
            ->greeting('Hello '.($notifiable->first_name ?? $notifiable->name).',')
            ->line('We received '.$amount.'. You now have '.$this->listings().' to use.')
            ->line('Publish a building from your dashboard: it shows on the ITUZE homepage for 60 days.')
            ->line('Receipt: '.$purchase->receipt_number)
            ->action('Publish a building', url('/dashboard'))
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    public function toSms(object $notifiable): string
    {
        $purchase = $this->purchase->loadMissing('advertiser:id,name');

        return $this->forAdmin($notifiable)
            ? 'ITUZE: '.$purchase->advertiser?->name.' paid '.number_format((float) $purchase->amount, 0).' RWF for '.$this->listings().'.'
            : 'ITUZE: Payment received. You have '.$this->listings().' to publish your buildings for 60 days each. Receipt '.$purchase->receipt_number.'.';
    }
}
