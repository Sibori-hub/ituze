<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE tenancies MODIFY status ENUM('active', 'ended', 'cancelled', 'scheduled') NOT NULL DEFAULT 'active'");
    }

    public function down(): void
    {
        DB::statement("UPDATE tenancies SET status = 'active' WHERE status = 'scheduled'");
        DB::statement("ALTER TABLE tenancies MODIFY status ENUM('active', 'ended', 'cancelled') NOT NULL DEFAULT 'active'");
    }
};
