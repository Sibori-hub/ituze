<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A newsletter an admin sent to the active subscribers.
 */
class NewsletterIssue extends Model
{
    protected $fillable = ['subject', 'body', 'sent_by', 'recipients'];

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }
}
