<?php

namespace App\Services;

use App\Models\RentCharge;
use App\Models\Tenancy;
use Carbon\CarbonImmutable;

class RentScheduleService
{
    public function createCharges(Tenancy $tenancy, bool $includeDeposit = true): void
    {
        $start = CarbonImmutable::parse($tenancy->start_date)->startOfDay();
        $effectiveEndDate = $tenancy->actual_end_date ?: $tenancy->end_date;
        $end = $effectiveEndDate
            ? CarbonImmutable::parse($effectiveEndDate)->startOfDay()
            : ($tenancy->status === 'ended'
                ? CarbonImmutable::today()
                : CarbonImmutable::today()->addMonthNoOverflow());
        $amount = (float) $tenancy->monthly_rent;

        if ($includeDeposit && (float) $tenancy->deposit_amount > 0) {
            RentCharge::query()->firstOrCreate(
                [
                    'tenancy_id' => $tenancy->id,
                    'charge_type' => 'deposit',
                    'period_start' => $start->format('Y-m-d H:i:s'),
                ],
                [
                    'period_end' => null,
                    'due_date' => $start->toDateString(),
                    'amount' => $tenancy->deposit_amount,
                ],
            );
        }

        if ($tenancy->rent_frequency === 'monthly') {
            $this->createMonthlyCharges($tenancy, $start, $end, (float) $amount);

            return;
        }

        $periodStart = $start;
        while ($periodStart->lessThanOrEqualTo($end)) {
            $nextPeriodStart = $this->nextPeriodStart($periodStart, $tenancy->rent_frequency);
            $periodEnd = $nextPeriodStart->subDay();
            if ($periodEnd->greaterThan($end)) {
                $periodEnd = $end;
            }

            RentCharge::query()->firstOrCreate(
                [
                    'tenancy_id' => $tenancy->id,
                    'charge_type' => 'rent',
                    'period_start' => $periodStart->format('Y-m-d H:i:s'),
                ],
                [
                    'period_end' => $periodEnd->toDateString(),
                    'due_date' => $periodStart->toDateString(),
                    'amount' => $amount,
                ],
            );
            $periodStart = $nextPeriodStart;
        }
    }

    private function createMonthlyCharges(Tenancy $tenancy, CarbonImmutable $start, CarbonImmutable $end, float $amount): void
    {
        $dueDay = $tenancy->due_day ?: $start->day;
        $periodStart = $start;
        $first = true;

        while ($periodStart->lessThanOrEqualTo($end)) {
            $nextPeriodStart = $this->nextMonthlyDueDate($periodStart, $dueDay);
            $periodEnd = $nextPeriodStart->subDay();
            if ($periodEnd->greaterThan($end)) {
                $periodEnd = $end;
            }

            RentCharge::query()->firstOrCreate(
                [
                    'tenancy_id' => $tenancy->id,
                    'charge_type' => 'rent',
                    'period_start' => $periodStart->format('Y-m-d H:i:s'),
                ],
                [
                    'period_end' => $periodEnd->toDateString(),
                    'due_date' => $first ? $start->toDateString() : $periodStart->toDateString(),
                    'amount' => $amount,
                ],
            );

            $periodStart = $nextPeriodStart;
            $first = false;
        }
    }

    private function nextMonthlyDueDate(CarbonImmutable $date, int $dueDay): CarbonImmutable
    {
        $month = $date->startOfMonth();
        $day = min($dueDay, $month->daysInMonth);
        $candidate = $month->setDay($day);

        if ($candidate->lessThanOrEqualTo($date)) {
            $month = $month->addMonthNoOverflow();
            $candidate = $month->setDay(min($dueDay, $month->daysInMonth));
        }

        return $candidate;
    }

    private function nextPeriodStart(CarbonImmutable $date, string $frequency): CarbonImmutable
    {
        return match ($frequency) {
            'daily' => $date->addDay(),
            'weekly' => $date->addWeek(),
            'quarterly' => $date->addMonthsNoOverflow(3),
            'yearly' => $date->addYearNoOverflow(),
            default => $date->addMonthNoOverflow(),
        };
    }
}
