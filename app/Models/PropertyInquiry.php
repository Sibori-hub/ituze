<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PropertyInquiry extends Model
{
    protected $fillable = [
        'property_id',
        'unit_id',
        'owner_id',
        'visitor_name',
        'visitor_email',
        'visitor_phone',
        'business_use',
        'message',
        'response_message',
        'status',
        'responded_at',
        'whatsapp_sent_at',
        'whatsapp_error',
    ];

    protected $casts = [
        'whatsapp_sent_at' => 'datetime',
        'responded_at' => 'datetime',
    ];

    public function property()
    {
        return $this->belongsTo(Property::class);
    }

    public function unit()
    {
        return $this->belongsTo(Unit::class);
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

}
