<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rent_charges', function (Blueprint $table) {
            $table->timestamp('voided_at')->nullable()->after('amount');
            $table->text('voided_reason')->nullable()->after('voided_at');
        });
    }

    public function down(): void
    {
        Schema::table('rent_charges', function (Blueprint $table) {
            $table->dropColumn(['voided_at', 'voided_reason']);
        });
    }
};
