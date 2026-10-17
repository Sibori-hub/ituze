<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class WhatsAppCloudService
{
    public function isConfigured(): bool
    {
        return (bool) config('services.whatsapp.phone_number_id')
            && (bool) config('services.whatsapp.access_token');
    }

    public function sendText(string $recipient, string $message): void
    {
        $this->send($recipient, [
            'type' => 'text',
            'text' => [
                'preview_url' => false,
                'body' => $message,
            ],
        ]);
    }

    /**
     * Deliver a one-time code. Uses the approved authentication template when one
     * is configured, otherwise a plain text message.
     */
    public function sendOtp(string $recipient, string $code, string $purpose): void
    {
        $template = config('services.whatsapp.otp_template');

        if (!$template) {
            $this->sendText(
                $recipient,
                "Your {$purpose} code is {$code}. It expires in 10 minutes. Never share this code with anyone."
            );

            return;
        }

        $components = [
            [
                'type' => 'body',
                'parameters' => [
                    ['type' => 'text', 'text' => $code],
                ],
            ],
        ];

        if (config('services.whatsapp.otp_template_has_button')) {
            $components[] = [
                'type' => 'button',
                'sub_type' => 'url',
                'index' => '0',
                'parameters' => [
                    ['type' => 'text', 'text' => $code],
                ],
            ];
        }

        $this->send($recipient, [
            'type' => 'template',
            'template' => [
                'name' => $template,
                'language' => ['code' => config('services.whatsapp.otp_template_language', 'en')],
                'components' => $components,
            ],
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    protected function send(string $recipient, array $payload): void
    {
        $phoneNumberId = config('services.whatsapp.phone_number_id');
        $token = config('services.whatsapp.access_token');
        $version = config('services.whatsapp.graph_version', 'v22.0');

        if (!$phoneNumberId || !$token) {
            throw new RuntimeException('WhatsApp Cloud API is not configured.');
        }

        $recipient = $this->toE164($recipient);

        if (!$recipient) {
            throw new RuntimeException('The WhatsApp recipient phone number is invalid.');
        }

        $response = Http::withToken($token)
            ->acceptJson()
            ->post("https://graph.facebook.com/{$version}/{$phoneNumberId}/messages", array_merge([
                'messaging_product' => 'whatsapp',
                'to' => $recipient,
            ], $payload));

        if ($response->failed()) {
            throw new RuntimeException('WhatsApp Cloud API returned an error: ' . $response->body());
        }
    }

    /**
     * Convert a local number such as 0781234567 into the E.164 form WhatsApp expects.
     */
    protected function toE164(string $phone): string
    {
        $digits = preg_replace('/[^\d]/', '', $phone) ?? '';

        if ($digits === '') {
            return '';
        }

        $countryCode = ltrim((string) config('services.whatsapp.default_country_code', '250'), '+');

        if (str_starts_with($digits, $countryCode)) {
            return $digits;
        }

        if (str_starts_with($digits, '0')) {
            return $countryCode . substr($digits, 1);
        }

        return $digits;
    }
}
