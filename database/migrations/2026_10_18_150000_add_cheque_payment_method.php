<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Payments can also be made by cheque (the cheque number is kept as the reference).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rent_payments', function (Blueprint $table) {
            $table->enum('method', ['cash', 'bank_transfer', 'mobile_money', 'cheque', 'other'])->change();
        });
    }

    public function down(): void
    {
        Schema::table('rent_payments', function (Blueprint $table) {
            $table->enum('method', ['cash', 'bank_transfer', 'mobile_money', 'other'])->change();
        });
    }
};
