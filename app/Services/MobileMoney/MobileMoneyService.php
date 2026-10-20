<?php

namespace App\Services\MobileMoney;

use App\Models\MobileMoneyRequest;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Sends payment requests to tenants' phones and keeps their status up to date.
 */
class MobileMoneyService
{
    public function gateway(): MobileMoneyGateway
    {
        return match (config('services.mobile_money.driver')) {
            'mtn' => app(MtnMomoGateway::class),
            'fake' => app(FakeGateway::class),
            default => throw new InvalidArgumentException('Unknown mobile money driver.'),
        };
    }

    /** 07XXXXXXXX, 7XXXXXXXX or +2507XXXXXXXX -> 2507XXXXXXXX. */
    public static function msisdn(string $phone): ?string
    {
        $digits = preg_replace('/\D/', '', $phone);
        if (str_starts_with($digits, '250')) {
            $digits = substr($digits, 3);
        }
        $digits = ltrim($digits, '0');

        return preg_match('/^7[2389]\d{7}$/', $digits) ? '250'.$digits : null;
    }

    public function start(User $user, ?Tenant $tenant, ?Unit $unit, string $phone, float $amount, string $message, string $purpose = 'assignment'): MobileMoneyRequest
    {
        $gateway = $this->gateway();
        $request = MobileMoneyRequest::create([
            'reference' => (string) Str::uuid(),
            'provider' => $gateway->name(),
            'purpose' => $purpose,
            'tenant_id' => $tenant?->id,
            'unit_id' => $unit?->id,
            'requested_by' => $user->id,
            'phone' => $phone,
            'amount' => $amount,
            'currency' => $gateway->currency(),
            'status' => MobileMoneyRequest::PENDING,
        ]);

        try {
            $gateway->requestToPay($request, $message);
        } catch (MobileMoneyException $e) {
            $request->update([
                'status' => MobileMoneyRequest::FAILED,
                'failure_reason' => $e->getMessage(),
                'completed_at' => now(),
            ]);
            throw $e;
        }

        return $request;
    }

    /**
     * Ask the provider for the result of a pending request. Callbacks only
     * trigger this check; the provider's own answer is what is trusted.
     */
    public function refresh(MobileMoneyRequest $request): MobileMoneyRequest
    {
        $result = $this->checkWithProvider($request);

        // A subscription is applied (or marked failed) as soon as the result is known.
        if ($result->purpose === 'subscription' && ! $result->isPending()) {
            app(\App\Services\SubscriptionService::class)->syncMobileMoney($result);
        }
        if ($result->purpose === 'ad_listings' && ! $result->isPending()) {
            app(\App\Services\AdvertisingService::class)->syncMobileMoney($result);
        }

        return $result;
    }

    private function checkWithProvider(MobileMoneyRequest $request): MobileMoneyRequest
    {
        if (! $request->isPending()) {
            return $request;
        }

        $result = $this->gateway()->status($request);

        return DB::transaction(function () use ($request, $result) {
            $locked = MobileMoneyRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();
            if (! $locked->isPending()) {
                return $locked;
            }

            if ($result['status'] === MobileMoneyRequest::SUCCESSFUL) {
                $locked->update([
                    'status' => MobileMoneyRequest::SUCCESSFUL,
                    'provider_transaction_id' => $result['transaction_id'] ?? $locked->reference,
                    'completed_at' => now(),
                ]);
            } elseif ($result['status'] === MobileMoneyRequest::FAILED) {
                $locked->update([
                    'status' => MobileMoneyRequest::FAILED,
                    'failure_reason' => $result['reason'] ?? 'The payment was not completed.',
                    'completed_at' => now(),
                ]);
            } elseif ($locked->created_at->diffInSeconds(now(), true) > (int) config('services.mobile_money.timeout_seconds', 180)) {
                $locked->update([
                    'status' => MobileMoneyRequest::EXPIRED,
                    'failure_reason' => 'The payment was not approved on the phone in time.',
                    'completed_at' => now(),
                ]);
            }

            return $locked;
        });
    }
}
