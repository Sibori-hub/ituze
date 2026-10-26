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
Route::get('/sitemap.xml', \App\Http\Controllers\SitemapController::class)->name('sitemap');
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

// A fresh CSRF token (and XSRF cookie) for pages left open too long, e.g. on a phone.
Route::get('/csrf-token', fn (\Illuminate\Http\Request $request) => response()->json(['token' => $request->session()->token()])
    ->header('Cache-Control', 'no-store'))->name('csrf.token');

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
Route::get('/search/suggestions', \App\Http\Controllers\SearchSuggestionController::class)
    ->middleware('throttle:90,1,search-suggestions')
    ->name('search.suggestions');
Route::post('/contact', [\App\Http\Controllers\ContactMessageController::class, 'store'])
    ->middleware('throttle:10,10,contact-form')
    ->name('contact.store');
Route::post('/newsletter', [\App\Http\Controllers\NewsletterController::class, 'subscribe'])
    ->middleware('throttle:10,10,newsletter-form')
    ->name('newsletter.subscribe');
Route::get('/newsletter/confirm/{token}', [\App\Http\Controllers\NewsletterController::class, 'confirm'])
    ->middleware('throttle:20,1,newsletter-link')
    ->name('newsletter.confirm');
Route::get('/newsletter/unsubscribe/{token}', [\App\Http\Controllers\NewsletterController::class, 'unsubscribe'])
    ->middleware('throttle:20,1,newsletter-link')
    ->name('newsletter.unsubscribe');
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
        // Only rent of owners Q.R.A manages (10% fee): a self-registered owner's rent is
        // their own business and is followed privately on Admin > Owners.
        $rentCollectedByMonth = \App\Models\RentPayment::query()
            ->where('paid_at', '>=', $chartStart)
            ->whereHas('charge', fn ($query) => $query->where('charge_type', 'rent'))
            ->whereHas('charge.tenancy.unit.property.owner', fn ($query) => $query->whereNotNull('created_by'))
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
            'utilitySnapshot' => \App\Services\UtilityReport::snapshot($user),
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

    return Inertia::render('Dashboard', [
        'utilitySnapshot' => \App\Services\UtilityReport::snapshot($user),
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
            // Rent and the security deposit apart: a first payment holds both.
            'recent_payments' => $portfolio->recentPayments(5),
            // This month, building by building, with who runs each (the owner or a manager).
            'by_property' => $user->isManager() ? [] : $portfolio->byProperty($thisMonth['from'], $thisMonth['to']),
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
    Route::patch('/profile/momo-pay', [ProfileController::class, 'updateMomoPay'])->name('profile.momo-pay');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

Route::middleware('auth')->group(function () {
    Route::get('/complete-profile', function (\Illuminate\Http\Request $request) {
        return Inertia::render('Profile/Complete', [
            'registrationDetails' => $request->user()->only(['first_name', 'last_name', 'email', 'phone']),
            'needsTerms' => $request->user()->isManager() && ! $request->user()->terms_accepted_at,
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
        // Buildings, floors, units and prices are the owner's: managers only run tenants, payments and utilities.
        Route::get('/create', [PropertyController::class, 'create'])->middleware('owner.builds')->name('create');
        Route::post('/', [PropertyController::class, 'store'])->middleware('owner.builds')->name('store');
        Route::get('/{property}', [PropertyController::class, 'show'])->name('show');
        Route::get('/{property}/edit', [PropertyController::class, 'edit'])->middleware('owner.builds')->name('edit');
        Route::put('/{property}', [PropertyController::class, 'update'])->middleware('owner.builds')->name('update');
        Route::delete('/{property}', [PropertyController::class, 'destroy'])->middleware('owner.builds')->name('destroy');

        // Units: a category on one floor of the property; rooms are added inside them.
        // Paying for the property (step 2 of creating it); units, rooms and tenants unlock once approved.
        Route::get('/{property}/pay', [PropertyController::class, 'pay'])->name('pay');
        Route::post('/{property}/property-units', [\App\Http\Controllers\PropertyUnitController::class, 'store'])->middleware(['owner.builds', 'property.paid'])->name('property-units.store');
        Route::post('/{property}/property-units/describe', [\App\Http\Controllers\AIDescriptionController::class, 'generateUnitDescription'])
            ->middleware(['owner.builds', 'throttle:10,1'])->name('property-units.describe');
        Route::put('/{property}/property-units/{propertyUnit}', [\App\Http\Controllers\PropertyUnitController::class, 'update'])->middleware('owner.builds')->name('property-units.update');
        Route::delete('/{property}/property-units/{propertyUnit}', [\App\Http\Controllers\PropertyUnitController::class, 'destroy'])->middleware('owner.builds')->name('property-units.destroy');

        // Rooms (stored as units; nested under properties)
        Route::prefix('{property}/units')->name('units.')->group(function () {
            Route::get('/', [UnitController::class, 'index'])->name('index');
            Route::get('/create', [UnitController::class, 'create'])->middleware(['owner.builds', 'property.paid'])->name('create');
            Route::post('/', [UnitController::class, 'store'])->middleware(['owner.builds', 'property.paid'])->name('store');
            Route::post('/describe', [\App\Http\Controllers\AIDescriptionController::class, 'generateRoomDescription'])
                ->middleware(['owner.builds', 'throttle:10,1'])->name('describe');
            Route::get('/{unit}', [UnitController::class, 'show'])->name('show');
            Route::get('/{unit}/edit', [UnitController::class, 'edit'])->middleware('owner.builds')->name('edit');
            Route::put('/{unit}', [UnitController::class, 'update'])->middleware('owner.builds')->name('update');
            Route::delete('/{unit}', [UnitController::class, 'destroy'])->middleware('owner.builds')->name('destroy');
            Route::middleware('owner.approved:owner')->group(function () {
            Route::post('/{unit}/tenancy', [TenancyController::class, 'store'])->middleware('property.paid')->name('tenancy.store');
            Route::post('/{unit}/tenancy/lease-note', [\App\Http\Controllers\LeaseNoteGenerationController::class, 'forAssignment'])->name('tenancy.lease-notes.generate');
            Route::post('/{unit}/tenancy/{tenancy}/lease-note', [\App\Http\Controllers\LeaseNoteGenerationController::class, 'forTenancy'])->name('tenancy.lease-notes.generate-for-tenancy');
            Route::post('/{unit}/tenancy/{tenancy}/renewals', [TenancyController::class, 'renew'])->middleware('property.paid')->name('tenancy.renewals.store');
            Route::post('/{unit}/tenancy/{tenancy}/move-out', [TenancyController::class, 'moveOut'])->name('tenancy.move-out');
            Route::post('/{unit}/tenancy/{tenancy}/charges/{charge}/payments', [TenancyController::class, 'storePayment'])->name('tenancy.payments.store');
            Route::post('/{unit}/tenancy/{tenancy}/rent-payments', [TenancyController::class, 'storeRentPayment'])->name('tenancy.rent-payments.store');
            Route::post('/{unit}/tenancy/{tenancy}/leases', [TenancyController::class, 'uploadLease'])->name('tenancy.leases.store');
            Route::get('/{unit}/tenancy/{tenancy}/leases/{lease}', [TenancyController::class, 'downloadLease'])->name('tenancy.leases.download');
            Route::delete('/{unit}/tenancy/{tenancy}/leases/{lease}', [TenancyController::class, 'deleteLease'])->name('tenancy.leases.destroy');
            });
        });

        Route::post('/{property}/tenants', [TenancyController::class, 'storeTenant'])->middleware(['owner.approved:owner', 'property.paid'])->name('tenants.store');
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
    Route::middleware(['verified', 'profile.complete'])->get('/tenants/{tenant}/files/{file}', [TenantController::class, 'file'])->whereIn('file', ['photo', 'identity-document'])->name('tenants.files');
    Route::middleware(['verified', 'profile.complete'])->get('/rent-payments/{payment}/proof', [TenantController::class, 'paymentProof'])->name('rent-payments.proof');
    Route::middleware(['verified', 'profile.complete', 'owner.approved:owner'])->group(function () {
        Route::get('/leases', [ManagementController::class, 'leases'])->name('leases.index');
        Route::get('/payments', [ManagementController::class, 'payments'])->name('payments.index');
        Route::get('/reports', [ManagementController::class, 'reports'])->name('reports.index');
        Route::get('/reports/export', [ManagementController::class, 'exportReport'])->middleware('throttle:20,1')->name('reports.export');

        // Environmental and utility management (water, electricity, waste, green score).
        Route::get('/utilities', [\App\Http\Controllers\UtilityController::class, 'index'])->name('utilities.index');
        Route::post('/utilities/readings', [\App\Http\Controllers\UtilityController::class, 'storeReading'])->name('utilities.readings.store');
        Route::delete('/utilities/readings/{reading}', [\App\Http\Controllers\UtilityController::class, 'destroyReading'])->name('utilities.readings.destroy');
        Route::post('/utilities/waste-schedules', [\App\Http\Controllers\UtilityController::class, 'storeSchedule'])->name('utilities.schedules.store');
        Route::delete('/utilities/waste-schedules/{schedule}', [\App\Http\Controllers\UtilityController::class, 'destroySchedule'])->name('utilities.schedules.destroy');
        Route::post('/utilities/waste-collections', [\App\Http\Controllers\UtilityController::class, 'storeCollection'])->name('utilities.collections.store');
        Route::delete('/utilities/waste-collections/{collection}', [\App\Http\Controllers\UtilityController::class, 'destroyCollection'])->name('utilities.collections.destroy');

        // A self-registered owner's managers (admins can open any owner's team with ?owner_id).
        Route::get('/managers', [\App\Http\Controllers\ManagerController::class, 'index'])->name('managers.index');
        Route::post('/managers', [\App\Http\Controllers\ManagerController::class, 'store'])->name('managers.store');
        Route::put('/managers/{manager}', [\App\Http\Controllers\ManagerController::class, 'update'])->name('managers.update');
        Route::post('/managers/{manager}/password', [\App\Http\Controllers\ManagerController::class, 'setPassword'])->name('managers.password');
        Route::post('/managers/{manager}/disable', [\App\Http\Controllers\ManagerController::class, 'disable'])->name('managers.disable');
        Route::post('/managers/{manager}/enable', [\App\Http\Controllers\ManagerController::class, 'enable'])->name('managers.enable');
        Route::delete('/managers/{manager}', [\App\Http\Controllers\ManagerController::class, 'destroy'])->name('managers.destroy');
        Route::get('/managers/{manager}/identity', [\App\Http\Controllers\ManagerController::class, 'identityDocument'])->name('managers.identity-document');
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

// Chat with ITUZE support: open to every signed-in user, also while paused.
Route::middleware(['auth'])->group(function () {
    Route::get('/chat', [\App\Http\Controllers\ChatController::class, 'index'])->middleware('throttle:120,1,chat-read')->name('chat.index');
    Route::post('/chat', [\App\Http\Controllers\ChatController::class, 'store'])->middleware('throttle:30,1,chat-send')->name('chat.store');
    Route::get('/chat/files/{message}', [\App\Http\Controllers\ChatController::class, 'attachment'])->name('chat.attachment');
});

// Self-registered owners pay here; open even while the account is paused for non-payment.
Route::middleware(['auth', 'verified', 'phone.verified', 'profile.complete'])->group(function () {
    Route::get('/subscription', [\App\Http\Controllers\SubscriptionController::class, 'show'])->name('subscription.show');
    Route::post('/subscription/transfer', [\App\Http\Controllers\SubscriptionController::class, 'storeTransfer'])->middleware('throttle:10,1')->name('subscription.transfer');
    Route::post('/subscription/momo-pay', [\App\Http\Controllers\SubscriptionController::class, 'storeMomoPay'])->middleware('throttle:10,1,momo-pay')->name('subscription.momopay');
    Route::post('/subscription/mobile-money', [\App\Http\Controllers\SubscriptionController::class, 'startMobileMoney'])->middleware('throttle:6,1')->name('subscription.momo.start');
    Route::get('/subscription/mobile-money/{payment}', [\App\Http\Controllers\SubscriptionController::class, 'mobileMoneyStatus'])->middleware('throttle:60,1')->name('subscription.momo.status');
    Route::get('/subscription/payments/{payment}/proof', [\App\Http\Controllers\SubscriptionController::class, 'proof'])->name('subscription.proof');
});

Route::middleware(['auth', 'admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/subscriptions', [\App\Http\Controllers\Admin\SubscriptionPaymentController::class, 'index'])->name('subscriptions');
    Route::post('/subscriptions/{payment}/approve', [\App\Http\Controllers\Admin\SubscriptionPaymentController::class, 'approve'])->name('subscriptions.approve');
    Route::post('/subscriptions/{payment}/reject', [\App\Http\Controllers\Admin\SubscriptionPaymentController::class, 'reject'])->name('subscriptions.reject');
    Route::get('/chats', [\App\Http\Controllers\Admin\ChatController::class, 'index'])->name('chats');
    Route::get('/chats/list', [\App\Http\Controllers\Admin\ChatController::class, 'list'])->middleware('throttle:120,1,admin-chat-list')->name('chats.list');
    Route::get('/chats/{conversation}', [\App\Http\Controllers\Admin\ChatController::class, 'show'])->middleware('throttle:120,1,admin-chat-show')->name('chats.show');
    Route::post('/chats/{conversation}', [\App\Http\Controllers\Admin\ChatController::class, 'store'])->middleware('throttle:60,1,admin-chat-send')->name('chats.store');
    Route::get('/messages', [\App\Http\Controllers\Admin\ContactMessageController::class, 'index'])->name('messages');
    Route::patch('/messages/{message}', [\App\Http\Controllers\Admin\ContactMessageController::class, 'update'])->name('messages.update');
    Route::delete('/messages/{message}', [\App\Http\Controllers\Admin\ContactMessageController::class, 'destroy'])->name('messages.destroy');
    Route::get('/newsletter', [\App\Http\Controllers\Admin\NewsletterController::class, 'index'])->name('newsletter');
    Route::post('/newsletter/send', [\App\Http\Controllers\Admin\NewsletterController::class, 'send'])->middleware('throttle:5,1,newsletter-send')->name('newsletter.send');
    Route::get('/newsletter/export', [\App\Http\Controllers\Admin\NewsletterController::class, 'export'])->name('newsletter.export');
    Route::delete('/newsletter/subscribers/{subscriber}', [\App\Http\Controllers\Admin\NewsletterController::class, 'destroy'])->name('newsletter.destroy');
    Route::get('/approvals', [ApprovalController::class, 'index'])->name('approvals');
    Route::post('/approvals/{user}/approve', [ApprovalController::class, 'approve'])->name('approvals.approve');
    Route::post('/approvals/{user}/reject', [ApprovalController::class, 'reject'])->name('approvals.reject');
    Route::get('/approvals/{user}/identity', [ApprovalController::class, 'identityDocument'])->name('approvals.identity-document');

    // Private tracking of self-registered (SaaS) owners: read only.
    Route::get('/owners', [\App\Http\Controllers\Admin\OwnerTrackingController::class, 'index'])->name('owners');
    Route::get('/owners/{owner}', [\App\Http\Controllers\Admin\OwnerTrackingController::class, 'show'])->name('owners.show');

    Route::get('/users', [AdminUserController::class, 'index'])->name('users');
    Route::get('/users/create', [AdminUserController::class, 'create'])->name('users.create');
    Route::post('/users', [AdminUserController::class, 'store'])->name('users.store');
    Route::patch('/users/{user}/plan', [AdminUserController::class, 'updatePlan'])->name('users.plan');
    Route::post('/users/{user}/password', [AdminUserController::class, 'setPassword'])->name('users.password');
    Route::patch('/users/{user}/phone', [AdminUserController::class, 'updatePhone'])->name('users.phone');
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