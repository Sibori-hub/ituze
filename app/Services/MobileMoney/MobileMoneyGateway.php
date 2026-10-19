<?php

namespace App\Services\MobileMoney;

use App\Models\MobileMoneyRequest;

/**
 * A mobile money provider that can push a payment prompt to a payer's phone.
 */
interface MobileMoneyGateway
{
    /** Short name stored on each request ("fake", "mtn"). */
    public function name(): string;

    /** Currency the provider charges in (MTN's sandbox only accepts EUR). */
    public function currency(): string;

    /**
     * Send the prompt to the payer's phone.
     *
     * @throws MobileMoneyException when the provider refuses the request
     */
    public function requestToPay(MobileMoneyRequest $request, string $message): void;

    /**
     * Ask the provider for the current result.
     *
     * @return array{status: string, transaction_id?: ?string, reason?: ?string}
     *                status is one of MobileMoneyRequest::PENDING, SUCCESSFUL or FAILED
     */
    public function status(MobileMoneyRequest $request): array;
}
