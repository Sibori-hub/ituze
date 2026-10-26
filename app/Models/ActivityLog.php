<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One line of "who did what" in an owner's workspace.
 */
class ActivityLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'actor_id', 'owner_id', 'property_id', 'action', 'subject_type', 'subject_id',
        'description', 'amount', 'group_key', 'created_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'created_at' => 'datetime',
    ];

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_id')->withTrashed();
    }

    /** The owner whose workspace this line belongs to. */
    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function property()
    {
        return $this->belongsTo(Property::class);
    }
}
