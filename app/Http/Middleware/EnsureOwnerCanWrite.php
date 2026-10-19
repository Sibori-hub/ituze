<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Owners that Q.R.A manages can look at everything about their properties but
 * change nothing: every write in the owner workspace is refused for them.
 */
class EnsureOwnerCanWrite
{
    /** A view-only owner can still sign out and look after their own account. */
    private const ALLOWED = [
        'logout', 'password.change.update', 'password.update', 'profile.update',
        'api.mobile.logout', 'api.mobile.password',
    ];

    public const MESSAGE = 'Your account is view-only. ITUZE GREEN PLATFORM manages changes to your properties. Please contact us for any change.';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isReadOnly() || $request->isMethodSafe() || $request->routeIs(...self::ALLOWED)) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => self::MESSAGE, 'read_only' => true], 403);
        }

        return back()->with('error', self::MESSAGE);
    }
}
