<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Private files on the "local" disk: NIDA front + back, or the passport photo page (front only).
            $table->string('identity_document_front')->nullable()->after('identity_document_type');
            $table->string('identity_document_back')->nullable()->after('identity_document_front');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['identity_document_front', 'identity_document_back']);
        });
    }
};
