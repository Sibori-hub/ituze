<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnerApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_pending_owner_cannot_access_owner_dashboard_or_property_management(): void
    {
        $owner = User::factory()->create([
            'role' => 'owner',
            'status' => 'pending',
            'profile_completed' => true,
            'expires_at' => null,
        ]);

        $this->actingAs($owner)
            ->get(route('dashboard'))
            ->assertRedirect(route('account.status'));

        $this->actingAs($owner)
            ->get(route('properties.index'))
            ->assertRedirect(route('account.status'));
    }

    public function test_admin_approval_starts_the_one_year_subscription_after_payment_confirmation(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'approved',
            'profile_completed' => true,
        ]);
        $owner = User::factory()->create([
            'role' => 'owner',
            'status' => 'pending',
            'profile_completed' => true,
            'expires_at' => null,
        ]);

        $this->actingAs($admin)
            ->post(route('admin.approvals.approve', $owner), ['payment_verified' => true])
            ->assertSessionHas('status');

        $owner->refresh();
        $this->assertSame('approved', $owner->status);
        // No free time: the owner pays the first month before using the system.
        $this->assertNull($owner->expires_at);
        $this->assertTrue($owner->isExpired());
    }

    public function test_admin_can_access_dashboard_without_owner_approval_or_active_subscription(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'pending',
            'profile_completed' => true,
            'expires_at' => now()->subDay(),
        ]);

        $this->actingAs($admin)
            ->get(route('dashboard'))
            ->assertOk();
    }
}
