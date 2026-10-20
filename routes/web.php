<?php

use App\Http\Controllers\Admin\ApprovalController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\LegalController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\ManagementController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ProfileCompletionController;
use App\Http\Controllers\PropertyController;
use App\Http\Controllers\UnitController;
use App\Http\Controllers\TenancyController;
use App\Http\Controllers\TenantController;
use App\Http\Controllers\PublicPropertyController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Public legal documents (linked from registration and the site footer).
Route::get('/terms', [LegalController::class, 'terms'])->name('legal.terms');
Route::get('/privacy', [LegalController::class, 'privacy'])->name('legal.privacy');

Route::get('/', function (\Illuminate\Http\Request $request) {
    $filters = $request->validate([
        'search' => ['nullable', 'string', 'max:120'],
        'category' => ['nullable', 'in:offices,apartments,coffee-shops,commercial-buildings,warehouses'],
        'province_id' => ['nullable', 'integer', 'exists:provinces,id'],
        'district_id' => ['nullable', 'integer', 'exists:districts,id'],
        'sector_id' => ['nullable', 'integer', 'exists:sectors,id'],
        'price_range' => ['nullable', 'regex:/^(any|under-500000|500000-1500000|1500000-5000000|5000000-plus)$/'],
    ]);

    $searchTerm = trim($filters['search'] ?? '');
    $category = $filters['category'] ?? null;
    $priceRange = $filters['price_range'] ?? 'any';
    $availableUnits = \App\Models\Unit::query()
        ->publiclyListed()
        ->when($category, fn ($query) => $query->whereHas('unitType', fn ($typeQuery) => $typeQuery->matchingFilter($category)))
            ->when($priceRange !== 'any', function ($query) use ($priceRange) {
                match ($priceRange) {
                    'under-500000' => $query->where('rent_amount', '<', 500000),
                    '500000-1500000' => $query->whereBetween('rent_amount', [500000, 1500000]),
                    '1500000-5000000' => $query->whereBetween('rent_amount', [1500000, 5000000]),
                    '5000000-plus' => $query->where('rent_amount', '>=', 5000000),
                    default => null,
                };
            })
        ->whereHas('property', function ($query) use ($filters, $searchTerm) {
            $query
                ->when(!empty($filters['province_id']), fn ($propertyQuery) => $propertyQuery->whereHas('cell.sector.district.province', fn ($locationQuery) => $locationQuery->whereKey($filters['province_id'])))
                ->when(!empty($filters['district_id']), fn ($propertyQuery) => $propertyQuery->whereHas('cell.sector.district', fn ($locationQuery) => $locationQuery->whereKey($filters['district_id'])))
                ->when(!empty($filters['sector_id']), fn ($propertyQuery) => $propertyQuery->whereHas('cell.sector', fn ($locationQuery) => $locationQuery->whereKey($filters['sector_id'])))
                ->when($searchTerm !== '', function ($propertyQuery) use ($searchTerm) {
                    $like = '%' . $searchTerm . '%';
                    $propertyQuery->where(function ($searchQuery) use ($like) {
                        $searchQuery
                            ->where('name', 'like', $like)
                            ->orWhere('address', 'like', $like)
                            ->orWhereHas('cell.sector', fn ($locationQuery) => $locationQuery->where('name', 'like', $like))
                            ->orWhereHas('cell.sector.district', fn ($locationQuery) => $locationQuery->where('name', 'like', $like))
                            ->orWhereHas('cell.sector.district.province', fn ($locationQuery) => $locationQuery->where('name', 'like', $like));
                    });
                });
        })
        ->with([
            'unitType',
            'images',
            'property.images',
            'property.cell.sector.district.province',
        ])
        ->latest();

    $units = \Inertia\Inertia::scroll(fn () => $availableUnits->paginate(12)->withQueryString());

    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'units' => $units,
        'propertyCategories' => [
            ['slug' => 'offices', 'name' => 'Offices'],
            ['slug' => 'apartments', 'name' => 'Apartments'],
            ['slug' => 'coffee-shops', 'name' => 'Coffee Shops'],
            ['slug' => 'commercial-buildings', 'name' => 'Commercial Buildings'],
            ['slug' => 'warehouses', 'name' => 'Warehouses'],
        ],
        'locations' => [
            'provinces' => \App\Models\Province::query()->orderBy('name')->get(['id', 'name']),
            'districts' => \App\Models\District::query()->orderBy('name')->get(['id', 'name', 'province_id']),
            'sectors' => \App\Models\Sector::query()->orderBy('name')->get(['id', 'name', 'district_id']),
        ],
        'searchFilters' => [
            'search' => $searchTerm,
            'category' => $filters['category'] ?? '',
            'province_id' => $filters['province_id'] ?? '',
            'district_id' => $filters['district_id'] ?? '',
            'sector_id' => $filters['sector_id'] ?? '',
            'price_range' => $priceRange,
            'active' => $request->filled('search')
                || $request->filled('category')
                || $request->filled('province_id')
                || $request->filled('district_id')
                || $request->filled('sector_id')
                || ($priceRange !== 'any'),
        ],
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

// Digital Asset Links: proves the ITUZE Android app belongs to this site (full-screen app).
Route::get('/.well-known/assetlinks.json', fn () => response()->json([[
    'relation' => ['delegate_permission/common.handle_all_urls'],
    'target' => [
        'namespace' => 'android_app',
        'package_name' => config('android.package'),
        'sha256_cert_fingerprints' => array_values(config('android.sha256_fingerprints')),
    ],
]], 200, [], JSON_UNESCAPED_SLASHES))->name('android.assetlinks');

Route::get('/spaces/{property}', [PublicPropertyController::class, 'show'])->name('public.properties.show');
Route::get('/spaces/{property}/units/{unit}', [PublicPropertyController::class, 'showUnit'])->name('public.units.show');
Route::post('/spaces/{property}/inquiries', [PublicPropertyController::class, 'inquire'])
    ->middleware('throttle:5,1')
    ->name('public.properties.inquiries.store');
Route::post('/inquiries/{inquiry}/read', [PublicPropertyController::class, 'markRead'])
    ->middleware(['auth', 'verified', 'profile.complete', 'owner.approved:owner,advertiser'])
    ->name('inquiries.read');

Route::get('/account/status', function (\Illuminate\Http\Request $request) {
    abort_unless(in_array($request->user()->role, ['owner', 'advertiser', 'manager'], true), 404);

    return Inertia::render('Account/Status', [
        'status' => $request->user()->status,
        'expired' => $request->user()->isExpired(),
        // A manager is paused while the owner they work for is inactive or unpaid.
        'managerPaused' => $request->user()->isManager() && ! $request->user()->employerWorkspaceIsActive(),
        'employerName' => $request->user()->isManager() ? $request->user()->employer?->name : null,
        'canPay' => $request->user()->paysSubscription() && $request->user()->status === 'approved',
        'neverPaid' => $request->user()->paysSubscription() && $request->user()->expires_at === null,
    ]);
})->middleware(['auth', 'verified'])->name('account.status');

Route::get('/dashboard', function (\Illuminate\Http\Request $request) {
    $user = $request->user();

    if ($user->isAdvertiser()) {
        return app(\App\Http\Controllers\AdvertiserController::class)->dashboard($request);
    }

    if ($user->isAdmin()) {
        $chartStart = now()->startOfMonth()->subMonths(5);
        $owners = \App\Models\User::query()->where('role', 'owner');
        // Only self-registered owners pay a subscription; Q.R.A-managed owners pay a fee on rent.
        $approvedOwners = (clone $owners)->where('status', 'approved')->whereNull('created_by');
        $activeSubscriptions = (clone $approvedOwners)
            ->whereNotNull('expires_at')
            ->where('expires_at', '>', now());
        $graceDays = (int) config('legal.owner_subscription_grace_days', 7);
        $approvedSubscriptionPayments = \App\Models\SubscriptionPayment::query()->where('status', 'approved');
        $pendingApprovals = (clone $owners)
            ->where('status', 'pending')
            ->where('profile_completed', true)
            ->whereNotNull('email_verified_at');
        $months = collect(range(0, 5))->map(fn ($offset) => $chartStart->copy()->addMonths($offset));
        $ownerGrowthByMonth = (clone $owners)
            ->where('created_at', '>=', $chartStart)
            ->get(['created_at'])
            ->groupBy(fn ($owner) => $owner->created_at->format('Y-m'))
            ->map->count();
        $rentCollectedByMonth = \App\Models\RentPayment::query()
            ->where('paid_at', '>=', $chartStart)
            ->whereHas('charge', fn ($query) => $query->where('charge_type', 'rent'))
            ->get(['amount', 'paid_at'])
            ->groupBy(fn ($payment) => $payment->paid_at->format('Y-m'))
            ->map(fn ($payments) => $payments->sum(fn ($payment) => (float) $payment->amount));
        $subscriptionsByMonth = (clone $approvedSubscriptionPayments)
            ->where('reviewed_at', '>=', $chartStart)
            ->get(['amount', 'reviewed_at'])
            ->groupBy(fn ($payment) => $payment->reviewed_at->format('Y-m'))
            ->map(fn ($payments) => $payments->sum(fn ($payment) => (float) $payment->amount));
        $adsByMonth = \App\Models\AdPurchase::query()->where('status', 'approved')->where('paid_at', '>=', $chartStart)
            ->get(['amount', 'paid_at'])
            ->groupBy(fn ($purchase) => $purchase->paid_at->format('Y-m'))
            ->map(fn ($purchases) => $purchases->sum(fn ($purchase) => (float) $purchase->amount));
        $activeTenancies = \App\Models\Tenancy::query()->where('status', 'active');
        $unitCounts = \App\Models\Unit::query()
            ->selectRaw('status, COUNT(*) as aggregate')
            ->whereHas('property')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        return Inertia::render('Dashboard', [
            'recentInquiries' => \App\Models\PropertyInquiry::query()
                ->with(['property:id,name', 'unit:id,unit_number', 'owner:id,name'])
                ->latest()
                ->take(20)
                ->get(),
            'adminOverview' => [
                'totalAccounts' => \App\Models\User::query()->count(),
                'totalOwners' => (clone $owners)->count(),
                'newOwnersThisMonth' => (clone $owners)->where('created_at', '>=', now()->startOfMonth())->count(),
                'pendingApprovals' => $pendingApprovals->count(),
                'activeSubscriptions' => $activeSubscriptions->count(),
                'expiredSubscriptions' => (clone $approvedOwners)
                    ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '<=', now()))
                    ->count(),
                'properties' => \App\Models\Property::query()->count(),
                'units' => \App\Models\Unit::query()->count(),
                'tenants' => \App\Models\Tenant::query()->count(),
                'leases' => \App\Models\Lease::query()->count(),
                'payments' => \App\Models\RentPayment::query()->count(),
                'newInquiries' => \App\Models\PropertyInquiry::query()->where('status', 'new')->count(),
                'occupancy' => [
                    'occupied' => (int) $unitCounts->get('occupied', 0),
                    'available' => (int) $unitCounts->get('available', 0),
                    'maintenance' => (int) $unitCounts->get('maintenance', 0),
                ],
                'ownerGrowth' => $months->map(fn ($month) => [
                    'month' => $month->format('Y-m'),
                    'count' => (int) $ownerGrowthByMonth->get($month->format('Y-m'), 0),
                ])->values(),
                'rentCollections' => $months->map(fn ($month) => [
                    'month' => $month->format('Y-m'),
                    'amount' => round((float) $rentCollectedByMonth->get($month->format('Y-m'), 0), 2),
                ])->values(),
                'rejectedOwners' => (clone $owners)->where('status', 'rejected')->count(),
                'subscriptionCollections' => $months->map(fn ($month) => [
                    'month' => $month->format('Y-m'),
                    'amount' => round((float) $subscriptionsByMonth->get($month->format('Y-m'), 0), 2),
                ])->values(),
                'adCollections' => $months->map(fn ($month) => [
                    'month' => $month->format('Y-m'),
                    'amount' => round((float) $adsByMonth->get($month->format('Y-m'), 0), 2),
                ])->values(),
                'advertisers' => \App\Models\User::query()->where('role', 'advertiser')->where('status', 'approved')->count(),
                'listedBuildings' => \App\Models\Property::query()->where('listed_until', '>', now())->count(),
                'leasesEndingSoon' => (clone $activeTenancies)->whereNotNull('end_date')
                    ->whereBetween('end_date', [today(), today()->addDays(\App\Http\Controllers\ManagementController::ENDING_SOON_DAYS)])->count(),
                'leasesExpired' => (clone $activeTenancies)->whereNotNull('end_date')->where('end_date', '<', today())->count(),
                'owners' => [
                    'managed' => (clone $owners)->whereNotNull('created_by')->where('status', 'approved')->count(),
                    'paying' => (clone $activeSubscriptions)->count(),
                    'grace' => (clone $approvedOwners)->whereBetween('expires_at', [now()->subDays($graceDays), now()])->count(),
                    'unpaid' => (clone $approvedOwners)->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '<', now()->subDays($graceDays)))->count(),
                    'pending' => $pendingApprovals->count(),
                    'managers' => \App\Models\User::query()->where('role', 'manager')->count(),
                ],
                'recentActivity' => \App\Models\ActivityLog::query()
                    ->with(['actor:id,name,role', 'property:id,name'])
                    ->latest('created_at')
                    ->latest('id')
                    ->take(8)
                    ->get()
                    ->map(fn ($log) => [
                        'id' => $log->id,
                        'at' => $log->created_at?->toIso8601String(),
                        'actor' => $log->actor?->name,
                        'role' => $log->actor?->role,
                        'description' => $log->description,
                        'amount' => $log->amount,
                    ]),
                'subscriptionMoney' => [
                    'month' => (float) (clone $approvedSubscriptionPayments)->where('reviewed_at', '>=', now()->startOfMonth())->sum('amount'),
                    'total' => (float) (clone $approvedSubscriptionPayments)->sum('amount'),
                    'payments_month' => (clone $approvedSubscriptionPayments)->where('reviewed_at', '>=', now()->startOfMonth())->count(),
                    'to_check' => \App\Models\SubscriptionPayment::query()->where('status', 'pending')->whereNull('mobile_money_request_id')->count(),
                    'paying_owners' => (clone $activeSubscriptions)->count(),
                    'overdue_owners' => (clone $approvedOwners)->whereBetween('expires_at', [now()->subDays($graceDays), now()])->count(),
                    'unpaid_owners' => (clone $approvedOwners)->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '<', now()->subDays($graceDays)))->count(),
                    'monthly_price' => (int) config('legal.owner_subscription_monthly_rwf', 100000),
                ],
            ],
        ]);
    }

    // Owners see their buildings; a manager only the rooms assigned to them.
    $rooms = fn ($query) => $user->isManager() ? $query->visibleTo($user) : $query;
    $properties = \App\Models\Property::query()
        ->visibleTo($user)
        ->with(['images'])
        ->withCount([
            'units' => $rooms,
            'units as occupied_units_count' => fn ($query) => $rooms($query)->where('status', 'occupied'),
            'units as available_units_count' => fn ($query) => $rooms($query)->where('status', 'available'),
            'units as maintenance_units_count' => fn ($query) => $rooms($query)->where('status', 'maintenance'),
        ])
        ->latest()
        ->get();

    $recentTenancies = \App\Models\Tenancy::with(['tenant', 'unit.property'])
        ->where('status', 'active')
        ->whereHas('unit', fn ($room) => $room->visibleTo($user))
        ->latest('start_date')
        ->take(5)
        ->get();

    $recentInquiries = \App\Models\PropertyInquiry::with(['property', 'unit'])
        ->whereIn('property_id', $properties->pluck('id'))
        ->latest()
        ->take(6)
        ->get();

    $totalUnits = $properties->sum('units_count');
    $occupiedUnits = $properties->sum('occupied_units_count');

    // The owner's figures for this month, from the same source as Reports.
    $portfolio = new \App\Services\PortfolioReport($user);
    $thisMonth = \App\Services\PortfolioReport::period('this_month');
    $overview = $portfolio->overview($thisMonth['from'], $thisMonth['to']);
    $arrears = $portfolio->arrears();
    $recentPayments = $portfolio->ownerStatements(now()->subMonthsNoOverflow(3)->startOfDay()->toImmutable(), today()->toImmutable())['lines'] ?? [];

    return Inertia::render('Dashboard', [
        'ownerReport' => [
            'is_manager' => $user->isManager(),
            'employer' => $user->isManager() ? $user->employer?->name : null,
            'managed' => $user->managementFeeRate() > 0,
            'fee_rate' => $user->managementFeeRate(),
            'month' => [
                'from' => $thisMonth['from']->toDateString(),
                'rent_collected' => $overview['rent_collected'],
                'commission' => $overview['commission'],
                'payout' => round($overview['rent_collected'] - $overview['commission'], 2),
                'deposits_received' => $overview['deposits_received'],
                'rent_expected' => $overview['rent_expected'],
                'collection_rate' => $overview['collection_rate'],
            ],
            'months' => array_slice($overview['months'], -6),
            'arrears' => ['total' => $arrears['totals']['total'], 'tenants' => $arrears['totals']['tenants'], 'rows' => array_slice($arrears['rows'], 0, 5)],
            'vacant_rent' => round((float) \App\Models\Unit::query()
                ->visibleTo($user)
                ->where('status', 'available')
                ->sum('rent_amount'), 2),
            'ending_soon' => \App\Models\Tenancy::query()
                ->with(['tenant:id,name', 'unit:id,property_id,unit_number', 'unit.property:id,name'])
                ->where('status', 'active')
                ->whereNotNull('end_date')
                ->whereBetween('end_date', [today(), today()->addDays(\App\Http\Controllers\ManagementController::ENDING_SOON_DAYS)])
                ->whereHas('unit', fn ($room) => $room->visibleTo($user))
                ->orderBy('end_date')
                ->take(5)
                ->get(['id', 'tenant_id', 'unit_id', 'end_date', 'monthly_rent']),
            'recent_payments' => array_slice(array_reverse($recentPayments), 0, 5),
        ],

        'summary' => [
            'properties' => $properties->count(),
            'units' => $totalUnits,
            'occupiedUnits' => $occupiedUnits,
            'availableUnits' => $properties->sum('available_units_count'),
            'maintenanceUnits' => $properties->sum('maintenance_units_count'),
            'occupancyRate' => $totalUnits ? round(($occupiedUnits / $totalUnits) * 100) : 0,
        ],
        'recentProperties' => $properties->take(4)->values(),
        'recentTenancies' => $recentTenancies,
        'recentInquiries' => $recentInquiries,
    ]);
})->middleware(['auth', 'verified', 'phone.verified', 'profile.complete', 'owner.approved'])->name('dashboard');

