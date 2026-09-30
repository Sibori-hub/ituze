<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $payments = DB::table('rent_payments')
            ->join('rent_charges', 'rent_charges.id', '=', 'rent_payments.rent_charge_id')
            ->where('rent_charges.charge_type', 'rent')
            ->whereNotNull('rent_payments.reference')
            ->where('rent_payments.reference', '<>', '')
            ->orderBy('rent_payments.id')
            ->get([
                'rent_payments.id',
                'rent_charges.tenancy_id',
                'rent_payments.transaction_id',
                'rent_payments.method',
                'rent_payments.reference',
                'rent_payments.receipt_number',
                'rent_payments.paid_at',
            ]);

        $payments->groupBy(fn ($payment) => implode('|', [
            $payment->tenancy_id,
            $payment->method,
            $payment->reference,
            substr((string) $payment->paid_at, 0, 16),
        ]))->filter(fn ($group) => $group->count() > 1)
            ->each(function ($group) {
                $paymentIds = $group->pluck('id');
                $transactionId = $group->pluck('transaction_id')->filter()->first() ?: (string) Str::uuid();
                $receiptNumber = $group->pluck('receipt_number')->filter()->first();

                DB::table('rent_payments')
                    ->whereIn('id', $paymentIds)
                    ->update([
                        'transaction_id' => $transactionId,
                        'receipt_number' => $receiptNumber,
                    ]);
            });
    }

    public function down(): void
    {
        $payments = DB::table('rent_payments')
            ->join('rent_charges', 'rent_charges.id', '=', 'rent_payments.rent_charge_id')
            ->where('rent_charges.charge_type', 'rent')
            ->whereNotNull('rent_payments.reference')
            ->where('rent_payments.reference', '<>', '')
            ->orderBy('rent_payments.id')
            ->get([
                'rent_payments.id',
                'rent_charges.tenancy_id',
                'rent_payments.transaction_id',
                'rent_payments.method',
                'rent_payments.reference',
                'rent_payments.paid_at',
            ]);

        $payments->groupBy(fn ($payment) => implode('|', [
            $payment->tenancy_id,
            $payment->method,
            $payment->reference,
            substr((string) $payment->paid_at, 0, 16),
        ]))->filter(fn ($group) => $group->count() > 1)
            ->each(function ($group) {
                foreach ($group as $payment) {
                    DB::table('rent_payments')
                        ->where('id', $payment->id)
                        ->update([
                            'transaction_id' => (string) Str::uuid(),
                            'receipt_number' => sprintf('ITZ-%s-%06d', substr((string) $payment->paid_at, 0, 4), $payment->id),
                        ]);
                }
            });
    }
};
