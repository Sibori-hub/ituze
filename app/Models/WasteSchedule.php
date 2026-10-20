<?php

namespace App\Models;

use App\Casts\PlainDate;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * How often a building's waste is collected, by whom and at what cost.
 */
class WasteSchedule extends Model
{
    public const FREQUENCIES = ['weekly', 'biweekly', 'monthly'];

    protected $fillable = ['property_id', 'collector', 'frequency', 'day', 'cost_per_collection', 'starts_on', 'active'];

    protected $casts = [
        'day' => 'integer',
        'cost_per_collection' => 'decimal:2',
        'starts_on' => PlainDate::class,
        'active' => 'boolean',
    ];

    public function property()
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * Planned collection dates between two days (inclusive).
     *
     * @return list<CarbonImmutable>
     */
    public function datesBetween(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $start = CarbonImmutable::parse($this->starts_on)->startOfDay();
        $from = $from->max($start);
        $dates = [];

        if ($this->frequency === 'monthly') {
            $month = $from->startOfMonth();
            while ($month->lte($to)) {
                $day = $month->addDays(min($this->day, $month->daysInMonth) - 1);
                if ($day->gte($from) && $day->lte($to)) {
                    $dates[] = $day;
                }
                $month = $month->addMonthNoOverflow();
            }

            return $dates;
        }

        // Weekly or every two weeks, on a weekday (1 = Monday … 7 = Sunday), counted from the start date.
        $first = $start->isoWeekday() === $this->day ? $start : $start->next($this->isoDayName());
        $step = $this->frequency === 'biweekly' ? 14 : 7;
        for ($day = $first; $day->lte($to); $day = $day->addDays($step)) {
            if ($day->gte($from)) {
                $dates[] = $day;
            }
        }

        return $dates;
    }

    private function isoDayName(): string
    {
        return ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][$this->day] ?? 'Monday';
    }
}
