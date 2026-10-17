<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use App\Services\OtpService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    public function __construct(protected OtpService $otp)
    {
    }

    /**
     * Display the login view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => session('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     *
     * The password is only the first factor. When the account is not exempt we
     * hand the session back and park the account until a one-time code sent on
     * the *other* channel is confirmed.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $user = $request->user();

        if (! config('auth.email_otp_enabled') && ! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
        }

        if (config('auth.login_otp_enabled') && $this->needsOtp($user, $request->identifierType())) {
            return $this->startOtpChallenge($request, $user);
        }

        $request->session()->regenerate();

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect('/');
    }

    /**
     * Whether this account still has to clear the second factor.
     */
    protected function needsOtp(User $user, string $identifierType): bool
    {
        if (in_array($user->role, config('auth.login_otp_exempt_roles', []), true)) {
            return false;
        }

        return $this->otp->canReceiveOtp($user, $this->otp->loginOtpChannelFor($user, $identifierType));
    }

    /**
     * Send the code, drop the just-created session and park the account.
     */
    protected function startOtpChallenge(LoginRequest $request, User $user): RedirectResponse
    {
        $channel = $this->otp->loginOtpChannelFor($user, $request->identifierType());

        $this->otp->sendLoginOtp($user, $channel);

        $request->session()->put(LoginOtpController::SESSION_USER, $user->id);
        $request->session()->put(LoginOtpController::SESSION_CHANNEL, $channel);
        $request->session()->put(LoginOtpController::SESSION_REMEMBER, $request->boolean('remember'));

        Auth::guard('web')->logout();

        return redirect()->route('login.otp.notice');
    }
}
