<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A property, or a single unit of it, that an owner gave a manager to run.
 * property_unit_id null means the whole property.
 */
class ManagerAssignment extends Model
{
    protected $fillable = ['manager_id', 'property_id', 'property_unit_id'];

    public function manager()
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    public function property()
    {
        return $this->belongsTo(Property::class);
    }

    public function propertyUnit()
    {
        return $this->belongsTo(PropertyUnit::class);
    }
}
