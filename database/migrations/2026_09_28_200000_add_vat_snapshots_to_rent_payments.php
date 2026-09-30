<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rent_payments', function (Blueprint $table) {
            $table->decimal('taxable_amount', 12, 2)->nullable()->after('amount');
            $table->decimal('vat_rate', 5, 2)->nullable()->after('taxable_amount');
            $table->decimal('vat_amount', 12, 2)->nullable()->after('vat_rate');
        });
    }

    public function down(): void
    {
        Schema::table('rent_payments', function (Blueprint $table) {
            $table->dropColumn(['taxable_amount', 'vat_rate', 'vat_amount']);
        });
    }
};
