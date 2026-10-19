<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/*
 * The subscription is 100,000 RWF every month, with no free year. Owners
 * who registered themselves and were given the old free year lose it:
 * - never paid in the app: they must pay their first month (no paid-until date);
 * - paid in the app: they keep exactly the months they paid for, counted
 *   from their first payment (not added on top of the free year).
 * Q.R.A-managed owners pay a fee on rent instead and are not touched.
 */
return new class extends Migration
{
    public function up(): void
    {
        $owners = DB::table('users')
            ->where('role', 'owner')
            ->whereNull('created_by')
            ->whereNotNull('expires_at')
            ->pluck('id');

        foreach ($owners as $ownerId) {
            $payments = DB::table('subscription_payments')
                ->where('owner_id', $ownerId)
                ->where('status', 'approved')
                ->orderBy('reviewed_at')
                ->orderBy('id')
                ->get(['id', 'months', 'reviewed_at', 'created_at']);

            if ($payments->isEmpty()) {
                DB::table('users')->where('id', $ownerId)->update(['expires_at' => null]);

                continue;
            }

            $end = Carbon::parse($payments->first()->reviewed_at ?? $payments->first()->created_at);
            foreach ($payments as $payment) {
                $start = $end->copy();
                $end = $start->copy()->addMonthsNoOverflow((int) $payment->months);
                DB::table('subscription_payments')->where('id', $payment->id)->update([
                    'period_start' => $start->toDateString(),
                    'period_end' => $end->toDateString(),
                ]);
            }
            DB::table('users')->where('id', $ownerId)->update(['expires_at' => $end]);
        }
    }

    public function down(): void
    {
        // The old free dates are not kept; nothing to restore.
    }
};
