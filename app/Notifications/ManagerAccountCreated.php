<?php

namespace App\Notifications;

use App\Models\User;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * An owner added a manager. Tells the manager by email and SMS who added
 * them, their username and how to sign in. The temporary password is never
 * sent: the owner gives it to them in person.
 */
class ManagerAccountCreated extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $ownerName, public array $buildings)
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

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('You are now a manager on ITUZE')
            ->greeting('Hello '.($notifiable->first_name ?: $notifiable->name).',')
            ->line($this->ownerName.' added you as a manager on ITUZE GREEN PLATFORM.')
            ->line('Buildings you will run: '.implode(', ', $this->buildings).'.')
            ->line('Your username: **'.$notifiable->username.'** (you can also sign in with your phone number).')
            ->line($this->ownerName.' will give you your temporary password. At your first sign-in you choose your own password, confirm your email and phone with a code, and add your ID, a copy of it, a photo and your location.')
            ->action('Sign in', route('login'))
            ->line('Did not expect this? Ignore this message or contact us.')
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    /** One SMS (about 160 characters). */
    public function toSms(object $notifiable): string
    {
        return 'ITUZE: '.str($this->ownerName)->limit(20, '').' made you a manager. Username: '.$notifiable->username
            .'. Password: ask the owner. Sign in: '.route('login');
    }

    /** Owner name and the building names, for a new manager. */
    public static function for(User $owner, User $manager): self
    {
        $buildings = $manager->managerAssignments()->with('property:id,name')->get()
            ->map(fn ($assignment) => $assignment->property?->name)->filter()->unique()->values()->all();

        return new self($owner->name, $buildings ?: ['—']);
    }
}
