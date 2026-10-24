<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Auth\RegisteredUserController;
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
            'payments' => SubscriptionPayment::query()
                ->where('owner_id', $owner->id)
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
        $data = $request->validate([
            'months' => ['required', 'integer', Rule::in(SubscriptionService::monthOptions())],
            'method' => ['required', Rule::in(['bank_transfer', 'cheque'])],
            'reference' => ['required', 'string', 'max:120'],
            'proof' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ], [
            'reference.required' => 'Enter the bank slip reference or the cheque number.',
            'proof.required' => 'Attach a photo or PDF of the bank slip or cheque.',
        ]);
        $this->ensureNothingWaiting($owner);

        $file = $request->file('proof');
        $payment = SubscriptionPayment::create([
            'owner_id' => $owner->id,
            'months' => $data['months'],
            'amount' => SubscriptionService::priceFor((int) $data['months']),
            'method' => $data['method'],
            'reference' => trim($data['reference']),
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
        $price = SubscriptionService::priceFor(max(1, (int) $request->input('months')));
        $data = $request->validate([
            'months' => ['required', 'integer', Rule::in(SubscriptionService::monthOptions())],
            'sender_name' => ['required', 'string', 'max:120'],
            'sender_phone' => ['required', 'regex:/^(072|073|078|079)\d{7}$/'],
            'amount' => ['required', 'numeric', Rule::in([$price])],
            'paid_at' => ['required', 'date', 'before_or_equal:now', 'after:'.now()->subDays(30)->toDateTimeString()],
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
            'amount.in' => 'For the months you chose the amount is '.number_format($price).' RWF. Pay exactly this amount.',
            'paid_at.before_or_equal' => 'The payment date and time cannot be in the future.',
            'paid_at.after' => 'This payment is more than 30 days old. Please contact ITUZE.',
            'transaction_id.regex' => 'Enter the transaction ID from the MoMo SMS: numbers only.',
            'transaction_id.unique' => 'This transaction ID was already used for a payment.',
        ]);
        $this->ensureNothingWaiting($owner);

        $file = $request->file('proof');
        $payment = SubscriptionPayment::create([
            'owner_id' => $owner->id,
            'months' => $data['months'],
            'amount' => $price,
            'method' => 'momo_pay',
            'reference' => $data['transaction_id'],
            'sender_name' => trim($data['sender_name']),
            'sender_phone' => $data['sender_phone'],
            'paid_at' => Carbon::parse($data['paid_at']),
            'proof_path' => $file?->store('subscription-proofs', 'local'),
            'proof_name' => $file ? mb_substr($file->getClientOriginalName(), 0, 200) : null,
            'status' => SubscriptionPayment::PENDING,
            'submitted_by' => $owner->id,
        ]);

        Notification::send(User::query()->where('role', 'admin')->get(), new SubscriptionPaymentSubmitted($payment));

        return back()->with('success', 'Thank you. We are checking your MoMo payment; your subscription starts as soon as it is approved. You will get an SMS and email.');
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
            'months' => ['required', 'integer', Rule::in(SubscriptionService::monthOptions())],
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
        $this->ensureNothingWaiting($owner, mobileMoneyOnly: true);

        $months = (int) $data['months'];
        try {
            $momo = $this->mobileMoney->start(
                $owner, null, null, $phone, SubscriptionService::priceFor($months),
                'ITUZE subscription, '.$months.' month'.($months > 1 ? 's' : ''), 'subscription',
            );
        } catch (MobileMoneyException $e) {
            throw ValidationException::withMessages(['phone' => $e->getMessage()]);
        }

        $payment = SubscriptionPayment::create([
            'owner_id' => $owner->id,
            'months' => $months,
            'amount' => SubscriptionService::priceFor($months),
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

    /** One payment at a time, so nothing is paid twice by mistake. */
    private function ensureNothingWaiting(User $owner, bool $mobileMoneyOnly = false): void
    {
        $waiting = SubscriptionPayment::query()
            ->where('owner_id', $owner->id)
            ->where('status', SubscriptionPayment::PENDING)
            ->when($mobileMoneyOnly, fn ($query) => $query->whereNotNull('mobile_money_request_id'))
            ->when(! $mobileMoneyOnly, fn ($query) => $query->whereNull('mobile_money_request_id'))
            ->exists();

        if ($waiting) {
            throw ValidationException::withMessages([
                $mobileMoneyOnly ? 'phone' : 'reference' => $mobileMoneyOnly
                    ? 'A mobile money request is still waiting. Approve it on your phone or wait 3 minutes and try again.'
                    : 'A payment you sent is still being checked. You will be told as soon as it is approved.',
            ]);
        }
    }

    public static function statusFor(User $owner): array
    {
        $expires = $owner->expires_at;
        $graceEnds = $owner->subscriptionGraceEndsAt();

        return [
            'paid_until' => $expires?->toIso8601String(),
            'days_left' => $expires ? (int) floor(now()->diffInDays($expires, false)) : null,
            'in_grace' => $owner->inSubscriptionGrace(),
            'grace_ends_at' => $graceEnds?->toIso8601String(),
            'blocked' => $owner->isExpired(),
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
            'months' => $payment->months,
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
