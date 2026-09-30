<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('move_out_inspections', function (Blueprint $table) {
            $table->decimal('damage_cost', 12, 2)->default(0)->after('deposit_deducted');
        });

        DB::table('move_out_inspections')
            ->where('deposit_deducted', '>', 0)
            ->update(['damage_cost' => DB::raw('deposit_deducted')]);

        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE rent_charges MODIFY charge_type ENUM('rent', 'deposit', 'damage') NOT NULL");
        }
    }

    public function down(): void
    {
        if (DB::table('rent_charges')->where('charge_type', 'damage')->exists()) {
            throw new RuntimeException('Cannot remove the damage charge type while damage charges exist.');
        }

        if (DB::connection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE rent_charges MODIFY charge_type ENUM('rent', 'deposit') NOT NULL");
        }

        Schema::table('move_out_inspections', function (Blueprint $table) {
            $table->dropColumn('damage_cost');
        });
    }
};
