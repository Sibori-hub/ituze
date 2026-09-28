<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RentCharge extends Model
{
    protected $fillable = [
        'tenancy_id',
        'charge_type',
        'period_start',
        'period_end',
        'due_date',
        'amount',
        'voided_at',
        'voided_reason',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'due_date' => 'date',
        'amount' => 'decimal:2',
        'voided_at' => 'datetime',
    ];

    public function tenancy()
    {
        return $this->belongsTo(Tenancy::class);
    }

    public function payments()
    {
        return $this->hasMany(RentPayment::class);
    }
}
