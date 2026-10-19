<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A payment request sent to a tenant's mobile money phone.
 */
class MobileMoneyRequest extends Model
{
    public const PENDING = 'pending';
    public const SUCCESSFUL = 'successful';
    public const FAILED = 'failed';
    public const EXPIRED = 'expired';

    protected $fillable = [
        'reference',
        'provider',
        'purpose',
        'tenant_id',
        'unit_id',
        'requested_by',
        'phone',
        'amount',
        'currency',
        'status',
        'provider_transaction_id',
        'failure_reason',
        'completed_at',
        'tenancy_id',
        'used_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'completed_at' => 'datetime',
        'used_at' => 'datetime',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function unit()
    {
        return $this->belongsTo(Unit::class);
    }

    public function isPending(): bool
    {
        return $this->status === self::PENDING;
    }

    public function isSuccessful(): bool
    {
        return $this->status === self::SUCCESSFUL;
    }

    /**
     * What the screen needs; never exposes provider secrets.
     *
     * @return array<string, mixed>
     */
    public function toClient(): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'status' => $this->status,
            'phone' => $this->phone,
            'amount' => (float) $this->amount,
            'currency' => $this->currency,
            'provider' => $this->provider,
            'transaction_id' => $this->provider_transaction_id,
            'failure_reason' => $this->failure_reason,
            'created_at' => $this->created_at?->toIso8601String(),
            'expires_at' => $this->created_at?->addSeconds((int) config('services.mobile_money.timeout_seconds', 180))->toIso8601String(),
        ];
    }
}
