<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rent_payments', function (Blueprint $table) {
            $table->string('transaction_id', 36)->nullable()->after('rent_charge_id');
            $table->dropUnique('rent_payments_receipt_number_unique');
            $table->index('receipt_number');
            $table->index(['transaction_id', 'paid_at']);
        });

        DB::table('rent_payments')->orderBy('id')->chunkById(500, function ($payments) {
            foreach ($payments as $payment) {
                DB::table('rent_payments')
                    ->where('id', $payment->id)
                    ->update(['transaction_id' => (string) Str::uuid()]);
            }
        });
    }

    public function down(): void
    {
        DB::table('rent_payments')
            ->select('receipt_number')
            ->whereNotNull('receipt_number')
            ->groupBy('receipt_number')
            ->havingRaw('COUNT(*) > 1')
            ->get()
            ->each(function ($receipt) {
                $paymentIds = DB::table('rent_payments')
                    ->where('receipt_number', $receipt->receipt_number)
                    ->orderBy('id')
                    ->pluck('id');

                foreach ($paymentIds->skip(1) as $paymentId) {
                    $paidAt = DB::table('rent_payments')->where('id', $paymentId)->value('paid_at');
                    DB::table('rent_payments')
                        ->where('id', $paymentId)
                        ->update([
                            'receipt_number' => sprintf('ITZ-%s-%06d', substr((string) $paidAt, 0, 4), $paymentId),
                        ]);
                }
            });

        Schema::table('rent_payments', function (Blueprint $table) {
            $table->dropIndex(['transaction_id', 'paid_at']);
            $table->dropIndex(['receipt_number']);
            $table->dropColumn('transaction_id');
            $table->unique('receipt_number');
        });
    }
};
