<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Environmental and utility management per building: monthly water and
 * electricity meter readings (with bills), and waste collection schedules,
 * collections and costs.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('utility_readings')) {
            Schema::create('utility_readings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('property_id')->constrained()->cascadeOnDelete();
                // water (m³) or electricity (kWh)
                $table->string('type', 20);
                // First day of the month the reading closes.
                $table->date('period');
                // Meter index read on site.
                $table->decimal('reading', 14, 2);
                // Used this month: this reading minus the previous one (or entered after a meter change).
                $table->decimal('consumption', 14, 2);
                $table->decimal('cost', 14, 2)->nullable();
                $table->string('bill_reference', 80)->nullable();
                $table->boolean('meter_replaced')->default(false);
                $table->string('notes', 500)->nullable();
                $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->unique(['property_id', 'type', 'period']);
            });
        }

        if (! Schema::hasTable('waste_schedules')) {
            Schema::create('waste_schedules', function (Blueprint $table) {
                $table->id();
                $table->foreignId('property_id')->constrained()->cascadeOnDelete();
                $table->string('collector', 120);
                // weekly, biweekly or monthly
                $table->string('frequency', 20);
                // 1 = Monday … 7 = Sunday (weekly / every two weeks), or day of month (monthly).
                $table->unsignedTinyInteger('day');
                $table->decimal('cost_per_collection', 12, 2)->default(0);
                $table->date('starts_on');
                $table->boolean('active')->default(true);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('waste_collections')) {
            Schema::create('waste_collections', function (Blueprint $table) {
                $table->id();
                $table->foreignId('property_id')->constrained()->cascadeOnDelete();
                $table->foreignId('waste_schedule_id')->nullable()->constrained()->nullOnDelete();
                $table->date('scheduled_on');
                // collected or missed
                $table->string('status', 20);
                $table->decimal('cost', 12, 2)->default(0);
                $table->string('notes', 500)->nullable();
                $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->unique(['property_id', 'scheduled_on']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('waste_collections');
        Schema::dropIfExists('waste_schedules');
        Schema::dropIfExists('utility_readings');
    }
};
