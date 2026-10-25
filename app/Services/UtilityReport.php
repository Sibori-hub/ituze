<?php

namespace App\Services;

use App\Models\Property;
use App\Models\User;
use App\Models\UtilityReading;
use App\Models\WasteCollection;
use App\Models\WasteSchedule;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Figures for the environmental and utility page: monthly usage and costs,
 * month-on-month comparison, high-consumption alerts and a basic green
 * property score.
 */
class UtilityReport
{
    /** A month is "high" when it is this much above the average of the 3 months before. */
    public const ALERT_RATIO = 1.3;

    /** @var list<int> */
    private array $propertyIds;

    public function __construct(private User $user, ?int $propertyId = null)
    {
        $ids = self::propertiesFor($user)->pluck('id')->all();
        $this->propertyIds = $propertyId ? array_values(array_intersect($ids, [$propertyId])) : $ids;
    }

    /** Buildings whose utilities this account follows (whole buildings only for managers). */
    public static function propertiesFor(User $user): Collection
    {
        return Property::query()
            ->inWorkspaceOf($user)
            ->orderBy('name')
            ->get(['id', 'name', 'owner_id'])
            ->filter(fn (Property $property) => ! $user->isManager() || $user->canManageWholeProperty($property))
            ->values();
    }

    /** Small summary for the dashboard card, or null when there are no buildings. */
    public static function snapshot(User $user): ?array
    {
        $report = new self($user);
        if (! $report->propertyIds()) {
            return null;
        }
        $month = CarbonImmutable::today()->startOfMonth();
        $comparison = self::compare($report->trends($month, 2));
        $scores = $report->scores($month);

        return [
            'score' => $scores ? (int) round(collect($scores)->avg('score')) : null,
            'alerts' => count(array_filter($report->alerts($month), fn ($alert) => $alert['month'] >= $month->subMonthNoOverflow()->format('Y-m'))),
            'water' => $comparison['water'],
            'electricity' => $comparison['electricity'],
            'cost' => $comparison['total_cost'],
        ];
    }

    public function propertyIds(): array
    {
        return $this->propertyIds;
    }

    /**
     * Usage and costs per month for the 12 months ending with $end.
     *
     * @return list<array{month: string, water: float, electricity: float, water_cost: float, electricity_cost: float, waste_cost: float, total_cost: float}>
     */
    public function trends(CarbonImmutable $end, int $months = 12): array
    {
        $start = $end->startOfMonth()->subMonthsNoOverflow($months - 1);
        $readings = UtilityReading::query()
            ->whereIn('property_id', $this->propertyIds ?: [0])
            ->whereBetween('period', [$start->toDateString(), $end->endOfMonth()->toDateString()])
            ->get(['type', 'period', 'consumption', 'cost'])
            ->groupBy(fn ($reading) => $reading->period->format('Y-m'));
        $waste = WasteCollection::query()
            ->whereIn('property_id', $this->propertyIds ?: [0])
            ->where('status', 'collected')
            ->whereBetween('scheduled_on', [$start->toDateString(), $end->endOfMonth()->toDateString()])
            ->get(['scheduled_on', 'cost'])
            ->groupBy(fn ($collection) => $collection->scheduled_on->format('Y-m'));

        return collect(range(0, $months - 1))->map(function (int $offset) use ($start, $readings, $waste) {
            $month = $start->addMonthsNoOverflow($offset)->format('Y-m');
            $rows = $readings->get($month, collect());
            $sum = fn (string $type, string $field) => round((float) $rows->where('type', $type)->sum(fn ($row) => (float) $row->{$field}), 2);
            $wasteCost = round((float) $waste->get($month, collect())->sum(fn ($row) => (float) $row->cost), 2);

            return [
                'month' => $month,
                'water' => $sum('water', 'consumption'),
                'electricity' => $sum('electricity', 'consumption'),
                'water_cost' => $sum('water', 'cost'),
                'electricity_cost' => $sum('electricity', 'cost'),
                'waste_cost' => $wasteCost,
                'total_cost' => round($sum('water', 'cost') + $sum('electricity', 'cost') + $wasteCost, 2),
            ];
        })->all();
    }

