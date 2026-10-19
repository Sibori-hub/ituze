<?php

namespace Tests\Unit;

use App\Models\User;
use Carbon\Carbon;
use Tests\TestCase;

class UserSubscriptionTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_owner_without_an_expiry_date_is_expired(): void
    {
        $owner = new User(['role' => 'owner', 'expires_at' => null]);

        $this->assertTrue($owner->isExpired());
    }

    public function test_owner_keeps_working_for_seven_grace_days_after_the_plan_end(): void
    {
        $owner = new User(['role' => 'owner', 'expires_at' => '2026-09-26 11:59:59']);

        // Just after the end: grace, still working.
        Carbon::setTestNow('2026-09-26 12:00:00');
        $this->assertFalse($owner->isExpired());
        $this->assertTrue($owner->inSubscriptionGrace());

        // Seven days later: paused.
        Carbon::setTestNow('2026-10-03 12:00:00');
        $this->assertTrue($owner->isExpired());
        $this->assertFalse($owner->inSubscriptionGrace());
    }

    public function test_owner_with_an_active_plan_is_not_expired(): void
    {
        Carbon::setTestNow('2026-09-26 12:00:00');
        $owner = new User(['role' => 'owner', 'expires_at' => '2026-09-27 00:00:00']);

        $this->assertFalse($owner->isExpired());
    }

    public function test_admin_is_not_expired_even_without_a_plan(): void
    {
        $admin = new User(['role' => 'admin', 'expires_at' => null]);

        $this->assertFalse($admin->isExpired());
    }
}
