<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('owner_registration_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('tx_ref')->unique();
            $table->string('provider_transaction_id')->nullable()->unique();
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->string('status')->default('pending')->index();
            $table->text('checkout_url')->nullable();
            $table->json('provider_data')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('owner_registration_payments');
    }
};
