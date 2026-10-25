<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Auth\RegisteredUserController;
use App\Models\Property;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Notifications\SubscriptionPaymentSubmitted;
use App\Services\MobileMoney\MobileMoneyException;
use App\Services\MobileMoney\MobileMoneyService;
use App\Services\SubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * A self-registered owner's monthly subscription: status, paying by mobile
 * money or with a bank slip / cheque, and the payment history. Open even
 * when the account is paused, so the owner can always pay.
 */
class SubscriptionController extends Controller
{
    public function __construct(private MobileMoneyService $mobileMoney, private SubscriptionService $subscriptions)
    {
    }

    public function show(Request $request): Response
    {
        $owner = $this->owner($request);

        // Mobile money requests that were approved while the page was closed.
        SubscriptionPayment::query()
            ->where('owner_id', $owner->id)
            ->where('status', SubscriptionPayment::PENDING)
            ->whereNotNull('mobile_money_request_id')
            ->with('mobileMoneyRequest')
            ->get()
            ->each(fn (SubscriptionPayment $payment) => $payment->mobileMoneyRequest && $this->mobileMoney->refresh($payment->mobileMoneyRequest));
        $owner->refresh();

        return Inertia::render('Subscription/Index', [
            'subscription' => $this->status($owner),
            'monthlyPrice' => SubscriptionService::monthlyPrice(),
            'monthOptions' => SubscriptionService::monthOptions(),
            'selectedProperty' => $request->integer('property') ?: null,
            'payments' => SubscriptionPayment::query()
                ->where('owner_id', $owner->id)
                ->with('property:id,name')
                ->latest('id')
                ->limit(50)
                ->get()
                ->map(fn (SubscriptionPayment $payment) => $this->paymentRow($payment)),
            'phone' => $owner->phone,
            'bank' => config('legal.qra_bank'),
            'momoPay' => [
                'code' => config('services.momo_pay.code'),
                'name' => config('services.momo_pay.name'),
            ],
            'momoApi' => self::mobileMoneyApiAvailable(),
        ]);
    }

    /** Bank transfer or cheque, with a photo or PDF of the slip / cheque for the admin to check. */
    public function storeTransfer(Request $request): RedirectResponse
    {
        $owner = $this->owner($request);
        $request->merge([
            'reference' => preg_replace('/\s+/', '', (string) $request->input('reference')),
            'account_number' => preg_replace('/[\s-]+/', '', (string) $request->input('account_number')),
        ]);
        $cheque = $request->input('method') === 'cheque';
        $data = $request->validate([
            ...$this->planRules(),
            'method' => ['required', Rule::in(['bank_transfer', 'cheque'])],
            'bank_name' => ['required', 'string', 'max:80'],
            'account_number' => ['required', 'regex:/^[0-9A-Za-z]{5,30}$/'],
            // Name on the account or on the cheque: a person or a company.
            'sender_name' => ['required', 'string', 'max:150'],
            'reference' => [
                'required', $cheque ? 'regex:/^[0-9]{4,20}$/' : 'regex:/^[0-9A-Za-z\/._-]{4,60}$/',
                // One slip or cheque pays once: the same number at the same bank is refused.
                Rule::unique('subscription_payments', 'reference')->where(fn ($query) => $query
                    ->where('method', $request->input('method'))
                    ->where('bank_name', $request->input('bank_name'))
                    ->whereIn('status', [SubscriptionPayment::PENDING, SubscriptionPayment::APPROVED])),
            ],
            'paid_at' => ['required', 'date', function (string $attribute, mixed $value, \Closure $fail) use ($cheque) {
                $day = self::kigaliTime((string) $value)->startOfDay();
                if ($day->isAfter(now()->addDay())) {
                    $fail($cheque ? 'The cheque date cannot be in the future.' : 'The transfer date cannot be in the future.');
                } elseif ($day->isBefore(now()->subDays(60))) {
                    $fail('This date is more than 60 days ago. Please contact ITUZE.');
                }
            }],
            'proof' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ], [
            'bank_name.required' => $cheque ? 'Choose the bank the cheque is drawn on.' : 'Choose the bank you paid from.',
            'account_number.required' => 'Enter the account number.',
            'account_number.regex' => 'Enter the account number: letters and numbers only.',
            'sender_name.required' => $cheque ? 'Enter the name written on the cheque.' : 'Enter the name on the account (a person or a company).',
            'reference.required' => $cheque ? 'Enter the cheque number.' : 'Enter the reference number on the bank receipt.',
            'reference.regex' => $cheque ? 'Enter the cheque number: numbers only.' : 'Enter the reference as printed on the receipt.',
            'reference.unique' => $cheque ? 'This cheque was already sent for a payment.' : 'This bank reference was already used for a payment.',
            'paid_at.required' => $cheque ? 'Enter the date written on the cheque.' : 'Enter the date of the transfer.',
            'proof.required' => $cheque ? 'Attach a copy (photo or scan) of the cheque.' : 'Attach the bank receipt (photo or PDF).',
        ]);
        $plan = $this->plan($owner, $data);
        $this->ensureNothingWaiting($owner, $plan['property_id']);

        $file = $request->file('proof');
        $payment = SubscriptionPayment::create([
            'owner_id' => $owner->id,
            ...$plan,
            'method' => $data['method'],
            'reference' => $data['reference'],
            'bank_name' => trim($data['bank_name']),
            'account_number' => $data['account_number'],
            'sender_name' => trim($data['sender_name']),
            'paid_at' => self::kigaliTime($data['paid_at'])->startOfDay()->utc(),
            'proof_path' => $file->store('subscription-proofs', 'local'),
            'proof_name' => mb_substr($file->getClientOriginalName(), 0, 200),
            'status' => SubscriptionPayment::PENDING,
            'submitted_by' => $owner->id,
        ]);

        Notification::send(User::query()->where('role', 'admin')->get(), new SubscriptionPaymentSubmitted($payment));

        return back()->with('success', 'Thank you. Your payment was sent for checking; your subscription is extended as soon as it is approved.');
    }

