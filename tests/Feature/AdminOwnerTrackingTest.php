<?php

namespace Tests\Feature;

use App\Models\Property;
use App\Models\Unit;
use App\Models\UnitType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminOwnerTrackingTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_dashboard_rent_card_counts_only_owners_qra_manages(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved', 'profile_completed' => true]);
        $selfRegistered = User::factory()->create(['role' => 'owner', 'status' => 'approved']);
        $managed = User::factory()->create(['role' => 'owner', 'status' => 'approved', 'created_by' => $admin->id]);
        $rentPaid = function (User $owner, int $amount) use ($admin) {
            $property = Property::create(['owner_id' => $owner->id, 'name' => 'B'.$owner->id, 'address' => 'KG 1 Ave', 'total_floors' => 1, 'paid_until' => now()->addMonth()]);
            $unit = Unit::create(['property_id' => $property->id, 'unit_type_id' => UnitType::space()->id, 'floor_number' => 0, 'unit_number' => '001', 'rent_amount' => $amount, 'rent_frequency' => 'monthly', 'status' => 'occupied']);
            $tenant = \App\Models\Tenant::create(['type' => 'individual', 'name' => 'T'.$owner->id, 'status' => 'active', 'created_by' => $owner->id]);
            $tenancy = \App\Models\Tenancy::create(['unit_id' => $unit->id, 'tenant_id' => $tenant->id, 'assigned_by' => $admin->id, 'start_date' => today(), 'end_date' => today()->addYear(), 'monthly_rent' => $amount, 'rent_frequency' => 'monthly', 'status' => 'active']);
            $charge = \App\Models\RentCharge::create(['tenancy_id' => $tenancy->id, 'charge_type' => 'rent', 'period_start' => today(), 'period_end' => today()->addMonth(), 'due_date' => today(), 'amount' => $amount]);
            \App\Models\RentPayment::create(['rent_charge_id' => $charge->id, 'recorded_by' => $admin->id, 'amount' => $amount, 'method' => 'cash', 'paid_at' => now()]);
        };
        $rentPaid($selfRegistered, 700000);
        $rentPaid($managed, 300000);

        $this->actingAs($admin)->get(route('dashboard'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('adminOverview.rentCollections.5.amount', fn ($amount) => (float) $amount === 300000.0));
    }

    public function test_only_admins_follow_self_registered_owners_and_their_data(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved', 'profile_completed' => true]);
        $owner = User::factory()->create(['role' => 'owner', 'status' => 'approved', 'name' => 'Inkotanyi Jean', 'momo_pay_code' => '551234', 'momo_pay_name' => 'INKOTANYI JEAN']);
        $managed = User::factory()->create(['role' => 'owner', 'status' => 'approved', 'created_by' => $admin->id]);
        $property = Property::create(['owner_id' => $owner->id, 'name' => 'Ikaze Building', 'address' => 'KG 7 Ave', 'total_floors' => 2, 'paid_until' => now()->addMonth()]);
        Unit::create(['property_id' => $property->id, 'unit_type_id' => UnitType::space()->id, 'floor_number' => 1, 'unit_number' => '001', 'rent_amount' => 300000, 'rent_frequency' => 'monthly', 'status' => 'available']);

        $this->actingAs($admin)->get(route('admin.owners'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Owners')
            ->where('totals.owners', 1)
            ->has('owners.data', 1)
            ->where('owners.data.0.name', 'Inkotanyi Jean')
            ->where('owners.data.0.properties', 1)
            ->where('owners.data.0.units', 1));

        $this->get(route('admin.owners.show', $owner))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Admin/OwnerShow')
            ->where('owner.momo_pay_code', '551234')
            ->where('summary.units', 1)
            ->where('properties.0.name', 'Ikaze Building')
            ->where('units.0.number', '001'));

        // The admin's work lists show only owners Q.R.A manages; the SaaS owner still sees their own.
        Property::create(['owner_id' => $managed->id, 'name' => 'Managed House', 'address' => 'KG 2 Ave', 'total_floors' => 1]);
        \App\Models\Tenant::create(['type' => 'individual', 'name' => 'SaaS Tenant', 'status' => 'active', 'created_by' => $owner->id]);
        $this->get(route('properties.index'))->assertInertia(fn (Assert $page) => $page
            ->has('properties.data', 1)->where('properties.data.0.name', 'Managed House'));
        $this->get(route('tenants.index'))->assertInertia(fn (Assert $page) => $page->has('tenants.data', 0));
        $this->actingAs($owner)->get(route('properties.index'))->assertInertia(fn (Assert $page) => $page
            ->has('properties.data', 1)->where('properties.data.0.name', 'Ikaze Building'));
        $this->actingAs($admin);

        // Owners managed by Q.R.A are not SaaS customers; owners never see this area.
        $this->get(route('admin.owners.show', $managed))->assertNotFound();
        $this->actingAs($owner)->get(route('admin.owners'))->assertForbidden();
    }
}
