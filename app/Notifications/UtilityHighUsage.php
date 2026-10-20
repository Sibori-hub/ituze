<?php

namespace App\Notifications;

use App\Models\UtilityReading;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Owner: a month's water or electricity use is well above the months before.
 */
class UtilityHighUsage extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public UtilityReading $reading, public int $percentAbove)
    {
        $this->onConnection('deferred');
    }

    public function via(object $notifiable): array
    {
        return filled($notifiable->email ?? null) ? ['mail'] : [];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $reading = $this->reading->loadMissing('property:id,name');
        $unit = UtilityReading::UNITS[$reading->type] ?? '';
        $used = rtrim(rtrim(number_format((float) $reading->consumption, 2, '.', ','), '0'), '.');

        return (new MailMessage)
            ->subject('High '.$reading->type.' use at '.$reading->property?->name)
            ->greeting('Hello '.($notifiable->first_name ?? $notifiable->name).',')
            ->line($reading->property?->name.' used '.$used.' '.$unit.' of '.$reading->type.' in '.$reading->period->format('F Y').', '.$this->percentAbove.'% more than the average of the months before.')
            ->line($reading->type === 'water'
                ? 'Please check for leaking taps, toilets or pipes.'
                : 'Please check for equipment left on, faulty appliances or air conditioning running when rooms are empty.')
            ->action('Open utilities', url('/utilities?property_id='.$reading->property_id))
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }
}
