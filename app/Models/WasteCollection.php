<?php

namespace App\Models;

use App\Casts\PlainDate;
use Illuminate\Database\Eloquent\Model;

/**
 * A planned waste collection that was done (collected) or not (missed).
 */
class WasteCollection extends Model
{
    protected $fillable = ['property_id', 'waste_schedule_id', 'scheduled_on', 'status', 'cost', 'notes', 'recorded_by'];

    protected $casts = [
        'scheduled_on' => PlainDate::class,
        'cost' => 'decimal:2',
    ];

    public function property()
    {
        return $this->belongsTo(Property::class);
    }

    public function schedule()
    {
        return $this->belongsTo(WasteSchedule::class, 'waste_schedule_id');
    }
}