Route::middleware(['auth', 'profile.complete'])->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

Route::middleware('auth')->group(function () {
    Route::get('/complete-profile', function (\Illuminate\Http\Request $request) {
        return Inertia::render('Profile/Complete', [
            'registrationDetails' => $request->user()->only(['first_name', 'last_name', 'email', 'phone']),
            'locations' => [
                'provinces' => \App\Models\Province::query()->orderBy('name')->get(['id', 'name']),
                'districts' => \App\Models\District::query()->orderBy('name')->get(['id', 'name', 'province_id']),
                'sectors' => \App\Models\Sector::query()->orderBy('name')->get(['id', 'name', 'district_id']),
            ],
        ]);
    })->middleware(['verified', 'phone.verified'])->name('profile.complete');
    Route::post('/complete-profile', [ProfileCompletionController::class, 'store'])
        ->middleware(['verified', 'phone.verified'])
        ->name('profile.complete.store');

    Route::get('/api/provinces', [LocationController::class, 'provinces'])->name('api.provinces');
    Route::get('/api/districts/{province}', [LocationController::class, 'districts'])->name('api.districts');
    Route::get('/api/sectors/{district}', [LocationController::class, 'sectors'])->name('api.sectors');
    Route::get('/api/cells/{sector}', [LocationController::class, 'cells'])->name('api.cells');
    Route::get('/api/unit-types', function () {
        return response()->json(\App\Models\UnitType::all(['id', 'name']));
    })->name('api.unit-types');

    Route::get('/api/property-types', function () {
        return response()->json(\App\Models\PropertyType::all(['id', 'name']));
    })->name('api.property-types');

    // Property management routes (requires verified email and completed profile)
    // Advertisers manage their buildings and rooms here too; tenancy routes below stay owner-only.
    Route::middleware(['verified', 'profile.complete', 'owner.approved:owner,advertiser', 'advertiser.paid'])->prefix('properties')->name('properties.')->group(function () {
        Route::get('/', [PropertyController::class, 'index'])->name('index');
        Route::get('/create', [PropertyController::class, 'create'])->name('create');
        Route::post('/', [PropertyController::class, 'store'])->name('store');
        Route::get('/{property}', [PropertyController::class, 'show'])->name('show');
        Route::get('/{property}/edit', [PropertyController::class, 'edit'])->name('edit');
        Route::put('/{property}', [PropertyController::class, 'update'])->name('update');
        Route::delete('/{property}', [PropertyController::class, 'destroy'])->name('destroy');

        // Units: a category on one floor of the property; rooms are added inside them.
        Route::post('/{property}/property-units', [\App\Http\Controllers\PropertyUnitController::class, 'store'])->name('property-units.store');
        Route::post('/{property}/property-units/describe', [\App\Http\Controllers\AIDescriptionController::class, 'generateUnitDescription'])
            ->middleware('throttle:10,1')->name('property-units.describe');
        Route::put('/{property}/property-units/{propertyUnit}', [\App\Http\Controllers\PropertyUnitController::class, 'update'])->name('property-units.update');
        Route::delete('/{property}/property-units/{propertyUnit}', [\App\Http\Controllers\PropertyUnitController::class, 'destroy'])->name('property-units.destroy');

        // Rooms (stored as units; nested under properties)
        Route::prefix('{property}/units')->name('units.')->group(function () {
            Route::get('/', [UnitController::class, 'index'])->name('index');
            Route::get('/create', [UnitController::class, 'create'])->name('create');
            Route::post('/', [UnitController::class, 'store'])->name('store');
            Route::post('/describe', [\App\Http\Controllers\AIDescriptionController::class, 'generateRoomDescription'])
                ->middleware('throttle:10,1')->name('describe');
            Route::get('/{unit}', [UnitController::class, 'show'])->name('show');
            Route::get('/{unit}/edit', [UnitController::class, 'edit'])->name('edit');
            Route::put('/{unit}', [UnitController::class, 'update'])->name('update');
            Route::delete('/{unit}', [UnitController::class, 'destroy'])->name('destroy');
            Route::middleware('owner.approved:owner')->group(function () {
            Route::post('/{unit}/tenancy', [TenancyController::class, 'store'])->name('tenancy.store');
            Route::post('/{unit}/tenancy/lease-note', [\App\Http\Controllers\LeaseNoteGenerationController::class, 'forAssignment'])->name('tenancy.lease-notes.generate');
            Route::post('/{unit}/tenancy/{tenancy}/lease-note', [\App\Http\Controllers\LeaseNoteGenerationController::class, 'forTenancy'])->name('tenancy.lease-notes.generate-for-tenancy');
            Route::post('/{unit}/tenancy/{tenancy}/renewals', [TenancyController::class, 'renew'])->name('tenancy.renewals.store');
            Route::post('/{unit}/tenancy/{tenancy}/move-out', [TenancyController::class, 'moveOut'])->name('tenancy.move-out');
            Route::post('/{unit}/tenancy/{tenancy}/charges/{charge}/payments', [TenancyController::class, 'storePayment'])->name('tenancy.payments.store');
            Route::post('/{unit}/tenancy/{tenancy}/rent-payments', [TenancyController::class, 'storeRentPayment'])->name('tenancy.rent-payments.store');
            Route::post('/{unit}/tenancy/{tenancy}/leases', [TenancyController::class, 'uploadLease'])->name('tenancy.leases.store');
            Route::get('/{unit}/tenancy/{tenancy}/leases/{lease}', [TenancyController::class, 'downloadLease'])->name('tenancy.leases.download');
            Route::delete('/{unit}/tenancy/{tenancy}/leases/{lease}', [TenancyController::class, 'deleteLease'])->name('tenancy.leases.destroy');
            });
        });

        Route::post('/{property}/tenants', [TenancyController::class, 'storeTenant'])->middleware('owner.approved:owner')->name('tenants.store');
    });

    // Mobile money payment requests pushed to a tenant's phone.
    Route::middleware(['verified', 'profile.complete', 'owner.approved:owner'])->group(function () {
        Route::post('/mobile-money/requests', [\App\Http\Controllers\MobileMoneyController::class, 'store'])
            ->middleware('throttle:10,1')->name('mobile-money.requests.store');
        Route::get('/mobile-money/requests/{mobileMoneyRequest}', [\App\Http\Controllers\MobileMoneyController::class, 'show'])
            ->middleware('throttle:120,1')->name('mobile-money.requests.show');
    });

    Route::middleware(['verified', 'profile.complete', 'owner.approved:owner'])->get('/tenants', [TenantController::class, 'index'])->name('tenants.index');
    Route::middleware(['verified', 'profile.complete', 'owner.approved:owner'])->get('/tenants/{tenant}', [TenantController::class, 'show'])->name('tenants.show');
    Route::middleware(['verified', 'profile.complete', 'owner.approved:owner'])->post('/tenants', [TenantController::class, 'store'])->name('tenants.store');
    Route::middleware(['verified', 'profile.complete', 'owner.approved:owner'])->put('/tenants/{tenant}', [TenantController::class, 'update'])->name('tenants.update');
    Route::middleware(['verified', 'profile.complete', 'owner.approved:owner'])->group(function () {
        Route::get('/leases', [ManagementController::class, 'leases'])->name('leases.index');
        Route::get('/payments', [ManagementController::class, 'payments'])->name('payments.index');
        Route::get('/reports', [ManagementController::class, 'reports'])->name('reports.index');
        Route::get('/reports/export', [ManagementController::class, 'exportReport'])->middleware('throttle:20,1')->name('reports.export');

        // A self-registered owner's managers (admins can open any owner's team with ?owner_id).
        Route::get('/managers', [\App\Http\Controllers\ManagerController::class, 'index'])->name('managers.index');
        Route::post('/managers', [\App\Http\Controllers\ManagerController::class, 'store'])->name('managers.store');
        Route::put('/managers/{manager}', [\App\Http\Controllers\ManagerController::class, 'update'])->name('managers.update');
        Route::post('/managers/{manager}/password', [\App\Http\Controllers\ManagerController::class, 'setPassword'])->name('managers.password');
        Route::post('/managers/{manager}/disable', [\App\Http\Controllers\ManagerController::class, 'disable'])->name('managers.disable');
        Route::post('/managers/{manager}/enable', [\App\Http\Controllers\ManagerController::class, 'enable'])->name('managers.enable');
        Route::delete('/managers/{manager}', [\App\Http\Controllers\ManagerController::class, 'destroy'])->name('managers.destroy');
    });

    Route::post('/api/ai/generate-property-description', [\App\Http\Controllers\AIDescriptionController::class, 'generatePropertyDescription'])
        ->middleware(['verified', 'profile.complete', 'owner.approved:owner,advertiser', 'advertiser.paid', 'throttle:10,1'])
        ->name('api.ai.generate-property-description');
});

