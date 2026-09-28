<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProfileUpdateRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required_without_all:first_name,last_name', 'string', 'max:255'],
            'first_name' => ['required_without:name', 'string', 'max:255'],
            'last_name' => ['required_without:name', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'lowercase',
                'email',
                'max:255',
                Rule::unique(User::class)->ignore($this->user()->id),
            ],
            'phone' => ['sometimes', 'required', 'string', 'max:30'],
            'address' => ['sometimes', 'required', 'string', 'max:255'],
            'identity_document_type' => ['sometimes', 'required', 'in:nida,passport'],
            'national_id' => ['sometimes', 'required', 'string', 'max:20'],
            'sector_id' => ['sometimes', 'required', 'exists:sectors,id'],
            'profile_photo' => ['nullable', 'image', 'max:2048'],
        ];
    }
}
