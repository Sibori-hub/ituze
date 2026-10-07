<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\ProfileCompletionController;
use App\Http\Controllers\Auth\MobileAuthController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Auth\VerifyEmailOtpController;
use App\Http\Controllers\Auth\EmailVerificationNotificationController;
use App\Http\Controllers\MobilePropertyController;
use App\Http\Controllers\MobileWorkspaceController;
use App\Http\Controllers\PublicPropertyController;

Route::prefix('mobile')->group(function () {
    Route::get('/properties', [MobilePropertyController::class, 'index'])->name('api.mobile.properties.index');
    Route::get('/properties/{property}', [MobilePropertyController::class, 'show'])->name('api.mobile.properties.show');
    Route::post('/properties/{property}/inquiries', [PublicPropertyController::class, 'inquire'])
        ->name('api.mobile.properties.inquiries.store');

    Route::post('/login', [MobileAuthController::class, 'login'])
        ->middleware('throttle:5,1')
        ->name('api.mobile.login');
    Route::post('/register', [RegisteredUserController::class, 'store'])
        ->middleware('throttle:5,1')
        ->name('api.mobile.register');
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [MobileAuthController::class, 'me'])->name('api.mobile.me');
        Route::post('/logout', [MobileAuthController::class, 'logout'])->name('api.mobile.logout');
        Route::post('/verify-email-otp', [VerifyEmailOtpController::class, 'store'])
            ->middleware('throttle:6,1')
            ->name('api.mobile.verify-email-otp');
        Route::post('/verification-notification', [EmailVerificationNotificationController::class, 'store'])
            ->middleware('throttle:6,1')
            ->name('api.mobile.verification-notification');
        Route::post('/complete-profile', [ProfileCompletionController::class, 'store'])
            ->name('api.mobile.profile.complete');
        Route::get('/dashboard', [MobileWorkspaceController::class, 'dashboard'])->name('api.mobile.dashboard');
        Route::get('/workspace/properties', [MobileWorkspaceController::class, 'properties'])->name('api.mobile.workspace.properties');
        Route::get('/workspace/cells', [MobileWorkspaceController::class, 'cells'])->name('api.mobile.workspace.cells');
        Route::get('/workspace/owners', [MobileWorkspaceController::class, 'owners'])->name('api.mobile.workspace.owners');
        Route::post('/workspace/properties', [MobileWorkspaceController::class, 'storeProperty'])->name('api.mobile.workspace.properties.store');
        Route::put('/workspace/properties/{property}', [MobileWorkspaceController::class, 'updateProperty'])->name('api.mobile.workspace.properties.update');
        Route::delete('/workspace/properties/{property}', [MobileWorkspaceController::class, 'destroyProperty'])->name('api.mobile.workspace.properties.destroy');
        Route::post('/workspace/properties/{property}/units', [MobileWorkspaceController::class, 'storeUnit'])->name('api.mobile.workspace.units.store');
        Route::put('/workspace/properties/{property}/units/{unit}', [MobileWorkspaceController::class, 'updateUnit'])->name('api.mobile.workspace.units.update');
        Route::delete('/workspace/properties/{property}/units/{unit}', [MobileWorkspaceController::class, 'destroyUnit'])->name('api.mobile.workspace.units.destroy');
        Route::get('/workspace/tenants', [MobileWorkspaceController::class, 'tenants'])->name('api.mobile.workspace.tenants');
        Route::post('/workspace/tenants', [MobileWorkspaceController::class, 'storeTenant'])->name('api.mobile.workspace.tenants.store');
        Route::put('/workspace/tenants/{tenant}', [MobileWorkspaceController::class, 'updateTenant'])->name('api.mobile.workspace.tenants.update');
        Route::get('/workspace/tenancies', [MobileWorkspaceController::class, 'tenancies'])->name('api.mobile.workspace.tenancies');
        Route::post('/workspace/properties/{property}/units/{unit}/tenancies/{tenancy}/charges/{charge}/payments', [MobileWorkspaceController::class, 'storeChargePayment'])->name('api.mobile.workspace.tenancy.payments.store');
        Route::post('/workspace/properties/{property}/units/{unit}/tenancies/{tenancy}/move-out', [MobileWorkspaceController::class, 'moveOut'])->name('api.mobile.workspace.tenancy.move-out');
        Route::get('/workspace/units', [MobileWorkspaceController::class, 'units'])->name('api.mobile.workspace.units');
        Route::get('/workspace/unit-types', [MobileWorkspaceController::class, 'unitTypes'])->name('api.mobile.workspace.unit-types');
        Route::get('/workspace/reports', [MobileWorkspaceController::class, 'reports'])->name('api.mobile.workspace.reports');
        Route::get('/workspace/leases', [MobileWorkspaceController::class, 'leases'])->name('api.mobile.workspace.leases');
        Route::get('/workspace/payments', [MobileWorkspaceController::class, 'payments'])->name('api.mobile.workspace.payments');
        Route::get('/workspace/approvals', [MobileWorkspaceController::class, 'approvals'])->name('api.mobile.workspace.approvals');
        Route::post('/workspace/approvals/{user}/reject', [MobileWorkspaceController::class, 'rejectOwner'])->name('api.mobile.workspace.approvals.reject');
    });

    Route::prefix('locations')->group(function () {
        Route::get('/provinces', [LocationController::class, 'provinces'])->name('api.mobile.provinces');
        Route::get('/districts/{province}', [LocationController::class, 'districts'])->name('api.mobile.districts');
        Route::get('/sectors/{district}', [LocationController::class, 'sectors'])->name('api.mobile.sectors');
        Route::get('/cells/{sector}', [LocationController::class, 'cells'])->name('api.mobile.cells');
    });
});
