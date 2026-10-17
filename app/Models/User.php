<?php

namespace App\Models;

use App\Services\OtpService;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

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
        'sector_id',
        'profile_photo',
        'profile_completed',
        'created_by',
        'password',
        'terms_accepted_at',
        'terms_version',
        'terms_accepted_ip',
        'disabled_at',
        'disabled_reason',
        'status_before_disabled',
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
        'phone_otp',
        'login_otp',
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
            'phone_otp_expires_at' => 'datetime',
            'login_otp_expires_at' => 'datetime',
            'terms_accepted_at' => 'datetime',
            'disabled_at' => 'datetime',
            'expires_at' => 'datetime',
            'profile_completed' => 'boolean',
            'login_enabled' => 'boolean',
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

    /**
     * The administrator who created this account, when Q.R.A registered it.
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    /**
     * Created by an administrator for an owner or advertiser that Q.R.A manages,
     * rather than self-registered.
     */
    public function isManaged(): bool
    {
        return $this->created_by !== null;
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

        // Advertiser plans are part of the advertising module; approval alone
        // is enough to use the advertiser workspace for now.
        if ($this->isAdvertiser()) {
            return false;
        }

        return !$this->expires_at || $this->expires_at->isPast();
    }

    public function isOwner(): bool
    {
        return $this->role === 'owner';
    }

    public function isAdvertiser(): bool
    {
        return $this->role === 'advertiser';
    }

    /**
     * Owners and advertisers both get their own workspace; only the dashboard differs.
     */
    public function isAccountHolder(): bool
    {
        return $this->isOwner() || $this->isAdvertiser();
    }

    public function isDisabled(): bool
    {
        return $this->status === 'disabled' || $this->disabled_at !== null;
    }

    public function isPhoneVerified(): bool
    {
        return $this->phone_verified_at !== null;
    }

    /**
     * Whether a phone code is outstanding. Accounts created before phone
     * verification existed were never sent one and are not held back.
     */
    public function awaitingPhoneVerification(): bool
    {
        return ! $this->isAdmin() && ! $this->isPhoneVerified() && $this->phone_otp !== null;
    }

    /**
     * Owners get a one-year subscription; advertiser billing arrives with the
     * advertising module, so approval alone unlocks their workspace.
     */
    public function approveAccount(): void
    {
        $this->update([
            'status' => 'approved',
            'expires_at' => $this->isOwner() ? now()->addYear() : null,
        ]);
    }

    /**
     * True when the user accepted the revision of the Terms that is currently published.
     */
    public function hasAcceptedTerms(?string $version = null): bool
    {
        return $this->terms_accepted_at !== null
            && $this->terms_version === ($version ?? config('legal.terms_version'));
    }

    public function roleLabel(): string
    {
        return match ($this->role) {
            'admin' => 'Administrator',
            'advertiser' => 'Advertiser',
            default => 'Property Owner',
        };
    }

    /**
     * Override Laravel's default link-based verification email
     * with a 6-digit OTP code instead.
     */
    public function sendEmailVerificationNotification(): void
    {
        app(OtpService::class)->sendEmailVerificationOtp($this);
    }

    /**
     * Sign the account out everywhere: revoke mobile tokens and drop web sessions.
     */
    public function endAllSessions(): void
    {
        $this->tokens()->delete();

        if (config('session.driver') === 'database') {
            DB::table(config('session.table', 'sessions'))->where('user_id', $this->id)->delete();
        }
    }
}