<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Each owner's own MoMo Pay code: tenants pay their rent straight to the owner.
        Schema::table('users', function (Blueprint $table) {
            $table->string('momo_pay_code', 20)->nullable();
            $table->string('momo_pay_name', 120)->nullable();
        });
        // Details from the tenant's MoMo SMS, kept with the payment.
        Schema::table('rent_payments', function (Blueprint $table) {
            $table->string('payer_name', 120)->nullable()->after('reference');
            $table->string('payer_phone', 20)->nullable()->after('payer_name');
            $table->string('proof_path')->nullable()->after('payer_phone');
            $table->string('proof_name', 200)->nullable()->after('proof_path');
        });
    }

    public function down(): void
    {
        Schema::table('rent_payments', function (Blueprint $table) {
            $table->dropColumn(['payer_name', 'payer_phone', 'proof_path', 'proof_name']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['momo_pay_code', 'momo_pay_name']);
        });
    }
};
