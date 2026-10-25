<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The owner sets up buildings, floors, units and their prices. A manager
 * runs tenants, payments and utilities only, so these changes are refused.
 */
class EnsureOwnerBuilds
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_if($request->user()?->isManager(), 403, 'Only the owner can add or change buildings, floors, units and prices.');

        return $next($request);
    }
}
