<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * An advertiser's building is public only while its paid listing runs.
 * The flag on the building lets the homepage check that without looking up
 * the owner.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('properties', 'requires_listing')) {
            Schema::table('properties', function (Blueprint $table) {
                $table->boolean('requires_listing')->default(false)->after('basement_floors');
            });
        }

        DB::table('properties')
            ->whereIn('owner_id', DB::table('users')->select('id')->where('role', 'advertiser'))
            ->update(['requires_listing' => true]);
    }

    public function down(): void
    {
        Schema::table('properties', fn (Blueprint $table) => $table->dropColumn('requires_listing'));
    }
};
