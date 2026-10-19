<?php

namespace App\Console\Commands;

use App\Models\MobileMoneyRequest;
use App\Models\User;
use App\Notifications\SubscriptionReminder;
use App\Services\MobileMoney\MobileMoneyService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Reminds self-registered owners by email and SMS 7 and 3 days before their
 * subscription ends, on the day it ends (grace starts), and when the grace
 * is over and the account is paused. Each reminder goes once per paid-until
 * date; a missed day is caught up the next run.
 */
class SendSubscriptionReminders extends Command
{
    protected $signature = 'subscriptions:send-reminders';

    protected $description = 'Remind owners about their monthly subscription by email and SMS.';

    public function handle(MobileMoneyService $mobileMoney): int
    {
        // Apply any mobile money payment approved on the phone while nobody had the page open.
        MobileMoneyRequest::query()
            ->where('purpose', 'subscription')
            ->where('status', MobileMoneyRequest::PENDING)
            ->get()
            ->each(fn (MobileMoneyRequest $request) => rescue(fn () => $mobileMoney->refresh($request), report: false));

        $today = CarbonImmutable::today();
        $grace = (int) config('legal.owner_subscription_grace_days', 7);
        $sent = 0;

        $owners = User::query()
            ->where('role', 'owner')
            ->whereNull('created_by')
            ->where('status', 'approved')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', $today->addDays(8)->endOfDay())
            ->where('expires_at', '>=', $today->subDays($grace + 7))
            ->get();

        foreach ($owners as $owner) {
            $end = CarbonImmutable::parse($owner->expires_at)->startOfDay();
            $daysLeft = (int) $today->diffInDays($end, false);

            $kind = match (true) {
                $daysLeft < -$grace => 'blocked',
                $daysLeft <= 0 => 'due',
                $daysLeft <= 3 => 'days_3',
                $daysLeft <= 7 => 'days_7',
                default => null,
            };
            if ($kind === null) {
                continue;
            }

            // Once per kind and paid-until date: a renewal starts a new cycle.
            $fresh = DB::table('subscription_reminders')->insertOrIgnore([
                'owner_id' => $owner->id,
                'kind' => $kind,
                'expires_on' => $end->toDateString(),
                'created_at' => now(),
            ]);
            if (! $fresh) {
                continue;
            }

            try {
                $owner->notify(new SubscriptionReminder($kind));
                $sent++;
            } catch (Throwable $e) {
                Log::warning('Subscription reminder not sent: '.$e->getMessage(), ['owner' => $owner->id, 'kind' => $kind]);
            }
        }

        $this->info("Subscription reminders sent: {$sent}");

        return self::SUCCESS;
    }
}
