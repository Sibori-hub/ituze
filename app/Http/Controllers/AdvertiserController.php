<?php

namespace App\Http\Controllers;

use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Notification;
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
                'status' => $this->listingStatus($property),
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
            'purchases' => AdPurchase::query()->with('property:id,name')->where('advertiser_id', $advertiser->id)->latest('id')->limit(20)->get()
                ->map(fn (AdPurchase $purchase) => $this->purchaseRow($purchase)),
            'inquiries' => PropertyInquiry::query()
                ->with(['property:id,name', 'unit:id,unit_number'])
                ->whereIn('property_id', $buildings->pluck('id'))
                ->latest()
                ->take(10)
                ->get(['id', 'property_id', 'unit_id', 'visitor_name', 'visitor_email', 'visitor_phone', 'message', 'status', 'created_at']),
            'phone' => $advertiser->phone,
            // Pay like owners: QRA's MoMo Pay code (SMS details) or a bank slip / cheque, checked by an admin.
            'momoPay' => ['code' => config('services.momo_pay.code'), 'name' => config('services.momo_pay.name')],
            'bank' => config('legal.qra_bank'),
            'momoApi' => SubscriptionController::mobileMoneyApiAvailable(),
            'waiting' => AdPurchase::query()->where('advertiser_id', $advertiser->id)->where('status', AdPurchase::PENDING)->whereNull('mobile_money_request_id')->exists(),
        ]);
    }

    /** MoMo Pay to QRA's code: the details from the MoMo SMS, checked by an admin. */
    public function storeMomoPay(Request $request): RedirectResponse
    {
        $advertiser = $request->user();
        $request->merge([
            'sender_phone' => \App\Http\Controllers\Auth\RegisteredUserController::normalizeRwandaPhone((string) $request->input('sender_phone')),
            'transaction_id' => preg_replace('/\s+/', '', (string) $request->input('transaction_id')),
        ]);
        $property = $this->ownProperty($request);
        $data = $request->validate([
            'sender_name' => ['required', 'string', 'max:120'],
            'sender_phone' => ['required', 'regex:/^(072|073|078|079)\d{7}$/'],
            'paid_at' => ['required', 'date', function (string $attribute, mixed $value, \Closure $fail) {
                $paidAt = SubscriptionController::kigaliTime((string) $value);
                if ($paidAt->isAfter(now()->addMinutes(10))) {
                    $fail('The payment date and time cannot be in the future.');
                } elseif ($paidAt->isBefore(now()->subDays(30))) {
                    $fail('This payment is more than 30 days old. Please contact ITUZE.');
                }
            }],
            'transaction_id' => ['required', 'regex:/^[0-9]{6,20}$/', function (string $attribute, mixed $value, \Closure $fail) {
                // One MoMo payment pays once, for listings or for a property.
                $used = AdPurchase::query()->where('method', 'momo_pay')->where('reference', $value)->whereIn('status', [AdPurchase::PENDING, AdPurchase::APPROVED])->exists()
                    || \App\Models\SubscriptionPayment::query()->where('method', 'momo_pay')->where('reference', $value)->whereIn('status', ['pending', 'approved'])->exists();
                if ($used) {
                    $fail('This transaction ID was already used for a payment.');
                }
            }],
            'proof' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ], [
            'sender_phone.regex' => 'Enter the 10-digit MTN or Airtel number that paid (078, 079, 072 or 073).',
            'transaction_id.regex' => 'Enter the transaction ID from the MoMo SMS: numbers only.',
        ]);
        $this->ensureNothingWaiting($advertiser, $property);

        $file = $request->file('proof');
        $this->submitted(AdPurchase::create([
            'advertiser_id' => $advertiser->id,
            'property_id' => $property->id,
            'listings' => 1,
            'amount' => AdvertisingService::price(),
            'method' => 'momo_pay',
            'status' => AdPurchase::PENDING,
            'reference' => $data['transaction_id'],
            'sender_name' => trim($data['sender_name']),
            'sender_phone' => $data['sender_phone'],
            'sent_at' => SubscriptionController::kigaliTime($data['paid_at'])->utc(),
            'proof_path' => $file?->store('ad-payment-proofs', 'local'),
            'proof_name' => $file ? mb_substr($file->getClientOriginalName(), 0, 200) : null,
        ]));

        return redirect()->route('dashboard')->with('success', 'Thank you. Your payment for "'.$property->name.'" was sent for checking; it goes on the homepage as soon as it is approved.');
    }

    /** Bank transfer or cheque, with the receipt or a copy of the cheque, checked by an admin. */
    public function storeTransfer(Request $request): RedirectResponse
    {
        $advertiser = $request->user();
        $request->merge([
            'reference' => preg_replace('/\s+/', '', (string) $request->input('reference')),
            'account_number' => preg_replace('/[\s-]+/', '', (string) $request->input('account_number')),
        ]);
        $cheque = $request->input('method') === 'cheque';
        $property = $this->ownProperty($request);
        $data = $request->validate([
            'method' => ['required', Rule::in(['bank_transfer', 'cheque'])],
            'bank_name' => ['required', 'string', 'max:80'],
            'account_number' => ['required', 'regex:/^[0-9A-Za-z]{5,30}$/'],
            'sender_name' => ['required', 'string', 'max:150'],
            'reference' => ['required', $cheque ? 'regex:/^[0-9]{4,20}$/' : 'regex:/^[0-9A-Za-z\/._-]{4,60}$/',
                Rule::unique('ad_purchases', 'reference')->where(fn ($query) => $query->where('method', $request->input('method'))
                    ->where('bank_name', $request->input('bank_name'))->whereIn('status', [AdPurchase::PENDING, AdPurchase::APPROVED]))],
            'paid_at' => ['required', 'date', 'before_or_equal:tomorrow'],
            'proof' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ], [
            'reference.unique' => $cheque ? 'This cheque was already sent for a payment.' : 'This bank reference was already used for a payment.',
            'proof.required' => $cheque ? 'Attach a copy (photo or scan) of the cheque.' : 'Attach the bank receipt (photo or PDF).',
        ]);
        $this->ensureNothingWaiting($advertiser, $property);

        $file = $request->file('proof');
        $this->submitted(AdPurchase::create([
            'advertiser_id' => $advertiser->id,
            'property_id' => $property->id,
            'listings' => 1,
            'amount' => AdvertisingService::price(),
            'method' => $data['method'],
            'status' => AdPurchase::PENDING,
            'reference' => $data['reference'],
            'bank_name' => trim($data['bank_name']),
            'account_number' => $data['account_number'],
            'sender_name' => trim($data['sender_name']),
            'sent_at' => SubscriptionController::kigaliTime($data['paid_at'])->startOfDay()->utc(),
            'proof_path' => $file->store('ad-payment-proofs', 'local'),
            'proof_name' => mb_substr($file->getClientOriginalName(), 0, 200),
        ]));

        return redirect()->route('dashboard')->with('success', 'Thank you. Your payment for "'.$property->name.'" was sent for checking; it goes on the homepage as soon as it is approved.');
    }

    /** The receipt of a listing payment: for admins and for the advertiser who sent it. */
    public function proof(Request $request, AdPurchase $purchase): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $user = $request->user();
        abort_unless($user->isAdmin() || $purchase->advertiser_id === $user->id, 404);
        abort_unless($purchase->proof_path && \Illuminate\Support\Facades\Storage::disk('local')->exists($purchase->proof_path), 404);

        return \Illuminate\Support\Facades\Storage::disk('local')->response($purchase->proof_path, $purchase->proof_name ?: basename($purchase->proof_path));
    }

    private function ensureNothingWaiting($advertiser, Property $property): void
    {
        if (AdPurchase::query()->where('advertiser_id', $advertiser->id)->where('property_id', $property->id)->where('status', AdPurchase::PENDING)->whereNull('mobile_money_request_id')->exists()) {
            throw ValidationException::withMessages(['property_id' => 'A payment for this property is already waiting for checking.']);
        }
    }

    /** The advertiser's own property the payment is for. */
    private function ownProperty(Request $request): Property
    {
        $request->validate(['property_id' => ['required', 'integer']]);

        return Property::query()->where('owner_id', $request->user()->id)->findOrFail($request->integer('property_id'));
    }

    /**
     * Step 2 after adding a property: pay 25,000 RWF for it (MoMo Pay, bank
     * transfer or cheque). A free listing from the first-purchase gift can be
     * used instead, when one is left.
     */
    public function pay(Request $request, Property $property): Response
    {
        $advertiser = $request->user();
        abort_unless($property->owner_id === $advertiser->id, 404);

        return Inertia::render('Advertiser/Pay', [
            'property' => [
                'id' => $property->id,
                'name' => $property->name,
                'address' => $property->address,
                'rooms' => $property->units()->count(),
                'status' => $this->listingStatus($property),
            ],
            'price' => AdvertisingService::price(),
            'listingDays' => AdvertisingService::LISTING_DAYS,
            'bonusOnApproval' => AdvertisingService::bonusFor($advertiser),
            'credits' => (int) $advertiser->ad_credits,
            'momoPay' => ['code' => config('services.momo_pay.code'), 'name' => config('services.momo_pay.name')],
            'bank' => config('legal.qra_bank'),
            'phone' => $advertiser->phone,
        ]);
    }

    /**
     * Where a property stands: unpaid, payment being checked, not approved,
     * online (days left) or ended.
     */
    private function listingStatus(Property $property): array
    {
        $latest = AdPurchase::query()->where('property_id', $property->id)->latest('id')->first();
        $listed = $property->listed_until?->isFuture() ?? false;

        return match (true) {
            $listed => ['key' => 'listed', 'until' => $property->listed_until?->toIso8601String(), 'days_left' => (int) ceil(now()->diffInHours($property->listed_until) / 24)],
            $latest?->status === AdPurchase::PENDING => ['key' => 'checking', 'since' => $latest->created_at?->toIso8601String(), 'amount' => (float) $latest->amount],
            $latest?->status === AdPurchase::REJECTED => ['key' => 'rejected', 'reason' => $latest->rejection_reason],
            $property->listed_until !== null => ['key' => 'ended', 'until' => $property->listed_until?->toIso8601String()],
            default => ['key' => 'unpaid'],
        };
    }

    /** Admins are told by email and SMS that a listing payment waits for them. */
    private function submitted(AdPurchase $purchase): void
    {
        Notification::send(User::query()->where('role', 'admin')->whereNull('disabled_at')->get(), new \App\Notifications\AdPurchaseDecision($purchase, \App\Notifications\AdPurchaseDecision::SUBMITTED));
    }

    /** Asks the advertiser's phone to pay for listings. */
    public function startPurchase(Request $request): JsonResponse
    {
        abort_unless(SubscriptionController::mobileMoneyApiAvailable(), 404);
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
            'method' => $purchase->method,
            'rejection_reason' => $purchase->rejection_reason,
            'property' => $purchase->property?->name,
        ];
    }
}
