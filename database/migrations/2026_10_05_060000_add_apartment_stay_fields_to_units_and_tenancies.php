<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('units', function (Blueprint $table) {
            $table->unsignedTinyInteger('bedrooms')->nullable()->after('size_sqm');
            $table->decimal('bathrooms', 3, 1)->nullable()->after('bedrooms');
        });

        Schema::table('tenancies', function (Blueprint $table) {
            $table->time('check_in_time')->nullable()->after('end_date');
            $table->time('check_out_time')->nullable()->after('check_in_time');
        });

        $apartmentTypeId = DB::table('unit_types')->where('name', 'Apartment')->value('id');
        if (! $apartmentTypeId) {
            $apartmentTypeId = DB::table('unit_types')->insertGetId([
                'name' => 'Apartment',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $legacyBedroomTypes = DB::table('unit_types')
            ->whereIn('name', ['1 Bedroom', '2 Bedrooms', '3 Bedrooms', '4+ Bedrooms'])
            ->get(['id', 'name']);

        foreach ($legacyBedroomTypes as $type) {
            preg_match('/^(\d+)/', $type->name, $matches);
            DB::table('units')->where('unit_type_id', $type->id)->update([
                'unit_type_id' => $apartmentTypeId,
                'bedrooms' => $type->name === '4+ Bedrooms' ? null : (isset($matches[1]) ? (int) $matches[1] : null),
            ]);
        }
        DB::table('unit_types')
            ->whereIn('name', ['1 Bedroom', '2 Bedrooms', '3 Bedrooms', '4+ Bedrooms'])
            ->delete();

        $studioTypeId = DB::table('unit_types')->where('name', 'Studio')->value('id');
        if ($studioTypeId) {
            DB::table('units')
                ->where('unit_type_id', $studioTypeId)
                ->whereNull('bedrooms')
                ->update(['bedrooms' => 0]);
        }

        $apartmentTypeIds = DB::table('unit_types')
            ->whereIn('name', ['Apartment', 'Studio'])
            ->pluck('id');
        DB::table('units')
            ->whereNotIn('unit_type_id', $apartmentTypeIds)
            ->update(['rent_frequency' => 'monthly']);
    }

    public function down(): void
    {
        Schema::table('tenancies', function (Blueprint $table) {
            $table->dropColumn(['check_in_time', 'check_out_time']);
        });

        Schema::table('units', function (Blueprint $table) {
            $table->dropColumn(['bedrooms', 'bathrooms']);
        });
    }
};
