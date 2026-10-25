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

    // Renew (or start) the subscription, or add houses to the current period.
    public const RENEWAL = 'renewal';
    public const ADD_HOUSES = 'add_houses';

    protected $fillable = [
        'owner_id', 'property_id', 'months', 'houses', 'purpose', 'amount', 'method', 'reference', 'bank_name', 'account_number', 'sender_name', 'sender_phone', 'paid_at', 'proof_path', 'proof_name', 'status',
        'mobile_money_request_id', 'period_start', 'period_end', 'receipt_number', 'submitted_by',
        'reviewed_by', 'reviewed_at', 'rejection_reason',
    ];

    protected $casts = [
        'months' => 'integer',
        'houses' => 'integer',
        'amount' => 'decimal:2',
        'period_start' => 'date',
        'period_end' => 'date',
        'reviewed_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    /** "Kigali Heights for 3 months". */
    public function planLabel(): string
    {
        $name = $this->property?->name ?? 'a property';

        return $name.' for '.$this->months.' month'.($this->months === 1 ? '' : 's');
    }

    public function property()
    {
        return $this->belongsTo(Property::class);
    }

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
