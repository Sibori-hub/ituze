<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Tenant extends Model
{
    use HasFactory;

    protected $fillable = [
        'created_by',
        'type',
        'name',
        'first_name',
        'last_name',
        'gender',
        'marital_status',
        'company_name',
        'identity_type',
        'identity_number',
        'tax_identification_number',
        'registration_number',
        'contact_person',
        'email',
        'phone',
        'national_id',
        'address',
        'province_id',
        'district_id',
        'sector_id',
        'status',
    ];

    // File paths stay on the server; pages get links that check access.
    protected $hidden = ['photo', 'identity_document'];

    protected $appends = ['photo_url', 'identity_document_url'];

    public function getPhotoUrlAttribute(): ?string
    {
        return $this->photo ? route('tenants.files', [$this->id, 'photo']).'?v='.substr(md5($this->photo), 0, 8) : null;
    }

    public function getIdentityDocumentUrlAttribute(): ?string
    {
        return $this->identity_document ? route('tenants.files', [$this->id, 'identity-document']) : null;
    }

    public function province()
    {
        return $this->belongsTo(Province::class);
    }

    public function district()
    {
        return $this->belongsTo(District::class);
    }

    public function sector()
    {
        return $this->belongsTo(Sector::class);
    }

    /**
     * Tenants this account may see: everyone (admin), tenants it (or, for a
     * manager, its owner) added, and tenants renting rooms it can work on.
     */
    public function scopeVisibleTo($query, User $user)
    {
        if ($user->isAdmin()) {
            return $query;
        }
        // An owner also sees the tenants their managers added.
        $creators = $user->isManager()
            ? array_values(array_filter([$user->id, $user->employer_id]))
            : User::query()->select('id')->whereKey($user->id)->orWhere('employer_id', $user->id);

        return $query->where(fn ($inner) => $inner
            ->whereIn($query->qualifyColumn('created_by'), $creators)
            ->orWhereHas('tenancies.unit', fn ($room) => $room->visibleTo($user)));
    }

    public function tenancies()
    {
        return $this->hasMany(Tenancy::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function getDisplayNameAttribute(): string
    {
        if ($this->type === 'company') {
            return $this->company_name ?: $this->name;
        }

        return trim(($this->first_name ?: '') . ' ' . ($this->last_name ?: '')) ?: $this->name;
    }

    public function activeTenancies()
    {
        return $this->hasMany(Tenancy::class)->where('status', 'active');
    }
}
