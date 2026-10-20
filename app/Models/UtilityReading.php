<?php

namespace App\Models;

use App\Casts\PlainDate;
use Illuminate\Database\Eloquent\Model;

/**
 * One month's water (m³) or electricity (kWh) meter reading for a building.
 */
class UtilityReading extends Model
{
    public const TYPES = ['water', 'electricity'];

    public const UNITS = ['water' => 'm³', 'electricity' => 'kWh'];

    protected $fillable = [
        'property_id', 'type', 'period', 'reading', 'consumption', 'cost', 'bill_reference',
        'meter_replaced', 'notes', 'recorded_by',
    ];

    protected $casts = [
        'period' => PlainDate::class,
        'reading' => 'decimal:2',
        'consumption' => 'decimal:2',
        'cost' => 'decimal:2',
        'meter_replaced' => 'boolean',
    ];

    public function property()
    {
        return $this->belongsTo(Property::class);
    }

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
