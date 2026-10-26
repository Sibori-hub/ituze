<?php

namespace App\Services;

use App\Models\AdPurchase;
use App\Models\MobileMoneyRequest;
use App\Models\Property;
use App\Models\User;
use App\Notifications\AdPurchasePaid;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Advertiser listing credits: buying them (mobile money) and using one to
 * show a building on the public homepage for a fixed number of days.
 */
class AdvertisingService
{
    public const LISTING_DAYS = 60;

    public static function price(): int
    {
        return (int) config('legal.ad_unit_price_rwf', 25000);
    }

    /** The welcome bonus comes once, with an advertiser's first paid purchase. */
    public static function bonusFor(User $advertiser): int
    {
        $alreadyPaid = AdPurchase::query()
            ->where('advertiser_id', $advertiser->id)
            ->where('status', AdPurchase::APPROVED)
            ->exists();

        return $alreadyPaid ? 0 : (int) config('legal.ad_welcome_bonus_units', 3);
    }

    /** Adds the paid listings (and the bonus, if still due) to the advertiser's credits. */
    public function approve(AdPurchase $purchase, ?User $reviewer = null): AdPurchase
    {
        $approved = DB::transaction(function () use ($purchase, $reviewer) {
            $locked = AdPurchase::query()->whereKey($purchase->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== AdPurchase::PENDING) {
                return null;
            }
            $advertiser = User::query()->whereKey($locked->advertiser_id)->lockForUpdate()->firstOrFail();
            $bonus = self::bonusFor($advertiser);

            $advertiser->forceFill(['ad_credits' => (int) $advertiser->ad_credits + $locked->listings + $bonus])->save();
            $locked->update([
                'status' => AdPurchase::APPROVED,
                'bonus' => $bonus,
                'paid_at' => now(),
                'receipt_number' => sprintf('ITZ-AD-%s-%06d', now()->format('Y'), $locked->id),
                'reviewed_by' => $reviewer?->id,
                'reviewed_at' => $reviewer ? now() : null,
            ]);

            return $locked;
        });

        if ($approved) {
            try {
                $recipients = User::query()->where('role', 'admin')->get()->push($approved->advertiser);
                Notification::send($recipients->filter(), new AdPurchasePaid($approved));
            } catch (Throwable $e) {
                Log::warning('Ad purchase notice not sent: '.$e->getMessage(), ['purchase' => $approved->id]);
            }
        }

        return $approved ?? $purchase->fresh();
    }

    /** Follows the mobile money request that pays for listings. */
    public function syncMobileMoney(MobileMoneyRequest $request): void
    {
        $purchase = AdPurchase::query()
            ->where('mobile_money_request_id', $request->id)
            ->where('status', AdPurchase::PENDING)
            ->first();
        if (! $purchase) {
            return;
        }

        if ($request->status === MobileMoneyRequest::SUCCESSFUL) {
            $purchase->update(['reference' => $request->provider_transaction_id]);
            $request->forceFill(['used_at' => now()])->save();
            $this->approve($purchase);
        } elseif (in_array($request->status, [MobileMoneyRequest::FAILED, MobileMoneyRequest::EXPIRED], true)) {
            $purchase->update(['status' => AdPurchase::FAILED]);
        }
    }

    /**
     * Uses one credit: the building shows on the homepage for 60 days, or 60
     * more days on top of a listing that is still running.
     */
    public function publish(User $advertiser, Property $property): Property
    {
        return DB::transaction(function () use ($advertiser, $property) {
            $locked = User::query()->whereKey($advertiser->id)->lockForUpdate()->firstOrFail();
            if ((int) $locked->ad_credits < 1) {
                throw ValidationException::withMessages(['credits' => 'You have no listings left. Buy listings first.']);
            }
            $building = Property::query()->whereKey($property->id)->lockForUpdate()->firstOrFail();
            if (! $building->units()->exists()) {
                throw ValidationException::withMessages(['credits' => 'Add at least one room before publishing this building.']);
            }

            $start = $building->listed_until && $building->listed_until->isFuture()
                ? Carbon::parse($building->listed_until)
                : Carbon::now();
            $end = $start->copy()->addDays(self::LISTING_DAYS);

            $locked->forceFill(['ad_credits' => (int) $locked->ad_credits - 1])->save();
            $building->forceFill(['listed_until' => $end])->save();
            DB::table('ad_listings')->insert([
                'property_id' => $building->id,
                'advertiser_id' => $locked->id,
                'starts_at' => $start,
                'ends_at' => $end,
                'created_at' => now(),
            ]);
            ActivityLogger::record('listing.published', 'Published '.$building->name.' on the homepage until '.$end->format('j M Y'), $building->id, $building);

            return $building;
        });
    }
}
