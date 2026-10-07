<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class EmailVerificationOtp extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $code)
    {
        $this->onConnection('deferred');
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your Verification Code - '.config('app.name'))
            ->greeting('Hello '.$notifiable->first_name.'!')
            ->line('Use the code below to verify your email address.')
            ->line(new \Illuminate\Support\HtmlString(
                '<div style="text-align:center; margin: 24px 0;">'.
                '<span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0E3B2E;">'.$this->code.'</span>'.
                '</div>'
            ))
            ->line('This code expires in 10 minutes.')
            ->line('If you did not create an account, no further action is required.');
    }
}