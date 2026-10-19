<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Self-registered owners pay 100,000 RWF per month for 1, 3, 6 or 12 months
 * at a time: by mobile money (applied as soon as it is approved on the
 * phone) or by bank transfer / cheque with an uploaded proof an admin checks.
 */
return new class extends Migration
{
    public function up(): void
    {
        // A mobile money request can now pay a subscription: no tenant or room.
        Schema::table('mobile_money_requests', function (Blueprint $table) {
            $table->unsignedBigInteger('tenant_id')->nullable()->change();
            $table->unsignedBigInteger('unit_id')->nullable()->change();
        });

        Schema::create('subscription_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('months');
            $table->decimal('amount', 12, 2);
            // mobile_money, bank_transfer or cheque
            $table->string('method', 20);
            // Bank slip reference, cheque number or mobile money transaction id.
            $table->string('reference', 120)->nullable();
            $table->string('proof_path')->nullable();
            $table->string('proof_name')->nullable();
            // pending (waiting for MoMo approval or admin review), approved, rejected, failed
            $table->string('status', 20)->default('pending')->index();
            $table->foreignId('mobile_money_request_id')->nullable()->constrained()->nullOnDelete();
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();
            $table->string('receipt_number', 40)->nullable();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('rejection_reason')->nullable();
            $table->timestamps();

            $table->index(['owner_id', 'created_at']);
        });

        Schema::create('subscription_reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            // days_7, days_3, due, blocked
            $table->string('kind', 20);
            // The paid-until date the reminder is about, so a renewal starts a fresh cycle.
            $table->date('expires_on');
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['owner_id', 'kind', 'expires_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_reminders');
        Schema::dropIfExists('subscription_payments');
    }
};
