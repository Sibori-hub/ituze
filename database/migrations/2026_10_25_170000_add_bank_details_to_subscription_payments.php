<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Bank transfer: the payer's bank and account. Cheque: the bank and account it is drawn on.
        // The name on the account or cheque (a person or a company) is kept in sender_name.
        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->string('bank_name', 80)->nullable()->after('reference');
            $table->string('account_number', 40)->nullable()->after('bank_name');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->dropColumn(['bank_name', 'account_number']);
        });
    }
};
