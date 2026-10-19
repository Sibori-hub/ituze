<?php

namespace App\Services\MobileMoney;

use App\Models\MobileMoneyRequest;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * MTN MoMo Collections API: "Request to Pay".
 * https://momodeveloper.mtn.com — the same calls work in the sandbox and live;
 * only the base URL, target environment, currency and keys change.
 */
class MtnMomoGateway implements MobileMoneyGateway
{
    public function name(): string
    {
        return 'mtn';
    }

    public function currency(): string
    {
        return (string) config('services.mobile_money.mtn.currency', 'EUR');
    }

    public function requestToPay(MobileMoneyRequest $request, string $message): void
    {
        $headers = ['X-Reference-Id' => $request->reference];
        // MTN only calls back over HTTPS; locally the status is polled instead.
        $callback = route('api.mobile-money.callback', $request->reference);
        if (str_starts_with($callback, 'https://')) {
            $headers['X-Callback-Url'] = $callback;
        }

        try {
            $response = $this->client()
                ->withToken($this->accessToken())
                ->withHeaders($headers)
                ->post('/collection/v1_0/requesttopay', [
                    'amount' => $this->amount($request->amount),
                    'currency' => $request->currency,
                    'externalId' => (string) $request->id,
                    'payer' => ['partyIdType' => 'MSISDN', 'partyId' => $request->phone],
                    'payerMessage' => mb_substr($message, 0, 160),
                    'payeeNote' => mb_substr($message, 0, 160),
                ]);
        } catch (ConnectionException $e) {
            throw new MobileMoneyException('MTN MoMo could not be reached. Check the internet connection and try again.', 0, $e);
        }

        if ($response->status() !== 202) {
            Log::warning('MTN MoMo request to pay refused', ['status' => $response->status(), 'body' => $response->body()]);
            throw new MobileMoneyException('MTN MoMo refused the request ('.$response->status().'). Check the number and try again.');
        }
    }

    public function status(MobileMoneyRequest $request): array
    {
        try {
            $response = $this->client()
                ->withToken($this->accessToken())
                ->get('/collection/v1_0/requesttopay/'.$request->reference);
        } catch (ConnectionException) {
            return ['status' => MobileMoneyRequest::PENDING];
        }

        if (! $response->successful()) {
            return ['status' => MobileMoneyRequest::PENDING];
        }

        $reason = $response->json('reason');

        return match (strtoupper((string) $response->json('status'))) {
            'SUCCESSFUL' => ['status' => MobileMoneyRequest::SUCCESSFUL, 'transaction_id' => $response->json('financialTransactionId')],
            'FAILED', 'REJECTED', 'TIMEOUT' => ['status' => MobileMoneyRequest::FAILED, 'reason' => is_array($reason) ? ($reason['message'] ?? $reason['code'] ?? null) : $reason],
            default => ['status' => MobileMoneyRequest::PENDING],
        };
    }

    /** Collection access token, cached until shortly before it expires. */
    private function accessToken(): string
    {
        $config = config('services.mobile_money.mtn');
        if (empty($config['subscription_key']) || empty($config['api_user']) || empty($config['api_key'])) {
            throw new MobileMoneyException('MTN MoMo is not set up yet. Add the subscription key, API user and API key.');
        }

        return Cache::remember('mtn-momo.collection-token.'.md5($config['api_user']), now()->addMinutes(50), function () use ($config) {
            $response = Http::baseUrl($config['base_url'])
                ->timeout(15)
                ->withBasicAuth($config['api_user'], $config['api_key'])
                ->withHeaders(['Ocp-Apim-Subscription-Key' => $config['subscription_key']])
                ->post('/collection/token/');

            $token = $response->json('access_token');
            if (! $response->successful() || ! $token) {
                Log::warning('MTN MoMo token request failed', ['status' => $response->status()]);
                throw new MobileMoneyException('MTN MoMo did not accept the API keys.');
            }

            return $token;
        });
    }

    private function client(): PendingRequest
    {
        $config = config('services.mobile_money.mtn');

        return Http::baseUrl($config['base_url'])
            ->timeout(20)
            ->acceptJson()
            ->withHeaders([
                'X-Target-Environment' => $config['environment'],
                'Ocp-Apim-Subscription-Key' => (string) $config['subscription_key'],
            ]);
    }

    /** MTN expects the amount as a string without decimals for whole numbers. */
    private function amount(string|float $amount): string
    {
        $value = (float) $amount;

        return floor($value) == $value ? (string) (int) $value : number_format($value, 2, '.', '');
    }
}
