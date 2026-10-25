<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Unit extends Model
{
    use HasFactory;

    protected $fillable = [
        'property_id',
        'property_unit_id',
        'unit_type_id',
        'unit_number',
        'floor_number',
        'rent_amount',
        'rent_frequency',
        'size_sqm',
        'bedrooms',
        'bathrooms',
        'description',
        'status',
    ];

    protected $casts = [
        'floor_number' => 'integer',
        'rent_amount' => 'decimal:2',
        'size_sqm' => 'decimal:2',
        'bedrooms' => 'integer',
        'bathrooms' => 'decimal:1',
    ];

    public function property()
    {
        return $this->belongsTo(Property::class);
    }

    /** Rooms this account may work on: a manager only gets the assigned properties and units. */
    public function scopeVisibleTo($query, User $user)
    {
        if ($user->isAdmin()) {
            return $query;
        }
        if ($user->isManager()) {
            $scope = $user->managerScope();

            return $query->where(fn ($inner) => $inner
                ->whereIn($query->qualifyColumn('property_id'), $scope['properties'] ?: [0])
                ->orWhereIn($query->qualifyColumn('property_unit_id'), $scope['units'] ?: [0]));
        }

        return $query->whereIn($query->qualifyColumn('property_id'), Property::query()->select('id')->where('owner_id', $user->id));
    }

    /**
     * The unit (category on a floor) this room belongs to.
     */
    /** Work lists: like visibleTo, but an admin only sees the owners Q.R.A manages. */
    public function scopeInWorkspaceOf($query, User $user)
    {
        return $query->visibleTo($user)->when($user->isAdmin(), fn ($inner) => $inner
            ->whereNotIn($query->qualifyColumn('property_id'), Property::query()->select('id')->whereIn('owner_id', User::selfRegisteredOwnerIds())));
    }

    public function propertyUnit()
    {
        return $this->belongsTo(PropertyUnit::class);
    }

    public function unitType()
    {
        return $this->belongsTo(UnitType::class);
    }

    public function isApartmentAccommodation(): bool
    {
        return UnitType::isResidentialName($this->unitType?->name);
    }

    public function images()
    {
        return $this->hasMany(UnitImage::class);
    }

    public function tenancies()
    {
        return $this->hasMany(Tenancy::class);
    }

    /**
     * Rooms shown to the public: marked available and not taken by a
     * current or upcoming tenancy.
     */
    public function scopePubliclyListed($query)
    {
        return $query->where('status', 'available')
            // An advertiser's building only while its paid listing runs.
            ->whereHas('property', fn ($property) => $property->where(fn ($inner) => $inner
                ->where('requires_listing', false)
                ->orWhere('listed_until', '>', now())))
            // A self-registered owner's property shows only while it is paid.
            ->whereHas('property', fn ($property) => $property->subscriptionActive())
            ->whereDoesntHave('activeTenancy')
            ->whereDoesntHave('scheduledTenancy');
    }

    public function activeTenancy()
    {
        return $this->hasOne(Tenancy::class)->where('status', 'active');
    }

    public function scheduledTenancy()
    {
        return $this->hasOne(Tenancy::class)
            ->where('status', 'scheduled')
            ->whereNull('renewed_from_id');
    }
}