<?php

namespace Tests\Feature;

use App\Models\Lease;
use App\Models\District;
use App\Models\Property;
use App\Models\Province;
use App\Models\RentCharge;
use App\Models\RentPayment;
use App\Models\Sector;
use App\Models\Tenancy;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\UnitType;
use App\Models\User;
use App\Services\RentScheduleService;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RentalLifecycleTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-01-01 10:00:00');

        foreach (['move_out_inspections', 'rent_payments', 'rent_charges', 'leases', 'tenancies', 'tenants', 'units', 'unit_types', 'properties', 'users', 'sectors', 'districts', 'provinces'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->string('role')->default('owner');
            $table->string('status')->default('approved');
            $table->timestamp('expires_at')->nullable();
            $table->boolean('profile_completed')->default(true);
            $table->string('password');
            $table->timestamp('email_verified_at')->nullable();
            $table->string('remember_token')->nullable();
            $table->timestamps();
        });
        Schema::create('provinces', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->timestamps();
        });
        Schema::create('districts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('province_id');
            $table->string('name');
            $table->timestamps();
        });
        Schema::create('sectors', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('district_id');
            $table->string('name');
            $table->timestamps();
        });
        $province = Province::create(['name' => 'Kigali City']);
        $district = District::create(['name' => 'Nyarugenge', 'province_id' => $province->id]);
        Sector::create(['name' => 'Nyarugenge', 'district_id' => $district->id]);
        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users');
            $table->unsignedBigInteger('cell_id')->nullable();
            $table->string('name');
            $table->string('address');
            $table->text('description')->nullable();
            $table->timestamps();
        });
        Schema::create('unit_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->timestamps();
        });
        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained();
            $table->foreignId('unit_type_id')->constrained();
            $table->string('unit_number');
            $table->integer('floor_number')->nullable();
            $table->decimal('rent_amount', 12, 2);
            $table->string('rent_frequency')->default('monthly');
            $table->decimal('size_sqm', 12, 2)->nullable();
            $table->text('description')->nullable();
            $table->string('status')->default('available');
            $table->timestamps();
        });
        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->string('type');
            $table->string('name');
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('company_name')->nullable();
            $table->string('identity_type')->nullable();
            $table->string('identity_number')->nullable();
            $table->string('tax_identification_number')->nullable();
            $table->string('registration_number')->nullable();
            $table->string('contact_person')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('national_id')->nullable();
            $table->text('address')->nullable();
            $table->unsignedBigInteger('province_id')->nullable();
            $table->unsignedBigInteger('district_id')->nullable();
            $table->unsignedBigInteger('sector_id')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });
        Schema::create('tenancies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('unit_id')->constrained();
            $table->foreignId('renewed_from_id')->nullable()->constrained('tenancies');
            $table->foreignId('tenant_id')->constrained();
            $table->foreignId('assigned_by')->constrained('users');
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->date('actual_end_date')->nullable();
            $table->decimal('monthly_rent', 12, 2);
            $table->string('rent_frequency')->default('monthly');
            $table->unsignedTinyInteger('due_day')->nullable();
            $table->decimal('deposit_amount', 12, 2)->nullable();
            $table->text('notes')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });
        Schema::create('leases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenancy_id')->constrained();
            $table->foreignId('uploaded_by')->constrained('users');
            $table->string('original_name');
            $table->string('path');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });
        Schema::create('rent_charges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenancy_id')->constrained();
            $table->string('charge_type');
            $table->date('period_start');
            $table->date('period_end')->nullable();
            $table->date('due_date');
            $table->decimal('amount', 12, 2);
            $table->timestamp('voided_at')->nullable();
            $table->text('voided_reason')->nullable();
            $table->timestamps();
            $table->unique(['tenancy_id', 'charge_type', 'period_start']);
        });
        Schema::create('rent_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rent_charge_id')->constrained();
            $table->foreignId('recorded_by')->constrained('users');
            $table->decimal('amount', 12, 2);
            $table->string('method');
            $table->string('receipt_number')->nullable()->unique();
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('paid_at');
            $table->timestamps();
        });
        Schema::create('move_out_inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenancy_id')->unique()->constrained();
            $table->foreignId('inspected_by')->constrained('users');
            $table->date('move_out_date');
            $table->text('condition_notes');
            $table->decimal('deposit_received', 12, 2)->default(0);
            $table->decimal('deposit_refunded', 12, 2)->default(0);
            $table->decimal('deposit_deducted', 12, 2)->default(0);
            $table->text('deduction_notes')->nullable();
            $table->string('unit_outcome');
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_monthly_and_weekly_charges_are_idempotent_and_start_with_a_full_period(): void
    {
        [, $owner, $unit, $tenant] = $this->makeUnitAndTenant();
        $monthly = $this->makeTenancy($unit, $tenant, $owner, [
            'start_date' => '2026-01-10',
            'end_date' => '2026-03-31',
            'monthly_rent' => 100,
            'rent_frequency' => 'monthly',
            'due_day' => 31,
            'deposit_amount' => 250,
        ]);
        $service = app(RentScheduleService::class);
        $service->createCharges($monthly);
        $service->createCharges($monthly);

        $rentCharges = $monthly->rentCharges()->where('charge_type', 'rent')->orderBy('period_start')->get();
        $this->assertSame(['2026-01-10', '2026-01-31', '2026-02-28', '2026-03-31'], $rentCharges->pluck('due_date')->map(fn ($date) => $date->format('Y-m-d'))->all());
        $this->assertSame('100.00', $rentCharges->first()->amount);
        $this->assertSame('2026-01-10', $rentCharges->first()->period_start->format('Y-m-d'));
        $this->assertSame(1, $monthly->rentCharges()->where('charge_type', 'deposit')->count());
        $this->assertSame(5, $monthly->rentCharges()->count());

        $weekly = $this->makeTenancy($unit, $tenant, $owner, [
            'start_date' => '2026-01-01',
            'end_date' => '2026-01-15',
            'monthly_rent' => 40,
            'rent_frequency' => 'weekly',
            'due_day' => null,
            'deposit_amount' => 0,
        ]);
        $service->createCharges($weekly);
        $this->assertSame(
            ['2026-01-01', '2026-01-08', '2026-01-15'],
            $weekly->rentCharges()->orderBy('period_start')->get()->pluck('due_date')->map(fn ($date) => $date->format('Y-m-d'))->all(),
        );
    }

    public function test_owner_can_record_partial_and_full_payments_but_not_overpay(): void
    {
        [$property, $owner, $unit, $tenant] = $this->makeUnitAndTenant();
        $tenancy = $this->makeTenancy($unit, $tenant, $owner);
        $charge = RentCharge::create([
            'tenancy_id' => $tenancy->id,
            'charge_type' => 'rent',
            'period_start' => '2026-01-01',
            'period_end' => '2026-01-31',
            'due_date' => '2026-01-01',
            'amount' => 500,
        ]);
        Storage::fake('local');
        $url = route('properties.units.tenancy.payments.store', [$property, $unit, $tenancy, $charge]);
        $data = ['method' => 'mobile_money', 'paid_at' => now()->format('Y-m-d H:i:s')];

        $this->actingAs($owner)->from(route('properties.units.show', [$property, $unit]))
            ->post($url, $data + ['amount' => '125.50'])
            ->assertRedirect();
        $this->assertDatabaseHas('rent_payments', [
            'rent_charge_id' => $charge->id,
            'amount' => '125.50',
            'method' => 'mobile_money',
            'receipt_number' => 'ITZ-2026-000001',
        ]);

        $this->from(route('properties.units.show', [$property, $unit]))
            ->post($url, $data + ['amount' => '374.50'])
            ->assertRedirect()
            ->assertSessionHasNoErrors();
        $this->assertSame(2, $charge->payments()->count());

        $this->from(route('properties.units.show', [$property, $unit]))
            ->post($url, $data + ['amount' => '0.01'])
            ->assertSessionHasErrors('amount');
        $this->assertSame(2, $charge->payments()->count());
    }

    public function test_company_tenant_assignment_saves_representative_identity_rent_terms_and_lease(): void
    {
        [$property, $owner, $unit] = $this->makeUnitAndTenant();
        $unit->update(['status' => 'available']);
        Storage::fake('local');

        $this->actingAs($owner)->from(route('properties.units.index', $property))
            ->post(route('properties.units.tenancy.store', [$property, $unit]), [
                'tenant_type' => 'company',
                'company_name' => 'Example Services Ltd',
                'tax_identification_number' => 'TIN-883422',
                'contact_person' => 'Aline Representative',
                'identity_type' => 'passport',
                'identity_number' => 'PA123456',
                'email' => 'aline@example.com',
                'phone' => '0780123456',
                ...$this->tenantLocationData(),
                'start_date' => '2026-01-01',
                'end_date' => '2026-12-31',
                'monthly_rent' => '600.00',
                'rent_frequency' => 'monthly',
                'deposit_amount' => '250.00',
                'lease' => UploadedFile::fake()->create('signed-lease.pdf', 30, 'application/pdf'),
            ])
            ->assertRedirect();

        $tenant = Tenant::query()->where('company_name', 'Example Services Ltd')->firstOrFail();
        $this->assertSame('Aline Representative', $tenant->contact_person);
        $this->assertSame('TIN-883422', $tenant->tax_identification_number);
        $this->assertSame('PA123456', $tenant->identity_number);
        $this->assertNull($tenant->registration_number);
        $this->assertSame('Kigali City, Nyarugenge, Nyarugenge', $tenant->address);
        $this->assertSame(1, $tenant->province_id);
        $tenancy = Tenancy::query()->where('tenant_id', $tenant->id)->firstOrFail();
        $this->assertSame('monthly', $tenancy->rent_frequency);
        $this->assertNull($tenancy->due_day);
        $this->assertSame('occupied', $unit->fresh()->status);
        $this->assertSame(1, $tenancy->leases()->count());
        $this->assertSame(12, $tenancy->rentCharges()->where('charge_type', 'rent')->count());
        $this->assertSame(1, $tenancy->rentCharges()->where('charge_type', 'deposit')->count());
    }

    public function test_tenant_creation_validates_identity_phone_and_location_hierarchy(): void
    {
        [$property, $owner] = $this->makeUnitAndTenant();
        $location = $this->tenantLocationData();
        $otherProvince = Province::create(['name' => 'Eastern Province']);
        $otherDistrict = District::create(['name' => 'Rwamagana', 'province_id' => $otherProvince->id]);
        $otherSector = Sector::create(['name' => 'Rwamagana', 'district_id' => $otherDistrict->id]);
        $payload = [
            'type' => 'individual',
            'first_name' => 'Aline',
            'last_name' => 'Tenant',
            'identity_type' => 'national_id',
            'identity_number' => '123456789012345',
            'email' => 'aline-new@example.com',
            'phone' => '0780123456',
            ...$location,
        ];

        $this->actingAs($owner)
            ->post(route('tenants.store'), $payload)
            ->assertSessionHasErrors('identity_number');

        $payload['identity_number'] = '1234567890123456';
        $payload['phone'] = '0790123456';
        $this->post(route('tenants.store'), $payload)
            ->assertSessionHasErrors('phone');

        $payload['phone'] = '0720123456';
        $payload['sector_id'] = $otherSector->id;
        $this->post(route('tenants.store'), $payload)
            ->assertSessionHasErrors('sector_id');

        $payload['sector_id'] = $location['sector_id'];
        $this->post(route('tenants.store'), $payload)
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('tenants', [
            'email' => 'aline-new@example.com',
            'identity_number' => '1234567890123456',
            'phone' => '0720123456',
            'province_id' => $location['province_id'],
            'district_id' => $location['district_id'],
            'sector_id' => $location['sector_id'],
            'address' => 'Kigali City, Nyarugenge, Nyarugenge',
        ]);

        $payload['email'] = 'property-tenant@example.com';
        $payload['identity_number'] = '2234567890123456';
        $payload['phone'] = '0781234567';
        $this->post(route('properties.tenants.store', $property), $payload)
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('tenants', [
            'email' => 'property-tenant@example.com',
            'identity_number' => '2234567890123456',
            'phone' => '0781234567',
            'province_id' => $location['province_id'],
            'district_id' => $location['district_id'],
            'sector_id' => $location['sector_id'],
        ]);
    }

    public function test_future_move_in_reserves_then_occupies_the_unit_automatically(): void
    {
        [$property, $owner, $unit] = $this->makeUnitAndTenant();
        $unit->update(['status' => 'available']);
        Storage::fake('local');

        $this->actingAs($owner)->from(route('properties.units.index', $property))
            ->post(route('properties.units.tenancy.store', [$property, $unit]), [
                'tenant_type' => 'individual',
                'first_name' => 'Future',
                'last_name' => 'Tenant',
                'identity_type' => 'national_id',
                'identity_number' => '1199887766554433',
                'email' => 'future@example.com',
                'phone' => '0780999000',
                ...$this->tenantLocationData(),
                'start_date' => '2026-01-02',
                'end_date' => '2026-12-31',
                'monthly_rent' => '500.00',
                'rent_frequency' => 'monthly',
                'due_day' => '1',
                'deposit_amount' => '0',
                'lease' => UploadedFile::fake()->create('future-lease.pdf', 30, 'application/pdf'),
            ])
            ->assertRedirect();

        $tenancy = Tenancy::query()->where('status', 'scheduled')->firstOrFail();
        $this->assertSame('reserved', $unit->fresh()->status);

        $this->travelTo(Carbon::parse('2026-01-02 10:00:00'));
        $this->artisan('tenancies:activate-scheduled')->assertExitCode(0);
        $this->assertSame('active', $tenancy->fresh()->status);
        $this->assertSame('occupied', $unit->fresh()->status);
    }

    public function test_tenant_details_page_lists_available_units_and_assigns_the_selected_tenant(): void
    {
        [$property, $owner, $unit, $tenant] = $this->makeUnitAndTenant();
        $unit->update(['status' => 'available']);
        Storage::fake('local');

        $this->actingAs($owner)
            ->get(route('tenants.show', $tenant))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Tenants/Show')
                ->where('tenant.id', $tenant->id)
                ->has('availableUnits', 1)
                ->where('availableUnits.0.id', $unit->id));

        $this->from(route('tenants.show', $tenant))
            ->post(route('properties.units.tenancy.store', [$property, $unit]), [
                'tenant_id' => $tenant->id,
                'start_date' => '2026-01-01',
                'end_date' => '2026-12-31',
                'monthly_rent' => '500.00',
                'rent_frequency' => 'monthly',
                'due_day' => '1',
                'deposit_amount' => '0',
                'lease' => UploadedFile::fake()->create('tenant-lease.pdf', 30, 'application/pdf'),
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('tenancies', [
            'tenant_id' => $tenant->id,
            'unit_id' => $unit->id,
            'status' => 'active',
        ]);
        $this->assertSame('occupied', $unit->fresh()->status);
    }

    public function test_scheduled_renewal_activates_on_its_start_date_and_carries_the_deposit(): void
    {
        [$property, $owner, $unit, $tenant] = $this->makeUnitAndTenant();
        $tenancy = $this->makeTenancy($unit, $tenant, $owner, [
            'start_date' => '2025-02-01',
            'end_date' => '2026-01-31',
            'deposit_amount' => 250,
        ]);
        Storage::fake('local');

        $this->actingAs($owner)->from(route('properties.units.show', [$property, $unit]))
            ->post(route('properties.units.tenancy.renewals.store', [$property, $unit, $tenancy]), [
                'start_date' => '2026-02-01',
                'end_date' => '2027-01-31',
                'monthly_rent' => '600',
                'rent_frequency' => 'monthly',
                'due_day' => 1,
                'lease' => UploadedFile::fake()->create('renewal.pdf', 30, 'application/pdf'),
            ])
            ->assertRedirect();

        $renewal = Tenancy::query()->where('renewed_from_id', $tenancy->id)->firstOrFail();
        $this->assertSame('scheduled', $renewal->status);
        $this->assertSame('250.00', $renewal->deposit_amount);
        $this->assertSame(0, $renewal->rentCharges()->where('charge_type', 'deposit')->count());

        $this->travelTo(Carbon::parse('2026-02-01 10:00:00'));
        $this->artisan('tenancies:activate-scheduled')->assertExitCode(0);
        $this->assertSame('ended', $tenancy->fresh()->status);
        $this->assertSame('2026-01-31', $tenancy->fresh()->actual_end_date->format('Y-m-d'));
        $this->assertSame('active', $renewal->fresh()->status);
        $this->assertSame('occupied', $unit->fresh()->status);
    }

    public function test_move_out_requires_an_inspection_and_exact_deposit_reconciliation(): void
    {
        [$property, $owner, $unit, $tenant] = $this->makeUnitAndTenant();
        $tenancy = $this->makeTenancy($unit, $tenant, $owner, [
            'start_date' => '2025-02-01',
            'end_date' => '2026-12-31',
            'deposit_amount' => 200,
        ]);
        $depositCharge = RentCharge::create([
            'tenancy_id' => $tenancy->id,
            'charge_type' => 'deposit',
            'period_start' => '2025-02-01',
            'due_date' => '2025-02-01',
            'amount' => 200,
        ]);
        $futureRentCharge = RentCharge::create([
            'tenancy_id' => $tenancy->id,
            'charge_type' => 'rent',
            'period_start' => '2026-02-01',
            'period_end' => '2026-02-28',
            'due_date' => '2026-02-01',
            'amount' => 500,
        ]);
        RentPayment::create([
            'rent_charge_id' => $depositCharge->id,
            'recorded_by' => $owner->id,
            'amount' => 200,
            'method' => 'cash',
            'paid_at' => now(),
        ]);
        $url = route('properties.units.tenancy.move-out', [$property, $unit, $tenancy]);
        $data = [
            'move_out_date' => '2026-01-01',
            'condition_notes' => 'Walls and floors inspected.',
            'deposit_refunded' => '150.00',
            'deposit_deducted' => '49.00',
            'deduction_notes' => 'Cleaning',
            'unit_outcome' => 'maintenance',
        ];

        $this->actingAs($owner)->from(route('properties.units.show', [$property, $unit]))
            ->post($url, $data)
            ->assertSessionHasErrors('deposit_refunded');
        $this->assertSame('active', $tenancy->fresh()->status);

        $this->from(route('properties.units.show', [$property, $unit]))
            ->post($url, [...$data, 'deposit_deducted' => '50.00'])
            ->assertRedirect();
        $this->assertSame('ended', $tenancy->fresh()->status);
        $this->assertSame('2026-01-01', $tenancy->fresh()->actual_end_date->format('Y-m-d'));
        $this->assertSame('maintenance', $unit->fresh()->status);
        $this->assertDatabaseHas('move_out_inspections', [
            'tenancy_id' => $tenancy->id,
            'deposit_received' => '200.00',
            'deposit_refunded' => '150.00',
            'deposit_deducted' => '50.00',
        ]);
        $this->assertDatabaseHas('rent_charges', [
            'id' => $futureRentCharge->id,
            'voided_reason' => 'Tenancy ended before this charge was due.',
        ]);
    }

    public function test_unit_cannot_be_made_available_or_deleted_while_it_has_tenancy_history(): void
    {
        [$property, $owner, $unit, $tenant] = $this->makeUnitAndTenant();
        $this->makeTenancy($unit, $tenant, $owner);

        $this->actingAs($owner)
            ->from(route('properties.units.show', [$property, $unit]))
            ->put(route('properties.units.update', [$property, $unit]), [
                'unit_type_id' => $unit->unit_type_id,
                'unit_number' => $unit->unit_number,
                'rent_amount' => $unit->rent_amount,
                'rent_frequency' => 'monthly',
                'status' => 'available',
            ])
            ->assertSessionHasErrors('status');

        $this->from(route('properties.units.show', [$property, $unit]))
            ->delete(route('properties.units.destroy', [$property, $unit]))
            ->assertRedirect()
            ->assertSessionHas('error', 'This unit has tenancy history and cannot be deleted.');

        $this->assertDatabaseHas('units', ['id' => $unit->id, 'status' => 'occupied']);
    }

    public function test_lease_payment_and_report_pages_show_the_owners_rental_records(): void
    {
        [$property, $owner, $unit, $tenant] = $this->makeUnitAndTenant();
        $tenancy = $this->makeTenancy($unit, $tenant, $owner);
        $charge = RentCharge::create([
            'tenancy_id' => $tenancy->id,
            'charge_type' => 'rent',
            'period_start' => '2026-01-01',
            'period_end' => '2026-01-31',
            'due_date' => '2026-01-01',
            'amount' => 500,
        ]);
        Lease::create([
            'tenancy_id' => $tenancy->id,
            'uploaded_by' => $owner->id,
            'original_name' => 'signed-lease.pdf',
            'path' => 'leases/1/signed-lease.pdf',
            'mime_type' => 'application/pdf',
            'size' => 128,
        ]);
        RentPayment::create([
            'rent_charge_id' => $charge->id,
            'recorded_by' => $owner->id,
            'amount' => 200,
            'method' => 'cash',
            'paid_at' => '2026-01-01 10:00:00',
        ]);

        $this->actingAs($owner)
            ->get(route('leases.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Leases/Index')
                ->has('leases.data', 1)
                ->where('leases.data.0.original_name', 'signed-lease.pdf')
                ->where('leases.data.0.days_remaining', 364)
                ->where('leases.data.0.term_status', 'Active')
                ->where('leases.data.0.payment_status', 'Partially paid')
                ->where('leases.data.0.payment_balance', 300));

        $this->get(route('payments.index', ['status' => 'outstanding']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Payments/Index')
                ->where('filters.status', 'outstanding')
                ->has('charges.data', 1)
                ->where('charges.data.0.id', $charge->id));

        $this->get(route('reports.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Index')
                ->where('summary.properties', 1)
                ->where('summary.active_leases', 1)
                ->where('summary.charges_total', 500)
                ->where('summary.payments_received', 200)
                ->where('summary.outstanding_balance', 300)
                ->has('properties', 1));
    }

    private function tenantLocationData(): array
    {
        return [
            'province_id' => Province::query()->value('id'),
            'district_id' => District::query()->value('id'),
            'sector_id' => Sector::query()->value('id'),
        ];
    }

    private function makeUnitAndTenant(): array
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'status' => 'approved',
            'profile_completed' => true,
            'expires_at' => now()->addYear(),
        ]);
        $property = Property::create([
            'owner_id' => $owner->id,
            'name' => 'Test property',
            'address' => 'Kigali',
        ]);
        $unitType = UnitType::create(['name' => 'Apartment']);
        $unit = Unit::create([
            'property_id' => $property->id,
            'unit_type_id' => $unitType->id,
            'unit_number' => 'A-1',
            'rent_amount' => 500,
            'rent_frequency' => 'monthly',
            'status' => 'occupied',
        ]);
        $tenant = Tenant::create([
            'created_by' => $owner->id,
            'type' => 'individual',
            'name' => 'Jean Tenant',
            'first_name' => 'Jean',
            'last_name' => 'Tenant',
            'identity_type' => 'national_id',
            'identity_number' => '1199887766554433',
            'national_id' => '1199887766554433',
            'email' => 'tenant@example.com',
            'phone' => '+250780000000',
            'address' => 'Kigali',
            'status' => 'active',
        ]);

        return [$property, $owner, $unit, $tenant];
    }

    private function makeTenancy(Unit $unit, Tenant $tenant, User $owner, array $overrides = []): Tenancy
    {
        return Tenancy::create(array_merge([
            'unit_id' => $unit->id,
            'tenant_id' => $tenant->id,
            'assigned_by' => $owner->id,
            'start_date' => '2026-01-01',
            'end_date' => '2026-12-31',
            'monthly_rent' => 500,
            'rent_frequency' => 'monthly',
            'due_day' => 1,
            'deposit_amount' => 0,
            'status' => 'active',
        ], $overrides));
    }
}
