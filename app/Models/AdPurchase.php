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
        'advertiser_id', 'listings', 'bonus', 'amount', 'method', 'status',
        'mobile_money_request_id', 'reference', 'receipt_number', 'paid_at',
    ];

    protected $casts = [
        'listings' => 'integer',
        'bonus' => 'integer',
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
    ];

    public function advertiser()
    {
        return $this->belongsTo(User::class, 'advertiser_id')->withTrashed();
    }

    public function mobileMoneyRequest()
    {
        return $this->belongsTo(MobileMoneyRequest::class);
    }
}
