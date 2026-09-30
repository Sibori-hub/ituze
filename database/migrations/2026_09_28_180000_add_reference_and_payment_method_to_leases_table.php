<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leases', function (Blueprint $table) {
            $table->string('reference_number', 32)->nullable()->unique();
            $table->string('payment_method', 30)->nullable();
            $table->string('payment_reference', 255)->nullable();
        });

        DB::table('leases')->orderBy('id')->chunkById(500, function ($leases) {
            foreach ($leases as $lease) {
                $year = $lease->created_at ? substr($lease->created_at, 0, 4) : now()->format('Y');
                DB::table('leases')
                    ->where('id', $lease->id)
                    ->update(['reference_number' => sprintf('ITZ-LSE-%s-%06d', $year, $lease->id)]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('leases', function (Blueprint $table) {
            $table->dropUnique(['reference_number']);
            $table->dropColumn(['reference_number', 'payment_method', 'payment_reference']);
        });
    }
};
