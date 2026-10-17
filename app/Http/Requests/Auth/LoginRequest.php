<?php

namespace App\Http\Requests\Auth;

use Illuminate\Auth\Events\Lockout;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function ($validator) {
                $value = $this->rawIdentifier();

                if ($value === '') {
                    return;
                }

                if (!$this->looksLikeEmail($value) && !$this->looksLikePhone($value)) {
                    $validator->errors()->add(
                        'email',
                        'Enter the email address or Rwanda mobile number linked to your account.'
                    );
                }
            },
        ];
    }

    /**
     * Attempt to authenticate the request's credentials.
     *
     * @throws ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        $credentials = [
            $this->identifierType() === 'phone' ? 'phone' : 'email' => $this->identifier(),
            'password' => (string) $this->string('password'),
        ];

        if (!Auth::attempt($credentials, $this->boolean('remember'))) {
            RateLimiter::hit($this->throttleKey());

            throw ValidationException::withMessages([
                'email' => trans('auth.failed'),
            ]);
        }

        $user = Auth::user();

        if ($user && $user->isDisabled()) {
            Auth::guard('web')->logout();
            RateLimiter::hit($this->throttleKey());

            throw ValidationException::withMessages([
                'email' => 'This account has been disabled. Please contact support if you believe this is a mistake.',
            ]);
        }

        RateLimiter::clear($this->throttleKey());
    }

    /**
     * Whether the visitor signed in with an email address or a phone number.
     */
    public function identifierType(): string
    {
        return str_contains($this->rawIdentifier(), '@') ? 'email' : 'phone';
    }

    /**
     * The normalised value used to look the account up.
     */
    public function identifier(): string
    {
        $value = $this->rawIdentifier();

        return $this->identifierType() === 'phone'
            ? $this->normalizePhone($value)
            : Str::lower($value);
    }

    /**
     * Ensure the login request is not rate limited.
     *
     * @throws ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        if (!RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'email' => trans('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    /**
     * Get the rate limiting throttle key for the request.
     */
    public function throttleKey(): string
    {
        return Str::transliterate(Str::lower($this->rawIdentifier()) . '|' . $this->ip());
    }

    protected function rawIdentifier(): string
    {
        return trim((string) $this->string('email'));
    }

    protected function looksLikeEmail(string $value): bool
    {
        return filter_var($value, FILTER_VALIDATE_EMAIL) !== false;
    }

    protected function looksLikePhone(string $value): bool
    {
        $digits = preg_replace('/[\s\-()]/', '', $value) ?? '';

        return preg_match('/^(?:\+?250|0)?7[2389]\d{7}$/', $digits) === 1;
    }

    /**
     * Reduce +250781234567 / 250781234567 / 0781234567 to the stored local form.
     */
    protected function normalizePhone(string $value): string
    {
        $digits = preg_replace('/\D/', '', $value) ?? '';

        if (str_starts_with($digits, '250')) {
            $digits = substr($digits, 3);
        }

        if (str_starts_with($digits, '0')) {
            return $digits;
        }

        return '0' . $digits;
    }
}
