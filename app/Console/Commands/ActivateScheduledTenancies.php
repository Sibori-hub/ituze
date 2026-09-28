<?php

namespace App\Console\Commands;

use App\Models\Tenancy;
use App\Models\Unit;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ActivateScheduledTenancies extends Command
{
    protected $signature = 'tenancies:activate-scheduled';

    protected $description = 'Activate signed tenancies whose start date has arrived.';

    public function handle(): int
    {
        $ids = Tenancy::query()
            ->where('status', 'scheduled')
            ->whereDate('start_date', '<=', today())
            ->orderBy('start_date')
            ->pluck('id');

        $failures = 0;
        foreach ($ids as $id) {
            $activated = DB::transaction(function () use ($id) {
                $scheduled = Tenancy::query()->find($id);
                if (!$scheduled) {
                    return true;
                }

                $unit = Unit::query()->whereKey($scheduled->unit_id)->lockForUpdate()->firstOrFail();
                $previous = $scheduled->renewed_from_id
                    ? Tenancy::query()->whereKey($scheduled->renewed_from_id)->lockForUpdate()->firstOrFail()
                    : null;
                $tenancy = Tenancy::query()->whereKey($id)->lockForUpdate()->first();
                if (!$tenancy || $tenancy->status !== 'scheduled' || $tenancy->start_date->isFuture()) {
                    return true;
                }

                if ($tenancy->renewed_from_id) {
                    $previous ??= Tenancy::query()->whereKey($tenancy->renewed_from_id)->lockForUpdate()->firstOrFail();
                    if ($previous->status !== 'active') {
                        $this->error("Scheduled renewal {$tenancy->id} cannot activate because its previous tenancy is not active.");

                        return false;
                    }

                    $previous->update([
                        'status' => 'ended',
                        'actual_end_date' => $tenancy->start_date->copy()->subDay()->toDateString(),
                    ]);
                }

                $tenancy->update(['status' => 'active']);
                $unit->update(['status' => 'occupied']);

                return true;
            });
            $failures += $activated ? 0 : 1;
        }

        $this->info("Processed {$ids->count()} scheduled tenancy record(s).");

        return $failures ? self::FAILURE : self::SUCCESS;
    }
}