    /**
     * MoMo Pay without the API: the owner paid our MoMo Pay code and sends the
     * details from the MoMo SMS. The admin compares them with the MoMo
     * statement and approves or rejects.
     */
    public function storeMomoPay(Request $request): RedirectResponse
    {
        $owner = $this->owner($request);
        $request->merge([
            'sender_phone' => RegisteredUserController::normalizeRwandaPhone((string) $request->input('sender_phone')),
            'transaction_id' => preg_replace('/\s+/', '', (string) $request->input('transaction_id')),
        ]);
        $plan = $this->plan($owner, $request->validate($this->planRules()));
        $price = $plan['amount'];
        $data = $request->validate([
            'sender_name' => ['required', 'string', 'max:120'],
            'sender_phone' => ['required', 'regex:/^(072|073|078|079)\d{7}$/'],
            'amount' => ['required', 'numeric', Rule::in([$price])],
            'paid_at' => ['required', 'date', function (string $attribute, mixed $value, \Closure $fail) {
                // The owner types Kigali time; the site runs on UTC. A phone clock a few minutes fast is fine.
                $paidAt = self::kigaliTime((string) $value);
                if ($paidAt->isAfter(now()->addMinutes(10))) {
                    $fail('The payment date and time cannot be in the future.');
                } elseif ($paidAt->isBefore(now()->subDays(30))) {
                    $fail('This payment is more than 30 days old. Please contact ITUZE.');
                }
            }],
            'transaction_id' => [
                'required', 'regex:/^[0-9]{6,20}$/',
                // One MoMo payment pays one subscription: a used transaction ID is refused.
                Rule::unique('subscription_payments', 'reference')->where(fn ($query) => $query
                    ->where('method', 'momo_pay')
                    ->whereIn('status', [SubscriptionPayment::PENDING, SubscriptionPayment::APPROVED])),
            ],
            'proof' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ], [
            'sender_phone.regex' => 'Enter the 10-digit MTN or Airtel number that paid (078, 079, 072 or 073).',
            'amount.in' => 'For the houses and months you chose the amount is '.number_format($price).' RWF. Pay exactly this amount.',
            'transaction_id.regex' => 'Enter the transaction ID from the MoMo SMS: numbers only.',
            'transaction_id.unique' => 'This transaction ID was already used for a payment.',
        ]);
        $this->ensureNothingWaiting($owner, $plan['property_id']);

        $file = $request->file('proof');
        $payment = SubscriptionPayment::create([
            'owner_id' => $owner->id,
            ...$plan,
            'method' => 'momo_pay',
            'reference' => $data['transaction_id'],
            'sender_name' => trim($data['sender_name']),
            'sender_phone' => $data['sender_phone'],
            'paid_at' => self::kigaliTime($data['paid_at'])->utc(),
            'proof_path' => $file?->store('subscription-proofs', 'local'),
            'proof_name' => $file ? mb_substr($file->getClientOriginalName(), 0, 200) : null,
            'status' => SubscriptionPayment::PENDING,
            'submitted_by' => $owner->id,
        ]);

        Notification::send(User::query()->where('role', 'admin')->get(), new SubscriptionPaymentSubmitted($payment));

        return back()->with('success', 'Thank you. We are checking your MoMo payment; your subscription starts as soon as it is approved. You will get an SMS and email.');
    }

