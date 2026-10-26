<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Listings paid by MoMo Pay (details from the SMS) or by bank transfer or cheque,
        // checked and approved by an admin, like the property payments.
        Schema::table('ad_purchases', function (Blueprint $table) {
            $table->string('sender_name', 150)->nullable()->after('reference');
            $table->string('sender_phone', 20)->nullable()->after('sender_name');
            $table->string('bank_name', 80)->nullable()->after('sender_phone');
            $table->string('account_number', 40)->nullable()->after('bank_name');
            $table->timestamp('sent_at')->nullable()->after('account_number');
            $table->string('proof_path')->nullable()->after('sent_at');
            $table->string('proof_name', 200)->nullable()->after('proof_path');
            $table->foreignId('reviewed_by')->nullable()->after('proof_name')->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable()->after('reviewed_by');
            $table->string('rejection_reason')->nullable()->after('reviewed_at');
        });
    }

    public function down(): void
    {
        Schema::table('ad_purchases', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reviewed_by');
            $table->dropColumn(['sender_name', 'sender_phone', 'bank_name', 'account_number', 'sent_at', 'proof_path', 'proof_name', 'reviewed_at', 'rejection_reason']);
        });
    }
};
