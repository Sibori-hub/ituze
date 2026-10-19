<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A unit of a property: one category on one floor (e.g. Office · Floor 2).
 * The rentable rooms inside it live in the `units` table (model Unit).
 */
class PropertyUnit extends Model
{
    protected $fillable = [
        'property_id',
        'unit_type_id',
        'floor_number',
        'description',
    ];

    protected $casts = [
        'floor_number' => 'integer',
    ];

    public function property()
    {
        return $this->belongsTo(Property::class);
    }

    /** Units this account may work on. */
    public function scopeVisibleTo($query, User $user)
    {
        if ($user->isAdmin()) {
            return $query;
        }
        if ($user->isManager()) {
            $scope = $user->managerScope();

            return $query->where(fn ($inner) => $inner
                ->whereIn($query->qualifyColumn('property_id'), $scope['properties'] ?: [0])
                ->orWhereIn($query->qualifyColumn('id'), $scope['units'] ?: [0]));
        }

        return $query->whereIn($query->qualifyColumn('property_id'), Property::query()->select('id')->where('owner_id', $user->id));
    }

    public function unitType()
    {
        return $this->belongsTo(UnitType::class);
    }

    /**
     * The rentable rooms in this unit.
     */
    public function rooms()
    {
        return $this->hasMany(Unit::class, 'property_unit_id');
    }

    /**
     * "Ground floor", "Floor 2" or "Basement 1".
     */
    public static function floorLabel(int $floor): string
    {
        if ($floor === 0) {
            return 'Ground floor';
        }

        return $floor > 0 ? "Floor {$floor}" : 'Basement '.abs($floor);
    }
}
