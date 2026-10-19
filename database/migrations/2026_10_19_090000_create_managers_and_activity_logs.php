<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Self-registered owners can add managers (staff accounts) and give each one
 * whole properties or single units to run. Every change made in a workspace
 * is written to an activity log the owner can follow.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['owner', 'advertiser', 'admin', 'manager'])->default('owner')->change();
            // The owner a manager works for.
            $table->foreignId('employer_id')->nullable()->after('created_by')->constrained('users')->nullOnDelete();
        });

        Schema::create('manager_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('manager_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            // Null: the whole property. Otherwise only this unit (category on a floor) and its rooms.
            $table->foreignId('property_unit_id')->nullable()->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->index(['manager_id', 'property_id']);
        });

        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            // Owner whose buildings were touched, so they can follow their workspace.
            $table->foreignId('owner_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->foreignId('property_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 60);
            $table->string('subject_type', 60)->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('description', 500);
            $table->decimal('amount', 14, 2)->nullable();
            // Groups the rows of one payment into a single log line.
            $table->string('group_key', 80)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['owner_id', 'created_at']);
            $table->index(['actor_id', 'created_at']);
            $table->index('group_key');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('manager_assignments');

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('employer_id');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['owner', 'advertiser', 'admin'])->default('owner')->change();
        });
    }
};
