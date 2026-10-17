<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\OtpService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Second step of the sign-in flow.
 *
 * When a password checks out we do not hand over a session: the account is
 * parked in the session and a one-time code is delivered on the *other*
 * channel. Only a correct code promotes the visitor to a logged-in session.
 */
class LoginOtpController extends Controller
{
    public const SESSION_USER = 'login_otp.user_id';

    public const SESSION_CHANNEL = 'login_otp.channel';

    public const SESSION_REMEMBER = 'login_otp.remember';

    public function __construct(protected OtpService $otp)
    {
    }

    /**
     * Show the code entry screen for the parked account.
     */
    public function show(Request $request): RedirectResponse|Response
    {
        $user = $this->pendingUser($request);

        if (! $user) {
            return redirect()->route('login');
        }

        $channel = $this->pendingChannel($request);

        return Inertia::render('Auth/VerifyLoginOtp', [
            'channel' => $channel,
            'destination' => $this->maskedDestination($user, $channel),
            'expiresInMinutes' => OtpService::CODE_TTL_MINUTES,
            'status' => session('status'),
            // Local environments surface the code so the flow works without WhatsApp/SMTP.
            'devMode' => app()->environment('local'),
            'devOtp' => OtpService::developmentCode('login_otp'),
        ]);
    }

    /**
     * Exchange a valid code for a real session.
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'otp' => ['required', 'string', 'size:6'],
        ]);

        $user = $this->pendingUser($request);

        if (! $user) {
            return redirect()->route('login');
        }

        if ($user->isDisabled()) {
            $this->clearPending($request);

            return redirect()->route('login')->withErrors([
                'email' => 'This account has been disabled. Please contact support if you believe this is a mistake.',
            ]);
        }

        $result = $this->otp->verifyLoginOtp($user, $request->input('otp'));

        if ($result !== OtpService::VALID) {
            return back()->withErrors(['otp' => OtpService::failureMessage($result)]);
        }

        $remember = (bool) $request->session()->pull(self::SESSION_REMEMBER, false);
        $this->clearPending($request);

        Auth::guard('web')->login($user, $remember);
        $request->session()->regenerate();

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /**
     * Send a replacement code to the same channel.
     */
    public function resend(Request $request): RedirectResponse
    {
        $user = $this->pendingUser($request);

        if (! $user) {
            return redirect()->route('login');
        }

        $channel = $this->pendingChannel($request);

        $this->otp->sendLoginOtp($user, $channel);

        return back()->with('status', 'We sent a new code to '.$this->maskedDestination($user, $channel).'.');
    }

    protected function pendingUser(Request $request): ?User
    {
        $id = $request->session()->get(self::SESSION_USER);

        return $id ? User::query()->find($id) : null;
    }

    protected function pendingChannel(Request $request): string
    {
        return (string) $request->session()->get(self::SESSION_CHANNEL, OtpService::CHANNEL_EMAIL);
    }

    protected function clearPending(Request $request): void
    {
        $request->session()->forget([self::SESSION_USER, self::SESSION_CHANNEL, self::SESSION_REMEMBER]);
    }

    protected function maskedDestination(User $user, string $channel): string
    {
        if ($channel === OtpService::CHANNEL_WHATSAPP) {
            return $this->maskPhone($user->phone);
        }

        return $this->maskEmail($user->email);
    }

    protected function maskPhone(?string $phone): string
    {
        if (! $phone || strlen($phone) < 6) {
            return 'your WhatsApp number';
        }

        return substr($phone, 0, 3).'****'.substr($phone, -2);
    }

    protected function maskEmail(?string $email): string
    {
        if (! $email || ! str_contains($email, '@')) {
            return 'your email address';
        }

        [$name, $domain] = explode('@', $email, 2);
        $visible = substr($name, 0, 2);

        return $visible.str_repeat('*', max(1, strlen($name) - strlen($visible))).'@'.$domain;
    }
}
