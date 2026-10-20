<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * An advertiser works with buildings only after paying for their first
 * listing (25,000 RWF). Until then they only see their dashboard, where
 * they pay.
 */
class EnsureAdvertiserHasPaid
{
    public const MESSAGE = 'Pay for your first listing (25,000 RWF) to start adding your buildings.';

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isAdvertiser() || $user->hasPaidForListings()) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => self::MESSAGE, 'payment_required' => true], 402);
        }

        return redirect()->route('dashboard')->with('warning', self::MESSAGE);
    }
}
