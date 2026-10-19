<?php

namespace App\Notifications;

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

    public function __construct(public string $kind)
    {
        $this->onConnection('deferred');
    }

    public function via(object $notifiable): array
    {
        return array_values(array_filter(['mail', filled($notifiable->phone ?? null) ? SmsChannel::class : null]));
    }

    /** @return array{subject: string, line: string} */
    public static function text(User $owner, string $kind): array
    {
        $end = $owner->expires_at?->format('j M Y');
        $graceEnd = $owner->subscriptionGraceEndsAt()?->format('j M Y');
        $price = number_format((int) config('legal.owner_subscription_monthly_rwf', 100000), 0).' RWF';

        return match ($kind) {
            'days_7', 'days_3' => [
                'subject' => 'Your ITUZE subscription ends on '.$end,
                'line' => 'Your subscription ends on '.$end.' ('.($kind === 'days_7' ? '7' : '3').' days). Pay '.$price.' per month by MoMo or bank to keep your account and your managers working.',
            ],
            'due' => [
                'subject' => 'Your ITUZE subscription ended today',
                'line' => 'Your subscription ended today. You have until '.$graceEnd.' to pay before your account and your managers are paused.',
            ],
            default => [
                'subject' => 'Your ITUZE account is paused',
                'line' => 'Your subscription was not renewed, so your account and your managers are paused. Your data is safe: pay any time to continue.',
            ],
        };
    }

    public function toMail(object $notifiable): MailMessage
    {
        $text = self::text($notifiable, $this->kind);

        return (new MailMessage)
            ->subject($text['subject'])
            ->greeting('Hello '.($notifiable->first_name ?? $notifiable->name).',')
            ->line($text['line'])
            ->action('Pay my subscription', url('/subscription'))
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    public function toSms(object $notifiable): string
    {
        return 'ITUZE: '.self::text($notifiable, $this->kind)['line'].' Pay: '.url('/subscription');
    }
}
