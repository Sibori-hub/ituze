<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Property → Unit → Room.
 *
 * A property now records its floors (ground + `total_floors` upper floors,
 * plus `basement_floors` below ground). A "unit" is a category on one floor
 * (e.g. Commercial space · Ground floor) and the rentable rooms sit inside it.
 * Rooms stay in the existing `units` table so tenancies, payments, reports and
 * the public listing keep working; they gain a link to their unit.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->string('address')->nullable()->change();
            $table->unsignedTinyInteger('basement_floors')->default(0)->after('total_floors');
        });

        Schema::create('property_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->foreignId('unit_type_id')->constrained('unit_types');
            // 0 = ground floor, 1.. = upper floors, -1.. = basements.
            $table->smallInteger('floor_number')->default(0);
            $table->text('description')->nullable();
            $table->timestamps();

            $table->unique(['property_id', 'unit_type_id', 'floor_number']);
        });

        Schema::table('units', function (Blueprint $table) {
            $table->foreignId('property_unit_id')->nullable()->after('property_id')
                ->constrained('property_units')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('units', function (Blueprint $table) {
            $table->dropConstrainedForeignId('property_unit_id');
        });

        Schema::dropIfExists('property_units');

        Schema::table('properties', function (Blueprint $table) {
            $table->dropColumn('basement_floors');
        });
    }
};
