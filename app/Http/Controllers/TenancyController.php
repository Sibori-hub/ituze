<?php

namespace App\Http\Controllers;

use App\Models\Lease;
use App\Models\MoveOutInspection;
use App\Models\Property;
use App\Models\RentCharge;
use App\Models\RentPayment;
use App\Models\Tenancy;
use App\Models\Tenant;
use App\Models\Unit;
use App\Services\RentScheduleService;
use App\Services\TenantLocationService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TenancyController extends Controller
{
    private const LEASE_MAX_KB = 10240;

    private const LEASE_MIMES = 'pdf,doc,docx,jpg,jpeg,png';

    /**
     * Create a tenant that can be assigned to a unit owned by the current user.
     */
    public function storeTenant(Request $request, Property $property): RedirectResponse
    {
        $this->authorizeManager($request->user());
        $this->authorizePropertyAccess($request->user(), $property);

        $data = $request->validate([
            ...app(TenantLocationService::class)->validationRules($request),
            'type' => ['required', 'in:individual,company'],
            'first_name' => ['required_if:type,individual', 'nullable', 'string', 'max:255'],
            'last_name' => ['required_if:type,individual', 'nullable', 'string', 'max:255'],
            'identity_type' => ['required', 'in:national_id,passport'],
            'identity_number' => ['required', 'string', 'max:100', Rule::when($request->input('identity_type') === 'national_id', ['digits:16'])],
            'name' => ['nullable', 'string', 'max:255'],
            'company_name' => ['required_if:type,company', 'nullable', 'string', 'max:255'],
            'tax_identification_number' => ['nullable', 'required_if:type,company', 'string', 'max:100'],
            'contact_person' => ['required_if:type,company', 'nullable', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'regex:/^(078|072|073)[0-9]{7}$/'],
        ]);

        Tenant::create([
            ...$data,
            'name' => $data['type'] === 'company'
                ? $data['company_name']
                : trim($data['first_name'].' '.$data['last_name']),
            'national_id' => $data['identity_type'] === 'national_id' ? $data['identity_number'] : null,
            'registration_number' => null,
            'address' => app(TenantLocationService::class)->address($data),
            'created_by' => $request->user()->id,
            'status' => 'active',
        ]);

        return back()->with('success', 'Tenant created successfully.');
    }

    /**
     * Assign a tenant and occupy a unit in one transaction.
     */
    public function store(Request $request, Property $property, Unit $unit): RedirectResponse
    {
        $this->authorizeManager($request->user());
        $this->authorizePropertyAccess($request->user(), $property);

        if ($unit->property_id !== $property->id) {
            abort(404);
        }

        $request->merge(['tenant_type' => $request->input('tenant_type', $request->input('type'))]);
        $hasExistingTenant = $request->filled('tenant_id');
        $tenantType = $request->input('tenant_type');
        $requiredForNewTenant = fn (string $type) => $hasExistingTenant ? 'nullable' : "required_if:tenant_type,{$type}";
        $data = $request->validate([
            'tenant_id' => ['nullable', 'exists:tenants,id'],
            'tenant_type' => ['required_without:tenant_id', 'nullable', 'in:individual,company'],
            'first_name' => [$requiredForNewTenant('individual'), 'nullable', 'string', 'max:255'],
            'last_name' => [$requiredForNewTenant('individual'), 'nullable', 'string', 'max:255'],
            'email' => [$hasExistingTenant ? 'nullable' : 'required', 'email', 'max:255'],
            'phone' => [$hasExistingTenant ? 'nullable' : 'required', 'regex:/^(078|072|073)[0-9]{7}$/'],
            'identity_type' => [$hasExistingTenant ? 'nullable' : 'required', 'in:national_id,passport'],
            'identity_number' => [
                $hasExistingTenant ? 'nullable' : 'required',
                'string',
                'max:100',
                Rule::when(! $hasExistingTenant && $request->input('identity_type') === 'national_id', ['digits:16']),
            ],
            'company_name' => [$requiredForNewTenant('company'), 'nullable', 'string', 'max:255'],
            'tax_identification_number' => [$requiredForNewTenant('company'), 'nullable', 'string', 'max:100'],
            'contact_person' => [$requiredForNewTenant('company'), 'nullable', 'string', 'max:255'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'monthly_rent' => ['required', 'numeric', 'decimal:0,2', 'gt:0'],
            'rent_frequency' => ['required', 'in:daily,weekly,monthly,quarterly,yearly'],
            'deposit_amount' => ['nullable', 'numeric', 'decimal:0,2', 'min:0'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'lease_notes' => ['nullable', 'string', 'max:1000'],
            'payment_method' => ['required', 'in:cash,bank_transfer,mobile_money,other'],
            'payment_reference' => ['required_if:payment_method,bank_transfer,mobile_money', 'nullable', 'string', 'max:255'],
            'lease' => ['required', 'file', 'mimes:'.self::LEASE_MIMES, 'max:'.self::LEASE_MAX_KB],
            ...($hasExistingTenant ? [] : app(TenantLocationService::class)->validationRules($request)),
        ]);

        DB::transaction(function () use ($data, $request, $unit, $tenantType) {
            $lockedUnit = Unit::whereKey($unit->id)->lockForUpdate()->firstOrFail();

            if ($lockedUnit->status !== 'available' ||
                $lockedUnit->tenancies()->whereIn('status', ['active', 'scheduled'])->exists()) {
                throw ValidationException::withMessages([
                    'unit_id' => 'This unit is not available or already has an active tenancy.',
                ]);
            }

            if (! empty($data['tenant_id'])) {
                $tenantQuery = Tenant::whereKey($data['tenant_id'])->where('status', 'active');
            } else {
                $tenant = Tenant::create([
                    'created_by' => $request->user()->id,
                    'type' => $tenantType,
                    'name' => $tenantType === 'company'
                        ? $data['company_name']
                        : trim($data['first_name'].' '.$data['last_name']),
                    'first_name' => $data['first_name'] ?? null,
                    'last_name' => $data['last_name'] ?? null,
                    'company_name' => $data['company_name'] ?? null,
                    'registration_number' => null,
                    'tax_identification_number' => $data['tax_identification_number'] ?? null,
                    'contact_person' => $data['contact_person'] ?? null,
                    'identity_type' => $data['identity_type'] ?? null,
                    'identity_number' => $data['identity_number'] ?? null,
                    'national_id' => ($data['identity_type'] ?? null) === 'national_id' ? $data['identity_number'] : null,
                    'email' => $data['email'] ?? null,
                    'phone' => $data['phone'] ?? null,
                    'address' => app(TenantLocationService::class)->address($data),
                    'province_id' => $data['province_id'],
                    'district_id' => $data['district_id'],
                    'sector_id' => $data['sector_id'],
                    'status' => 'active',
                ]);
                $tenantQuery = Tenant::whereKey($tenant->id);
            }
            if (! $request->user()->isAdmin() && isset($tenantQuery)) {
                $tenantQuery->where(function ($query) use ($request) {
                    $query->where('created_by', $request->user()->id)
                        ->orWhereHas('tenancies.unit.property', fn ($property) => $property->where('owner_id', $request->user()->id));
                });
            }
            $tenant = $tenantQuery->first();
            if (! $tenant) {
                throw ValidationException::withMessages([
                    'tenant_id' => 'The selected tenant is not active.',
                ]);
            }
            if (
                ! $tenant->email
                || ! $tenant->phone
                || ! $tenant->address
                || ! $tenant->identity_type
                || ! $tenant->identity_number
                || ($tenant->type === 'individual' && (! $tenant->first_name || ! $tenant->last_name))
                || ($tenant->type === 'company' && (
                    ! $tenant->company_name
                    || ! $tenant->tax_identification_number
                    || ! $tenant->contact_person
                ))
            ) {
                throw ValidationException::withMessages([
                    'tenant_id' => 'This tenant record is missing required identity or contact details. Complete those details before assigning the tenant.',
                ]);
            }

            $tenancy = Tenancy::create([
                'unit_id' => $lockedUnit->id,
                'tenant_id' => $tenant->id,
                'assigned_by' => $request->user()->id,
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
                'monthly_rent' => $data['monthly_rent'],
                'rent_frequency' => $data['rent_frequency'],
                'due_day' => null,
                'deposit_amount' => $data['deposit_amount'] ?? null,
                'notes' => $data['notes'] ?? null,
                'status' => CarbonImmutable::parse($data['start_date'])->isFuture() ? 'scheduled' : 'active',
            ]);

            $this->storeLeaseDocument($tenancy, $request, $data['lease'], $data['lease_notes'] ?? null, $data['payment_method'], $data['payment_reference'] ?? null);
            $lockedUnit->update([
                'status' => $tenancy->status === 'scheduled' ? 'reserved' : 'occupied',
            ]);
            app(RentScheduleService::class)->createCharges($tenancy);

            if ((int) round((float) $tenancy->deposit_amount * 100) > 0) {
                $depositCharge = $tenancy->rentCharges()
                    ->where('charge_type', 'deposit')
                    ->firstOrFail();
                $depositCents = (int) round((float) $depositCharge->amount * 100);
                $depositPayment = RentPayment::create([
                    'rent_charge_id' => $depositCharge->id,
                    'recorded_by' => $request->user()->id,
                    'amount' => number_format($depositCents / 100, 2, '.', ''),
                    'method' => $data['payment_method'],
                    'reference' => $data['payment_reference'] ?? null,
                    'notes' => 'Full security deposit received. Rent allocations and VAT are recorded separately against rent charges.',
                    'paid_at' => now(),
                ]);
                $depositPayment->update([
                    'receipt_number' => sprintf('ITZ-%s-%06d', now()->format('Y'), $depositPayment->id),
                ]);

                $vatRate = (int) round(config('finance.rwanda_vat_rate') * 100);
                $availableDepositCents = $depositCents;
                $rentCharges = $tenancy->rentCharges()
                    ->where('charge_type', 'rent')
                    ->orderBy('due_date')
                    ->get();
                foreach ($rentCharges as $rentCharge) {
                    if ($availableDepositCents <= 0) {
                        break;
                    }
                    $rentCents = min($availableDepositCents, (int) round((float) $rentCharge->amount * 100));
                    $vatCents = (int) round($rentCents * $vatRate / 10000);
                    $rentPayment = RentPayment::create([
                        'rent_charge_id' => $rentCharge->id,
                        'recorded_by' => $request->user()->id,
                        'amount' => number_format($rentCents / 100, 2, '.', ''),
                        'taxable_amount' => number_format($rentCents / 100, 2, '.', ''),
                        'vat_rate' => number_format($vatRate / 100, 2, '.', ''),
                        'vat_amount' => number_format($vatCents / 100, 2, '.', ''),
                        'method' => $data['payment_method'],
                        'reference' => $data['payment_reference'] ?? null,
                        'notes' => 'Rent paid from the received security deposit. Remaining deposit credit is calculated separately.',
                        'paid_at' => now(),
                    ]);
                    $rentPayment->update([
                        'receipt_number' => sprintf('ITZ-%s-%06d', now()->format('Y'), $rentPayment->id),
                    ]);
                    $availableDepositCents -= $rentCents;
                }
            }
        });

        $redirect = ! empty($data['tenant_id'])
            ? redirect()->route('tenants.show', $data['tenant_id'])
            : redirect()->route('properties.units.index', $property);

        return $redirect->with('success', 'Tenancy created and rent schedule generated.');
    }

    public function storePayment(Request $request, Property $property, Unit $unit, Tenancy $tenancy, RentCharge $charge): RedirectResponse
    {
        $this->authorizeTenancyAccess($request->user(), $property, $unit, $tenancy);
        if ($charge->tenancy_id !== $tenancy->id) {
            abort(404);
        }
        if ($charge->voided_at) {
            throw ValidationException::withMessages([
                'amount' => 'Payments cannot be recorded against a cancelled charge.',
            ]);
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'decimal:0,2', 'gt:0'],
            'method' => ['required', 'in:cash,bank_transfer,mobile_money,other'],
            'paid_at' => ['required', 'date', 'before_or_equal:now'],
            'reference' => [
                'required_if:method,bank_transfer,mobile_money',
                'nullable',
                'string',
                'max:255',
            ],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($data, $request, $unit, $tenancy, $charge) {
            Unit::query()->whereKey($unit->id)->lockForUpdate()->firstOrFail();
            $lockedTenancy = Tenancy::query()->whereKey($tenancy->id)->lockForUpdate()->firstOrFail();
            if ($lockedTenancy->status === 'cancelled') {
                throw ValidationException::withMessages([
                    'amount' => 'Payments cannot be recorded against a cancelled tenancy.',
                ]);
            }
            $lockedCharge = RentCharge::query()->whereKey($charge->id)->lockForUpdate()->firstOrFail();
            if ($lockedCharge->voided_at) {
                throw ValidationException::withMessages([
                    'amount' => 'Payments cannot be recorded against a cancelled charge.',
                ]);
            }
            $paidCents = (int) round((float) $lockedCharge->payments()->sum('amount') * 100);
            $chargeCents = (int) round((float) $lockedCharge->amount * 100);
            $paymentCents = (int) round((float) $data['amount'] * 100);

            if ($paymentCents > $chargeCents - $paidCents) {
                throw ValidationException::withMessages([
                    'amount' => 'The payment cannot exceed the remaining charge balance.',
                ]);
            }

            $vatRate = (int) round(config('finance.rwanda_vat_rate') * 100);
            $vatCents = (int) round($paymentCents * $vatRate / 10000);

            $payment = RentPayment::create([
                'rent_charge_id' => $lockedCharge->id,
                'recorded_by' => $request->user()->id,
                'amount' => number_format($paymentCents / 100, 2, '.', ''),
                'taxable_amount' => $vatCents === null ? null : number_format($paymentCents / 100, 2, '.', ''),
                'vat_rate' => $vatCents === null ? null : number_format($vatRate / 100, 2, '.', ''),
                'vat_amount' => $vatCents === null ? null : number_format($vatCents / 100, 2, '.', ''),
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? null,
                'paid_at' => $data['paid_at'],
            ]);
            $payment->update([
                'receipt_number' => sprintf('ITZ-%s-%06d', now()->format('Y'), $payment->id),
            ]);
        });

        return back()->with('success', 'Payment recorded and receipt number generated.');
    }

    public function renew(Request $request, Property $property, Unit $unit, Tenancy $tenancy): RedirectResponse
    {
        $this->authorizeTenancyAccess($request->user(), $property, $unit, $tenancy);
        if ($tenancy->status !== 'active' || $tenancy->moveOutInspection()->exists()) {
            throw ValidationException::withMessages([
                'tenancy' => 'Only an active tenancy that has not been settled can be renewed.',
            ]);
        }

        $data = $request->validate([
            'start_date' => ['required', 'date', 'after_or_equal:today'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'monthly_rent' => ['required', 'numeric', 'decimal:0,2', 'gt:0'],
            'rent_frequency' => ['required', 'in:daily,weekly,monthly,quarterly,yearly'],
            'due_day' => ['nullable', 'required_if:rent_frequency,monthly', 'integer', 'between:1,31'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'lease_notes' => ['nullable', 'string', 'max:1000'],
            'payment_method' => ['required', 'in:cash,bank_transfer,mobile_money,other'],
            'payment_reference' => ['required_if:payment_method,bank_transfer,mobile_money', 'nullable', 'string', 'max:255'],
            'lease' => ['required', 'file', 'mimes:'.self::LEASE_MIMES, 'max:'.self::LEASE_MAX_KB],
        ]);
        if ($tenancy->end_date && CarbonImmutable::parse($data['start_date'])->lessThanOrEqualTo($tenancy->end_date->startOfDay())) {
            throw ValidationException::withMessages([
                'start_date' => 'A renewal must start after the current lease end date.',
            ]);
        }

        DB::transaction(function () use ($data, $request, $unit, $tenancy) {
            $lockedUnit = Unit::query()->whereKey($unit->id)->lockForUpdate()->firstOrFail();
            $lockedTenancy = Tenancy::query()->whereKey($tenancy->id)->lockForUpdate()->firstOrFail();
            if (
                $lockedTenancy->status !== 'active'
                || $lockedTenancy->moveOutInspection()->exists()
                || $lockedTenancy->renewals()->whereIn('status', ['active', 'scheduled'])->exists()
            ) {
                throw ValidationException::withMessages([
                    'tenancy' => 'This tenancy already has an active or scheduled renewal.',
                ]);
            }

            $renewal = Tenancy::create([
                'unit_id' => $lockedUnit->id,
                'renewed_from_id' => $lockedTenancy->id,
                'tenant_id' => $lockedTenancy->tenant_id,
                'assigned_by' => $request->user()->id,
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
                'monthly_rent' => $data['monthly_rent'],
                'rent_frequency' => $data['rent_frequency'],
                'due_day' => $data['rent_frequency'] === 'monthly' ? $data['due_day'] : null,
                'deposit_amount' => $lockedTenancy->deposit_amount,
                'notes' => $data['notes'] ?? null,
                'status' => CarbonImmutable::parse($data['start_date'])->isFuture() ? 'scheduled' : 'active',
            ]);

            $this->storeLeaseDocument($renewal, $request, $data['lease'], $data['lease_notes'] ?? null, $data['payment_method'], $data['payment_reference'] ?? null);

            app(RentScheduleService::class)->createCharges($renewal, false);

            if ($renewal->status === 'active') {
                $lockedTenancy->update([
                    'status' => 'ended',
                    'actual_end_date' => CarbonImmutable::parse($data['start_date'])->subDay()->toDateString(),
                ]);
                $lockedUnit->update(['status' => 'occupied']);
            }
        });

        return back()->with('success', 'Renewal recorded. The existing deposit carries forward to this lease.');
    }

    public function moveOut(Request $request, Property $property, Unit $unit, Tenancy $tenancy): RedirectResponse
    {
        $this->authorizeTenancyAccess($request->user(), $property, $unit, $tenancy);
        if ($tenancy->status !== 'active' || $tenancy->moveOutInspection()->exists()) {
            throw ValidationException::withMessages([
                'tenancy' => 'Only an active tenancy without a completed move-out inspection can be ended.',
            ]);
        }

        $data = $request->validate([
            'move_out_date' => ['required', 'date', 'before_or_equal:today'],
            'condition_notes' => ['required', 'string', 'max:5000'],
            'damage_cost' => ['required', 'numeric', 'decimal:0,2', 'min:0'],
            'deduction_notes' => ['nullable', 'string', 'max:5000'],
            'unit_outcome' => ['required', 'in:available,maintenance'],
        ]);
        if (CarbonImmutable::parse($data['move_out_date'])->lessThan($tenancy->start_date->startOfDay())) {
            throw ValidationException::withMessages([
                'move_out_date' => 'The move-out date cannot be before the tenancy start date.',
            ]);
        }

        DB::transaction(function () use ($data, $request, $unit, $tenancy) {
            $lockedUnit = Unit::query()->whereKey($unit->id)->lockForUpdate()->firstOrFail();
            $lockedTenancy = Tenancy::query()->whereKey($tenancy->id)->lockForUpdate()->firstOrFail();
            if ($lockedTenancy->status !== 'active' || $lockedTenancy->moveOutInspection()->exists()) {
                throw ValidationException::withMessages([
                    'tenancy' => 'This tenancy has already ended or been inspected.',
                ]);
            }
            $chain = $lockedTenancy->renewalChain();
            $chainIds = $chain->pluck('id');
            $depositReceivedCents = (int) round(
                (float) RentPayment::query()
                    ->whereHas('charge', fn ($query) => $query
                        ->whereIn('tenancy_id', $chainIds)
                        ->where('charge_type', 'deposit'))
                    ->sum('amount') * 100,
            );
            $damageCents = (int) round((float) $data['damage_cost'] * 100);
            if ($damageCents > 0 && empty($data['deduction_notes'])) {
                throw ValidationException::withMessages([
                    'deduction_notes' => 'Explain any deductions from the deposit.',
                ]);
            }
            $depositDeductedCents = min($damageCents, $depositReceivedCents);
            $depositRefundedCents = max(0, $depositReceivedCents - $damageCents);
            $excessDamageCents = max(0, $damageCents - $depositReceivedCents);

            foreach ($chain as $linkedTenancy) {
                $scheduledRenewals = $linkedTenancy->renewals()->where('status', 'scheduled')->get();
                foreach ($scheduledRenewals as $scheduledRenewal) {
                    $scheduledRenewal->update(['status' => 'cancelled']);
                    $scheduledRenewal->rentCharges()
                        ->whereDoesntHave('payments')
                        ->update([
                            'voided_at' => now(),
                            'voided_reason' => 'Scheduled renewal was cancelled at move-out.',
                        ]);
                }
            }
            RentCharge::query()
                ->whereIn('tenancy_id', $chainIds)
                ->where('charge_type', 'rent')
                ->whereDate('due_date', '>', $data['move_out_date'])
                ->whereDoesntHave('payments')
                ->update([
                    'voided_at' => now(),
                    'voided_reason' => 'Tenancy ended before this charge was due.',
                ]);

            MoveOutInspection::create([
                'tenancy_id' => $lockedTenancy->id,
                'inspected_by' => $request->user()->id,
                'move_out_date' => $data['move_out_date'],
                'condition_notes' => $data['condition_notes'],
                'deposit_received' => number_format($depositReceivedCents / 100, 2, '.', ''),
                'deposit_refunded' => number_format($depositRefundedCents / 100, 2, '.', ''),
                'deposit_deducted' => number_format($depositDeductedCents / 100, 2, '.', ''),
                'damage_cost' => number_format($damageCents / 100, 2, '.', ''),
                'deduction_notes' => $data['deduction_notes'] ?? null,
                'unit_outcome' => $data['unit_outcome'],
            ]);

            if ($excessDamageCents > 0) {
                $moveOutDate = CarbonImmutable::parse($data['move_out_date'])->toDateString();
                RentCharge::query()->firstOrCreate(
                    [
                        'tenancy_id' => $lockedTenancy->id,
                        'charge_type' => 'damage',
                        'period_start' => $moveOutDate,
                    ],
                    [
                        'period_end' => null,
                        'due_date' => $moveOutDate,
                        'amount' => number_format($excessDamageCents / 100, 2, '.', ''),
                    ],
                );
            }

            $lockedTenancy->update([
                'status' => 'ended',
                'actual_end_date' => $data['move_out_date'],
            ]);
            $lockedUnit->update(['status' => $data['unit_outcome']]);
        });

        return back()->with('success', 'Move-out inspection saved and the tenancy ended.');
    }

    public function uploadLease(Request $request, Property $property, Unit $unit, Tenancy $tenancy): RedirectResponse
    {
        $this->authorizeTenancyAccess($request->user(), $property, $unit, $tenancy);

        try {
            $data = $request->validate([
                'lease' => ['required', 'file', 'mimes:'.self::LEASE_MIMES, 'max:'.self::LEASE_MAX_KB],
                'notes' => ['nullable', 'string', 'max:1000'],
                'payment_method' => ['required', 'in:cash,bank_transfer,mobile_money,other'],
                'payment_reference' => ['required_if:payment_method,bank_transfer,mobile_money', 'nullable', 'string', 'max:255'],
            ]);
            $this->storeLeaseDocument($tenancy, $request, $data['lease'], $data['notes'] ?? null, $data['payment_method'], $data['payment_reference'] ?? null);

            return back()->with('success', 'Lease uploaded successfully.');
        } catch (ValidationException $e) {
            Log::warning('Lease upload validation failed.', ['user_id' => $request->user()->id, 'tenancy_id' => $tenancy->id, 'errors' => $e->errors()]);
            throw $e;
        } catch (\Throwable $e) {
            Log::error('Lease upload failed.', ['user_id' => $request->user()->id, 'tenancy_id' => $tenancy->id, 'error' => $e->getMessage()]);

            return back()->with('error', 'The lease could not be uploaded.');
        }
    }

    public function downloadLease(Request $request, Property $property, Unit $unit, Tenancy $tenancy, Lease $lease): StreamedResponse
    {
        $this->authorizeTenancyAccess($request->user(), $property, $unit, $tenancy);
        $this->ensureLeaseBelongsToTenancy($lease, $tenancy);
        if (! Storage::disk('local')->exists($lease->path)) {
            Log::warning('Lease download requested for missing file.', ['lease_id' => $lease->id]);
            abort(404);
        }

        return Storage::disk('local')->download($lease->path, $lease->original_name);
    }

    public function deleteLease(Request $request, Property $property, Unit $unit, Tenancy $tenancy, Lease $lease): RedirectResponse
    {
        $this->authorizeTenancyAccess($request->user(), $property, $unit, $tenancy);
        $this->ensureLeaseBelongsToTenancy($lease, $tenancy);
        Storage::disk('local')->delete($lease->path);
        $lease->delete();

        return back()->with('success', 'Lease deleted successfully.');
    }

    private function authorizeTenancyAccess($user, Property $property, Unit $unit, Tenancy $tenancy): void
    {
        if (! $user->isAdmin() && $property->owner_id !== $user->id) {
            Log::warning('Unauthorized lease access attempt.', [
                'user_id' => $user->id,
                'property_id' => $property->id,
                'tenancy_id' => $tenancy->id,
            ]);
            abort(403, 'You do not have permission to access this property.');
        }
        if ($unit->property_id !== $property->id || $tenancy->unit_id !== $unit->id) {
            abort(404);
        }
    }

    private function ensureLeaseBelongsToTenancy(Lease $lease, Tenancy $tenancy): void
    {
        if ($lease->tenancy_id !== $tenancy->id) {
            abort(404);
        }
    }

    private function storeLeaseDocument(
        Tenancy $tenancy,
        Request $request,
        UploadedFile $file,
        ?string $notes,
        string $paymentMethod,
        ?string $paymentReference,
    ): Lease {
        $path = $file->store('leases/'.$tenancy->id, 'local');
        $lease = $tenancy->leases()->create([
            'uploaded_by' => $request->user()->id,
            'payment_method' => $paymentMethod,
            'payment_reference' => $paymentReference,
            'original_name' => $file->getClientOriginalName(),
            'path' => $path,
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'notes' => $notes,
        ]);
        $lease->update([
            'reference_number' => sprintf('ITZ-LSE-%s-%06d', now()->format('Y'), $lease->id),
        ]);

        return $lease;
    }

    private function authorizePropertyAccess($user, Property $property): void
    {
        if (! $user->isAdmin() && $property->owner_id !== $user->id) {
            abort(403, 'You do not have permission to access this property.');
        }

    }

    private function authorizeManager($user): void
    {
        if (! $user || ! in_array($user->role, ['admin', 'owner'], true)) {
            abort(403, 'Only administrators and owners can manage tenancies.');
        }
    }
}
