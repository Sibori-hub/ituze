<?php

namespace App\Http\Controllers;

use App\Models\Property;
use App\Models\User;
use App\Models\UtilityReading;
use App\Models\WasteCollection;
use App\Models\WasteSchedule;
use App\Notifications\UtilityHighUsage;
use App\Services\ActivityLogger;
use App\Services\UtilityReport;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Environmental and utility management: water and electricity readings and
 * bills, waste collection, trends, alerts and the green property score.
 * For admins, owners and managers of whole buildings.
 */
class UtilityController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $properties = UtilityReport::propertiesFor($user);
        $filters = $request->validate([
            'property_id' => ['nullable', 'integer', Rule::in($properties->pluck('id')->all())],
            'month' => ['nullable', 'date_format:Y-m'],
        ]);
        $propertyId = isset($filters['property_id']) ? (int) $filters['property_id'] : null;
        $month = CarbonImmutable::createFromFormat('Y-m-d', ($filters['month'] ?? now()->format('Y-m')).'-01')->startOfDay();

        $report = new UtilityReport($user, $propertyId);
        $ids = $report->propertyIds() ?: [0];
        $trends = $report->trends($month);
        $scores = $report->scores($month);

        // Last reading of each building and meter: the next one must not be lower.
        $latest = UtilityReading::query()
            ->whereIn('property_id', $ids)
            ->orderByDesc('period')
            ->get(['property_id', 'type', 'period', 'reading'])
            ->unique(fn ($reading) => $reading->property_id.'-'.$reading->type)
            ->map(fn ($reading) => ['property_id' => $reading->property_id, 'type' => $reading->type, 'month' => $reading->period->format('Y-m'), 'reading' => (float) $reading->reading])
            ->values();

        $schedules = WasteSchedule::query()->with('property:id,name')->whereIn('property_id', $ids)->where('active', true)->get();
        $recorded = WasteCollection::query()->whereIn('property_id', $ids)
            ->whereBetween('scheduled_on', [now()->subDays(45)->toDateString(), now()->addDays(31)->toDateString()])
            ->get()->keyBy(fn ($collection) => $collection->property_id.'@'.$collection->scheduled_on->toDateString());
        $planned = $schedules->flatMap(fn (WasteSchedule $schedule) => collect($schedule->datesBetween(CarbonImmutable::today()->subDays(30), CarbonImmutable::today()->addDays(30)))
            ->map(function (CarbonImmutable $date) use ($schedule, $recorded) {
                $done = $recorded->get($schedule->property_id.'@'.$date->toDateString());

                return [
                    'property' => ['id' => $schedule->property_id, 'name' => $schedule->property?->name],
                    'schedule_id' => $schedule->id,
                    'date' => $date->toDateString(),
                    'collector' => $schedule->collector,
                    'cost' => (float) $schedule->cost_per_collection,
                    'status' => $done?->status,
                    'collection_id' => $done?->id,
                    'is_past' => $date->lte(CarbonImmutable::today()),
                ];
            }))->sortBy('date')->values();

        return Inertia::render('Utilities/Index', [
            'properties' => $properties->map(fn (Property $property) => ['id' => $property->id, 'name' => $property->name])->values(),
            'filters' => ['property_id' => $propertyId, 'month' => $month->format('Y-m')],
            'canEdit' => ! $user->isReadOnly(),
            'units' => UtilityReading::UNITS,
            'trends' => $trends,
            'comparison' => UtilityReport::compare($trends),
            'alerts' => $report->alerts($month),
            'scores' => $scores,
            'overallScore' => $scores ? (int) round(collect($scores)->avg('score')) : null,
            'latest' => $latest,
            'readings' => UtilityReading::query()->with(['property:id,name', 'recorder:id,name'])->whereIn('property_id', $ids)
                ->orderByDesc('period')->orderBy('type')->limit(40)->get()
                ->map(fn (UtilityReading $reading) => [
                    'id' => $reading->id,
                    'property' => $reading->property?->name,
                    'type' => $reading->type,
                    'month' => $reading->period->format('Y-m'),
                    'reading' => (float) $reading->reading,
                    'consumption' => (float) $reading->consumption,
                    'cost' => $reading->cost !== null ? (float) $reading->cost : null,
                    'bill_reference' => $reading->bill_reference,
                    'meter_replaced' => $reading->meter_replaced,
                    'notes' => $reading->notes,
                    'recorded_by' => $reading->recorder?->name,
                ]),
            'schedules' => $schedules->map(fn (WasteSchedule $schedule) => [
                'id' => $schedule->id,
                'property' => ['id' => $schedule->property_id, 'name' => $schedule->property?->name],
                'collector' => $schedule->collector,
                'frequency' => $schedule->frequency,
                'day' => $schedule->day,
                'cost' => (float) $schedule->cost_per_collection,
                'starts_on' => $schedule->starts_on->toDateString(),
            ])->values(),
            'planned' => $planned,
        ]);
    }

    public function storeReading(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'property_id' => ['required', 'integer'],
            'type' => ['required', Rule::in(UtilityReading::TYPES)],
            'month' => ['required', 'date_format:Y-m', 'before_or_equal:'.now()->format('Y-m')],
            'reading' => ['required', 'numeric', 'min:0', 'max:999999999'],
            'meter_replaced' => ['sometimes', 'boolean'],
            'consumption' => ['nullable', 'numeric', 'min:0', 'max:999999999'],
            'cost' => ['nullable', 'numeric', 'min:0', 'max:999999999'],
            'bill_reference' => ['nullable', 'string', 'max:80'],
            'notes' => ['nullable', 'string', 'max:500'],
        ], [
            'month.before_or_equal' => 'You cannot record a reading for a future month.',
        ]);
        $property = $this->writableProperty($request, (int) $data['property_id']);
        $period = $data['month'].'-01';
        $replaced = (bool) ($data['meter_replaced'] ?? false);

        $reading = DB::transaction(function () use ($data, $property, $period, $replaced, $request) {
            $previous = UtilityReading::query()->where('property_id', $property->id)->where('type', $data['type'])
                ->where('period', '<', $period)->orderByDesc('period')->lockForUpdate()->first();

            if ($replaced || ! $previous) {
                // New meter, or the first reading: the usage cannot be worked out from the meter.
                if ($replaced && ($data['consumption'] ?? null) === null) {
                    throw ValidationException::withMessages(['consumption' => 'Enter how much was used this month, because the meter was replaced.']);
                }
                $consumption = (float) ($data['consumption'] ?? 0);
            } else {
                if ((float) $data['reading'] < (float) $previous->reading) {
                    throw ValidationException::withMessages([
                        'reading' => 'The reading cannot be lower than last time ('.rtrim(rtrim(number_format((float) $previous->reading, 2, '.', ''), '0'), '.').'). Tick "Meter replaced" if it is a new meter.',
                    ]);
                }
                $consumption = (float) $data['reading'] - (float) $previous->reading;
            }

            // Filling in an earlier month: it cannot be above the month after it.
            $next = UtilityReading::query()->where('property_id', $property->id)->where('type', $data['type'])
                ->where('period', '>', $period)->orderBy('period')->first();
            if ($next && ! $next->meter_replaced && (float) $data['reading'] > (float) $next->reading) {
                throw ValidationException::withMessages([
                    'reading' => 'The reading cannot be higher than the one of '.$next->period->format('F Y').' ('.rtrim(rtrim(number_format((float) $next->reading, 2, '.', ''), '0'), '.').').',
                ]);
            }

            $reading = UtilityReading::updateOrCreate(
                ['property_id' => $property->id, 'type' => $data['type'], 'period' => $period],
                [
                    'reading' => $data['reading'],
                    'consumption' => round($consumption, 2),
                    'cost' => $data['cost'] ?? null,
                    'bill_reference' => $data['bill_reference'] ?? null,
                    'meter_replaced' => $replaced,
                    'notes' => $data['notes'] ?? null,
                    'recorded_by' => $request->user()->id,
                ],
            );

            // A later month already recorded is now measured from this reading.
            if ($next && ! $next->meter_replaced) {
                $next->update(['consumption' => max(0, round((float) $next->reading - (float) $reading->reading, 2))]);
            }

            return $reading;
        });

        $unit = UtilityReading::UNITS[$reading->type];
        ActivityLogger::record(
            'utility.reading',
            'Recorded the '.$reading->type.' reading of '.$property->name.' for '.$reading->period->format('F Y').': '.rtrim(rtrim(number_format((float) $reading->consumption, 2, '.', ','), '0'), '.').' '.$unit.' used',
            $property->id,
            $reading,
            $reading->cost !== null ? (float) $reading->cost : null,
        );

        $above = UtilityReport::alertFor($reading);
        if ($above !== null) {
            try {
                $property->owner?->notify(new UtilityHighUsage($reading, $above));
            } catch (Throwable $e) {
                Log::warning('High usage notice not sent: '.$e->getMessage());
            }

            return back()->with('warning', 'Saved. Alert: '.$reading->type.' use in '.$property->name.' is '.$above.'% above the average of the last months.');
        }

        return back()->with('success', ucfirst($reading->type).' reading saved for '.$property->name.'.');
    }

    public function destroyReading(Request $request, UtilityReading $reading): RedirectResponse
    {
        $this->writableProperty($request, $reading->property_id);
        $reading->delete();

        return back()->with('success', 'Reading deleted.');
    }

    public function storeSchedule(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'property_id' => ['required', 'integer'],
            'collector' => ['required', 'string', 'max:120'],
            'frequency' => ['required', Rule::in(WasteSchedule::FREQUENCIES)],
            'day' => ['required', 'integer', 'min:1', $request->input('frequency') === 'monthly' ? 'max:31' : 'max:7'],
            'cost_per_collection' => ['required', 'numeric', 'min:0', 'max:99999999'],
            'starts_on' => ['required', 'date'],
        ]);
        $property = $this->writableProperty($request, (int) $data['property_id']);

        DB::transaction(function () use ($property, $data) {
            // One active schedule per building: a new one replaces the old.
            WasteSchedule::query()->where('property_id', $property->id)->update(['active' => false]);
            WasteSchedule::create([...$data, 'property_id' => $property->id, 'active' => true]);
        });
        ActivityLogger::record('waste.schedule', 'Set the waste collection of '.$property->name.': '.$data['collector'].', '.$data['frequency'], $property->id);

        return back()->with('success', 'Waste collection schedule saved for '.$property->name.'.');
    }

    public function destroySchedule(Request $request, WasteSchedule $schedule): RedirectResponse
    {
        $this->writableProperty($request, $schedule->property_id);
        $schedule->update(['active' => false]);

        return back()->with('success', 'Waste collection schedule stopped.');
    }

    /** Marks a planned collection as collected (with its cost) or missed. */
    public function storeCollection(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'property_id' => ['required', 'integer'],
            'waste_schedule_id' => ['nullable', 'integer'],
            'scheduled_on' => ['required', 'date', 'before_or_equal:today'],
            'status' => ['required', Rule::in(['collected', 'missed'])],
            'cost' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'notes' => ['nullable', 'string', 'max:500'],
        ], [
            'scheduled_on.before_or_equal' => 'A collection can only be marked on or after its day.',
        ]);
        $property = $this->writableProperty($request, (int) $data['property_id']);

        WasteCollection::updateOrCreate(
            ['property_id' => $property->id, 'scheduled_on' => $data['scheduled_on']],
            [
                'waste_schedule_id' => $data['waste_schedule_id'] ?? null,
                'status' => $data['status'],
                'cost' => $data['status'] === 'collected' ? (float) ($data['cost'] ?? 0) : 0,
                'notes' => $data['notes'] ?? null,
                'recorded_by' => $request->user()->id,
            ],
        );
        ActivityLogger::record(
            'waste.collection',
            'Waste of '.$property->name.' on '.CarbonImmutable::parse($data['scheduled_on'])->format('j M Y').': '.$data['status'],
            $property->id,
            null,
            $data['status'] === 'collected' ? (float) ($data['cost'] ?? 0) : null,
        );

        return back()->with('success', $data['status'] === 'collected' ? 'Collection recorded.' : 'Missed collection recorded.');
    }

    public function destroyCollection(Request $request, WasteCollection $collection): RedirectResponse
    {
        $this->writableProperty($request, $collection->property_id);
        $collection->delete();

        return back()->with('success', 'Collection record removed.');
    }

    private function writableProperty(Request $request, int $propertyId): Property
    {
        $user = $request->user();
        $property = Property::query()->findOrFail($propertyId);
        abort_unless(UtilityReport::propertiesFor($user)->contains('id', $property->id), 404);
        abort_if($user->isReadOnly(), 403, 'ITUZE GREEN PLATFORM manages this building for you.');

        return $property;
    }
}
