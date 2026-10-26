<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // An owner or advertiser registers as a person or as a company (with its TIN);
        // for a company, the first and last name are its representative's.
        Schema::table('users', function (Blueprint $table) {
            $table->string('account_type', 20)->default('individual')->after('role');
            $table->string('company_name', 150)->nullable()->after('account_type');
            $table->string('company_tin', 20)->nullable()->after('company_name');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['account_type', 'company_name', 'company_tin']);
        });
    }
};
