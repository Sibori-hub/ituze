<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('gender', 10)->nullable()->after('last_name');
            $table->string('marital_status', 20)->nullable()->after('gender');
            // Private files (local disk): a portrait and a copy of the ID or passport.
            $table->string('photo')->nullable()->after('marital_status');
            $table->string('identity_document')->nullable()->after('identity_number');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['gender', 'marital_status', 'photo', 'identity_document']);
        });
    }
};
