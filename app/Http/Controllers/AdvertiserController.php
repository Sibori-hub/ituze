<?php

namespace App\Http\Controllers;

use App\Models\AdPurchase;
use App\Models\Property;
use App\Models\PropertyInquiry;
use App\Models\User;
use App\Services\AdvertisingService;
use App\Services\MobileMoney\MobileMoneyException;
use App\Services\MobileMoney\MobileMoneyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Advertiser workspace: buy listings by mobile money (25,000 RWF each, +3
 * free with the first purchase) and publish buildings on the homepage for
 * 60 days. Advertisers have no tenants, leases or rent payments.
 */
class AdvertiserController extends Controller
{
    public function __construct(private MobileMoneyService $mobileMoney, private AdvertisingService $advertising)
    {
    }

    public function dashboard(Request $request): Response
    {
        $advertiser = $request->user();

        if ($advertiser->status === 'approved') {
            // Purchases approved on the phone while the page was closed.
            AdPurchase::query()->where('advertiser_id', $advertiser->id)->where('status', AdPurchase::PENDING)
                ->whereNotNull('mobile_money_request_id')->with('mobileMoneyRequest')->get()
                ->each(fn (AdPurchase $purchase) => $purchase->mobileMoneyRequest && $this->mobileMoney->refresh($purchase->mobileMoneyRequest));
            $advertiser->refresh();
        }

        $buildings = Property::query()
            ->where('owner_id', $advertiser->id)
            ->with(['images' => fn ($query) => $query->orderByDesc('is_cover')])
            ->withCount('units')
            ->latest()
            ->get()
            ->map(fn (Property $property) => [
                'id' => $property->id,
                'name' => $property->name,
                'address' => $property->address,
                'rooms' => $property->units_count,
                'cover' => $property->images->first()?->image_path,
                'listed_until' => $property->listed_until?->toIso8601String(),
                'is_listed' => $property->listed_until?->isFuture() ?? false,
                'days_left' => $property->listed_until?->isFuture() ? (int) ceil(now()->diffInHours($property->listed_until) / 24) : null,
                'new_inquiries' => PropertyInquiry::query()->where('property_id', $property->id)->where('status', 'new')->count(),
            ]);

        return Inertia::render('Advertiser/Dashboard', [
            'status' => $advertiser->status,
            'adUnitPrice' => AdvertisingService::price(),
            'welcomeBonusUnits' => (int) config('legal.ad_welcome_bonus_units', 3),
            'bonusAvailable' => AdvertisingService::bonusFor($advertiser) > 0,
            'hasPaid' => $advertiser->hasPaidForListings(),
            'listingDays' => AdvertisingService::LISTING_DAYS,
            'credits' => (int) $advertiser->ad_credits,
            'buildings' => $buildings,
            'purchases' => AdPurchase::query()->where('advertiser_id', $advertiser->id)->latest('id')->limit(20)->get()
                ->map(fn (AdPurchase $purchase) => $this->purchaseRow($purchase)),
            'inquiries' => PropertyInquiry::query()
                ->with(['property:id,name', 'unit:id,unit_number'])
                ->whereIn('property_id', $buildings->pluck('id'))
                ->latest()
                ->take(10)
                ->get(['id', 'property_id', 'unit_id', 'visitor_name', 'visitor_email', 'visitor_phone', 'message', 'status', 'created_at']),
            'phone' => $advertiser->phone,
        ]);
    }

    /** Asks the advertiser's phone to pay for listings. */
    public function startPurchase(Request $request): JsonResponse
    {
        $advertiser = $request->user();
        $data = $request->validate([
            'listings' => ['required', 'integer', 'min:1', 'max:50'],
            'phone' => ['required', 'string', 'max:20'],
        ]);
        $phone = MobileMoneyService::msisdn($data['phone']);
        if (! $phone) {
            throw ValidationException::withMessages(['phone' => 'Enter an MTN or Airtel number: 078, 079, 072 or 073 followed by 7 digits.']);
        }

        // An earlier request may have finished since; only one may wait at a time.
        AdPurchase::query()->where('advertiser_id', $advertiser->id)->where('status', AdPurchase::PENDING)
            ->with('mobileMoneyRequest')->get()
            ->each(fn (AdPurchase $purchase) => $purchase->mobileMoneyRequest && $this->mobileMoney->refresh($purchase->mobileMoneyRequest));
        if (AdPurchase::query()->where('advertiser_id', $advertiser->id)->where('status', AdPurchase::PENDING)->exists()) {
            throw ValidationException::withMessages(['phone' => 'A payment request is still waiting. Approve it on your phone or wait 3 minutes and try again.']);
        }

        $listings = (int) $data['listings'];
        $amount = $listings * AdvertisingService::price();
        try {
            $momo = $this->mobileMoney->start($advertiser, null, null, $phone, $amount, 'ITUZE listings x'.$listings, 'ad_listings');
        } catch (MobileMoneyException $e) {
            throw ValidationException::withMessages(['phone' => $e->getMessage()]);
        }

        $purchase = AdPurchase::create([
            'advertiser_id' => $advertiser->id,
            'listings' => $listings,
            'amount' => $amount,
            'method' => 'mobile_money',
            'status' => AdPurchase::PENDING,
            'mobile_money_request_id' => $momo->id,
        ]);

        return response()->json(['purchase' => $this->purchaseRow($purchase), 'request' => $momo->toClient()], 201);
    }

    public function purchaseStatus(Request $request, AdPurchase $purchase): JsonResponse
    {
        abort_unless($purchase->advertiser_id === $request->user()->id && $purchase->mobileMoneyRequest, 404);
        $momo = $this->mobileMoney->refresh($purchase->mobileMoneyRequest);

        return response()->json([
            'request' => $momo->toClient(),
            'purchase' => $this->purchaseRow($purchase->fresh()),
            'credits' => (int) $request->user()->fresh()->ad_credits,
        ]);
    }

    /** Uses one listing: the building shows on the homepage for 60 days. */
    public function publish(Request $request, Property $property): RedirectResponse
    {
        $advertiser = $request->user();
        abort_unless($property->owner_id === $advertiser->id, 404);

        $property = $this->advertising->publish($advertiser, $property);

        return back()->with('success', $property->name.' is on the homepage until '.$property->listed_until->format('j M Y').'.');
    }

    private function purchaseRow(AdPurchase $purchase): array
    {
        return [
            'id' => $purchase->id,
            'created_at' => $purchase->created_at?->toIso8601String(),
            'listings' => $purchase->listings,
            'bonus' => $purchase->bonus,
            'amount' => (float) $purchase->amount,
            'status' => $purchase->status,
            'reference' => $purchase->reference,
            'receipt_number' => $purchase->receipt_number,
        ];
    }
}
