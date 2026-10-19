<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Property extends Model
{
    use HasFactory;

    protected $fillable = [
        'owner_id',
        'created_by',
        'cell_id',
        'name',
        'address',
        'description',
        'amenities',
        'proximity',
        'total_floors',
        'basement_floors',
    ];

    protected $casts = [
        'amenities' => 'array',
        'proximity' => 'array',
        'total_floors' => 'integer',
        'basement_floors' => 'integer',
    ];

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /** Properties this account may see: all (admin), its own (owner) or the assigned ones (manager). */
    public function scopeVisibleTo($query, User $user)
    {
        if ($user->isAdmin()) {
            return $query;
        }
        if ($user->isManager()) {
            $scope = $user->managerScope();

            return $query->whereIn($query->qualifyColumn('id'), array_values(array_unique([...$scope['properties'], ...$scope['unit_properties']])) ?: [0]);
        }

        return $query->where($query->qualifyColumn('owner_id'), $user->id);
    }

    public function cell()
    {
        return $this->belongsTo(Cell::class);
    }

    public function images()
    {
        return $this->hasMany(PropertyImage::class);
    }

    public function units()
    {
        return $this->hasMany(Unit::class);
    }

    /**
     * Units of the property: one category on one floor, each holding rooms.
     */
    public function propertyUnits()
    {
        return $this->hasMany(PropertyUnit::class)->orderBy('floor_number');
    }

    /**
     * Floor numbers from the lowest basement to the top floor (0 = ground).
     *
     * @return list<int>
     */
    public function floorNumbers(): array
    {
        return range(-1 * (int) $this->basement_floors, (int) $this->total_floors);
    }

    public function tenancies()
    {
        return $this->hasManyThrough(Tenancy::class, Unit::class);
    }

    public function inquiries()
    {
        return $this->hasMany(PropertyInquiry::class);
    }

    /**
     * The account that added the property (an admin, or the owner).
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }
}
