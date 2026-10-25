<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class RentPayment extends Model
{
    protected $fillable = [
        'rent_charge_id',
        'transaction_id',
        'recorded_by',
        'amount',
        'taxable_amount',
        'vat_rate',
        'vat_amount',
        'method',
        'receipt_number',
        'reference',
        'payer_name',
        'payer_phone',
        'proof_path',
        'proof_name',
        'notes',
        'paid_at',
    ];

    // The screenshot stays on the server; pages only learn whether there is one.
    protected $hidden = ['proof_path'];

    protected $appends = ['proof_url'];

    public function getProofUrlAttribute(): ?string
    {
        return $this->proof_path ? route('rent-payments.proof', $this->id) : null;
    }

    protected $casts = [
        'amount' => 'decimal:2',
        'taxable_amount' => 'decimal:2',
        'vat_rate' => 'decimal:2',
        'vat_amount' => 'decimal:2',
        'paid_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (RentPayment $payment) {
            $payment->transaction_id ??= (string) Str::uuid();
        });
    }

    public function charge()
    {
        return $this->belongsTo(RentCharge::class, 'rent_charge_id');
    }

    public function recordedBy()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
