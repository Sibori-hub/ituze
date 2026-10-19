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
        abort_unless($request->user()->canAccessRoom($unit), 403);
        $unit->loadMissing('unitType');
        $isApartment = $unit->isApartmentAccommodation();

        $data = $request->validate([
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'check_in_time' => ['required_if:rent_frequency,daily', 'prohibited_unless:rent_frequency,daily', 'date_format:H:i'],
            'check_out_time' => ['required_if:rent_frequency,daily', 'prohibited_unless:rent_frequency,daily', 'date_format:H:i'],
            'monthly_rent' => ['required', 'numeric', 'decimal:0,2', 'gt:0'],
            'rent_frequency' => ['required', Rule::in($isApartment ? ['daily', 'monthly'] : ['monthly'])],
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
        $unit->loadMissing('unitType');
        $isApartment = $unit->isApartmentAccommodation();

        $data = $request->validate([
            'purpose' => ['required', Rule::in(['renewal', 'attachment'])],
            'start_date' => ['required_if:purpose,renewal', 'nullable', 'date'],
            'end_date' => ['required_if:purpose,renewal', 'nullable', 'date', 'after:start_date'],
            'monthly_rent' => ['required_if:purpose,renewal', 'nullable', 'numeric', 'decimal:0,2', 'gt:0'],
            'rent_frequency' => ['required_if:purpose,renewal', 'nullable', Rule::in($isApartment ? ['daily', 'monthly'] : ['monthly'])],
            'check_in_time' => ['required_if:rent_frequency,daily', 'prohibited_unless:rent_frequency,daily', 'date_format:H:i'],
            'check_out_time' => ['required_if:rent_frequency,daily', 'prohibited_unless:rent_frequency,daily', 'date_format:H:i'],
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
            'check_in_time' => $isRenewal ? ($data['check_in_time'] ?? null) : $tenancy->check_in_time,
            'check_out_time' => $isRenewal ? ($data['check_out_time'] ?? null) : $tenancy->check_out_time,
            'deposit_amount' => $tenancy->deposit_amount,
        ]));
    }

    private function authorizePropertyManager(Request $request, Property $property): void
    {
        $user = $request->user();
        abort_unless($user && in_array($user->role, ['admin', 'owner', 'manager'], true), 403);
        abort_unless($user->canAccessProperty($property), 403);
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
        abort_unless($request->user()->canAccessRoom($unit), 403);
    }
}
