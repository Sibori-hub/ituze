<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class NewOwnerRegistered extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public User $newUser)
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
            ->subject('New Owner Registered - '.config('app.name'))
            ->greeting('Hello Admin,')
            ->line('A new owner has just registered on '.config('app.name').'.')
            ->line('Name: '.$this->newUser->name)
            ->line('Email: '.$this->newUser->email)
            ->line('Phone: '.$this->newUser->phone)
            ->line('Once they complete their profile, you will be able to review and approve their account.')
            ->action('Open Admin Dashboard', url('/admin/approvals'))
            ->line('Thank you for keeping the platform safe.');
    }
}