    /** This month against the month before, from the trend rows. */
    public static function compare(array $trends): array
    {
        $current = end($trends) ?: [];
        $previous = count($trends) > 1 ? $trends[count($trends) - 2] : [];
        $change = function (string $key) use ($current, $previous) {
            $before = (float) ($previous[$key] ?? 0);
            $now = (float) ($current[$key] ?? 0);

            return $before > 0 ? (int) round(($now - $before) / $before * 100) : null;
        };

        $result = [];
        foreach (['water', 'electricity', 'water_cost', 'electricity_cost', 'waste_cost', 'total_cost'] as $key) {
            $result[$key] = ['current' => (float) ($current[$key] ?? 0), 'previous' => (float) ($previous[$key] ?? 0), 'change' => $change($key)];
        }

        return $result;
    }

    /**
     * Months that used much more than the 3 months before them (last 6 months).
     *
     * @return list<array<string, mixed>>
     */
    public function alerts(CarbonImmutable $end): array
    {
        $since = $end->startOfMonth()->subMonthsNoOverflow(8);
        $readings = UtilityReading::query()
            ->with('property:id,name')
            ->whereIn('property_id', $this->propertyIds ?: [0])
            ->whereBetween('period', [$since->toDateString(), $end->endOfMonth()->toDateString()])
            ->orderBy('period')
            ->get();
        $recentFrom = $end->startOfMonth()->subMonthsNoOverflow(5);
        $alerts = [];

        foreach ($readings->groupBy(fn ($reading) => $reading->property_id.'-'.$reading->type) as $series) {
            $series = $series->values();
            foreach ($series as $index => $reading) {
                if ($reading->period->lt($recentFrom) || $index < 2) {
                    continue;
                }
                $before = $series->slice(max(0, $index - 3), min(3, $index))->pluck('consumption')->map(fn ($value) => (float) $value)->filter();
                if ($before->count() < 2) {
                    continue;
                }
                $average = $before->avg();
                $used = (float) $reading->consumption;
                if ($average > 0 && $used >= $average * self::ALERT_RATIO) {
                    $alerts[] = [
                        'property' => ['id' => $reading->property_id, 'name' => $reading->property?->name],
                        'type' => $reading->type,
                        'month' => $reading->period->format('Y-m'),
                        'consumption' => round($used, 2),
                        'average' => round($average, 2),
                        'percent' => (int) round(($used - $average) / $average * 100),
                    ];
                }
            }
        }

        usort($alerts, fn ($a, $b) => strcmp($b['month'], $a['month']) ?: $b['percent'] <=> $a['percent']);

        return $alerts;
    }

    /** Is this new reading much higher than the 3 months before it? Returns the % above, or null. */
    public static function alertFor(UtilityReading $reading): ?int
    {
        $before = UtilityReading::query()
            ->where('property_id', $reading->property_id)
            ->where('type', $reading->type)
            ->where('period', '<', $reading->period->toDateString())
            ->orderByDesc('period')
            ->limit(3)
            ->pluck('consumption')
            ->map(fn ($value) => (float) $value)
            ->filter();
        if ($before->count() < 2) {
            return null;
        }
        $average = $before->avg();

        return $average > 0 && (float) $reading->consumption >= $average * self::ALERT_RATIO
            ? (int) round(((float) $reading->consumption - $average) / $average * 100)
            : null;
    }

