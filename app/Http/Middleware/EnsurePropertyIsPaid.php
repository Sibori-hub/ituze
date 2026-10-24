<?php

namespace App\Http\Middleware;

use App\Models\Property;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A self-registered owner's property is paid for while it is created; units,
 * rooms and tenants unlock once ITUZE approves that payment.
 */
class EnsurePropertyIsPaid
{
    public function handle(Request $request, Closure $next): Response
    {
        $property = $request->route('property');
        if (! $property instanceof Property) {
            $property = Property::query()->find($property);
        }

        if ($property && ! $property->loadMissing('owner')->subscriptionIsActive()) {
            $message = $property->subscriptionPayments()->where('status', 'pending')->exists()
                ? 'Your payment for "'.$property->name.'" is being checked by ITUZE. You can add units, rooms and tenants as soon as it is approved.'
                : 'Pay for "'.$property->name.'" first (100,000 RWF per month). Then you can add units, rooms and tenants.';

            return $request->expectsJson()
                ? response()->json(['message' => $message, 'errors' => ['subscription' => [$message]]], 422)
                : redirect()->route('properties.pay', $property)->with('error', $message);
        }

        return $next($request);
    }
}
