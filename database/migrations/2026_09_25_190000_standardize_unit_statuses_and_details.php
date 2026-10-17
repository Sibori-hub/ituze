<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("UPDATE units SET status = 'available' WHERE status = 'vacant'");

        // SQLite keeps enums as plain text, and has no ALTER ... MODIFY.
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE units MODIFY status ENUM('available', 'occupied', 'maintenance', 'reserved', 'inactive') NOT NULL DEFAULT 'available'");
        }

        Schema::table('units', function (Blueprint $table) {
            $table->integer('floor_number')->nullable()->after('unit_number');
            $table->string('rent_frequency', 20)->default('monthly')->after('rent_amount');
        });
    }

    public function down(): void
    {
        DB::statement("UPDATE units SET status = 'vacant' WHERE status IN ('available', 'reserved', 'inactive')");

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE units MODIFY status ENUM('vacant', 'occupied', 'maintenance') NOT NULL DEFAULT 'vacant'");
        }

        Schema::table('units', function (Blueprint $table) {
            $table->dropColumn(['floor_number', 'rent_frequency']);
        });
    }
};
