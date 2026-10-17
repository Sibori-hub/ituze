<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Advertisers become a first-class account type alongside owners.
        $this->modifyEnum('users', 'role', ['owner', 'advertiser', 'admin'], 'owner');

        // 'disabled' lets an admin suspend an account without destroying its history.
        $this->modifyEnum('users', 'status', ['pending', 'approved', 'rejected', 'disabled'], 'pending');

        Schema::table('users', function (Blueprint $table) {
            // Terms & Conditions acceptance record.
            $table->timestamp('terms_accepted_at')->nullable()->after('profile_completed');
            $table->string('terms_version', 20)->nullable()->after('terms_accepted_at');
            $table->string('terms_accepted_ip', 45)->nullable()->after('terms_version');

            // Phone verification code (delivered over WhatsApp).
            $table->string('phone_otp', 6)->nullable()->after('phone_verified_at');
            $table->timestamp('phone_otp_expires_at')->nullable()->after('phone_otp');

            // Login second-factor code.
            $table->string('login_otp', 6)->nullable()->after('phone_otp_expires_at');
            $table->timestamp('login_otp_expires_at')->nullable()->after('login_otp');
            $table->string('login_otp_channel', 10)->nullable()->after('login_otp_expires_at');

            // Account suspension, kept reversible.
            $table->timestamp('disabled_at')->nullable()->after('login_otp_channel');
            $table->string('disabled_reason')->nullable()->after('disabled_at');

            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'terms_accepted_at',
                'terms_version',
                'terms_accepted_ip',
                'phone_otp',
                'phone_otp_expires_at',
                'login_otp',
                'login_otp_expires_at',
                'login_otp_channel',
                'disabled_at',
                'disabled_reason',
            ]);
            $table->dropSoftDeletes();
        });

        $this->modifyEnum('users', 'role', ['owner', 'admin'], 'owner');
        $this->modifyEnum('users', 'status', ['pending', 'approved', 'rejected'], 'pending');
    }

    /**
     * Change an enum column on MySQL, or rebuild it through the schema builder elsewhere
     * (SQLite has no ALTER ... MODIFY, which is what the test suite runs on).
     */
    protected function modifyEnum(string $table, string $column, array $values, string $default): void
    {
        if (DB::connection()->getDriverName() === 'mysql') {
            $list = implode(', ', array_map(fn (string $value) => "'{$value}'", $values));

            DB::statement("ALTER TABLE {$table} MODIFY {$column} ENUM({$list}) NOT NULL DEFAULT '{$default}'");

            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($column, $values, $default) {
            $blueprint->enum($column, $values)->default($default)->change();
        });
    }
};
