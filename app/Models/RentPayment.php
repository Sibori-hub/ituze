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
        'notes',
        'paid_at',
    ];

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
