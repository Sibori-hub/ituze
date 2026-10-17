<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * One-time codes are now stored as a 64 character HMAC instead of the plain
 * six digits, so the columns need room for the hash.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('email_otp', 64)->nullable()->change();
            $table->string('phone_otp', 64)->nullable()->change();
            $table->string('login_otp', 64)->nullable()->change();
        });
    }

    public function down(): void
    {
        // Hashed codes do not fit the old width; outstanding codes are simply re-requested.
        DB::table('users')->update(['email_otp' => null, 'phone_otp' => null, 'login_otp' => null]);

        Schema::table('users', function (Blueprint $table) {
            $table->string('email_otp', 6)->nullable()->change();
            $table->string('phone_otp', 6)->nullable()->change();
            $table->string('login_otp', 6)->nullable()->change();
        });
    }
};
