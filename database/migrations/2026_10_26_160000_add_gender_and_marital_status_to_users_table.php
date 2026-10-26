<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The same personal details as tenants: for a company, the representative's.
        Schema::table('users', function (Blueprint $table) {
            $table->string('gender', 10)->nullable()->after('last_name');
            $table->string('marital_status', 20)->nullable()->after('gender');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['gender', 'marital_status']);
        });
    }
};
