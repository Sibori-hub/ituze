<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('move_out_inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenancy_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('inspected_by')->constrained('users')->restrictOnDelete();
            $table->date('move_out_date');
            $table->text('condition_notes');
            $table->decimal('deposit_received', 12, 2)->default(0);
            $table->decimal('deposit_refunded', 12, 2)->default(0);
            $table->decimal('deposit_deducted', 12, 2)->default(0);
            $table->text('deduction_notes')->nullable();
            $table->enum('unit_outcome', ['available', 'maintenance']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('move_out_inspections');
    }
};
