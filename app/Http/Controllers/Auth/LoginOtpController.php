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
 * parked in the session and one code is sent to both the email address and
 * the WhatsApp number. Only a correct code promotes the visitor to a
 * logged-in session.
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

        return Inertia::render('Auth/VerifyLoginOtp', [
            'destinations' => $this->destinations($user, $this->pendingChannels($request, $user)),
            'expiresIn' => OtpService::secondsLeft($user, 'login_otp'),
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
                'email' => 'This account has been disabled. Please contact ITUZE GREEN PLATFORM for more information.',
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
     * Send a replacement code to the email address and WhatsApp number.
     */
    public function resend(Request $request): RedirectResponse
    {
        $user = $this->pendingUser($request);

        if (! $user) {
            return redirect()->route('login');
        }

        $channels = $this->otp->sendLoginOtp($user);
        $request->session()->put(self::SESSION_CHANNEL, $channels);

        return back()->with('status', 'We sent a new code to your email and by SMS.');
    }

    protected function pendingUser(Request $request): ?User
    {
        $id = $request->session()->get(self::SESSION_USER);

        return $id ? User::query()->find($id) : null;
    }

    /**
     * @return list<string>
     */
    protected function pendingChannels(Request $request, User $user): array
    {
        $channels = $request->session()->get(self::SESSION_CHANNEL);

        return is_array($channels) && $channels !== [] ? $channels : $this->otp->loginOtpChannels($user);
    }

    protected function clearPending(Request $request): void
    {
        $request->session()->forget([self::SESSION_USER, self::SESSION_CHANNEL, self::SESSION_REMEMBER]);
    }

    /**
     * Where the code went, masked so a shoulder-surfer learns little.
     *
     * @param  list<string>  $channels
     * @return list<array{channel: string, value: string}>
     */
    protected function destinations(User $user, array $channels): array
    {
        return array_map(fn (string $channel) => [
            'channel' => $channel,
            'value' => $channel === OtpService::CHANNEL_WHATSAPP
                ? $this->maskPhone($user->phone)
                : $this->maskEmail($user->email),
        ], $channels);
    }

    protected function maskPhone(?string $phone): string
    {
        if (! $phone || strlen($phone) < 6) {
            return 'your phone number';
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
