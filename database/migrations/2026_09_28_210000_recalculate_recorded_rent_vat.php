<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('rent_payments')
            ->join('rent_charges', 'rent_charges.id', '=', 'rent_payments.rent_charge_id')
            ->where('rent_charges.charge_type', 'rent')
            ->select('rent_payments.id', 'rent_payments.amount')
            ->orderBy('rent_payments.id')
            ->chunkById(500, function ($payments) {
                foreach ($payments as $payment) {
                    $amountCents = (int) round((float) $payment->amount * 100);
                    $vatCents = (int) round($amountCents * 18 / 100);

                    DB::table('rent_payments')
                        ->where('id', $payment->id)
                        ->update([
                            'taxable_amount' => number_format($amountCents / 100, 2, '.', ''),
                            'vat_rate' => '18.00',
                            'vat_amount' => number_format($vatCents / 100, 2, '.', ''),
                        ]);
                }
            }, 'rent_payments.id', 'id');
    }

    public function down(): void
    {
        DB::table('rent_payments')
            ->join('rent_charges', 'rent_charges.id', '=', 'rent_payments.rent_charge_id')
            ->where('rent_charges.charge_type', 'rent')
            ->where('rent_payments.vat_rate', '18.00')
            ->select('rent_payments.id', 'rent_payments.amount')
            ->orderBy('rent_payments.id')
            ->chunkById(500, function ($payments) {
                foreach ($payments as $payment) {
                    $amountCents = (int) round((float) $payment->amount * 100);
                    $vatCents = (int) round($amountCents * 1800 / 11800);

                    DB::table('rent_payments')
                        ->where('id', $payment->id)
                        ->update([
                            'taxable_amount' => number_format(($amountCents - $vatCents) / 100, 2, '.', ''),
                            'vat_amount' => number_format($vatCents / 100, 2, '.', ''),
                        ]);
                }
            }, 'rent_payments.id', 'id');
    }
};