    /** A date and time typed in Rwanda (e.g. 2026-10-24T17:05), as a moment in time. */
    public static function kigaliTime(string $value): Carbon
    {
        return Carbon::parse($value, config('app.schedule_timezone', 'Africa/Kigali'));
    }

    /**
     * Payment requests straight to the owner's phone need the MoMo API. Until
     * it is connected, the test driver must never run on the live site: it
     * would mark payments as paid without any money.
     */
    public static function mobileMoneyApiAvailable(): bool
    {
        return config('services.mobile_money.driver') !== 'fake' || app()->environment(['local', 'testing']);
    }

    /** Sends the request to the owner's phone; they approve it with their PIN. */
    public function startMobileMoney(Request $request): JsonResponse
    {
        $owner = $this->owner($request);
        abort_unless(self::mobileMoneyApiAvailable(), 404);
        $data = $request->validate([
            ...$this->planRules(),
            'phone' => ['required', 'string', 'max:20'],
        ]);
        $phone = MobileMoneyService::msisdn($data['phone']);
        if (! $phone) {
            throw ValidationException::withMessages(['phone' => 'Enter an MTN or Airtel number: 078, 079, 072 or 073 followed by 7 digits.']);
        }
        // An earlier request may have finished or timed out since; check it first.
        SubscriptionPayment::query()->where('owner_id', $owner->id)->where('status', SubscriptionPayment::PENDING)
            ->whereNotNull('mobile_money_request_id')->with('mobileMoneyRequest')->get()
            ->each(fn (SubscriptionPayment $payment) => $payment->mobileMoneyRequest && $this->mobileMoney->refresh($payment->mobileMoneyRequest));
        $plan = $this->plan($owner, $data);
        $this->ensureNothingWaiting($owner, $plan['property_id'], mobileMoneyOnly: true);
        try {
            $momo = $this->mobileMoney->start(
                $owner, null, null, $phone, $plan['amount'],
                'ITUZE subscription, property #'.$plan['property_id'].', '.$plan['months'].' month(s)', 'subscription',
            );
        } catch (MobileMoneyException $e) {
            throw ValidationException::withMessages(['phone' => $e->getMessage()]);
        }

        $payment = SubscriptionPayment::create([
            'owner_id' => $owner->id,
            ...$plan,
            'method' => 'mobile_money',
            'status' => SubscriptionPayment::PENDING,
            'mobile_money_request_id' => $momo->id,
            'submitted_by' => $owner->id,
        ]);

        return response()->json(['payment' => $this->paymentRow($payment), 'request' => $momo->toClient()], 201);
    }

    /** Polled by the page while the owner approves on their phone. */
    public function mobileMoneyStatus(Request $request, SubscriptionPayment $payment): JsonResponse
    {
        $owner = $this->owner($request);
        abort_unless($payment->owner_id === $owner->id && $payment->mobileMoneyRequest, 404);

        $momo = $this->mobileMoney->refresh($payment->mobileMoneyRequest);

        return response()->json([
            'request' => $momo->toClient(),
            'payment' => $this->paymentRow($payment->fresh()),
            'subscription' => $this->status($owner->fresh()),
        ]);
    }

