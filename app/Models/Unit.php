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

    /**
     * The unit (category on a floor) this room belongs to.
     */
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