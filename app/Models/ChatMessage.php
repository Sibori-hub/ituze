<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One message in a support chat, written by the user or by ITUZE support.
 */
class ChatMessage extends Model
{
    protected $fillable = ['conversation_id', 'sender_id', 'from_support', 'body', 'attachment_path', 'attachment_name', 'read_at'];

    protected function casts(): array
    {
        return [
            'from_support' => 'boolean',
            'read_at' => 'datetime',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(ChatConversation::class, 'conversation_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id')->withTrashed();
    }

    /** What the chat window needs. */
    public function toClient(): array
    {
        return [
            'id' => $this->id,
            'from_support' => $this->from_support,
            'sender' => $this->from_support ? 'ITUZE' : $this->sender?->name,
            'body' => $this->body,
            'attachment' => $this->attachment_path ? [
                'name' => $this->attachment_name,
                'url' => route('chat.attachment', $this->id),
                'image' => (bool) preg_match('/\.(jpe?g|png|webp|gif)$/i', (string) $this->attachment_path),
            ] : null,
            'read' => $this->read_at !== null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
