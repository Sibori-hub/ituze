<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // What was taken: bins of biodegradable waste (ibibora) and of
        // non-biodegradable waste (ibitabora), each with its size in kg.
        Schema::table('waste_collections', function (Blueprint $table) {
            $table->unsignedSmallInteger('biodegradable_bins')->default(0)->after('cost');
            $table->decimal('biodegradable_bin_kg', 8, 2)->nullable()->after('biodegradable_bins');
            $table->unsignedSmallInteger('non_biodegradable_bins')->default(0)->after('biodegradable_bin_kg');
            $table->decimal('non_biodegradable_bin_kg', 8, 2)->nullable()->after('non_biodegradable_bins');
        });
    }

    public function down(): void
    {
        Schema::table('waste_collections', function (Blueprint $table) {
            $table->dropColumn(['biodegradable_bins', 'biodegradable_bin_kg', 'non_biodegradable_bins', 'non_biodegradable_bin_kg']);
        });
    }
};