// Advertisers buy listings by mobile money and publish their buildings.
Route::middleware(['auth', 'verified', 'phone.verified', 'profile.complete', 'owner.approved:advertiser'])->prefix('advertising')->name('advertising.')->group(function () {
    Route::post('/purchases', [\App\Http\Controllers\AdvertiserController::class, 'startPurchase'])->middleware('throttle:6,1')->name('purchases.start');
    Route::get('/purchases/{purchase}', [\App\Http\Controllers\AdvertiserController::class, 'purchaseStatus'])->middleware('throttle:60,1')->name('purchases.status');
    Route::post('/properties/{property}/publish', [\App\Http\Controllers\AdvertiserController::class, 'publish'])->middleware('throttle:20,1')->name('publish');
});

// Self-registered owners pay here; open even while the account is paused for non-payment.
Route::middleware(['auth', 'verified', 'phone.verified', 'profile.complete'])->group(function () {
    Route::get('/subscription', [\App\Http\Controllers\SubscriptionController::class, 'show'])->name('subscription.show');
    Route::post('/subscription/transfer', [\App\Http\Controllers\SubscriptionController::class, 'storeTransfer'])->middleware('throttle:10,1')->name('subscription.transfer');
    Route::post('/subscription/mobile-money', [\App\Http\Controllers\SubscriptionController::class, 'startMobileMoney'])->middleware('throttle:6,1')->name('subscription.momo.start');
    Route::get('/subscription/mobile-money/{payment}', [\App\Http\Controllers\SubscriptionController::class, 'mobileMoneyStatus'])->middleware('throttle:60,1')->name('subscription.momo.status');
    Route::get('/subscription/payments/{payment}/proof', [\App\Http\Controllers\SubscriptionController::class, 'proof'])->name('subscription.proof');
});