    /** The uploaded slip or cheque: the owner who sent it, or an admin. */
    public function proof(Request $request, SubscriptionPayment $payment): StreamedResponse
    {
        $user = $request->user();
        abort_unless($user->isAdmin() || $payment->owner_id === $user->id, 404);
        abort_unless($payment->proof_path && Storage::disk('local')->exists($payment->proof_path), 404);

        return Storage::disk('local')->response($payment->proof_path, $payment->proof_name ?: basename($payment->proof_path));
    }

    private function owner(Request $request): User
    {
        $user = $request->user();
        abort_unless($user->paysSubscription() && in_array($user->status, ['approved'], true), 403, 'Only owners who registered themselves pay a subscription.');

        return $user;
    }

    /** What the owner pays for: one property, for some months. */
    private function planRules(): array
    {
        return [
            'property_id' => ['required', 'integer'],
            'months' => ['required', 'integer', 'min:1', 'max:12'],
        ];
    }

    /** @return array{property_id: int, purpose: string, months: int, houses: int, amount: int} */
    private function plan(User $owner, array $data): array
    {
        return SubscriptionService::quote($owner, Property::query()->find($data['property_id']), (int) $data['months']);
    }

    /** One payment at a time per property, so nothing is paid twice by mistake. */
    private function ensureNothingWaiting(User $owner, int $propertyId, bool $mobileMoneyOnly = false): void
    {
        $waiting = SubscriptionPayment::query()
            ->where('owner_id', $owner->id)
            ->where('property_id', $propertyId)
            ->where('status', SubscriptionPayment::PENDING)
            ->when($mobileMoneyOnly, fn ($query) => $query->whereNotNull('mobile_money_request_id'))
            ->when(! $mobileMoneyOnly, fn ($query) => $query->whereNull('mobile_money_request_id'))
            ->exists();

        if ($waiting) {
            throw ValidationException::withMessages([
                $mobileMoneyOnly ? 'phone' : 'reference' => $mobileMoneyOnly
                    ? 'A mobile money request is still waiting. Approve it on your phone or wait 3 minutes and try again.'
                    : 'A payment for this property is still being checked. You will be told as soon as it is approved.',
            ]);
        }
    }

    public static function statusFor(User $owner): array
    {
        $properties = Property::query()->where('owner_id', $owner->id)->orderBy('name')->get(['id', 'owner_id', 'name', 'paid_until'])
            ->each(fn (Property $property) => $property->setRelation('owner', $owner))
            ->map(fn (Property $property) => [
                'id' => $property->id,
                'name' => $property->name,
                'state' => $property->subscriptionState(),
                'paid_until' => $property->paid_until?->toIso8601String(),
                'days_left' => $property->paid_until ? (int) floor(now()->diffInDays($property->paid_until, false)) : null,
                'grace_ends_at' => $property->paid_until?->copy()->addDays(Property::graceDays())->toIso8601String(),
            ])
            ->values();
        $count = fn (string ...$states) => $properties->whereIn('state', $states)->count();

        return [
            'properties' => $properties->all(),
            'unpaid' => $count('unpaid'),
            'expiring' => $count('expiring'),
            'grace' => $count('grace'),
            'paused' => $count('paused'),
            'active' => $count('active', 'expiring'),
            // Kept for screens that show one date: the latest paid property.
            'paid_until' => $owner->expires_at?->toIso8601String(),
            'blocked' => false,
        ];
    }

    private function status(User $owner): array
    {
        return self::statusFor($owner);
    }

    private function paymentRow(SubscriptionPayment $payment): array
    {
        return [
            'id' => $payment->id,
            'created_at' => $payment->created_at?->toIso8601String(),
            'property_id' => $payment->property_id,
            'property' => $payment->property?->name,
            'months' => $payment->months,
            'houses' => $payment->houses,
            'purpose' => $payment->purpose,
            'amount' => (float) $payment->amount,
            'method' => $payment->method,
            'reference' => $payment->reference,
            'status' => $payment->status,
            'period_start' => $payment->period_start?->toDateString(),
            'period_end' => $payment->period_end?->toDateString(),
            'receipt_number' => $payment->receipt_number,
            'rejection_reason' => $payment->rejection_reason,
            'has_proof' => (bool) $payment->proof_path,
        ];
    }
}
