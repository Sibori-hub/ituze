<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Which lease-ending reminders were already sent, so each goes out only once.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lease_reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenancy_id')->constrained()->cascadeOnDelete();
            // days_60, days_30, days_7 or expired
            $table->string('kind', 20);
            $table->unsignedSmallInteger('recipients')->default(0);
            $table->timestamp('sent_at');
            $table->timestamps();

            $table->unique(['tenancy_id', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lease_reminders');
    }
};
