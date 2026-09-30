<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RentPayment extends Model
{
    protected $fillable = [
        'rent_charge_id',
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

    public function charge()
    {
        return $this->belongsTo(RentCharge::class, 'rent_charge_id');
    }

    public function recordedBy()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
