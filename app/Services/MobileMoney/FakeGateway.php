<?php

namespace App\Services\MobileMoney;

use App\Models\MobileMoneyRequest;

/**
 * Test mode: no money moves. A request is approved a few seconds after it is
 * sent, so the waiting screen can be tried. Numbers ending in 0000 decline.
 */
class FakeGateway implements MobileMoneyGateway
{
    public function name(): string
    {
        return 'fake';
    }

    public function currency(): string
    {
        return 'RWF';
    }

    public function requestToPay(MobileMoneyRequest $request, string $message): void
    {
        // Nothing to send.
    }

    public function status(MobileMoneyRequest $request): array
    {
        if (str_ends_with($request->phone, '0000')) {
            return ['status' => MobileMoneyRequest::FAILED, 'reason' => 'The payer declined the request.'];
        }

        $delay = (int) config('services.mobile_money.fake_delay_seconds', 8);
        if ($request->created_at && $request->created_at->diffInSeconds(now(), true) < $delay) {
            return ['status' => MobileMoneyRequest::PENDING];
        }

        return [
            'status' => MobileMoneyRequest::SUCCESSFUL,
            'transaction_id' => 'TEST-'.strtoupper(substr(str_replace('-', '', $request->reference), 0, 10)),
        ];
    }
}
