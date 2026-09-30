<?php

namespace App\Http\Controllers;

use App\Models\Property;
use App\Models\Tenancy;
use App\Models\Unit;
use App\Services\LeaseNoteGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LeaseNoteGenerationController extends Controller
{
    public function forAssignment(
        Request $request,
        Property $property,
        Unit $unit,
        LeaseNoteGenerator $generator,
    ): JsonResponse {
        $this->authorizePropertyManager($request, $property);
        abort_unless($unit->property_id === $property->id, 404);

        $data = $request->validate([
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'monthly_rent' => ['required', 'numeric', 'decimal:0,2', 'gt:0'],
            'rent_frequency' => ['required', Rule::in(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])],
            'deposit_amount' => ['nullable', 'numeric', 'decimal:0,2', 'min:0'],
        ]);

        return response()->json($generator->generate([
            'purpose' => 'initial',
            ...$data,
            'deposit_amount' => $data['deposit_amount'] ?? 0,
        ]));
    }

    public function forTenancy(
        Request $request,
        Property $property,
        Unit $unit,
        Tenancy $tenancy,
        LeaseNoteGenerator $generator,
    ): JsonResponse {
        $this->authorizeTenancyManager($request, $property, $unit, $tenancy);

        $data = $request->validate([
            'purpose' => ['required', Rule::in(['renewal', 'attachment'])],
            'start_date' => ['required_if:purpose,renewal', 'nullable', 'date'],
            'end_date' => ['required_if:purpose,renewal', 'nullable', 'date', 'after:start_date'],
            'monthly_rent' => ['required_if:purpose,renewal', 'nullable', 'numeric', 'decimal:0,2', 'gt:0'],
            'rent_frequency' => ['required_if:purpose,renewal', 'nullable', Rule::in(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])],
        ]);

        $isRenewal = $data['purpose'] === 'renewal';

        return response()->json($generator->generate([
            'purpose' => $data['purpose'],
            'start_date' => $isRenewal ? $data['start_date'] : $tenancy->start_date->toDateString(),
            'end_date' => $isRenewal
                ? $data['end_date']
                : ($tenancy->end_date?->toDateString() ?? 'Ongoing'),
            'monthly_rent' => $isRenewal ? $data['monthly_rent'] : $tenancy->monthly_rent,
            'rent_frequency' => $isRenewal ? $data['rent_frequency'] : $tenancy->rent_frequency,
            'deposit_amount' => $tenancy->deposit_amount,
        ]));
    }

    private function authorizePropertyManager(Request $request, Property $property): void
    {
        $user = $request->user();
        abort_unless($user && in_array($user->role, ['admin', 'owner'], true), 403);
        abort_unless($user->isAdmin() || $property->owner_id === $user->id, 403);
    }

    private function authorizeTenancyManager(
        Request $request,
        Property $property,
        Unit $unit,
        Tenancy $tenancy,
    ): void {
        $this->authorizePropertyManager($request, $property);
        abort_unless(
            $unit->property_id === $property->id && $tenancy->unit_id === $unit->id,
            404,
        );
    }
}
