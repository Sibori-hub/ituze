<?php

namespace Tests\Feature;

use App\Models\Lease;
use App\Models\Property;
use App\Models\PropertyUnit;
use App\Models\Tenancy;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\UnitType;
use App\Models\User;
use App\Notifications\LeaseEndingReminder;
use App\Services\RentScheduleService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LeaseManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $owner;
    private Unit $unit;
    private Tenant $tenant;
    private Tenancy $tenancy;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(Carbon::parse('2026-10-18 09:00:00'));

        $this->admin = User::factory()->create(['role' => 'admin', 'phone' => '0788000001']);
        $this->owner = User::factory()->create(['role' => 'owner', 'status' => 'approved', 'expires_at' => now()->addYear(), 'phone' => '0788000002']);
        $property = Property::create(['paid_until' => now()->addYear(), 'owner_id' => $this->owner->id, 'name' => 'Lease Plaza', 'total_floors' => 2]);
        $type = UnitType::create(['name' => 'Offices']);
        $parent = PropertyUnit::create(['property_id' => $property->id, 'unit_type_id' => $type->id, 'floor_number' => 1]);
        $this->unit = Unit::create([
            'property_id' => $property->id, 'property_unit_id' => $parent->id, 'unit_type_id' => $type->id, 'floor_number' => 1,
            'unit_number' => '101', 'rent_amount' => 300000, 'rent_frequency' => 'monthly', 'status' => 'occupied',
        ]);
        $province = DB::table('provinces')->insertGetId(['name' => 'Kigali City', 'created_at' => now(), 'updated_at' => now()]);
        $district = DB::table('districts')->insertGetId(['name' => 'Gasabo', 'province_id' => $province, 'created_at' => now(), 'updated_at' => now()]);
        $sector = DB::table('sectors')->insertGetId(['name' => 'Kacyiru', 'district_id' => $district, 'created_at' => now(), 'updated_at' => now()]);
        $this->tenant = Tenant::create([
            'created_by' => $this->admin->id, 'type' => 'individual', 'name' => 'Lease Tenant', 'first_name' => 'Lease', 'last_name' => 'Tenant',
            'identity_type' => 'national_id', 'identity_number' => '1199880012345678', 'email' => 'lease.tenant@example.com', 'phone' => '0788123456',
            'address' => 'Kigali', 'province_id' => $province, 'district_id' => $district, 'sector_id' => $sector, 'status' => 'active',
        ]);
        // Ends in 25 days: inside the 30-day reminder window.
        $this->tenancy = Tenancy::create([
            'unit_id' => $this->unit->id, 'tenant_id' => $this->tenant->id, 'assigned_by' => $this->admin->id,
            'start_date' => '2025-11-12', 'end_date' => '2026-11-12', 'monthly_rent' => 300000, 'rent_frequency' => 'monthly',
            'deposit_amount' => 300000, 'status' => 'active',
        ]);
        Lease::create([
            'tenancy_id' => $this->tenancy->id, 'uploaded_by' => $this->admin->id, 'reference_number' => 'ITZ-LSE-2025-000001',
            'payment_method' => 'bank_transfer', 'payment_reference' => 'SLIP-1', 'original_name' => 'lease.pdf', 'path' => 'leases/lease.pdf',
            'mime_type' => 'application/pdf', 'size' => 1000,
        ]);
        config(['services.whatsapp.phone_number_id' => null, 'services.whatsapp.access_token' => null]);
    }

    public function test_reminders_go_to_admin_owner_and_tenant_once_per_window(): void
    {
        Notification::fake();

        $this->artisan('leases:send-reminders')->assertExitCode(0);
        $this->artisan('leases:send-reminders')->assertExitCode(0);

        Notification::assertSentToTimes($this->admin, LeaseEndingReminder::class, 1);
        Notification::assertSentToTimes($this->owner, LeaseEndingReminder::class, 1);
        Notification::assertSentOnDemand(LeaseEndingReminder::class, fn ($notification, $channels, AnonymousNotifiable $notifiable) => $notifiable->routes['mail'] === 'lease.tenant@example.com'
            && $notification->kind === 'days_30' && $notification->audience === 'tenant');
        $this->assertDatabaseHas('lease_reminders', ['tenancy_id' => $this->tenancy->id, 'kind' => 'days_30']);

        // A week before the end: the 7-day reminder.
        $this->travelTo(Carbon::parse('2026-11-08 09:00:00'));
        $this->artisan('leases:send-reminders')->assertExitCode(0);
        Notification::assertSentTo($this->admin, LeaseEndingReminder::class, fn ($notification) => $notification->kind === 'days_7');
    }

    public function test_expired_lease_alerts_staff_not_tenant_and_shows_as_action_needed(): void
    {
        Notification::fake();
        $this->travelTo(Carbon::parse('2026-11-15 09:00:00'));

        $this->artisan('leases:send-reminders')->assertExitCode(0);

        Notification::assertSentTo($this->admin, LeaseEndingReminder::class, fn ($notification) => $notification->kind === 'expired');
        Notification::assertSentTo($this->owner, LeaseEndingReminder::class, fn ($notification) => $notification->kind === 'expired');
        Notification::assertSentOnDemandTimes(LeaseEndingReminder::class, 0);

        // Admin work lists show the owners Q.R.A manages.
        $this->owner->update(['created_by' => $this->admin->id]);
        $this->actingAs($this->admin)->get(route('leases.index', ['status' => 'expired']))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Leases/Index')
                ->where('counts.expired', 1)
                ->where('counts.ending_soon', 0)
                ->where('leases.data.0.term_status', 'Expired')
                ->where('leases.data.0.can_renew', true));
    }

    public function test_renewal_records_first_month_paid_and_carries_the_deposit(): void
    {
        $this->owner->update(['created_by' => $this->admin->id]);
        Storage::fake('local');
        $this->travelTo(Carbon::parse('2026-11-15 09:00:00'));
        app(RentScheduleService::class)->createCharges($this->tenancy);

        // Expired three days ago: the renewal continues from the day after the end.
        $this->actingAs($this->admin)->post(route('properties.units.tenancy.renewals.store', [$this->unit->property_id, $this->unit->id, $this->tenancy->id]), [
            'start_date' => '2026-11-13',
            'end_date' => '2027-11-12',
            'monthly_rent' => '320000',
            'rent_frequency' => 'monthly',
            'payment_method' => 'cheque',
            'payment_reference' => 'CHQ-000123',
            'lease' => UploadedFile::fake()->create('renewal.pdf', 20, 'application/pdf'),
        ])->assertSessionHasNoErrors();

        $renewal = Tenancy::query()->where('renewed_from_id', $this->tenancy->id)->firstOrFail();
        $this->assertSame('300000.00', (string) $renewal->deposit_amount);
        $this->assertSame(13, (int) $renewal->due_day);
        $charges = $renewal->rentCharges()->where('charge_type', 'rent')->orderBy('due_date')->get();
        $this->assertSame(320000.0, (float) $charges->first()->payments()->sum('amount'));
        $this->assertSame('CHQ-000123', $charges->first()->payments()->value('reference'));
        $this->assertSame(0.0, (float) $charges->skip(1)->sum(fn ($charge) => $charge->payments()->sum('amount')));

        // A renewal cannot start in the past otherwise.
        $this->post(route('properties.units.tenancy.renewals.store', [$this->unit->property_id, $this->unit->id, $renewal->id]), [
            'start_date' => '2026-11-01',
            'end_date' => '2027-11-12',
            'monthly_rent' => '320000',
            'rent_frequency' => 'monthly',
            'payment_method' => 'cheque',
            'payment_reference' => 'CHQ-000124',
            'lease' => UploadedFile::fake()->create('renewal2.pdf', 20, 'application/pdf'),
        ])->assertSessionHasErrors('start_date');
    }

    public function test_payments_show_qra_commission_on_managed_owner_rent_only(): void
    {
        $charges = [];
        foreach (['rent' => 300000, 'deposit' => 300000] as $type => $amount) {
            $charges[$type] = \App\Models\RentCharge::create([
                'tenancy_id' => $this->tenancy->id, 'charge_type' => $type, 'period_start' => '2026-10-12',
                'period_end' => $type === 'rent' ? '2026-11-11' : null, 'due_date' => '2026-10-12', 'amount' => $amount,
            ]);
            \App\Models\RentPayment::create([
                'rent_charge_id' => $charges[$type]->id, 'transaction_id' => (string) \Illuminate\Support\Str::uuid(),
                'recorded_by' => $this->admin->id, 'amount' => $amount, 'method' => 'bank_transfer', 'reference' => 'SLIP', 'paid_at' => now(),
            ]);
        }

        // Self-registered owner: their payments are theirs, with no commission. The admin's
        // Payments page leaves them out (they are followed on Admin > Owners).
        $this->actingAs($this->owner)->get(route('payments.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('reportTotals.commission', 0)
                ->where('reportTotals.paid', 600000)
                ->where('reportTotals.deposits_received', 300000));
        $this->actingAs($this->admin)->get(route('payments.index'))
            ->assertInertia(fn (Assert $page) => $page->where('reportTotals.paid', 0)->has('payments.data', 0));

        // Managed owner at 10%: 10% of the rent, nothing on the deposit.
        $this->owner->update(['created_by' => $this->admin->id, 'management_fee_percent' => 10]);
        $this->get(route('payments.index', ['type' => 'rent']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('reportTotals.managed_rent', 300000)
                ->where('reportTotals.commission', 30000)
                ->where('reportTotals.owner_payout', 270000)
                ->where('payments.data.0.commission', 30000)
                ->where('payments.data.0.owner_share', 270000));
        $this->get(route('payments.index', ['type' => 'deposit']))
            ->assertInertia(fn (Assert $page) => $page->where('payments.data.0.commission', null));
    }

    public function test_reports_show_period_money_arrears_owner_statement_and_export(): void
    {
        app(RentScheduleService::class)->createCharges($this->tenancy);
        $this->owner->update(['created_by' => $this->admin->id, 'management_fee_percent' => 10]);
        // Rent paid on time up to August; September and October are unpaid.
        $this->tenancy->rentCharges()->where('charge_type', 'rent')->whereDate('due_date', '<', '2026-09-01')->get()
            ->each(fn ($charge) => \App\Models\RentPayment::create([
                'rent_charge_id' => $charge->id, 'transaction_id' => (string) \Illuminate\Support\Str::uuid(), 'recorded_by' => $this->admin->id,
                'amount' => 300000, 'vat_amount' => 54000, 'method' => 'bank_transfer', 'reference' => 'SLIP', 'paid_at' => $charge->due_date->copy()->setTime(10, 0),
            ]));

        $period = ['period' => 'custom', 'from' => '2026-01-01', 'to' => '2026-08-31'];
        $this->actingAs($this->admin)->get(route('reports.index', $period))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Reports/Index')
                ->where('overview.rent_collected', 2400000)
                ->where('overview.rent_expected', 2400000)
                ->where('overview.collection_rate', 100)
                ->where('overview.commission', 240000)
                ->where('overview.vat', 432000)
                ->where('overview.arrears', 600000)
                ->has('overview.months', 12)
                ->where('arrears', null));

        $this->get(route('reports.index', ['tab' => 'arrears']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('arrears.totals.total', 600000)
                ->where('arrears.totals.d30', 300000)
                ->where('arrears.totals.d60', 300000)
                ->where('arrears.rows.0.tenant.name', 'Lease Tenant')
                ->where('arrears.rows.0.days_late', 36));

        $this->get(route('reports.index', ['tab' => 'owners', 'owner_id' => $this->owner->id, ...$period]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('statements.rows.0.commission', 240000)
                ->where('statements.rows.0.payout', 2160000)
                ->has('statements.lines', 8));

        $csv = $this->get(route('reports.export', ['tab' => 'arrears']))->assertOk();
        $this->assertStringContainsString('text/csv', $csv->headers->get('Content-Type'));
        $this->assertStringContainsString('Lease Tenant', $csv->streamedContent());

        $this->get(route('reports.index', ['period' => 'custom', 'from' => '2026-05-01', 'to' => '2026-04-01']))
            ->assertSessionHasErrors('to');

        // Another owner sees none of it.
        $other = User::factory()->create(['role' => 'owner', 'status' => 'approved', 'expires_at' => now()->addYear(), 'phone' => '0788000003']);
        $this->actingAs($other)->get(route('reports.index', ['tab' => 'arrears']))
            ->assertInertia(fn (Assert $page) => $page->where('arrears.totals.total', 0));
    }

    public function test_owner_dashboard_shows_this_months_money_payout_and_leases_ending(): void
    {
        $this->owner->update(['created_by' => $this->admin->id, 'management_fee_percent' => 10, 'profile_completed' => true, 'email_verified_at' => now(), 'phone_verified_at' => now()]);
        $charge = \App\Models\RentCharge::create([
            'tenancy_id' => $this->tenancy->id, 'charge_type' => 'rent', 'period_start' => '2026-10-12', 'period_end' => '2026-11-11', 'due_date' => '2026-10-12', 'amount' => 300000,
        ]);
        \App\Models\RentPayment::create([
            'rent_charge_id' => $charge->id, 'transaction_id' => (string) \Illuminate\Support\Str::uuid(), 'recorded_by' => $this->admin->id,
            'amount' => 300000, 'method' => 'bank_transfer', 'reference' => 'SLIP', 'paid_at' => now(),
        ]);

        $this->actingAs($this->owner->fresh())->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('ownerReport.managed', true)
                ->where('ownerReport.month.rent_collected', 300000)
                ->where('ownerReport.month.commission', 30000)
                ->where('ownerReport.month.payout', 270000)
                ->where('ownerReport.ending_soon.0.tenant.name', 'Lease Tenant')
                ->has('ownerReport.recent_payments', 1)
                ->has('ownerReport.months', 6));
    }

    public function test_ending_soon_tab_and_search(): void
    {
        $this->owner->update(['created_by' => $this->admin->id]);
        $this->actingAs($this->admin)->get(route('leases.index', ['status' => 'ending_soon', 'search' => 'Lease Tenant']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('counts.ending_soon', 1)
                ->where('counts.all', 1)
                ->where('leases.data.0.term_status', 'Expiring soon')
                ->where('leases.data.0.can_renew', true)
                ->has('leases.data', 1));

        $this->get(route('leases.index', ['search' => 'nobody-matches']))
            ->assertInertia(fn (Assert $page) => $page->has('leases.data', 0));
    }
}
