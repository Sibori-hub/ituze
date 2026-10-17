<?php

namespace App\Support;

/**
 * Account-holder identity numbers: a Rwandan NIDA number is exactly 16 digits,
 * a passport number is 6 to 20 letters and digits.
 */
class IdentityNumber
{
    public const PASSPORT_PATTERN = '/^[A-Z0-9]{6,20}$/';

    /**
     * Strip the spaces and dashes people type for readability; passports are upper-cased.
     */
    public static function normalize(?string $type, ?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return $type === 'passport'
            ? strtoupper(preg_replace('/[\s-]+/', '', $value) ?? '')
            : preg_replace('/\D+/', '', $value);
    }

    /**
     * @return array<int, string>
     */
    public static function rules(?string $type): array
    {
        return $type === 'passport'
            ? ['required', 'string', 'regex:'.self::PASSPORT_PATTERN]
            : ['required', 'digits:16'];
    }

    /**
     * @return array<string, string>
     */
    public static function messages(string $field = 'national_id'): array
    {
        return [
            "{$field}.required" => 'Please enter your NIDA or passport number.',
            "{$field}.digits" => 'A NIDA number has exactly 16 digits.',
            "{$field}.regex" => 'Enter a valid passport number (6 to 20 letters and numbers).',
        ];
    }
}
