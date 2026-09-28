<?php

namespace App\Services;

use App\Models\Sector;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TenantLocationService
{
    public function validationRules(Request $request): array
    {
        return [
            'province_id' => ['required', 'integer', 'exists:provinces,id'],
            'district_id' => [
                'required',
                'integer',
                Rule::exists('districts', 'id')->where('province_id', $request->input('province_id')),
            ],
            'sector_id' => [
                'required',
                'integer',
                Rule::exists('sectors', 'id')->where('district_id', $request->input('district_id')),
            ],
        ];
    }

    public function address(array $data): string
    {
        $sector = Sector::query()
            ->with('district.province')
            ->findOrFail($data['sector_id']);

        return implode(', ', [
            $sector->district->province->name,
            $sector->district->name,
            $sector->name,
        ]);
    }
}
