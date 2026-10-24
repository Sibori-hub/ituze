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

    /** The price is per house per month. */
    public static function priceFor(int $months, int $houses = 1): int
    {
        return $months * max(1, $houses) * self::monthlyPrice();
    }

    /** Whole months left in the paid period, at least one: what an extra house costs. */
    public static function monthsLeft(User $owner): int
    {
        if (! $owner->expires_at || $owner->expires_at->isPast()) {
            return 0;
        }

        // Calendar months, rounded up (a part of a month counts as a month).
        return max(1, (int) ceil(round(now()->diffInMonths($owner->expires_at), 3)));
    }

    /**
     * Months, houses and price for a payment, checked against the owner.
     * Renewal: any month option, at least one house and never fewer than the
     * houses they have. Adding houses: only while paid, for the months left.
     *
     * @return array{purpose: string, months: int, houses: int, amount: int}
     */
    public static function quote(User $owner, string $purpose, int $months, int $houses): array
    {
        if ($purpose === SubscriptionPayment::ADD_HOUSES) {
            $left = self::monthsLeft($owner);
            if ($left === 0) {
                throw \Illuminate\Validation\ValidationException::withMessages(['houses' => 'Your subscription has ended. Renew it, choosing all the houses you need.']);
            }
            if ($houses < 1 || $houses > 100) {
                throw \Illuminate\Validation\ValidationException::withMessages(['houses' => 'Choose how many houses to add (1 to 100).']);
            }

            return ['purpose' => $purpose, 'months' => $left, 'houses' => $houses, 'amount' => self::priceFor($left, $houses)];
        }

        $minimum = max(1, $owner->housesUsed());
        if ($houses < $minimum || $houses > 500) {
            throw \Illuminate\Validation\ValidationException::withMessages(['houses' => "You have {$owner->housesUsed()} house(s) on ITUZE, so pay for at least {$minimum}."]);
        }
        if (! in_array($months, self::monthOptions(), true)) {
            throw \Illuminate\Validation\ValidationException::withMessages(['months' => 'Choose 1, 3, 6 or 12 months.']);
        }

        return ['purpose' => SubscriptionPayment::RENEWAL, 'months' => $months, 'houses' => $houses, 'amount' => self::priceFor($months, $houses)];
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
            if ($locked->purpose === SubscriptionPayment::ADD_HOUSES && $owner->expires_at && $owner->expires_at->isFuture()) {
                // Extra houses join the current period; the end date stays.
                $start = Carbon::now();
                $end = $owner->expires_at->copy();
                $owner->forceFill(['paid_houses' => (int) $owner->paid_houses + $locked->houses])->save();
            } else {
                $early = $owner->expires_at && $owner->expires_at->isFuture();
                $start = $early ? $owner->expires_at->copy() : Carbon::now();
                $end = $start->copy()->addMonthsNoOverflow($locked->months);
                // Paying early never takes away houses already paid for this period.
                $houses = max($locked->houses, $owner->housesUsed(), $early ? (int) $owner->paid_houses : 0);
                $owner->forceFill(['expires_at' => $end, 'paid_houses' => $houses])->save();
            }
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
            // Paid by mobile money with no admin involved: let the admins know.
            if ($reviewer === null) {
                $this->tellAdmins($approved);
            }
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

    private function tellAdmins(SubscriptionPayment $payment): void
    {
        try {
            \Illuminate\Support\Facades\Notification::send(User::query()->where('role', 'admin')->get(), new \App\Notifications\SubscriptionPaymentReceived($payment));
        } catch (Throwable $e) {
            Log::warning('Subscription payment admin notice not sent: '.$e->getMessage(), ['payment' => $payment->id]);
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
