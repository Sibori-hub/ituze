<?php

namespace App\Observers;

use App\Models\Lease;
use App\Models\MoveOutInspection;
use App\Models\Property;
use App\Models\PropertyUnit;
use App\Models\RentPayment;
use App\Models\Tenancy;
use App\Models\Tenant;
use App\Models\Unit;
use App\Services\ActivityLogger;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

/**
 * Turns changes to the main records into readable activity lines for the
 * owner's monitoring page.
 */
class ActivityObserver
{
    /** Monitoring must never stop the real work. */
    private function safely(callable $write): void
    {
        try {
            $write();
        } catch (\Throwable $e) {
            Log::warning('Activity log not written: '.$e->getMessage());
        }
    }

    private static function money($value): string
    {
        return number_format((float) $value, 0).' RWF';
    }

    private static function room(?Unit $unit): string
    {
        return 'room '.($unit?->unit_number ?? '?').' at '.($unit?->property?->name ?? 'a property');
    }

    public function created(Model $model): void
    {
        $this->safely(fn () => $this->createdActivity($model));
    }

    private function createdActivity(Model $model): void
    {
        match (true) {
            $model instanceof Tenant => ActivityLogger::record('tenant.created', 'Added tenant '.$model->name, null, $model),
            $model instanceof Tenancy => $this->tenancyCreated($model),
            $model instanceof RentPayment => $this->paymentCreated($model),
            $model instanceof Unit => ActivityLogger::record('room.created', 'Added '.self::room($model).' ('.self::money($model->rent_amount).' per '.($model->rent_frequency === 'daily' ? 'night' : 'month').')', $model->property_id, $model),
            $model instanceof PropertyUnit => ActivityLogger::record('unit.created', 'Added unit '.($model->unitType?->name ?? 'unit').' · '.PropertyUnit::floorLabel((int) $model->floor_number).' at '.$model->property?->name, $model->property_id, $model),
            $model instanceof Lease => $this->leaseCreated($model),
            $model instanceof MoveOutInspection => $this->moveOutCreated($model),
            default => null,
        };
    }

    public function updated(Model $model): void
    {
        $this->safely(fn () => $this->updatedActivity($model));
    }

    private function updatedActivity(Model $model): void
    {
        if ($model instanceof Unit) {
            $changes = [];
            if ($model->wasChanged('rent_amount')) {
                $changes[] = 'rent '.self::money($model->getOriginal('rent_amount')).' → '.self::money($model->rent_amount);
            }
            if ($model->wasChanged('status')) {
                $changes[] = 'status '.$model->getOriginal('status').' → '.$model->status;
            }
            if ($model->wasChanged(['unit_number', 'size_sqm', 'description', 'bedrooms', 'bathrooms', 'property_unit_id'])) {
                $changes[] = 'details';
            }
            if ($changes) {
                ActivityLogger::record('room.updated', 'Changed '.self::room($model).': '.implode(', ', $changes), $model->property_id, $model);
            }

            return;
        }

        if ($model instanceof Property && $model->wasChanged(['name', 'address', 'description', 'amenities', 'proximity', 'total_floors', 'basement_floors', 'cell_id'])) {
            ActivityLogger::record('property.updated', 'Updated the details of '.$model->name, $model->id, $model);

            return;
        }

        if ($model instanceof Tenancy && $model->wasChanged('status')) {
            $model->loadMissing(['tenant:id,name', 'unit.property:id,name']);
            ActivityLogger::record('lease.status', 'Lease of '.$model->tenant?->name.' for '.self::room($model->unit).' is now '.$model->status, $model->unit?->property_id, $model);
        }
    }

    public function deleted(Model $model): void
    {
        $this->safely(fn () => $this->deletedActivity($model));
    }

    private function deletedActivity(Model $model): void
    {
        if ($model instanceof Unit) {
            ActivityLogger::record('room.deleted', 'Deleted '.self::room($model), $model->property_id, $model);
        } elseif ($model instanceof PropertyUnit) {
            ActivityLogger::record('unit.deleted', 'Deleted unit '.($model->unitType?->name ?? 'unit').' · '.PropertyUnit::floorLabel((int) $model->floor_number).' at '.$model->property?->name, $model->property_id, $model);
        }
    }

    private function tenancyCreated(Tenancy $tenancy): void
    {
        $tenancy->loadMissing(['tenant:id,name', 'unit.property:id,name']);
        $verb = $tenancy->renewed_from_id ? 'Renewed the lease of ' : 'Assigned ';
        $text = $tenancy->renewed_from_id
            ? $verb.$tenancy->tenant?->name.' for '.self::room($tenancy->unit)
            : $verb.self::room($tenancy->unit).' to '.$tenancy->tenant?->name;
        $term = $tenancy->start_date?->format('j M Y').($tenancy->end_date ? ' – '.$tenancy->end_date->format('j M Y') : '');
        ActivityLogger::record($tenancy->renewed_from_id ? 'lease.renewed' : 'lease.created', $text.' ('.$term.', '.self::money($tenancy->monthly_rent).')', $tenancy->unit?->property_id, $tenancy);
    }

    private function paymentCreated(RentPayment $payment): void
    {
        $payment->loadMissing(['charge.tenancy.tenant:id,name', 'charge.tenancy.unit.property:id,name']);
        $tenancy = $payment->charge?->tenancy;
        $method = str_replace('_', ' ', (string) $payment->method);
        ActivityLogger::record(
            'payment.recorded',
            'Recorded a '.$method.' payment from '.$tenancy?->tenant?->name.' for '.self::room($tenancy?->unit),
            $tenancy?->unit?->property_id,
            $payment,
            (float) $payment->amount,
            $payment->transaction_id ? 'payment:'.$payment->transaction_id : null,
        );
    }

    private function leaseCreated(Lease $lease): void
    {
        $lease->loadMissing(['tenancy.tenant:id,name', 'tenancy.unit.property:id,name']);
        ActivityLogger::record('lease.document', 'Uploaded a lease document for '.$lease->tenancy?->tenant?->name.', '.self::room($lease->tenancy?->unit), $lease->tenancy?->unit?->property_id, $lease);
    }

    private function moveOutCreated(MoveOutInspection $inspection): void
    {
        $inspection->loadMissing(['tenancy.tenant:id,name', 'tenancy.unit.property:id,name']);
        ActivityLogger::record('lease.moved_out', 'Recorded the move-out of '.$inspection->tenancy?->tenant?->name.' from '.self::room($inspection->tenancy?->unit), $inspection->tenancy?->unit?->property_id, $inspection);
    }
}
