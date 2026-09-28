<?php

namespace App\Console\Commands;

use App\Models\Tenancy;
use App\Services\RentScheduleService;
use Illuminate\Console\Command;

class GenerateRentCharges extends Command
{
    protected $signature = 'rent:generate-charges';

    protected $description = 'Generate missing rent and deposit charges for active and historical tenancies.';

    public function handle(RentScheduleService $rentSchedule): int
    {
        $processed = 0;

        Tenancy::query()
            ->whereIn('status', ['active', 'scheduled', 'ended'])
            ->orderBy('id')
            ->chunkById(100, function ($tenancies) use ($rentSchedule, &$processed) {
                foreach ($tenancies as $tenancy) {
                    $rentSchedule->createCharges($tenancy, !$tenancy->renewed_from_id);
                    $processed++;
                }
            });

        $this->info("Checked {$processed} active, scheduled, or ended tenancy record(s).");

        return self::SUCCESS;
    }
}
