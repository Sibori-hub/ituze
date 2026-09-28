<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('tax_identification_number')->nullable()->after('registration_number');
        });

        Schema::table('tenancies', function (Blueprint $table) {
            $table->string('rent_frequency')->default('monthly')->after('monthly_rent');
            $table->unsignedTinyInteger('due_day')->nullable()->after('rent_frequency');
            $table->date('actual_end_date')->nullable()->after('end_date');
            $table->foreignId('renewed_from_id')->nullable()->after('unit_id')->constrained('tenancies')->nullOnDelete();
        });

        DB::table('tenancies')
            ->select(['id', 'unit_id', 'start_date'])
            ->orderBy('id')
            ->chunkById(100, function ($tenancies) {
                $frequencies = DB::table('units')
                    ->whereIn('id', $tenancies->pluck('unit_id'))
                    ->pluck('rent_frequency', 'id');

                foreach ($tenancies as $tenancy) {
                    $frequency = $frequencies[$tenancy->unit_id] ?? 'monthly';
                    DB::table('tenancies')->where('id', $tenancy->id)->update([
                        'rent_frequency' => $frequency,
                        'due_day' => $frequency === 'monthly' ? (int) substr($tenancy->start_date, -2) : null,
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('tenancies', function (Blueprint $table) {
            $table->dropForeign(['renewed_from_id']);
            $table->dropColumn(['rent_frequency', 'due_day', 'actual_end_date', 'renewed_from_id']);
        });

        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('tax_identification_number');
        });
    }
};
