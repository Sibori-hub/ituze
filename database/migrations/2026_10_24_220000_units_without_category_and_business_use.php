<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Units are plain spaces on a floor (number, size, rent, photos): they all
     * use the neutral "Space" type. What a client uses a unit for (office,
     * salon, warehouse…) is typed when the unit is rented, and a visitor says
     * it when they ask about a space.
     */
    public function up(): void
    {
        if (! DB::table('unit_types')->where('name', 'Space')->exists()) {
            DB::table('unit_types')->insert(['name' => 'Space', 'created_at' => now(), 'updated_at' => now()]);
        }

        Schema::table('tenancies', function (Blueprint $table) {
            $table->string('business_use', 120)->nullable()->after('tenant_id');
        });
        Schema::table('property_inquiries', function (Blueprint $table) {
            $table->string('business_use', 120)->nullable()->after('visitor_phone');
        });
    }

    public function down(): void
    {
        Schema::table('property_inquiries', function (Blueprint $table) {
            $table->dropColumn('business_use');
        });
        Schema::table('tenancies', function (Blueprint $table) {
            $table->dropColumn('business_use');
        });
    }
};
