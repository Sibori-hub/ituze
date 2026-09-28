<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UnitImage extends Model
{
    protected $fillable = [
        'unit_id',
        'image_path',
        'is_cover',
    ];

    protected function casts(): array
    {
        return [
            'is_cover' => 'boolean',
        ];
    }

    public function unit()
    {
        return $this->belongsTo(Unit::class);
    }
}
