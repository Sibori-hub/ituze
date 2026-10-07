<?php

namespace App\Console\Commands;

use App\Models\Tenancy;
use App\Models\Unit;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CompleteApartmentStays extends Command
{
    protected $signature = 'tenancies:complete-apartment-stays';

    protected $description = 'Complete daily apartment stays after their scheduled check-out time.';

    public function handle(): int
    {
        $now = CarbonImmutable::now();
        $ids = Tenancy::query()
            ->where('status', 'active')
            ->where('rent_frequency', 'daily')
            ->whereNotNull('end_date')
            ->where(function ($query) use ($now) {
                $query->whereDate('end_date', '<', $now->toDateString())
                    ->orWhere(function ($today) use ($now) {
                        $today->whereDate('end_date', $now->toDateString())
                            ->where(function ($time) use ($now) {
                                $time->whereNull('check_out_time')
                                    ->orWhere('check_out_time', '<=', $now->format('H:i:s'));
                            });
                    });
            })
            ->orderBy('end_date')
            ->pluck('id');

        foreach ($ids as $id) {
            DB::transaction(function () use ($id) {
                $tenancy = Tenancy::query()->whereKey($id)->lockForUpdate()->first();
                if (! $tenancy || $tenancy->status !== 'active' || ! $tenancy->end_date) {
                    return;
                }

                $unit = Unit::query()->whereKey($tenancy->unit_id)->lockForUpdate()->firstOrFail();
                $now = CarbonImmutable::now();
                $checkoutPassed = $tenancy->end_date->lessThan($now->startOfDay())
                    || ($tenancy->end_date->isToday()
                        && (! $tenancy->check_out_time || $tenancy->check_out_time <= $now->format('H:i:s')));
                if (! $checkoutPassed) {
                    return;
                }

                $tenancy->update([
                    'status' => 'ended',
                    'actual_end_date' => $tenancy->end_date->toDateString(),
                ]);

                if (in_array($unit->status, ['available', 'reserved', 'occupied'], true)) {
                    $unit->update([
                        'status' => $unit->tenancies()->where('status', 'active')->exists()
                            ? 'occupied'
                            : ($unit->tenancies()->where('status', 'scheduled')->exists() ? 'reserved' : 'available'),
                    ]);
                }
            });
        }

        $this->info("Completed {$ids->count()} daily apartment stay(s) after check-out.");

        return self::SUCCESS;
    }
}
