<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The subscription is paid per property: each property of a
     * self-registered owner has its own paid-until date, and each payment
     * belongs to one property.
     */
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->dateTime('paid_until')->nullable()->index()->after('listed_until');
        });
        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->foreignId('property_id')->nullable()->after('owner_id')->constrained()->nullOnDelete();
        });
        // Reminders go per property. The new unique index (starting with owner_id)
        // is added before the old one is dropped, as the owner foreign key needs one.
        Schema::table('subscription_reminders', function (Blueprint $table) {
            $table->foreignId('property_id')->nullable()->after('owner_id')->constrained()->cascadeOnDelete();
            $table->unique(['owner_id', 'property_id', 'kind', 'expires_on'], 'subscription_reminders_property_unique');
        });
        Schema::table('subscription_reminders', function (Blueprint $table) {
            $table->dropUnique(['owner_id', 'kind', 'expires_on']);
        });

        // Properties of owners who had already paid keep that date.
        $owners = DB::table('users')->where('role', 'owner')->whereNull('created_by')->whereNotNull('expires_at')->get(['id', 'expires_at']);
        foreach ($owners as $owner) {
            DB::table('properties')->where('owner_id', $owner->id)->update(['paid_until' => $owner->expires_at]);
        }
    }

    public function down(): void
    {
        Schema::table('subscription_reminders', function (Blueprint $table) {
            $table->unique(['owner_id', 'kind', 'expires_on']);
        });
        Schema::table('subscription_reminders', function (Blueprint $table) {
            $table->dropUnique('subscription_reminders_property_unique');
            $table->dropConstrainedForeignId('property_id');
        });
        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('property_id');
        });
        Schema::table('properties', function (Blueprint $table) {
            $table->dropColumn('paid_until');
        });
    }
};
