<?php

namespace App\Models;

use App\Notifications\EmailVerificationOtp;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'first_name',
        'last_name',
        'name',
        'email',
        'phone',
        'role',
        'status',
        'expires_at',
        'national_id',
        'identity_document_type',
        'address',
        'sector_id',
        'profile_photo',
        'profile_completed',
        'created_by',
        'password',
        'email_otp',
        'email_otp_expires_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'email_otp',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'email_otp_expires_at' => 'datetime',
            'expires_at' => 'datetime',
            'profile_completed' => 'boolean',
            'password' => 'hashed',
        ];
    }

    public function properties()
    {
        return $this->hasMany(Property::class, 'owner_id');
    }

    public function assignedTenancies()
    {
        return $this->hasMany(Tenancy::class, 'assigned_by');
    }

    public function uploadedLeases()
    {
        return $this->hasMany(Lease::class, 'uploaded_by');
    }

    public function sector()
    {
        return $this->belongsTo(Sector::class);
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isApproved(): bool
    {
        return $this->isAdmin() || $this->status === 'approved';
    }

    public function isExpired(): bool
    {
        if ($this->isAdmin()) {
            return false;
        }

        return !$this->expires_at || $this->expires_at->isPast();
    }

    /**
     * Override Laravel's default link-based verification email
     * with a 6-digit OTP code instead.
     */
    public function sendEmailVerificationNotification(): void
    {
        $code = (string) random_int(100000, 999999);

        $this->forceFill([
            'email_otp' => $code,
            'email_otp_expires_at' => now()->addMinutes(10),
        ])->save();

        try {
            $this->notify(new EmailVerificationOtp($code));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Verification email could not be sent: ' . $e->getMessage());
        }
    }
}