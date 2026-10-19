<?php

namespace App\Services;

use App\Models\MobileMoneyRequest;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Notifications\SubscriptionPaymentDecided;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Turns an approved payment into more paid months for the owner.
 */
class SubscriptionService
{
    public static function monthlyPrice(): int
    {
        return (int) config('legal.owner_subscription_monthly_rwf', 100000);
    }

    /** @return list<int> */
    public static function monthOptions(): array
    {
        return array_map('intval', config('legal.owner_subscription_month_options', [1, 3, 6, 12]));
    }

    public static function priceFor(int $months): int
    {
        return $months * self::monthlyPrice();
    }

    /**
     * Extends the paid-until date. Paying early adds to the current period;
     * paying after it ended starts from today.
     */
    public function approve(SubscriptionPayment $payment, ?User $reviewer = null): SubscriptionPayment
    {
        $approved = DB::transaction(function () use ($payment, $reviewer) {
            $locked = SubscriptionPayment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== SubscriptionPayment::PENDING) {
                return null;
            }

            $owner = User::query()->whereKey($locked->owner_id)->lockForUpdate()->firstOrFail();
            $start = $owner->expires_at && $owner->expires_at->isFuture()
                ? $owner->expires_at->copy()
                : Carbon::now();
            $end = $start->copy()->addMonthsNoOverflow($locked->months);

            $owner->forceFill(['expires_at' => $end])->save();
            $locked->update([
                'status' => SubscriptionPayment::APPROVED,
                'period_start' => $start->toDateString(),
                'period_end' => $end->toDateString(),
                'receipt_number' => sprintf('ITZ-SUB-%s-%06d', now()->format('Y'), $locked->id),
                'reviewed_by' => $reviewer?->id,
                'reviewed_at' => now(),
                'rejection_reason' => null,
            ]);

            return $locked;
        });

        if ($approved) {
            $this->tell($approved);
        }

        return $approved ?? $payment->fresh();
    }

    public function reject(SubscriptionPayment $payment, User $reviewer, string $reason): SubscriptionPayment
    {
        $rejected = DB::transaction(function () use ($payment, $reviewer, $reason) {
            $locked = SubscriptionPayment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== SubscriptionPayment::PENDING) {
                return null;
            }
            $locked->update([
                'status' => SubscriptionPayment::REJECTED,
                'reviewed_by' => $reviewer->id,
                'reviewed_at' => now(),
                'rejection_reason' => $reason,
            ]);

            return $locked;
        });

        if ($rejected) {
            $this->tell($rejected);
        }

        return $rejected ?? $payment->fresh();
    }

    /**
     * Follows a mobile money request that pays a subscription: approved on
     * the phone means paid; declined or timed out means failed.
     */
    public function syncMobileMoney(MobileMoneyRequest $request): void
    {
        $payment = SubscriptionPayment::query()
            ->where('mobile_money_request_id', $request->id)
            ->where('status', SubscriptionPayment::PENDING)
            ->first();
        if (! $payment) {
            return;
        }

        if ($request->status === MobileMoneyRequest::SUCCESSFUL) {
            $payment->update(['reference' => $request->provider_transaction_id]);
            $request->forceFill(['used_at' => now()])->save();
            $this->approve($payment);
        } elseif (in_array($request->status, [MobileMoneyRequest::FAILED, MobileMoneyRequest::EXPIRED], true)) {
            $payment->update([
                'status' => SubscriptionPayment::FAILED,
                'rejection_reason' => $request->failure_reason,
            ]);
        }
    }

    /** Email and SMS to the owner; a delivery problem never undoes the payment. */
    private function tell(SubscriptionPayment $payment): void
    {
        try {
            $payment->owner?->notify(new SubscriptionPaymentDecided($payment));
        } catch (Throwable $e) {
            Log::warning('Subscription payment notice not sent: '.$e->getMessage(), ['payment' => $payment->id]);
        }
    }
}