Route::middleware(['auth', 'admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/subscriptions', [\App\Http\Controllers\Admin\SubscriptionPaymentController::class, 'index'])->name('subscriptions');
    Route::post('/subscriptions/{payment}/approve', [\App\Http\Controllers\Admin\SubscriptionPaymentController::class, 'approve'])->name('subscriptions.approve');
    Route::post('/subscriptions/{payment}/reject', [\App\Http\Controllers\Admin\SubscriptionPaymentController::class, 'reject'])->name('subscriptions.reject');
    Route::get('/approvals', [ApprovalController::class, 'index'])->name('approvals');
    Route::post('/approvals/{user}/approve', [ApprovalController::class, 'approve'])->name('approvals.approve');
    Route::post('/approvals/{user}/reject', [ApprovalController::class, 'reject'])->name('approvals.reject');

    Route::get('/users', [AdminUserController::class, 'index'])->name('users');
    Route::get('/users/create', [AdminUserController::class, 'create'])->name('users.create');
    Route::post('/users', [AdminUserController::class, 'store'])->name('users.store');
    Route::patch('/users/{user}/plan', [AdminUserController::class, 'updatePlan'])->name('users.plan');
    Route::post('/users/{user}/password', [AdminUserController::class, 'setPassword'])->name('users.password');
    Route::patch('/users/{user}/fee', [AdminUserController::class, 'updateFee'])->name('users.fee');
    Route::post('/users/{user}/disable', [AdminUserController::class, 'disable'])->name('users.disable');
    Route::post('/users/{user}/enable', [AdminUserController::class, 'enable'])->name('users.enable');
    Route::delete('/users/{user}', [AdminUserController::class, 'destroy'])->name('users.destroy');
    Route::get('/users/export/excel', [AdminUserController::class, 'exportExcel'])->name('users.export.excel');
    Route::get('/users/export/pdf', [AdminUserController::class, 'exportPdf'])->name('users.export.pdf');
});

if (app()->environment('local')) {
    Route::post('/dev/verify-email', function (\Illuminate\Http\Request $request) {
        $request->user()->markEmailAsVerified();

        return redirect()->route('dashboard');
    })->middleware('auth')->name('dev.verify-email');
}

require __DIR__.'/auth.php';