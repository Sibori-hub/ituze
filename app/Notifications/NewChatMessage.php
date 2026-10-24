<?php

namespace App\Notifications;

use App\Models\ChatMessage;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A chat message the other side has not seen: to the admins when a user
 * writes, to the user when ITUZE support answers. SMS and email.
 */
class NewChatMessage extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public ChatMessage $message)
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

    private function preview(int $limit): string
    {
        $text = str($this->message->body ?? '')->squish();

        return $text->isEmpty() ? '(file: '.$this->message->attachment_name.')' : (string) $text->limit($limit);
    }

    private function writer(): string
    {
        return $this->message->from_support ? 'ITUZE support' : (string) $this->message->loadMissing('sender')->sender?->name;
    }

    private function link(): string
    {
        return $this->message->from_support
            ? route('dashboard', ['chat' => 1])
            : route('admin.chats', ['conversation' => $this->message->conversation_id]);
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('New chat message from '.$this->writer())
            ->greeting('Hello '.($notifiable->first_name ?: $notifiable->name).',')
            ->line($this->writer().' wrote in the ITUZE chat:')
            ->line('“'.$this->preview(500).'”')
            ->action('Open the chat', $this->link())
            ->salutation('ITUZE GREEN PLATFORM · Q.R.A GROUP LTD');
    }

    /** One SMS. */
    public function toSms(object $notifiable): string
    {
        return 'ITUZE chat: '.str($this->writer())->limit(25).': "'.$this->preview(60).'" Reply: '.$this->link();
    }
}
