<?php

namespace App\Http\Controllers;

use App\Models\MobileMoneyRequest;
use App\Models\Tenant;
use App\Models\Unit;
use App\Services\MobileMoney\MobileMoneyException;
use App\Services\MobileMoney\MobileMoneyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * "Request to pay": push the assignment payment to the tenant's phone and
 * follow it until they approve or decline.
 */
class MobileMoneyController extends Controller
{
    public function __construct(private readonly MobileMoneyService $mobileMoney)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'purpose' => ['nullable', 'in:assignment,renewal'],
            'tenant_id' => ['required', 'integer', 'exists:tenants,id'],
            'unit_id' => ['required', 'integer', 'exists:units,id'],
            'phone' => ['required', 'string', 'max:20'],
            // Renewal: the first month at the renewed rent, and the lease it renews.
            'monthly_rent' => ['required_if:purpose,renewal', 'nullable', 'numeric', 'gt:0'],
            'tenancy_id' => ['required_if:purpose,renewal', 'nullable', 'integer', 'exists:tenancies,id'],
        ]);
        $purpose = $data['purpose'] ?? 'assignment';

        $user = $request->user();
        $unit = Unit::with('property')->findOrFail($data['unit_id']);
        $tenant = Tenant::findOrFail($data['tenant_id']);
        abort_unless($user->canAccessRoom($unit), 403);
        abort_if($user->delegatedToManager($unit->property, $unit), 403, 'Your manager runs this unit. You can see everything here; the manager makes the changes.');
        $this->authorizeTenant($user, $tenant);

        $phone = MobileMoneyService::msisdn($data['phone']);
        if (! $phone) {
            throw ValidationException::withMessages(['phone' => 'Enter an MTN or Airtel number: 078, 079, 072 or 073 followed by 7 digits.']);
        }
        if ($purpose === 'renewal') {
            $tenancy = \App\Models\Tenancy::findOrFail($data['tenancy_id']);
            abort_unless($tenancy->tenant_id === $tenant->id && $tenancy->unit_id === $unit->id, 404);
            // The first month of the renewed lease.
            $amount = (float) $data['monthly_rent'];
        } else {
            if ($unit->rent_frequency === 'daily' || ! ((float) $unit->rent_amount > 0)) {
                throw ValidationException::withMessages(['unit_id' => 'Phone payment requests are for monthly rentals. For nightly stays, enter the transaction ID.']);
            }
            // Months 1–2 of rent plus a one-month security deposit (TenancyController::MINIMUM_MONTHS).
            $amount = (float) $unit->rent_amount * (TenancyController::MINIMUM_MONTHS + 1);
        }

        try {
            $payment = $this->mobileMoney->start(
                $user,
                $tenant,
                $unit,
                $phone,
                $amount,
                $purpose === 'renewal' ? 'ITUZE: first month of renewed lease, room '.$unit->unit_number : 'ITUZE: rent and deposit, room '.$unit->unit_number,
                $purpose,
            );
        } catch (MobileMoneyException $e) {
            throw ValidationException::withMessages(['phone' => $e->getMessage()]);
        }

        return response()->json(['request' => $payment->toClient()], 201);
    }

    public function show(Request $request, MobileMoneyRequest $mobileMoneyRequest): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isAdmin() || $mobileMoneyRequest->requested_by === $user->id, 404);

        return response()->json(['request' => $this->mobileMoney->refresh($mobileMoneyRequest)->toClient()]);
    }

    /**
     * Provider callback. The body is not trusted: it only prompts us to ask the
     * provider for the real status.
     */
    public function callback(string $reference): JsonResponse
    {
        $payment = MobileMoneyRequest::query()->where('reference', $reference)->first();
        if ($payment) {
            $this->mobileMoney->refresh($payment);
        }

        return response()->json(['received' => true]);
    }

    private function authorizeTenant($user, Tenant $tenant): void
    {
        if ($user->isAdmin()) {
            return;
        }

        $allowed = Tenant::query()->whereKey($tenant->id)->visibleTo($user)->exists();

        abort_unless($allowed, 404);
    }
}
