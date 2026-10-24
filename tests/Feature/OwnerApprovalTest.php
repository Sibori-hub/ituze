<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\AccountApproved;
use App\Notifications\Channels\SmsChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
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
            'phone' => '0788123456',
        ]);
        Notification::fake();

        $this->actingAs($admin)
            ->post(route('admin.approvals.approve', $owner), ['payment_verified' => true])
            ->assertSessionHas('status');

        $owner->refresh();
        $this->assertSame('approved', $owner->status);
        // The owner hears it by email and SMS, with the next step.
        Notification::assertSentTo($owner, AccountApproved::class, function ($notification, $channels) use ($owner) {
            $sms = $notification->toSms($owner);

            return $channels === ['mail', SmsChannel::class]
                && str_contains($sms, 'your account is approved')
                && str_contains($sms, 'Add your properties')
                && mb_strlen($sms) <= 160
                && $notification->toMail($owner)->subject === 'Your ITUZE account is approved';
        });
        // The dashboard opens at once; each property is paid for after it is created.
        $this->assertNull($owner->expires_at);
        $this->assertFalse($owner->isExpired());
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
