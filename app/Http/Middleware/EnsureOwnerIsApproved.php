<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOwnerIsApproved
{
    public function handle(Request $request, Closure $next, ?string $role = null): Response
    {
        $user = $request->user();

        if ($user->isAdmin()) {
            return $next($request);
        }

        abort_unless($user->isAccountHolder(), 403);

        // The owner workspace passes the role through the alias, e.g.
        // middleware('owner.approved:owner'), so advertisers are kept out.
        if ($role !== null) {
            abort_unless($user->role === $role, 403);
        }

        if (!$user->isApproved() || $user->isExpired()) {
            return redirect()->route('account.status');
        }

        return $next($request);
    }
}
