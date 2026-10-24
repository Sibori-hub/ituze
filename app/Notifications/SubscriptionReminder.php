<?php

namespace App\Notifications;

use App\Models\Property;
use App\Models\User;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Owner: the subscription ends in 7 or 3 days ("days_7", "days_3"), ended
 * today ("due", grace starts), or the grace is over ("blocked").
 */
class SubscriptionReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $kind, public Property $property)
    {
        $this->onConnection('deferred');
    }

    public function via(object $notifiable): array
    {
        return array_values(array_filter(['mail', filled($notifiable->phone ?? null) ? SmsChannel::class : null]));
    }

    /** @return array{subject: string, line: string} */
    public static function text(Property $property, string $kind): array
    {
        $name = $property->name;
        $end = $property->paid_until?->format('j M Y');
        $graceEnd = $property->paid_until?->copy()->addDays(Property::graceDays())->format('j M Y');
        $price = number_format((int) config('legal.owner_subscription_monthly_rwf', 100000), 0).' RWF';

        return match ($kind) {
            'days_7', 'days_3' => [
                'subject' => $name.': subscription ends on '.$end,
                'line' => 'The subscription for '.$name.' ends on '.$end.'. Pay '.$price.' per month to keep it running.',
            ],
            'due' => [
                'subject' => $name.': subscription ended today',
                'line' => 'The subscription for '.$name.' ended today. Pay before '.$graceEnd.' or it will be paused.',
            ],
            default => [
                'subject' => $name.' is paused',
                'line' => $name.' is paused: its subscription was not renewed. Your data is safe; pay any time to continue.',
            ],
        };
    }

    public function toMail(object $notifiable): MailMessage
    {
        $text = self::text($this->property, $this->kind);

        return (new MailMessage)
            ->subject($text['subject'])
            ->greeting('Hello '.($notifiable->first_name ?? $notifiable->name).',')
            ->line($text['line'])
            ->action('Pay my subscription', route('subscription.show', ['property' => $this->property->id]))
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    public function toSms(object $notifiable): string
    {
        return 'ITUZE: '.self::text($this->property, $this->kind)['line'].' Pay: '.route('subscription.show', ['property' => $this->property->id]);
    }
}
