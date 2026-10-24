<?php

namespace App\Services;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\User;
use App\Notifications\NewChatMessage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Throwable;

/**
 * Sends chat messages and tells the other side by SMS and email, at most once
 * every 15 minutes per conversation and side so a quick back-and-forth does
 * not send a text for every line.
 */
class ChatService
{
    public const ALERT_MINUTES = 15;

    public function conversationFor(User $user): ChatConversation
    {
        return ChatConversation::query()->firstOrCreate(['user_id' => $user->id]);
    }

    public function send(ChatConversation $conversation, User $sender, bool $fromSupport, ?string $body, ?UploadedFile $file = null): ChatMessage
    {
        $message = $conversation->messages()->create([
            'sender_id' => $sender->id,
            'from_support' => $fromSupport,
            'body' => filled($body) ? trim($body) : null,
            'attachment_path' => $file?->store('chat-files', 'local'),
            'attachment_name' => $file ? mb_substr($file->getClientOriginalName(), 0, 200) : null,
        ]);
        $conversation->forceFill(['last_message_at' => $message->created_at])->save();

        // Writing means you have read the other side's messages.
        $conversation->messages()->where('from_support', ! $fromSupport)->whereNull('read_at')->update(['read_at' => now()]);

        $this->alert($conversation, $message);

        return $message;
    }

    private function alert(ChatConversation $conversation, ChatMessage $message): void
    {
        $side = $message->from_support ? 'user' : 'support';
        if (! Cache::add("chat-alert:{$conversation->id}:{$side}", true, now()->addMinutes(self::ALERT_MINUTES))) {
            return;
        }

        $recipients = $message->from_support
            ? collect([$conversation->user])->filter()
            : User::query()->where('role', 'admin')->whereNull('disabled_at')->get();

        try {
            Notification::send($recipients, new NewChatMessage($message));
        } catch (Throwable $e) {
            Log::warning('Chat alert not sent: '.$e->getMessage(), ['message' => $message->id]);
        }
    }
}
