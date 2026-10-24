<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Someone who asked for ITUZE news by email. They receive newsletters only
 * after confirming (double opt-in) and until they unsubscribe.
 */
class NewsletterSubscriber extends Model
{
    protected $fillable = ['email', 'locale', 'token', 'ip_address'];

    protected $hidden = ['token'];

    protected function casts(): array
    {
        return [
            'confirmed_at' => 'datetime',
            'unsubscribed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $subscriber) {
            $subscriber->token ??= Str::random(48);
        });
    }

    /** Confirmed and not unsubscribed: the people a newsletter goes to. */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNotNull('confirmed_at')->whereNull('unsubscribed_at');
    }

    public function isActive(): bool
    {
        return $this->confirmed_at !== null && $this->unsubscribed_at === null;
    }

    public function status(): string
    {
        return match (true) {
            $this->unsubscribed_at !== null => 'unsubscribed',
            $this->confirmed_at !== null => 'active',
            default => 'pending',
        };
    }
}
