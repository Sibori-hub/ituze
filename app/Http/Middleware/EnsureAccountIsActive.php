<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Cuts off an account the moment an administrator disables it, including
 * sessions and mobile tokens that were issued before the suspension.
 */
class EnsureAccountIsActive
{
    public const MESSAGE = 'This account has been disabled. Please contact ITUZE GREEN PLATFORM for more information.';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isDisabled()) {
            return $next($request);
        }

        $token = $user->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();

            return response()->json(['message' => self::MESSAGE], 403);
        }

        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => self::MESSAGE], 403);
        }

        return redirect()->route('login')->withErrors(['email' => self::MESSAGE]);
    }
}
