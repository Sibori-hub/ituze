<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Managers now give the same details as an owner (ID, ID copy, photo,
     * location, terms). Those added before complete them at their next sign-in.
     */
    public function up(): void
    {
        DB::table('users')->where('role', 'manager')->whereNull('identity_document')->update(['profile_completed' => false]);
    }

    public function down(): void
    {
        DB::table('users')->where('role', 'manager')->whereNull('identity_document')->update(['profile_completed' => true]);
    }
};
