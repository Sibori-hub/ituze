<?php

namespace App\Http\Middleware;

use App\Models\Property;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * An admin works only on the buildings of owners Q.R.A manages. Buildings of
 * advertisers and of self-registered owners belong to them: an admin cannot
 * change them (no edit, units, floors, rentals, payments or leases there).
 */
class EnsureAdminWorksOnQraBuildings
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user?->isAdmin() || ! $this->changes($request)) {
            return $next($request);
        }

        $property = $request->route('property');
        $propertyId = $property instanceof Property ? $property->id : (is_numeric($property) ? (int) $property : null);
        if ($propertyId && Property::query()->whereKey($propertyId)->whereIn('owner_id', User::notRunByQraIds())->exists()) {
            abort(403, 'This property belongs to an advertiser or to an owner who runs it themselves. ITUZE does not change it.');
        }

        return $next($request);
    }

    /** Any write, and the pages that lead to one (forms). */
    private function changes(Request $request): bool
    {
        if (! $request->isMethodSafe()) {
            return true;
        }
        $name = (string) $request->route()?->getName();

        return str_ends_with($name, '.edit') || str_ends_with($name, '.create');
    }
}
