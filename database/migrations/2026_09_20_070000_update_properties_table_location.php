<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Formerly 2026_09_17_160132_update_properties_table_location. It was moved
 * after the cells table so fresh installs can add the foreign key, which means
 * databases that already ran the old file will see it again: every step is
 * guarded so it only does what is still missing.
 */
return new class extends Migration
{
    public function up(): void
    {
        $dropColumns = array_values(array_filter(
            ['district', 'sector'],
            fn (string $column) => Schema::hasColumn('properties', $column),
        ));

        if ($dropColumns !== []) {
            Schema::table('properties', function (Blueprint $table) use ($dropColumns) {
                $table->dropColumn($dropColumns);
            });
        }

        if (! Schema::hasColumn('properties', 'cell_id')) {
            Schema::table('properties', function (Blueprint $table) {
                $table->foreignId('cell_id')->nullable()->constrained()->nullOnDelete()->after('owner_id');
            });
        }
    }

    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cell_id');
            $table->string('district')->nullable();
            $table->string('sector')->nullable();
        });
    }
};
