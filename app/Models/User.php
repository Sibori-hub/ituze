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
        'management_fee_percent',
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
            'must_change_password' => 'boolean',
            'management_fee_percent' => 'decimal:2',
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

    /**
     * Managed owners follow their properties but cannot change anything:
     * Q.R.A does all the work on their behalf.
     */
    public function isReadOnly(): bool
    {
        return $this->isOwner() && $this->isManaged();
    }

    /**
     * Share of collected rent Q.R.A keeps as its management fee (managed owners only).
     */
    public function managementFeeRate(): float
    {
        if (! $this->isOwner() || ! $this->isManaged()) {
            return 0.0;
        }

        return (float) ($this->management_fee_percent ?? 10);
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    /** Staff account a self-registered owner created to run some of their buildings. */
    public function isManager(): bool
    {
        return $this->role === 'manager';
    }

    /** The owner a manager works for. */
    public function employer()
    {
        return $this->belongsTo(User::class, 'employer_id')->withTrashed();
    }

    public function managers()
    {
        return $this->hasMany(User::class, 'employer_id')->where('role', 'manager');
    }

    public function managerAssignments()
    {
        return $this->hasMany(ManagerAssignment::class, 'manager_id');
    }

    /** Only self-registered owners hire their own managers; Q.R.A runs managed owners' buildings. */
    public function canHireManagers(): bool
    {
        return $this->isOwner() && ! $this->isManaged();
    }

    /** @var array{properties: list<int>, units: list<int>, unit_properties: list<int>}|null */
    private ?array $managerScopeCache = null;

    /**
     * What a manager was given: whole properties, single units, and the
     * properties those units belong to. Empty for everyone else.
     *
     * @return array{properties: list<int>, units: list<int>, unit_properties: list<int>}
     */
    public function managerScope(): array
    {
        if (! $this->isManager()) {
            return ['properties' => [], 'units' => [], 'unit_properties' => []];
        }

        if ($this->managerScopeCache === null) {
            // Only buildings the employer still owns count.
            $rows = $this->managerAssignments()
                ->whereHas('property', fn ($query) => $query->where('owner_id', $this->employer_id))
                ->get(['property_id', 'property_unit_id']);
            $this->managerScopeCache = [
                'properties' => $rows->whereNull('property_unit_id')->pluck('property_id')->map(fn ($id) => (int) $id)->unique()->values()->all(),
                'units' => $rows->whereNotNull('property_unit_id')->pluck('property_unit_id')->map(fn ($id) => (int) $id)->unique()->values()->all(),
                'unit_properties' => $rows->whereNotNull('property_unit_id')->pluck('property_id')->map(fn ($id) => (int) $id)->unique()->values()->all(),
            ];
        }

        return $this->managerScopeCache;
    }

    public function forgetManagerScope(): void
    {
        $this->managerScopeCache = null;
    }

    /** Can see this property (all of it, or some units of it for a manager). */
    public function canAccessProperty(Property $property): bool
    {
        if ($this->isAdmin()) {
            return true;
        }
        if ($this->isManager()) {
            $scope = $this->managerScope();

            return in_array($property->id, $scope['properties'], true) || in_array($property->id, $scope['unit_properties'], true);
        }

        return $property->owner_id === $this->id;
    }

    /** Can change the property itself (details, floors, new units): never a single-unit manager. */
    public function canManageWholeProperty(Property $property): bool
    {
        if ($this->isManager()) {
            return in_array($property->id, $this->managerScope()['properties'], true);
        }

        return $this->isAdmin() || $property->owner_id === $this->id;
    }

    /** Can work on this unit (category on a floor) and its rooms. */
    public function canAccessPropertyUnit(PropertyUnit $propertyUnit): bool
    {
        if ($this->isManager()) {
            $scope = $this->managerScope();

            return in_array($propertyUnit->property_id, $scope['properties'], true) || in_array($propertyUnit->id, $scope['units'], true);
        }

        return $this->isAdmin() || $propertyUnit->property?->owner_id === $this->id;
    }

    /** Can work on this room. */
    public function canAccessRoom(Unit $room): bool
    {
        if ($this->isManager()) {
            $scope = $this->managerScope();

            return in_array($room->property_id, $scope['properties'], true)
                || ($room->property_unit_id !== null && in_array((int) $room->property_unit_id, $scope['units'], true));
        }

        return $this->isAdmin() || $room->property?->owner_id === $this->id;
    }

    /** The owner a manager works for still exists, is approved, enabled and paid up. */
    public function employerWorkspaceIsActive(): bool
    {
        $employer = $this->employer;

        return $employer !== null
            && ! $employer->trashed()
            && ! $employer->isDisabled()
            && $employer->isApproved()
            && ! $employer->isExpired();
    }

    /** Owner whose buildings this account works on: itself, or a manager's employer. */
    public function workspaceOwnerId(): ?int
    {
        return $this->isManager() ? $this->employer_id : ($this->isOwner() ? $this->id : null);
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

        // A manager can work only while their owner's account is active.
        if ($this->isManager()) {
            return ! $this->employerWorkspaceIsActive();
        }

        // Managed owners pay a management fee on collected rent, not a subscription.
        if ($this->isManaged()) {
            return false;
        }

        // Blocked only once the grace days after the paid-until date have passed.
        return ! $this->expires_at || $this->subscriptionGraceEndsAt()->isPast();
    }

    /** An advertiser has paid for listings at least once (needed before adding buildings). */
    public function hasPaidForListings(): bool
    {
        return $this->isAdvertiser()
            && \App\Models\AdPurchase::query()->where('advertiser_id', $this->id)->where('status', \App\Models\AdPurchase::APPROVED)->exists();
    }

    /** Self-registered owners pay a monthly subscription. */
    public function paysSubscription(): bool
    {
        return $this->isOwner() && ! $this->isManaged();
    }

    /** Last moment of access: the paid-until date plus the grace days. */
    public function subscriptionGraceEndsAt(): ?\Illuminate\Support\Carbon
    {
        return $this->expires_at?->copy()->addDays((int) config('legal.owner_subscription_grace_days', 7));
    }

    /** Paid-until date has passed but the grace days have not. */
    public function inSubscriptionGrace(): bool
    {
        return $this->paysSubscription()
            && $this->expires_at !== null
            && $this->expires_at->isPast()
            && ! $this->subscriptionGraceEndsAt()->isPast();
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
     * Approval opens the account, but an owner uses the system only once the
     * first month (100,000 RWF) is paid on the Subscription page. Advertiser
     * billing arrives with the advertising module, so approval alone unlocks
     * their workspace.
     */
    public function approveAccount(): void
    {
        $this->update([
            'status' => 'approved',
            'expires_at' => null,
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
            'manager' => 'Manager',
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