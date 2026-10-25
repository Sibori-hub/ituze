<?php

namespace App\Support;

use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * The personal details kept on every new tenant: gender, marital status, a
 * profile photo and a copy of the National ID or passport. Both files are
 * private (local disk) and are only streamed to accounts that can see the tenant.
 */
class TenantProfile
{
    public const GENDERS = ['female', 'male'];

    public const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'];

    /** Validation rules; $creating makes the details and both files required. */
    public static function rules(bool $creating): array
    {
        $required = $creating ? 'required_if:type,individual' : 'nullable';

        return [
            'gender' => [$required, 'nullable', 'in:'.implode(',', self::GENDERS)],
            'marital_status' => [$required, 'nullable', 'in:'.implode(',', self::MARITAL_STATUSES)],
            'photo' => [$creating ? 'required' : 'nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'identity_document' => [$creating ? 'required' : 'nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
        ];
    }

    public static function messages(): array
    {
        return [
            'gender.required_if' => 'Choose the tenant’s gender.',
            'marital_status.required_if' => 'Choose the tenant’s marital status.',
            'photo.required' => 'Add a profile photo of the tenant.',
            'photo.mimes' => 'The profile photo must be a JPG, PNG or WEBP image.',
            'photo.max' => 'The profile photo is too large. The maximum is 5 MB.',
            'identity_document.required' => 'Upload a photo or scan of the tenant’s ID or passport.',
            'identity_document.mimes' => 'The ID document must be a JPG, PNG, WEBP or PDF file.',
            'identity_document.max' => 'The ID document is too large. The maximum is 5 MB.',
        ];
    }

    /** Saves uploaded files on the tenant, replacing (and deleting) older ones. */
    public static function storeFiles(Request $request, Tenant $tenant): void
    {
        $changes = [];
        foreach (['photo', 'identity_document'] as $field) {
            if (! $request->hasFile($field)) {
                continue;
            }
            $old = $tenant->{$field};
            $changes[$field] = $request->file($field)->store("tenant-files/{$tenant->id}", 'local');
            if ($old) {
                Storage::disk('local')->delete($old);
            }
        }
        if ($changes) {
            $tenant->forceFill($changes)->save();
        }
    }

    /** Only these fields of the profile are written straight to the tenant row. */
    public static function details(array $data): array
    {
        $individual = ($data['type'] ?? 'individual') === 'individual';

        return [
            'gender' => $individual ? ($data['gender'] ?? null) : null,
            'marital_status' => $individual ? ($data['marital_status'] ?? null) : null,
        ];
    }
}
