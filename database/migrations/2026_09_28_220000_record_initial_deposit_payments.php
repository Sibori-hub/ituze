<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('rent_charges')
            ->join('tenancies', 'tenancies.id', '=', 'rent_charges.tenancy_id')
            ->join('leases', 'leases.tenancy_id', '=', 'tenancies.id')
            ->leftJoin('rent_payments', 'rent_payments.rent_charge_id', '=', 'rent_charges.id')
            ->where('rent_charges.charge_type', 'deposit')
            ->whereNull('rent_payments.id')
            ->whereNotNull('leases.payment_method')
            ->whereRaw('leases.id = (SELECT MIN(initial_lease.id) FROM leases AS initial_lease WHERE initial_lease.tenancy_id = tenancies.id)')
            ->select([
                'rent_charges.id as id',
                'rent_charges.amount',
                'leases.payment_method',
                'leases.payment_reference',
                'leases.uploaded_by',
                'leases.created_at as lease_created_at',
                'tenancies.start_date',
            ])
            ->orderBy('rent_charges.id')
            ->chunkById(500, function ($charges) {
                foreach ($charges as $charge) {
                    $amountCents = (int) round((float) $charge->amount * 100);
                    if ($amountCents <= 0) {
                        continue;
                    }

                    $paidAt = $charge->lease_created_at ?: $charge->start_date;
                    $paymentId = DB::table('rent_payments')->insertGetId([
                        'rent_charge_id' => $charge->id,
                        'recorded_by' => $charge->uploaded_by,
                        'amount' => number_format($amountCents / 100, 2, '.', ''),
                        'method' => $charge->payment_method,
                        'reference' => $charge->payment_reference,
                        'notes' => 'Initial security deposit payment imported from lease payment details.',
                        'paid_at' => $paidAt,
                        'created_at' => $paidAt,
                        'updated_at' => $paidAt,
                    ]);

                    DB::table('rent_payments')
                        ->where('id', $paymentId)
                        ->update([
                            'receipt_number' => sprintf('ITZ-%s-%06d', substr($paidAt, 0, 4), $paymentId),
                        ]);
                }
            }, 'rent_charges.id', 'id');
    }

    public function down(): void
    {
        DB::table('rent_payments')
            ->where('notes', 'Initial security deposit payment imported from lease payment details.')
            ->whereIn('rent_charge_id', function ($query) {
                $query->select('id')
                    ->from('rent_charges')
                    ->where('charge_type', 'deposit');
            })
            ->delete();
    }
};
