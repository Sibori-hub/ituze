<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A message from the "Contact us" form on the home page.
 */
class ContactMessage extends Model
{
    public const TOPICS = [
        'rent' => 'Rent a space',
        'list' => 'List my property',
        'partnership' => 'Partnership',
        'other' => 'Other',
    ];

    protected $fillable = ['name', 'phone', 'email', 'topic', 'message', 'ip_address'];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
        ];
    }

    public function topicLabel(): string
    {
        return self::TOPICS[$this->topic] ?? ucfirst((string) $this->topic);
    }
}
