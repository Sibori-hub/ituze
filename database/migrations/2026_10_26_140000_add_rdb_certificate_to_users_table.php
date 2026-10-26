<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A company account adds its RDB registration certificate (private file) and street address.
        Schema::table('users', function (Blueprint $table) {
            $table->string('rdb_certificate')->nullable()->after('identity_document');
            // Its street address (province, district and sector come from sector_id).
            $table->string('company_address')->nullable()->after('company_tin');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['rdb_certificate', 'company_address']);
        });
    }
};
