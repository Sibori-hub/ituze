<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Accounts that received a temporary password from an administrator must
 * choose their own before using the platform.
 */
class EnsurePasswordIsChanged
{
    /** Routes that stay reachable while the temporary password is still in use. */
    private const ALLOWED = ['password.change', 'password.change.update', 'logout', 'api.mobile.password', 'api.mobile.me', 'api.mobile.logout'];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->must_change_password || $request->routeIs(...self::ALLOWED)) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Please change your temporary password before continuing.',
                'password_change_required' => true,
            ], 403);
        }

        return redirect()->route('password.change');
    }
}