    /**
     * Basic green property score (0–100) for each building, with the parts
     * it is made of and tips to improve.
     *
     * @return list<array<string, mixed>>
     */
    public function scores(CarbonImmutable $end): array
    {
        $alertsByProperty = collect($this->alerts($end))
            ->filter(fn ($alert) => $alert['month'] >= $end->startOfMonth()->subMonthsNoOverflow(2)->format('Y-m'))
            ->groupBy(fn ($alert) => $alert['property']['id']);
        $from6 = $end->startOfMonth()->subMonthsNoOverflow(5);
        $from3 = $end->startOfMonth()->subMonthsNoOverflow(2);
        $readings = UtilityReading::query()
            ->whereIn('property_id', $this->propertyIds ?: [0])
            ->whereBetween('period', [$from6->toDateString(), $end->endOfMonth()->toDateString()])
            ->get(['property_id', 'type', 'period', 'consumption'])
            ->groupBy('property_id');
        $collections = WasteCollection::query()
            ->whereIn('property_id', $this->propertyIds ?: [0])
            ->whereBetween('scheduled_on', [$from3->toDateString(), $end->endOfMonth()->toDateString()])
            ->get(['property_id', 'status'])
            ->groupBy('property_id');
        $schedules = WasteSchedule::query()->whereIn('property_id', $this->propertyIds ?: [0])->where('active', true)->pluck('property_id')->unique();
        $names = Property::query()->whereIn('id', $this->propertyIds ?: [0])->pluck('name', 'id');

        return collect($this->propertyIds)->map(function (int $propertyId) use ($readings, $collections, $schedules, $alertsByProperty, $from3, $names) {
            $rows = $readings->get($propertyId, collect());

            // 1. Usage trend (35): last 3 months against the 3 before.
            $trendPoints = collect(['water', 'electricity'])->map(function (string $type) use ($rows, $from3) {
                $recent = $rows->where('type', $type)->filter(fn ($row) => $row->period->gte($from3))->avg(fn ($row) => (float) $row->consumption);
                $earlier = $rows->where('type', $type)->filter(fn ($row) => $row->period->lt($from3))->avg(fn ($row) => (float) $row->consumption);
                if (! $recent || ! $earlier) {
                    return null;
                }
                $change = ($recent - $earlier) / $earlier * 100;

                return match (true) {
                    $change <= -5 => 35,
                    $change <= 5 => 25,
                    $change <= 20 => 15,
                    default => 5,
                };
            })->filter(fn ($points) => $points !== null);
            $trend = $trendPoints->isEmpty() ? 15 : (int) round($trendPoints->avg());

            // 2. Alerts (20): no high-use month lately.
            $alertCount = $alertsByProperty->get($propertyId, collect())->count();
            $alerts = $alertCount === 0 ? 20 : ($alertCount === 1 ? 10 : 0);

            // 3. Readings recorded (20): water and electricity for each of the last 3 months.
            $recorded = $rows->filter(fn ($row) => $row->period->gte($from3))->count();
            $records = (int) round(20 * min(6, $recorded) / 6);

            // 4. Waste (25): a schedule, and collections done rather than missed.
            $done = $collections->get($propertyId, collect());
            $collected = $done->where('status', 'collected')->count();
            $missed = $done->where('status', 'missed')->count();
            $waste = ! $schedules->contains($propertyId) ? 0 : 10 + (int) round(15 * ($collected + $missed ? $collected / ($collected + $missed) : 0.5));

            $score = min(100, $trend + $alerts + $records + $waste);
            $tips = [];
            if ($records < 20) {
                $tips[] = 'Record water and electricity readings every month.';
            }
            if ($waste === 0) {
                $tips[] = 'Set up a regular waste collection schedule.';
            } elseif ($missed > 0) {
                $tips[] = 'Follow up missed waste collections with the collector.';
            }
            if ($alerts < 20) {
                $tips[] = 'Check for leaks or equipment left on: usage jumped recently.';
            }
            if ($trend <= 15 && $trendPoints->isNotEmpty()) {
                $tips[] = 'Usage is rising: consider LED lighting, water-saving taps and switching off unused equipment.';
            }

            return [
                'property' => ['id' => $propertyId, 'name' => $names->get($propertyId)],
                'score' => $score,
                'grade' => $score >= 80 ? 'A' : ($score >= 60 ? 'B' : ($score >= 40 ? 'C' : 'D')),
                'parts' => ['trend' => $trend, 'alerts' => $alerts, 'records' => $records, 'waste' => $waste],
                'tips' => $tips,
            ];
        })->sortByDesc('score')->values()->all();
    }
}
