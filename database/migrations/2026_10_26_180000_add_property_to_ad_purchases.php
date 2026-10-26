<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A listing payment now belongs to one property: 25,000 RWF puts that property online.
        Schema::table('ad_purchases', function (Blueprint $table) {
            $table->foreignId('property_id')->nullable()->after('advertiser_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('ad_purchases', function (Blueprint $table) {
            $table->dropConstrainedForeignId('property_id');
        });
    }
};
