<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\HtmlString;

class OtpCodeMail extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $code,
        public string $purpose = 'login',
    ) {
        $this->onConnection(config('mail.code_queue_connection', 'deferred'));
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $isLogin = $this->purpose === 'login';

        return (new MailMessage)
            ->subject(($isLogin ? 'Your Login Code' : 'Your Verification Code') . ' - ' . config('app.name'))
            ->greeting('Hello ' . $notifiable->first_name . '!')
            ->line($isLogin
                ? 'Use the code below to finish signing in to your account.'
                : 'Use the code below to verify your phone number.')
            ->line(new HtmlString(
                '<div style="text-align:center; margin: 24px 0;">' .
                '<span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0E3B2E;">' . $this->code . '</span>' .
                '</div>'
            ))
            ->line('This code expires in 10 minutes.')
            ->line('If you did not request this code, you can ignore this message.');
    }

    /**
     * A queued send that fails would otherwise vanish silently; leave a trace.
     */
    public function failed(\Throwable $e): void
    {
        Log::warning(class_basename($this).' could not be sent: '.$e->getMessage());
    }
}
