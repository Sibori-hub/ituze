<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Account holders no longer give a personal street address; province,
 * district and sector are enough. Property and tenant addresses are separate
 * columns and stay. Rolling back restores an empty column, not the old values.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'address')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('address');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('users', 'address')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('address')->nullable()->after('national_id');
            });
        }
    }
};
