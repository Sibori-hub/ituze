<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Accounts an administrator creates for owners and advertisers that Q.R.A
 * manages do not sign in themselves; their email and phone are only used to
 * keep them informed. Existing and self-registered accounts keep signing in.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('login_enabled')->default(true)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('login_enabled');
        });
    }
};
