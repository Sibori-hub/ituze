<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Demo or sample accounts whose phone may not be theirs: never send them an SMS.
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('sms_muted')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('sms_muted');
        });
    }
};
