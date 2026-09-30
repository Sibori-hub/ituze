<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Lease extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenancy_id',
        'uploaded_by',
        'reference_number',
        'payment_method',
        'payment_reference',
        'original_name',
        'path',
        'mime_type',
        'size',
        'notes',
    ];

    public function tenancy()
    {
        return $this->belongsTo(Tenancy::class);
    }

    public function uploadedBy()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
