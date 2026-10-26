<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdPurchase;
use App\Notifications\AdPurchaseDecision;
use App\Services\AdvertisingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admins check listing payments sent by MoMo Pay, bank transfer or cheque,
 * then approve them (the listings are added) or reject them with a reason.
 */
class AdPurchaseController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate(['status' => ['nullable', Rule::in(['pending', 'approved', 'rejected', 'all'])]]);
        $status = $filters['status'] ?? 'pending';

        return Inertia::render('Admin/AdPayments', [
            'status' => $status,
            'counts' => [
                'pending' => AdPurchase::query()->where('status', AdPurchase::PENDING)->whereNull('mobile_money_request_id')->count(),
                'approved' => AdPurchase::query()->where('status', AdPurchase::APPROVED)->count(),
                'rejected' => AdPurchase::query()->where('status', AdPurchase::REJECTED)->count(),
            ],
            'payments' => AdPurchase::query()->with(['advertiser:id,name,email,phone', 'reviewer:id,name', 'property:id,name'])
                ->when($status !== 'all', fn ($query) => $query->where('status', $status))
                ->when($status === 'pending', fn ($query) => $query->whereNull('mobile_money_request_id'))
                ->latest('id')->limit(100)->get()
                ->map(fn (AdPurchase $purchase) => [
                    'id' => $purchase->id,
                    'created_at' => $purchase->created_at?->toIso8601String(),
                    'advertiser' => $purchase->advertiser?->only(['id', 'name', 'email', 'phone']),
                    'property' => $purchase->property?->only(['id', 'name']),
                    'listings' => $purchase->listings,
                    'bonus' => $purchase->bonus,
                    'bonus_due' => $purchase->status === AdPurchase::PENDING && $purchase->advertiser ? AdvertisingService::bonusFor($purchase->advertiser) : 0,
                    'amount' => (float) $purchase->amount,
                    'method' => $purchase->method,
                    'reference' => $purchase->reference,
                    'sender_name' => $purchase->sender_name,
                    'sender_phone' => $purchase->sender_phone,
                    'bank_name' => $purchase->bank_name,
                    'account_number' => $purchase->account_number,
                    'sent_at' => $purchase->sent_at?->toIso8601String(),
                    'has_proof' => (bool) $purchase->proof_path,
                    'status' => $purchase->status,
                    'receipt_number' => $purchase->receipt_number,
                    'reviewer' => $purchase->reviewer?->name,
                    'reviewed_at' => $purchase->reviewed_at?->toIso8601String(),
                    'rejection_reason' => $purchase->rejection_reason,
                ]),
        ]);
    }

    public function approve(Request $request, AdPurchase $purchase, AdvertisingService $advertising): RedirectResponse
    {
        abort_unless($purchase->status === AdPurchase::PENDING && ! $purchase->mobile_money_request_id, 409, 'This payment is no longer waiting.');
        $advertising->approve($purchase, $request->user());

        return back()->with('success', 'Payment approved: the listings were added to '.$purchase->advertiser?->name.'.');
    }

    public function reject(Request $request, AdPurchase $purchase): RedirectResponse
    {
        abort_unless($purchase->status === AdPurchase::PENDING && ! $purchase->mobile_money_request_id, 409, 'This payment is no longer waiting.');
        $data = $request->validate(['reason' => ['required', 'string', 'max:255']], ['reason.required' => 'Say why, so the advertiser can fix it.']);
        $purchase->update(['status' => AdPurchase::REJECTED, 'rejection_reason' => trim($data['reason']), 'reviewed_by' => $request->user()->id, 'reviewed_at' => now()]);
        $purchase->advertiser?->notify(new AdPurchaseDecision($purchase, AdPurchaseDecision::REJECTED));

        return back()->with('success', 'Payment rejected. The advertiser was told why.');
    }
}
