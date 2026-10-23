<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One upload holds the whole ID (both NIDA sides in one photo or PDF, or the passport photo page).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->renameColumn('identity_document_front', 'identity_document');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('identity_document_back');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->renameColumn('identity_document', 'identity_document_front');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->string('identity_document_back')->nullable()->after('identity_document_front');
        });
    }
};
