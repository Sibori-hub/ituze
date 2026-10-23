<?php

namespace App\Notifications;

use App\Models\User;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Someone finished registering (profile, photo and ID sent) and waits for
 * approval. Sent to every admin, by SMS and email.
 */
class NewRegistrationAwaitingApproval extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public User $applicant)
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

    private function applicantName(): string
    {
        return trim($this->applicant->first_name.' '.$this->applicant->last_name) ?: (string) $this->applicant->name;
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('New registration waiting for approval: '.$this->applicantName())
            ->greeting('Hello '.($notifiable->first_name ?? $notifiable->name ?? '').',')
            ->line($this->applicantName().' registered on ITUZEAPP as '.$this->applicant->role.' and is waiting for approval.')
            ->line('Phone: '.$this->applicant->phone)
            ->line('Email: '.$this->applicant->email)
            ->action('Review the account', route('admin.approvals'))
            ->line('Check the photo and ID document before approving.')
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    /** One SMS (about 160 characters). */
    public function toSms(object $notifiable): string
    {
        return 'Hello Admin, '.str($this->applicantName())->limit(30).' ('.$this->applicant->role.', '.$this->applicant->phone
            .') registered on ITUZEAPP and is waiting for approval. '.route('admin.approvals');
    }
}
