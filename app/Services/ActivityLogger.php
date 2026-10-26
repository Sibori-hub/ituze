<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Property;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

/**
 * Writes "who did what" lines for an owner's workspace. Only actions done by
 * a signed-in person are recorded (not imports, seeders or scheduled jobs).
 */
class ActivityLogger
{
    /** Side effects of another action (a unit turning occupied): no separate message. */
    private const QUIET = ['room.updated', 'lease.status'];

    /** @var array<int, true> log lines to tell the managed owner about, sent once the request ends */
    private static array $toTell = [];
    public static function record(
        string $action,
        string $description,
        ?int $propertyId,
        ?object $subject = null,
        ?float $amount = null,
        ?string $groupKey = null,
    ): void {
        $actor = Auth::user();
        if (! $actor || app()->runningInConsole() && ! app()->runningUnitTests()) {
            return;
        }

        // Monitoring must never stop the real work (a payment, an assignment).
        try {
            self::write($actor, $action, $description, $propertyId, $subject, $amount, $groupKey);
        } catch (\Throwable $e) {
            Log::warning('Activity log not written: '.$e->getMessage(), ['action' => $action]);
        }
    }

    private static function write(
        $actor,
        string $action,
        string $description,
        ?int $propertyId,
        ?object $subject,
        ?float $amount,
        ?string $groupKey,
    ): void {
        // Records without a building (a new tenant) belong to the actor's workspace.
        $ownerId = $propertyId ? Property::query()->whereKey($propertyId)->value('owner_id') : $actor->workspaceOwnerId();

        // One payment can cover several months: keep it as a single line.
        if ($groupKey !== null) {
            $existing = ActivityLog::query()->where('group_key', $groupKey)->first();
            if ($existing) {
                $existing->update([
                    'amount' => (float) $existing->amount + (float) $amount,
                    'description' => $description,
                ]);

                return;
            }
        }

        $log = ActivityLog::create([
            'actor_id' => $actor->id,
            'owner_id' => $ownerId,
            'property_id' => $propertyId,
            'action' => $action,
            'subject_type' => $subject ? class_basename($subject) : null,
            'subject_id' => $subject->id ?? null,
            'description' => mb_substr($description, 0, 500),
            'amount' => $amount,
            'group_key' => $groupKey,
            'created_at' => now(),
        ]);
        self::tellManagedOwner($log, $actor);
    }

    /**
     * An owner Q.R.A manages is told by email and SMS of each thing Q.R.A does
     * in their buildings. Sent when the request ends, so a payment covering
     * several months goes out once with its full amount.
     */
    private static function tellManagedOwner(ActivityLog $log, $actor): void
    {
        if (! $log->owner_id || $log->owner_id === $actor->id || in_array($log->action, self::QUIET, true)) {
            return;
        }
        if (self::$toTell === []) {
            app()->terminating(static function () {
                $ids = array_keys(self::$toTell);
                self::$toTell = [];
                foreach (ActivityLog::query()->with(['owner', 'property:id,name'])->whereKey($ids)->get() as $line) {
                    $owner = $line->owner;
                    if (! $owner || $owner->role !== 'owner' || ! $owner->isManaged() || $owner->isDisabled()) {
                        continue;
                    }
                    try {
                        $owner->notify(new \App\Notifications\ManagedOwnerActivity(
                            $line->description,
                            $line->property?->name,
                            $line->amount !== null ? (float) $line->amount : null,
                            $line->created_at?->timezone('Africa/Kigali')->format('j M Y, H:i') ?? '',
                        ));
                    } catch (\Throwable $e) {
                        Log::warning('Managed owner not told: '.$e->getMessage(), ['log' => $line->id]);
                    }
                }
            });
        }
        self::$toTell[$log->id] = true;
    }
}
