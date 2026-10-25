<?php

namespace App\Models;

use App\Casts\PlainDate;
use Illuminate\Database\Eloquent\Model;

/**
 * A planned waste collection that was done (collected) or not (missed).
 */
class WasteCollection extends Model
{
    protected $fillable = [
        'property_id', 'waste_schedule_id', 'scheduled_on', 'status', 'cost', 'notes', 'recorded_by',
        'biodegradable_bins', 'biodegradable_bin_kg', 'non_biodegradable_bins', 'non_biodegradable_bin_kg',
    ];

    protected $casts = [
        'scheduled_on' => PlainDate::class,
        'cost' => 'decimal:2',
        'biodegradable_bins' => 'integer',
        'biodegradable_bin_kg' => 'float',
        'non_biodegradable_bins' => 'integer',
        'non_biodegradable_bin_kg' => 'float',
    ];

    /** Biodegradable (ibibora) waste taken, in kg. */
    public function biodegradableKg(): float
    {
        return $this->biodegradable_bins * (float) $this->biodegradable_bin_kg;
    }

    /** Non-biodegradable (ibitabora) waste taken, in kg. */
    public function nonBiodegradableKg(): float
    {
        return $this->non_biodegradable_bins * (float) $this->non_biodegradable_bin_kg;
    }

    /** The bins, as shown on the page. */
    public function bins(): array
    {
        return [
            'biodegradable_bins' => $this->biodegradable_bins,
            'biodegradable_bin_kg' => $this->biodegradable_bin_kg,
            'non_biodegradable_bins' => $this->non_biodegradable_bins,
            'non_biodegradable_bin_kg' => $this->non_biodegradable_bin_kg,
            'biodegradable_kg' => $this->biodegradableKg(),
            'non_biodegradable_kg' => $this->nonBiodegradableKg(),
            'total_kg' => $this->biodegradableKg() + $this->nonBiodegradableKg(),
        ];
    }

    public function property()
    {
        return $this->belongsTo(Property::class);
    }

    public function schedule()
    {
        return $this->belongsTo(WasteSchedule::class, 'waste_schedule_id');
    }
}
