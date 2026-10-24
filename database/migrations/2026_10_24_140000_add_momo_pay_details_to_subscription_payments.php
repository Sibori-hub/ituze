<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * MoMo Pay without the MoMo API: the owner pays our MoMo Pay code and
     * types the details from the MoMo SMS; the admin checks them.
     */
    public function up(): void
    {
        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->string('sender_name', 120)->nullable()->after('reference');
            $table->string('sender_phone', 20)->nullable()->after('sender_name');
            $table->dateTime('paid_at')->nullable()->after('sender_phone');
            $table->index(['method', 'reference']);
        });
    }

    public function down(): void
    {
        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->dropIndex(['method', 'reference']);
            $table->dropColumn(['sender_name', 'sender_phone', 'paid_at']);
        });
    }
};
