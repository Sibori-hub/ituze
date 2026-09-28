<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Tenancy extends Model
{
    use HasFactory;

    protected $fillable = [
        'unit_id',
        'renewed_from_id',
        'tenant_id',
        'assigned_by',
        'start_date',
        'end_date',
        'actual_end_date',
        'monthly_rent',
        'rent_frequency',
        'due_day',
        'deposit_amount',
        'notes',
        'status',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'actual_end_date' => 'date',
        'monthly_rent' => 'decimal:2',
        'due_day' => 'integer',
        'deposit_amount' => 'decimal:2',
    ];

    public function unit()
    {
        return $this->belongsTo(Unit::class);
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function assignedBy()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function leases()
    {
        return $this->hasMany(Lease::class);
    }

    public function rentCharges()
    {
        return $this->hasMany(RentCharge::class);
    }

    public function renewedFrom()
    {
        return $this->belongsTo(self::class, 'renewed_from_id');
    }

    public function renewals()
    {
        return $this->hasMany(self::class, 'renewed_from_id');
    }

    public function moveOutInspection()
    {
        return $this->hasOne(MoveOutInspection::class);
    }

    public function renewalChain()
    {
        $root = $this;
        while ($root->renewedFrom()->exists()) {
            $root = $root->renewedFrom()->firstOrFail();
        }

        $chain = collect([$root]);
        for ($index = 0; $index < $chain->count(); $index++) {
            $chain = $chain->merge($chain[$index]->renewals()->get());
        }

        return $chain->unique('id')->values();
    }
}
