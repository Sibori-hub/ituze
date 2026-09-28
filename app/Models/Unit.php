<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Unit extends Model
{
    use HasFactory;

    protected $fillable = [
        'property_id',
        'unit_type_id',
        'unit_number',
        'floor_number',
        'rent_amount',
        'rent_frequency',
        'size_sqm',
        'description',
        'status',
    ];

    protected $casts = [
        'floor_number' => 'integer',
        'rent_amount' => 'decimal:2',
        'size_sqm' => 'decimal:2',
    ];

    public function property()
    {
        return $this->belongsTo(Property::class);
    }

    public function unitType()
    {
        return $this->belongsTo(UnitType::class);
    }

    public function images()
    {
        return $this->hasMany(UnitImage::class);
    }

    public function tenancies()
    {
        return $this->hasMany(Tenancy::class);
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