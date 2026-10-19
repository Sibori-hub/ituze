<?php

namespace App\Notifications;

use App\Models\PropertyInquiry;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A visitor asked about a space. Sent to the property owner and every admin,
 * by email and SMS.
 */
class NewPropertyInquiry extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public PropertyInquiry $inquiry)
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

    private function space(): string
    {
        $this->inquiry->loadMissing(['property:id,name', 'unit:id,unit_number']);
        $room = $this->inquiry->unit?->unit_number;

        return $this->inquiry->property?->name.($room ? ' · room '.$room : '');
    }

    public function toMail(object $notifiable): MailMessage
    {
        $inquiry = $this->inquiry;

        return (new MailMessage)
            ->subject('New inquiry: '.$this->space())
            ->greeting('Hello '.($notifiable->first_name ?? $notifiable->name ?? '').',')
            ->line('A visitor is interested in '.$this->space().'.')
            ->line('Name: '.$inquiry->visitor_name)
            ->line('Phone: '.$inquiry->visitor_phone)
            ->line('Email: '.$inquiry->visitor_email)
            ->line('Message: “'.str($inquiry->message)->limit(600).'”')
            ->action('Open visitor inquiries', url('/dashboard#visitor-inquiries'))
            ->line('Please contact the visitor soon, then mark the inquiry as read.')
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    /** Short enough for one or two SMS. */
    public function toSms(object $notifiable): string
    {
        $inquiry = $this->inquiry;

        return 'ITUZE: New inquiry for '.$this->space().' from '.$inquiry->visitor_name.' '.$inquiry->visitor_phone
            .'. Message: "'.str($inquiry->message)->squish()->limit(60).'" Open: '.url('/dashboard');
    }
}
