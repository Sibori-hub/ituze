<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\SubscriptionController;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admins check bank slips and cheques, approve or reject them, and see which
 * self-registered owners are about to expire or are paused.
 */
class SubscriptionPaymentController extends Controller
{
    public function __construct(private SubscriptionService $subscriptions)
    {
    }

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['pending', 'approved', 'rejected', 'failed', 'all'])],
            'search' => ['nullable', 'string', 'max:100'],
        ]);
        $status = $filters['status'] ?? 'pending';
        $search = trim($filters['search'] ?? '');

        $payments = SubscriptionPayment::query()
            ->with(['owner', 'reviewer:id,name'])
            ->when($status !== 'all', fn ($query) => $query->where('status', $status))
            // Mobile money payments still waiting on the phone are not for admins to review.
            ->when($status === 'pending', fn ($query) => $query->whereNull('mobile_money_request_id'))
            ->when($search !== '', fn ($query) => $query->where(fn ($inner) => $inner
                ->where('reference', 'like', "%{$search}%")
                ->orWhere('receipt_number', 'like', "%{$search}%")
                ->orWhere('sender_name', 'like', "%{$search}%")
                ->orWhere('sender_phone', 'like', "%{$search}%")
                ->orWhereHas('owner', fn ($owner) => $owner->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"))))
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (SubscriptionPayment $payment) => [
                'id' => $payment->id,
                'created_at' => $payment->created_at?->toIso8601String(),
                'owner' => $payment->owner?->only(['id', 'name', 'email', 'phone']),
                'months' => $payment->months,
                'houses' => $payment->houses,
                'purpose' => $payment->purpose,
                'amount' => (float) $payment->amount,
                'method' => $payment->method,
                'reference' => $payment->reference,
                'sender_name' => $payment->sender_name,
                'sender_phone' => $payment->sender_phone,
                'paid_at' => $payment->paid_at?->toIso8601String(),
                'status' => $payment->status,
                'has_proof' => (bool) $payment->proof_path,
                'proof_name' => $payment->proof_name,
                'period_end' => $payment->period_end?->toDateString(),
                'receipt_number' => $payment->receipt_number,
                'reviewer' => $payment->reviewer?->name,
                'reviewed_at' => $payment->reviewed_at?->toIso8601String(),
                'rejection_reason' => $payment->rejection_reason,
                'owner_status' => $payment->owner ? SubscriptionController::statusFor($payment->owner) : null,
            ]);

        $owners = User::query()->where('role', 'owner')->whereNull('created_by')->where('status', 'approved');
        $graceDays = (int) config('legal.owner_subscription_grace_days', 7);

        return Inertia::render('Admin/Subscriptions', [
            'payments' => $payments,
            'filters' => ['status' => $status, 'search' => $search],
            'counts' => [
                'pending' => SubscriptionPayment::query()->where('status', 'pending')->whereNull('mobile_money_request_id')->count(),
                'expiring' => (clone $owners)->whereBetween('expires_at', [now(), now()->addDays(7)])->count(),
                'grace' => (clone $owners)->whereBetween('expires_at', [now()->subDays($graceDays), now()])->count(),
                'paused' => (clone $owners)->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '<', now()->subDays($graceDays)))->count(),
                'month_total' => (float) SubscriptionPayment::query()->where('status', 'approved')->where('reviewed_at', '>=', now()->startOfMonth())->sum('amount'),
            ],
            'monthlyPrice' => SubscriptionService::monthlyPrice(),
        ]);
    }

    public function approve(Request $request, SubscriptionPayment $payment): RedirectResponse
    {
        abort_unless($payment->status === SubscriptionPayment::PENDING && ! $payment->mobile_money_request_id, 409, 'This payment was already handled.');
        $payment = $this->subscriptions->approve($payment, $request->user());

        return back()->with('success', 'Approved. '.$payment->owner?->name.' is now paid until '.$payment->period_end?->format('j M Y').'.');
    }

    public function reject(Request $request, SubscriptionPayment $payment): RedirectResponse
    {
        abort_unless($payment->status === SubscriptionPayment::PENDING && ! $payment->mobile_money_request_id, 409, 'This payment was already handled.');
        $data = $request->validate(['reason' => ['required', 'string', 'max:250']], ['reason.required' => 'Tell the owner why the payment is not accepted.']);
        $this->subscriptions->reject($payment, $request->user(), $data['reason']);

        return back()->with('success', 'Rejected. The owner was told the reason by email and SMS.');
    }
}
