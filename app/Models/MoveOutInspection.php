<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MoveOutInspection extends Model
{
    protected $fillable = [
        'tenancy_id',
        'inspected_by',
        'move_out_date',
        'condition_notes',
        'deposit_received',
        'deposit_refunded',
        'deposit_deducted',
        'deduction_notes',
        'unit_outcome',
    ];

    protected $casts = [
        'move_out_date' => 'date',
        'deposit_received' => 'decimal:2',
        'deposit_refunded' => 'decimal:2',
        'deposit_deducted' => 'decimal:2',
    ];

    public function tenancy()
    {
        return $this->belongsTo(Tenancy::class);
    }

    public function inspectedBy()
    {
        return $this->belongsTo(User::class, 'inspected_by');
    }
}
