<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Advertisers used to pay before adding any building. Now they add a
 * property first and pay 25,000 RWF for that property (step 2); it stays off
 * the homepage until the payment is approved. Kept so the routes stay the same.
 */
class EnsureAdvertiserHasPaid
{
    public function handle(Request $request, Closure $next): Response
    {
        return $next($request);
    }
}
