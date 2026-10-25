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
        'requires_listing',
        'paid_until',
    ];

    protected $casts = [
        'amenities' => 'array',
        'proximity' => 'array',
        'total_floors' => 'integer',
        'basement_floors' => 'integer',
        'listed_until' => 'datetime',
        'paid_until' => 'datetime',
        'requires_listing' => 'boolean',
    ];

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /** Self-registered owners pay for each property; managed owners and advertisers do not. */
    public function needsSubscription(): bool
    {
        return (bool) $this->owner?->paysSubscription();
    }

    /**
     * free (no subscription needed), unpaid (never paid), active, expiring
     * (7 days or less left), grace (ended, still working for the grace days)
     * or paused.
     */
    public function subscriptionState(): string
    {
        if (! $this->needsSubscription()) {
            return 'free';
        }
        if (! $this->paid_until) {
            return 'unpaid';
        }
        if ($this->paid_until->isFuture()) {
            return $this->paid_until->lte(now()->addDays(7)) ? 'expiring' : 'active';
        }

        return $this->paid_until->copy()->addDays(self::graceDays())->isFuture() ? 'grace' : 'paused';
    }

    /** Tenants, leases and the public listing need an active property. */
    public function subscriptionIsActive(): bool
    {
        return in_array($this->subscriptionState(), ['free', 'active', 'expiring', 'grace'], true);
    }

    public static function graceDays(): int
    {
        return (int) config('legal.owner_subscription_grace_days', 7);
    }

    /** Properties that may be used: not needing a subscription, or paid (grace included). */
    public function scopeSubscriptionActive($query)
    {
        return $query->where(fn ($inner) => $inner
            ->where($inner->qualifyColumn('paid_until'), '>', now()->subDays(self::graceDays()))
            ->orWhereHas('owner', fn ($owner) => $owner->where(fn ($free) => $free->where('role', '!=', 'owner')->orWhereNotNull('created_by'))));
    }

    public function subscriptionPayments()
    {
        return $this->hasMany(SubscriptionPayment::class);
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

    /**
     * Work lists (properties, tenants, leases, payments, reports, utilities):
     * like visibleTo, but an admin only sees the owners Q.R.A manages.
     */
    public function scopeInWorkspaceOf($query, User $user)
    {
        return $query->visibleTo($user)->when($user->isAdmin(), fn ($inner) => $inner
            ->whereNotIn($query->qualifyColumn('owner_id'), User::selfRegisteredOwnerIds()));
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
