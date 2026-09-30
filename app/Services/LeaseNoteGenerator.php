<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Http\Client\ConnectionException;

class LeaseNoteGenerator
{
    public function generate(array $context): array
    {
        $purpose = $context['purpose'];
        $frequency = $context['rent_frequency'];
        $systemPrompt = 'Write one concise, neutral administrative note for a rental lease document. Do not include names, addresses, property or unit identifiers, exact dates, or financial amounts. Do not give legal advice or invent facts. Keep it to one or two sentences.';
        $userPrompt = sprintf(
            "Document purpose: %s\nRent frequency: %s\nWrite a note suitable for a property manager's internal lease record.",
            match ($purpose) {
                'initial' => 'Initial lease',
                'renewal' => 'Lease renewal',
                default => 'Additional lease document or amendment',
            },
            $frequency,
        );

        $apiKey = config('services.openai.api_key');
        if (! $apiKey) {
            Log::warning('Lease note generation used a local template: OpenAI API key not configured.');

            return $this->withLeaseDetails($context, $this->template($purpose), 'template');
        }

        try {
            $response = Http::timeout(15)
                ->withToken($apiKey)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => config('services.openai.model', 'gpt-4o-mini'),
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => $userPrompt],
                    ],
                    'temperature' => 0.4,
                ]);
        } catch (ConnectionException $exception) {
            Log::warning('Lease note generation failed: OpenAI connection error.', [
                'error' => $exception->getMessage(),
            ]);

            return $this->withLeaseDetails($context, $this->template($purpose), 'template');
        }

        if (! $response->successful()) {
            Log::warning('Lease note generation failed: OpenAI returned status '.$response->status());

            return $this->withLeaseDetails($context, $this->template($purpose), 'template');
        }

        $note = trim((string) $response->json('choices.0.message.content'));
        if ($note === '') {
            Log::warning('Lease note generation failed: OpenAI returned empty content.');

            return $this->withLeaseDetails($context, $this->template($purpose), 'template');
        }

        return $this->withLeaseDetails($context, Str::limit($note, 500), 'llm');
    }

    private function template(string $purpose): string
    {
        return match ($purpose) {
            'initial' => 'This note summarizes the recorded terms for a newly created tenancy.',
            'renewal' => 'This note records a renewal of an existing tenancy under updated lease terms.',
            default => 'This note records an additional lease document or amendment attached to an existing tenancy.',
        };
    }

    private function withLeaseDetails(array $context, string $note, string $source): array
    {
        $period = match ($context['rent_frequency']) {
            'daily' => 'day',
            'weekly' => 'week',
            'monthly' => 'month',
            'quarterly' => 'quarter',
            'yearly' => 'year',
        };
        $details = [
            'Lease term: '.$context['start_date'].' to '.$context['end_date'],
            'Rent: '.number_format((float) $context['monthly_rent'], 2).' RWF per '.$period,
        ];

        if (isset($context['deposit_amount']) && (float) $context['deposit_amount'] > 0) {
            $details[] = 'Recorded deposit: '.number_format((float) $context['deposit_amount'], 2).' RWF';
        }

        return [
            'note' => $note."\n\n".implode("\n", $details),
            'source' => $source,
        ];
    }
}
