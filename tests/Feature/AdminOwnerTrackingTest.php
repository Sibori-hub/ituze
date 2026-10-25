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

        // Owners managed by Q.R.A are not SaaS customers; owners never see this area.
        $this->get(route('admin.owners.show', $managed))->assertNotFound();
        $this->actingAs($owner)->get(route('admin.owners'))->assertForbidden();
    }
}
