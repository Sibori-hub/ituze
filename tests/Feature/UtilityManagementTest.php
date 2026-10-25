<?php

namespace Tests\Feature;

use App\Models\Property;
use App\Models\User;
use App\Models\UtilityReading;
use App\Models\WasteCollection;
use App\Models\WasteSchedule;
use App\Notifications\UtilityHighUsage;
use App\Services\UtilityReport;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UtilityManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Property $property;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse('2026-10-15 10:00:00'));
        $this->owner = $this->makeOwner('owner@example.com', '0788000010');
        $this->property = Property::create(['owner_id' => $this->owner->id, 'name' => 'Green Plaza', 'total_floors' => 2]);
    }

    private function makeOwner(string $email, string $phone, array $extra = []): User
    {
        $owner = User::factory()->create([
            'role' => 'owner', 'status' => 'approved', 'expires_at' => now()->addMonth(), 'email' => $email, 'phone' => $phone,
            'profile_completed' => true, ...$extra,
        ]);
        $owner->forceFill(['email_verified_at' => now(), 'phone_verified_at' => now()])->save();

        return $owner;
    }

    private function record(string $month, float $reading, array $extra = [], string $type = 'water')
    {
        return $this->actingAs($this->owner)->post(route('utilities.readings.store'), [
            'property_id' => $this->property->id, 'type' => $type, 'month' => $month, 'reading' => $reading, ...$extra,
        ]);
    }

    public function test_readings_give_monthly_consumption_and_reject_a_lower_reading(): void
    {
        $this->record('2026-07', 1000)->assertSessionHasNoErrors();
        $this->record('2026-08', 1020, ['cost' => 30000, 'bill_reference' => 'WASAC-88'])->assertSessionHasNoErrors();

        $august = UtilityReading::query()->where('period', '2026-08-01')->firstOrFail();
        $this->assertEquals(20, (float) $august->consumption);
        $this->assertEquals(30000, (float) $august->cost);
        $this->assertEquals(0, (float) UtilityReading::query()->where('period', '2026-07-01')->value('consumption'));

        // Lower than last time: refused, unless the meter was replaced.
        $this->record('2026-09', 900)->assertSessionHasErrors('reading');
        $this->record('2026-09', 5, ['meter_replaced' => true])->assertSessionHasErrors('consumption');
        $this->record('2026-09', 5, ['meter_replaced' => true, 'consumption' => 22])->assertSessionHasNoErrors();
        $this->assertEquals(22, (float) UtilityReading::query()->where('period', '2026-09-01')->value('consumption'));

        // Filling in a missed month: it must sit between the months around it, and the later month is re-measured.
        $this->record('2026-06', 1050)->assertSessionHasErrors('reading');
        $this->record('2026-06', 990)->assertSessionHasNoErrors();
        $this->assertEquals(10, (float) UtilityReading::query()->where('period', '2026-07-01')->value('consumption'));

        // No future months.
        $this->record('2026-11', 2000)->assertSessionHasErrors('month');
    }

    public function test_high_use_sends_an_alert_and_shows_on_the_page(): void
    {
        Notification::fake();
        $this->record('2026-06', 1000);
        $this->record('2026-07', 1020);
        $this->record('2026-08', 1040);
        $this->record('2026-09', 1060);
        Notification::assertNothingSent();

        // 50 m³ against an average of 20: 150% above.
        $this->record('2026-10', 1110)->assertSessionHas('warning');
        Notification::assertSentTo($this->owner, UtilityHighUsage::class, fn ($notice) => $notice->percentAbove === 150);

        $this->actingAs($this->owner)->get(route('utilities.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Utilities/Index')
                ->where('canEdit', true)
                ->where('comparison.water.current', 50)
                ->where('comparison.water.previous', 20)
                ->where('comparison.water.change', 150)
                ->has('alerts', 1)
                ->where('alerts.0.percent', 150)
                ->has('scores', 1)
                ->has('trends', 12));
    }

    public function test_waste_schedule_collections_and_costs(): void
    {
        $this->actingAs($this->owner)->post(route('utilities.schedules.store'), [
            'property_id' => $this->property->id, 'collector' => 'COPED', 'frequency' => 'weekly', 'day' => 1,
            'cost_per_collection' => 5000, 'starts_on' => '2026-09-01',
        ])->assertSessionHasNoErrors();
        $schedule = WasteSchedule::query()->firstOrFail();

        // Mondays: 5, 12 October are past and waiting; 19 October is upcoming.
        $dates = collect($schedule->datesBetween(CarbonImmutable::parse('2026-10-01'), CarbonImmutable::parse('2026-10-31')))->map->toDateString();
        $this->assertSame(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'], $dates->all());

        $this->actingAs($this->owner)->post(route('utilities.collections.store'), [
            'property_id' => $this->property->id, 'waste_schedule_id' => $schedule->id, 'scheduled_on' => '2026-10-05', 'status' => 'collected', 'cost' => 5000,
        ])->assertSessionHasNoErrors();
        $this->actingAs($this->owner)->post(route('utilities.collections.store'), [
            'property_id' => $this->property->id, 'scheduled_on' => '2026-10-12', 'status' => 'missed', 'cost' => 5000,
        ])->assertSessionHasNoErrors();
        // Not before the day.
        $this->actingAs($this->owner)->post(route('utilities.collections.store'), [
            'property_id' => $this->property->id, 'scheduled_on' => '2026-10-19', 'status' => 'collected',
        ])->assertSessionHasErrors('scheduled_on');

        $this->assertEquals(0, (float) WasteCollection::query()->where('status', 'missed')->value('cost'));
        $trends = (new UtilityReport($this->owner))->trends(CarbonImmutable::parse('2026-10-01'));
        $this->assertEquals(5000, end($trends)['waste_cost']);

        $score = (new UtilityReport($this->owner))->scores(CarbonImmutable::parse('2026-10-01'))[0];
        // Waste: 10 + 15 × ½ collected.
        $this->assertSame(18, $score['parts']['waste']);
    }

    public function test_others_cannot_see_or_change_a_building(): void
    {
        $stranger = $this->makeOwner('other@example.com', '0788000020');
        $this->actingAs($stranger)->post(route('utilities.readings.store'), [
            'property_id' => $this->property->id, 'type' => 'water', 'month' => '2026-10', 'reading' => 10,
        ])->assertNotFound();
        $this->actingAs($stranger)->get(route('utilities.index', ['property_id' => $this->property->id]))->assertSessionHasErrors('property_id');

        // Q.R.A-managed owners only look.
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved']);
        $managed = $this->makeOwner('managed@example.com', '0788000030', ['created_by' => $admin->id, 'expires_at' => null]);
        $theirs = Property::create(['owner_id' => $managed->id, 'name' => 'Managed House', 'total_floors' => 1]);
        $this->actingAs($managed)->get(route('utilities.index'))->assertOk()->assertInertia(fn (Assert $page) => $page->where('canEdit', false)->has('properties', 1));
        $this->actingAs($managed)->post(route('utilities.readings.store'), [
            'property_id' => $theirs->id, 'type' => 'water', 'month' => '2026-10', 'reading' => 10,
        ])->assertRedirect();
        $this->assertSame(0, UtilityReading::query()->where('property_id', $theirs->id)->count());

        // Admins work on the buildings of owners Q.R.A manages; self-registered owners run their own.
        $this->actingAs($admin)->get(route('utilities.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('properties', 1)->where('properties.0.id', $theirs->id)->where('canEdit', true));
        $this->actingAs($admin)->post(route('utilities.readings.store'), [
            'property_id' => $theirs->id, 'type' => 'electricity', 'month' => '2026-10', 'reading' => 10,
        ])->assertSessionHasNoErrors();
    }

    public function test_dashboard_shows_the_utility_snapshot(): void
    {
        $this->record('2026-09', 100, [], 'electricity');
        $this->record('2026-10', 180, [], 'electricity');

        $this->actingAs($this->owner)->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('utilitySnapshot.electricity.current', 80)->has('utilitySnapshot.score'));
    }
}
