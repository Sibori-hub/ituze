<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Advertisers buy listing credits by mobile money (25,000 RWF each; the
 * first purchase adds 3 free ones). Publishing a building uses one credit
 * and shows it on the public homepage for 60 days.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Each step checks first, so the migration can safely run again after a partial run.
        if (! Schema::hasColumn('users', 'ad_credits')) Schema::table('users', function (Blueprint $table) {
            // Listing credits an advertiser can still use.
            $table->unsignedInteger('ad_credits')->default(0)->after('management_fee_percent');
        });

        if (! Schema::hasColumn('properties', 'listed_until')) Schema::table('properties', function (Blueprint $table) {
            // An advertiser's building is public only until this moment.
            $table->timestamp('listed_until')->nullable()->after('basement_floors');
        });

        if (! Schema::hasTable('ad_purchases')) Schema::create('ad_purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('advertiser_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedSmallInteger('listings');
            $table->unsignedSmallInteger('bonus')->default(0);
            $table->decimal('amount', 12, 2);
            $table->string('method', 20)->default('mobile_money');
            // pending (waiting for approval on the phone), approved, failed
            $table->string('status', 20)->default('pending')->index();
            $table->foreignId('mobile_money_request_id')->nullable()->constrained()->nullOnDelete();
            $table->string('reference', 120)->nullable();
            $table->string('receipt_number', 40)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });

        if (! Schema::hasTable('ad_listings')) Schema::create('ad_listings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->foreignId('advertiser_id')->constrained('users')->cascadeOnDelete();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['advertiser_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ad_listings');
        Schema::dropIfExists('ad_purchases');
        Schema::table('properties', fn (Blueprint $table) => $table->dropColumn('listed_until'));
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('ad_credits'));
    }
};
