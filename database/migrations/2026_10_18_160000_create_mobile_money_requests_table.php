<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Mobile money payment requests sent to a tenant's phone ("request to pay").
 * A successful request is used once, as the proof of payment for an assignment.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mobile_money_requests', function (Blueprint $table) {
            $table->id();
            // Our reference, also sent to the provider (X-Reference-Id for MTN).
            $table->uuid('reference')->unique();
            $table->string('provider', 30);
            $table->string('purpose', 30)->default('assignment');
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('unit_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requested_by')->constrained('users');
            // Payer number in international format without "+": 2507XXXXXXXX.
            $table->string('phone', 15);
            $table->decimal('amount', 12, 2);
            $table->string('currency', 3);
            // pending, successful, failed, expired
            $table->string('status', 20)->default('pending')->index();
            $table->string('provider_transaction_id')->nullable();
            $table->string('failure_reason')->nullable();
            $table->timestamp('completed_at')->nullable();
            // Set when the payment is attached to a tenancy, so it cannot be used twice.
            $table->foreignId('tenancy_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mobile_money_requests');
    }
};
