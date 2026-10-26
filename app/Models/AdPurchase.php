<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Listing credits an advertiser bought by mobile money.
 */
class AdPurchase extends Model
{
    public const PENDING = 'pending';
    public const APPROVED = 'approved';
    public const FAILED = 'failed';

    protected $fillable = [
        'advertiser_id', 'property_id', 'listings', 'bonus', 'amount', 'method', 'status',
        'mobile_money_request_id', 'reference', 'receipt_number', 'paid_at',
        'sender_name', 'sender_phone', 'bank_name', 'account_number', 'sent_at', 'proof_path', 'proof_name',
        'reviewed_by', 'reviewed_at', 'rejection_reason',
    ];

    public const REJECTED = 'rejected';

    // The receipt photo stays on the server; pages only learn whether there is one.
    protected $hidden = ['proof_path'];

    protected $casts = [
        'listings' => 'integer',
        'bonus' => 'integer',
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'sent_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function advertiser()
    {
        return $this->belongsTo(User::class, 'advertiser_id')->withTrashed();
    }

    public function property()
    {
        return $this->belongsTo(Property::class);
    }

    public function mobileMoneyRequest()
    {
        return $this->belongsTo(MobileMoneyRequest::class);
    }
}
