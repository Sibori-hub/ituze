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

        ActivityLog::create([
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
    }
}
