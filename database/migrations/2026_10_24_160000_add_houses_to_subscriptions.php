<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The subscription is priced per house per month. An owner pays for a
     * number of houses and cannot add more houses than that; adding one means
     * paying for it first (purpose "add_houses").
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedSmallInteger('paid_houses')->default(0)->after('expires_at');
        });
        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->unsignedSmallInteger('houses')->default(1)->after('months');
            $table->string('purpose', 20)->default('renewal')->after('houses');
        });

        // Owners who already paid keep every house they have (at least one).
        $owners = DB::table('users')
            ->where('role', 'owner')
            ->whereNull('created_by')
            ->whereNotNull('expires_at')
            ->pluck('id');
        foreach ($owners as $id) {
            $houses = DB::table('properties')->where('owner_id', $id)->count();
            DB::table('users')->where('id', $id)->update(['paid_houses' => max(1, $houses)]);
        }
    }

    public function down(): void
    {
        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->dropColumn(['houses', 'purpose']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('paid_houses');
        });
    }
};
