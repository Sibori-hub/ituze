<?php

namespace App\Console\Commands;

use App\Models\Tenancy;
use App\Models\User;
use App\Notifications\LeaseEndingReminder;
use App\Services\WhatsAppCloudService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Throwable;

/**
 * Reminds the admins, the owner and the tenant before a lease ends (60, 30 and
 * 7 days), and the admins and owner when a lease has expired without renewal.
 * Each reminder is sent once; a missed day is caught up the next run.
 */
class SendLeaseReminders extends Command
{
    protected $signature = 'leases:send-reminders';

    protected $description = 'Send lease-ending reminders by email and WhatsApp.';

    /** Window => [more than N days left, up to M days left]. */
    private const WINDOWS = [
        'days_60' => [30, 60],
        'days_30' => [7, 30],
        'days_7' => [-1, 7],
    ];

    public function handle(WhatsAppCloudService $whatsApp): int
    {
        $today = CarbonImmutable::today();
        $sent = 0;

        $tenancies = Tenancy::query()
            ->where('status', 'active')
            ->whereNotNull('end_date')
            ->where('end_date', '<=', $today->addDays(60)->toDateString())
            ->whereDoesntHave('renewals', fn ($renewal) => $renewal->whereIn('status', ['active', 'scheduled']))
            ->with(['tenant', 'unit.property.owner'])
            ->get();

        foreach ($tenancies as $tenancy) {
            $daysLeft = (int) $today->diffInDays(CarbonImmutable::parse($tenancy->end_date)->startOfDay(), false);
            $kind = $daysLeft < 0 ? 'expired' : $this->windowFor($daysLeft);
            if (! $kind) {
                continue;
            }

            // Claim the reminder first so two runs can never send it twice.
            $claimed = DB::table('lease_reminders')->insertOrIgnore([
                'tenancy_id' => $tenancy->id,
                'kind' => $kind,
                'sent_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            if (! $claimed) {
                continue;
            }

            $recipients = $this->deliver($tenancy, $kind, $whatsApp);
            DB::table('lease_reminders')->where(['tenancy_id' => $tenancy->id, 'kind' => $kind])->update(['recipients' => $recipients]);
            $sent++;
        }

        $this->info("Lease reminders sent: {$sent}");

        return self::SUCCESS;
    }

    private function windowFor(int $daysLeft): ?string
    {
        foreach (self::WINDOWS as $kind => [$from, $to]) {
            if ($daysLeft > $from && $daysLeft <= $to) {
                return $kind;
            }
        }

        return null;
    }

    private function deliver(Tenancy $tenancy, string $kind, WhatsAppCloudService $whatsApp): int
    {
        $owner = $tenancy->unit?->property?->owner;
        $staff = User::query()->where('role', 'admin')->where('status', '!=', 'disabled')->get()
            ->when($owner, fn ($users) => $users->push($owner))
            ->unique('id');
        $count = 0;

        foreach ($staff as $user) {
            if ($user->email) {
                $user->notify(new LeaseEndingReminder($tenancy, $kind, 'staff'));
                $count++;
            }
            $this->whatsApp($whatsApp, $user->phone, $tenancy, $kind, 'staff');
        }

        // Tenants hear about the coming end of their lease, not the internal "expired" alert.
        if ($kind !== 'expired' && $tenancy->tenant) {
            if ($tenancy->tenant->email) {
                Notification::route('mail', $tenancy->tenant->email)->notify(new LeaseEndingReminder($tenancy, $kind, 'tenant'));
                $count++;
            }
            $this->whatsApp($whatsApp, $tenancy->tenant->phone, $tenancy, $kind, 'tenant');
        }

        return $count;
    }

    private function whatsApp(WhatsAppCloudService $whatsApp, ?string $phone, Tenancy $tenancy, string $kind, string $audience): void
    {
        if (! $phone) {
            return;
        }

        $lines = LeaseEndingReminder::lines($tenancy, $kind, $audience);
        $message = $lines['subject']."\n\n".implode("\n", $lines['body'])."\n\nITUZE GREEN PLATFORM";

        if (! $whatsApp->isConfigured()) {
            Log::info('WhatsApp not configured; lease reminder not sent', ['to' => $phone, 'message' => $message]);

            return;
        }

        try {
            $whatsApp->sendText($phone, $message);
        } catch (Throwable $e) {
            Log::warning('Lease reminder WhatsApp failed: '.$e->getMessage(), ['to' => $phone]);
        }
    }
}
