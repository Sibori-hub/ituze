<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Sends a plain text SMS through the configured provider: "pindo" (Pindo,
 * Rwanda), "africastalking" (Africa's Talking) or "log" (default, writes the
 * message to the log only — used until a provider account is set up).
 */
class SmsService
{
    public function driver(): string
    {
        return (string) config('services.sms.driver', 'log');
    }

    /** True when a real provider is configured; "log" only records messages. */
    public function isLive(): bool
    {
        return match ($this->driver()) {
            'pindo' => filled(config('services.sms.pindo.token')),
            'africastalking' => filled(config('services.sms.africastalking.username')) && filled(config('services.sms.africastalking.api_key')),
            default => false,
        };
    }

    public function send(string $phone, string $message): void
    {
        $to = $this->toE164($phone);

        if (! $this->isLive()) {
            Log::info('SMS (not sent: no SMS provider configured)', ['to' => $to, 'message' => $message]);

            return;
        }

        $response = match ($this->driver()) {
            'pindo' => Http::withToken((string) config('services.sms.pindo.token'))
                ->acceptJson()
                ->timeout(15)
                ->post('https://api.pindo.io/v1/sms/', [
                    'to' => $to,
                    'text' => $message,
                    'sender' => (string) config('services.sms.pindo.sender', 'PindoTest'),
                ]),
            'africastalking' => Http::withHeaders(['apiKey' => (string) config('services.sms.africastalking.api_key')])
                ->acceptJson()
                ->asForm()
                ->timeout(15)
                ->post(
                    config('services.sms.africastalking.username') === 'sandbox'
                        ? 'https://api.sandbox.africastalking.com/version1/messaging'
                        : 'https://api.africastalking.com/version1/messaging',
                    array_filter([
                        'username' => (string) config('services.sms.africastalking.username'),
                        'to' => $to,
                        'message' => $message,
                        'from' => config('services.sms.africastalking.sender'),
                    ]),
                ),
        };

        if ($response->failed()) {
            throw new RuntimeException('SMS provider error '.$response->status().': '.mb_substr($response->body(), 0, 300));
        }
    }

    /** "0788 123 456", "788123456" or "250788123456" → "+250788123456". */
    public function toE164(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        $digits = str_starts_with($digits, '00') ? substr($digits, 2) : $digits;
        $country = ltrim((string) config('services.sms.default_country_code', '250'), '+');

        if (str_starts_with($digits, '0')) {
            $digits = $country.substr($digits, 1);
        } elseif (strlen($digits) === 9) {
            $digits = $country.$digits;
        }

        return '+'.$digits;
    }
}
