<?php

namespace Tests\Unit;

use App\Models\Property;
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

    public function test_the_owner_account_is_never_paused_only_each_property(): void
    {
        $owner = new User(['role' => 'owner', 'expires_at' => null]);

        $this->assertFalse($owner->isExpired());
    }

    public function test_a_property_works_for_seven_grace_days_after_its_paid_until_date(): void
    {
        $owner = new User(['role' => 'owner']);
        $property = (new Property(['name' => 'Kigali Heights']))->setRelation('owner', $owner);
        $this->assertSame('unpaid', $property->subscriptionState());
        $this->assertFalse($property->subscriptionIsActive());

        $property->paid_until = '2026-09-26 11:59:59';
        Carbon::setTestNow('2026-09-20 12:00:00');
        $this->assertSame('expiring', $property->subscriptionState());

        // Just after the end: grace, still working.
        Carbon::setTestNow('2026-09-26 12:00:00');
        $this->assertSame('grace', $property->subscriptionState());
        $this->assertTrue($property->subscriptionIsActive());

        // Seven days later: paused.
        Carbon::setTestNow('2026-10-03 12:00:00');
        $this->assertSame('paused', $property->subscriptionState());
        $this->assertFalse($property->subscriptionIsActive());

        // A managed owner's property never needs a subscription.
        $managed = (new Property(['name' => 'Managed']))->setRelation('owner', new User(['role' => 'owner', 'created_by' => 1]));
        $this->assertSame('free', $managed->subscriptionState());
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
