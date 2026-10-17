<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // SQLite keeps enums as plain text, and has no ALTER ... MODIFY.
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE tenancies MODIFY status ENUM('active', 'ended', 'cancelled', 'scheduled') NOT NULL DEFAULT 'active'");
        }
    }

    public function down(): void
    {
        DB::statement("UPDATE tenancies SET status = 'active' WHERE status = 'scheduled'");

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE tenancies MODIFY status ENUM('active', 'ended', 'cancelled') NOT NULL DEFAULT 'active'");
        }
    }
};
