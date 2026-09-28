<?php

use App\Http\Controllers\Admin\ApprovalController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
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

Route::get('/', function (\Illuminate\Http\Request $request) {
    $filters = $request->validate([
        'search' => ['nullable', 'string', 'max:120'],
        'category' => ['nullable', 'in:offices,apartments,coffee-shops,commercial-buildings,warehouses'],
        'province_id' => ['nullable', 'integer', 'exists:provinces,id'],
        'district_id' => ['nullable', 'integer', 'exists:districts,id'],
        'sector_id' => ['nullable', 'integer', 'exists:sectors,id'],
        'price_range' => ['nullable', 'regex:/^(any|under-500000|500000-1500000|1500000-5000000|5000000-plus)$/'],
    ]);

    $categoryTypeNames = [
        'offices' => ['Office'],
        'apartments' => ['Apartment', 'Studio', '1 Bedroom', '2 Bedrooms', '3 Bedrooms', '4+ Bedrooms'],
        'coffee-shops' => ['Coffee Shop'],
        'commercial-buildings' => ['Commercial Building', 'Commercial Space', 'Shop'],
        'warehouses' => ['Warehouse'],
    ];
    $searchTerm = trim($filters['search'] ?? '');
    $categoryTypes = $categoryTypeNames[$filters['category'] ?? ''] ?? [];
    $priceRange = $filters['price_range'] ?? 'any';
    $availableUnits = \App\Models\Unit::query()
        ->where('status', 'available')
        ->when($categoryTypes, fn ($query) => $query->whereHas('unitType', fn ($typeQuery) => $typeQuery->whereIn('name', $categoryTypes)))
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

Route::get('/spaces/{property}', [PublicPropertyController::class, 'show'])->name('public.properties.show');
Route::get('/spaces/{property}/units/{unit}', [PublicPropertyController::class, 'showUnit'])->name('public.units.show');
Route::post('/spaces/{property}/inquiries', [PublicPropertyController::class, 'inquire'])->name('public.properties.inquiries.store');
Route::post('/inquiries/{inquiry}/read', [PublicPropertyController::class, 'markRead'])
    ->middleware(['auth', 'verified', 'profile.complete', 'owner.approved'])
    ->name('inquiries.read');

Route::get('/account/status', function (\Illuminate\Http\Request $request) {
    abort_unless($request->user()->role === 'owner', 404);

    return Inertia::render('Account/Status', [
        'status' => $request->user()->status,
        'expired' => $request->user()->isExpired(),
    ]);
})->middleware(['auth', 'verified'])->name('account.status');

Route::get('/dashboard', function (\Illuminate\Http\Request $request) {
    $user = $request->user();
    $properties = \App\Models\Property::query()
        ->when(!$user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id))
        ->with(['images'])
        ->withCount([
            'units',
            'units as occupied_units_count' => fn ($query) => $query->where('status', 'occupied'),
            'units as available_units_count' => fn ($query) => $query->where('status', 'available'),
            'units as maintenance_units_count' => fn ($query) => $query->where('status', 'maintenance'),
        ])
        ->latest()
        ->get();

    $recentTenancies = \App\Models\Tenancy::with(['tenant', 'unit.property'])
        ->where('status', 'active')
        ->when(!$user->isAdmin(), fn ($query) => $query->whereHas('unit.property', fn ($property) => $property->where('owner_id', $user->id)))
        ->latest('start_date')
        ->take(5)
        ->get();

    $recentInquiries = \App\Models\PropertyInquiry::with(['property', 'unit'])
        ->when(!$user->isAdmin(), fn ($query) => $query->where('owner_id', $user->id))
        ->latest()
        ->take(6)
        ->get();

    $totalUnits = $properties->sum('units_count');
    $occupiedUnits = $properties->sum('occupied_units_count');

    return Inertia::render('Dashboard', [
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
})->middleware(['auth', 'verified', 'profile.complete', 'owner.approved'])->name('dashboard');

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
    })->middleware('verified')->name('profile.complete');
    Route::post('/complete-profile', [ProfileCompletionController::class, 'store'])
        ->middleware('verified')
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
    Route::middleware(['verified', 'profile.complete', 'owner.approved'])->prefix('properties')->name('properties.')->group(function () {
        Route::get('/', [PropertyController::class, 'index'])->name('index');
        Route::get('/create', [PropertyController::class, 'create'])->name('create');
        Route::post('/', [PropertyController::class, 'store'])->name('store');
        Route::get('/{property}', [PropertyController::class, 'show'])->name('show');
        Route::get('/{property}/edit', [PropertyController::class, 'edit'])->name('edit');
        Route::put('/{property}', [PropertyController::class, 'update'])->name('update');
        Route::delete('/{property}', [PropertyController::class, 'destroy'])->name('destroy');

        // Unit management routes (nested under properties)
        Route::prefix('{property}/units')->name('units.')->group(function () {
            Route::get('/', [UnitController::class, 'index'])->name('index');
            Route::get('/create', [UnitController::class, 'create'])->name('create');
            Route::post('/', [UnitController::class, 'store'])->name('store');
            Route::get('/{unit}', [UnitController::class, 'show'])->name('show');
            Route::get('/{unit}/edit', [UnitController::class, 'edit'])->name('edit');
            Route::put('/{unit}', [UnitController::class, 'update'])->name('update');
            Route::delete('/{unit}', [UnitController::class, 'destroy'])->name('destroy');
            Route::post('/{unit}/tenancy', [TenancyController::class, 'store'])->name('tenancy.store');
            Route::post('/{unit}/tenancy/{tenancy}/renewals', [TenancyController::class, 'renew'])->name('tenancy.renewals.store');
            Route::post('/{unit}/tenancy/{tenancy}/move-out', [TenancyController::class, 'moveOut'])->name('tenancy.move-out');
            Route::post('/{unit}/tenancy/{tenancy}/charges/{charge}/payments', [TenancyController::class, 'storePayment'])->name('tenancy.payments.store');
            Route::post('/{unit}/tenancy/{tenancy}/leases', [TenancyController::class, 'uploadLease'])->name('tenancy.leases.store');
            Route::get('/{unit}/tenancy/{tenancy}/leases/{lease}', [TenancyController::class, 'downloadLease'])->name('tenancy.leases.download');
            Route::delete('/{unit}/tenancy/{tenancy}/leases/{lease}', [TenancyController::class, 'deleteLease'])->name('tenancy.leases.destroy');
        });

        Route::post('/{property}/tenants', [TenancyController::class, 'storeTenant'])->name('tenants.store');
    });

    Route::middleware(['verified', 'profile.complete', 'owner.approved'])->get('/tenants', [TenantController::class, 'index'])->name('tenants.index');
    Route::middleware(['verified', 'profile.complete', 'owner.approved'])->get('/tenants/{tenant}', [TenantController::class, 'show'])->name('tenants.show');
    Route::middleware(['verified', 'profile.complete', 'owner.approved'])->post('/tenants', [TenantController::class, 'store'])->name('tenants.store');
    Route::middleware(['verified', 'profile.complete', 'owner.approved'])->put('/tenants/{tenant}', [TenantController::class, 'update'])->name('tenants.update');
    Route::middleware(['verified', 'profile.complete', 'owner.approved'])->group(function () {
        Route::get('/leases', [ManagementController::class, 'leases'])->name('leases.index');
        Route::get('/payments', [ManagementController::class, 'payments'])->name('payments.index');
        Route::get('/reports', [ManagementController::class, 'reports'])->name('reports.index');
    });

    Route::post('/api/ai/generate-property-description', [\App\Http\Controllers\AIDescriptionController::class, 'generatePropertyDescription'])->name('api.ai.generate-property-description');
});

Route::middleware(['auth', 'admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/approvals', [ApprovalController::class, 'index'])->name('approvals');
    Route::post('/approvals/{user}/approve', [ApprovalController::class, 'approve'])->name('approvals.approve');
    Route::post('/approvals/{user}/reject', [ApprovalController::class, 'reject'])->name('approvals.reject');

    Route::get('/users', [AdminUserController::class, 'index'])->name('users');
    Route::patch('/users/{user}/plan', [AdminUserController::class, 'updatePlan'])->name('users.plan');
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