<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Owners an admin creates now get a temporary password they must replace at
 * first sign-in, and pay Q.R.A a management fee on the rent it collects for
 * them (default 10%, adjustable per owner).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('must_change_password')->default(false)->after('login_enabled');
            $table->decimal('management_fee_percent', 5, 2)->nullable()->after('must_change_password');
        });

        // Owners already created by an admin start on the default rate.
        DB::table('users')
            ->whereNotNull('created_by')
            ->where('role', 'owner')
            ->update(['management_fee_percent' => 10]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['must_change_password', 'management_fee_percent']);
        });
    }
};
