<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rent_charges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenancy_id')->constrained()->cascadeOnDelete();
            $table->enum('charge_type', ['rent', 'deposit']);
            $table->date('period_start');
            $table->date('period_end')->nullable();
            $table->date('due_date');
            $table->decimal('amount', 12, 2);
            $table->timestamps();
            $table->unique(['tenancy_id', 'charge_type', 'period_start']);
            $table->index(['tenancy_id', 'due_date']);
        });

        Schema::create('rent_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rent_charge_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $table->decimal('amount', 12, 2);
            $table->enum('method', ['cash', 'bank_transfer', 'mobile_money', 'other']);
            $table->string('receipt_number')->nullable()->unique();
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('paid_at')->useCurrent();
            $table->timestamps();
            $table->index(['rent_charge_id', 'paid_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rent_payments');
        Schema::dropIfExists('rent_charges');
    }
};
