<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * An owner's payment for 1, 3, 6 or 12 months of the subscription.
 */
class SubscriptionPayment extends Model
{
    public const PENDING = 'pending';
    public const APPROVED = 'approved';
    public const REJECTED = 'rejected';
    public const FAILED = 'failed';

    protected $fillable = [
        'owner_id', 'months', 'amount', 'method', 'reference', 'sender_name', 'sender_phone', 'paid_at', 'proof_path', 'proof_name', 'status',
        'mobile_money_request_id', 'period_start', 'period_end', 'receipt_number', 'submitted_by',
        'reviewed_by', 'reviewed_at', 'rejection_reason',
    ];

    protected $casts = [
        'months' => 'integer',
        'amount' => 'decimal:2',
        'period_start' => 'date',
        'period_end' => 'date',
        'reviewed_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id')->withTrashed();
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function mobileMoneyRequest()
    {
        return $this->belongsTo(MobileMoneyRequest::class);
    }
}
