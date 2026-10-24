<?php

namespace Tests\Feature;

use App\Models\Property;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Notifications\SubscriptionPaymentDecided;
use App\Notifications\SubscriptionPaymentSubmitted;
use App\Notifications\SubscriptionReminder;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SubscriptionPaymentTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $admin;
    private Property $house;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(Carbon::parse('2026-10-19 10:00:00'));
        config(['services.mobile_money.driver' => 'fake', 'services.mobile_money.fake_delay_seconds' => 0]);
        Notification::fake();
        Storage::fake('local');

        $this->admin = User::factory()->create(['role' => 'admin', 'phone' => '0788000001']);
        $this->owner = User::factory()->create([
            'role' => 'owner', 'status' => 'approved', 'profile_completed' => true, 'phone' => '0788000002',
        ]);
        $this->owner->forceFill(['email_verified_at' => now(), 'phone_verified_at' => now()])->save();
        // Each property is paid on its own; this one is paid until 25 October.
        $this->house = $this->property('Kigali Heights', '2026-10-25 10:00:00');
    }

    private function property(string $name, ?string $paidUntil = null): Property
    {
        return Property::create(['owner_id' => $this->owner->id, 'name' => $name, 'address' => 'KG 1 Ave', 'total_floors' => 1, 'paid_until' => $paidUntil]);
    }

    private function slip(): UploadedFile
    {
        return UploadedFile::fake()->create('slip.pdf', 100, 'application/pdf');
    }

    public function test_mobile_money_payment_adds_months_after_the_property_end(): void
    {
        $start = $this->actingAs($this->owner)->postJson(route('subscription.momo.start'), ['property_id' => $this->house->id, 'months' => 3, 'phone' => '0788123456'])
            ->assertCreated()
            ->assertJsonPath('payment.amount', 300000)
            ->assertJsonPath('request.amount', 300000);

        $this->getJson(route('subscription.momo.status', $start->json('payment.id')))
            ->assertOk()
            ->assertJsonPath('request.status', 'successful')
            ->assertJsonPath('payment.status', 'approved');

        // Paid early: three months after 25 October, not after today.
        $this->assertSame('2027-01-25', $this->house->fresh()->paid_until->toDateString());
        $payment = SubscriptionPayment::query()->firstOrFail();
        $this->assertSame($this->house->id, $payment->property_id);
        $this->assertSame('ITZ-SUB-2026-'.str_pad((string) $payment->id, 6, '0', STR_PAD_LEFT), $payment->receipt_number);
        Notification::assertSentTo($this->owner, SubscriptionPaymentDecided::class);
        // Paid by phone with no admin involved: the admins are told by email and SMS.
        Notification::assertSentTo($this->admin, \App\Notifications\SubscriptionPaymentReceived::class, fn ($notification, array $channels) => in_array('mail', $channels, true)
            && in_array(\App\Notifications\Channels\SmsChannel::class, $channels, true)
            && str_contains($notification->toSms($this->admin), 'Kigali Heights for 3 months'));

        $this->get(route('subscription.show'))->assertInertia(fn (Assert $page) => $page
            ->component('Subscription/Index')
            ->where('payments.0.status', 'approved')
            ->where('payments.0.property', 'Kigali Heights')
            ->where('monthlyPrice', 100000));
    }

    public function test_bank_slip_is_checked_by_an_admin_then_approved_or_rejected(): void
    {
        $this->actingAs($this->owner)->post(route('subscription.transfer'), [
            'property_id' => $this->house->id, 'months' => 1, 'method' => 'bank_transfer', 'reference' => 'BK-778899', 'proof' => $this->slip(),
        ])->assertSessionHasNoErrors();
        $payment = SubscriptionPayment::query()->firstOrFail();
        $this->assertSame('pending', $payment->status);
        Storage::disk('local')->assertExists($payment->proof_path);
        Notification::assertSentTo($this->admin, SubscriptionPaymentSubmitted::class);

        // One slip at a time for the same property.
        $this->post(route('subscription.transfer'), ['property_id' => $this->house->id, 'months' => 1, 'method' => 'cheque', 'reference' => 'CHQ-1', 'proof' => $this->slip()])
            ->assertSessionHasErrors('reference');

        // The owner cannot approve; the admin can, and sees the proof and the property.
        $this->post(route('admin.subscriptions.approve', $payment))->assertForbidden();
        $this->actingAs($this->admin)->get(route('subscription.proof', $payment))->assertOk();
        $this->get(route('admin.subscriptions'))->assertInertia(fn (Assert $page) => $page->where('counts.pending', 1)->where('payments.data.0.property', 'Kigali Heights'));
        $this->post(route('admin.subscriptions.approve', $payment))->assertSessionHasNoErrors();
        $this->assertSame('2026-11-25', $this->house->fresh()->paid_until->toDateString());

        // A second slip is rejected with a reason the owner is told.
        $this->actingAs($this->owner)->post(route('subscription.transfer'), ['property_id' => $this->house->id, 'months' => 6, 'method' => 'cheque', 'reference' => 'CHQ-2', 'proof' => $this->slip()]);
        $second = SubscriptionPayment::query()->latest('id')->firstOrFail();
        $this->actingAs($this->admin)->post(route('admin.subscriptions.reject', $second), ['reason' => ''])->assertSessionHasErrors('reason');
        $this->post(route('admin.subscriptions.reject', $second), ['reason' => 'Cheque not signed'])->assertSessionHasNoErrors();
        $this->assertSame('rejected', $second->fresh()->status);
        $this->assertSame('2026-11-25', $this->house->fresh()->paid_until->toDateString());
        Notification::assertSentTo($this->owner, SubscriptionPaymentDecided::class, fn ($notification) => $notification->payment->status === 'rejected');
    }

    public function test_momo_pay_details_are_checked_by_the_admin_and_a_transaction_id_is_used_once(): void
    {
        config(['services.momo_pay.code' => '123456']);
        $form = fn (array $overrides = []) => [
            'property_id' => $this->house->id, 'months' => 1, 'amount' => 100000, 'sender_name' => 'Jean Bosco', 'sender_phone' => '+250 788 123 456',
            'paid_at' => '2026-10-19T12:00', 'transaction_id' => '12345 67890', ...$overrides,
        ];

        $this->actingAs($this->owner)->get(route('subscription.show'))
            ->assertInertia(fn (Assert $page) => $page->where('momoPay.code', '123456')->where('momoApi', true));

        // Wrong amount, future time, letters in the ID: refused.
        $this->post(route('subscription.momopay'), $form(['amount' => 50000, 'paid_at' => '2026-10-20 09:00', 'transaction_id' => 'ABC']))
            ->assertSessionHasErrors(['amount', 'paid_at', 'transaction_id']);

        $this->post(route('subscription.momopay'), $form())->assertSessionHasNoErrors()->assertSessionHas('success');
        $payment = SubscriptionPayment::query()->firstOrFail();
        $this->assertSame(['momo_pay', 'pending', '1234567890', '0788123456', 'Jean Bosco'], [$payment->method, $payment->status, $payment->reference, $payment->sender_phone, $payment->sender_name]);
        // 12:00 typed in Kigali is right now (10:00 UTC): accepted, and kept as the same moment.
        $this->assertSame('2026-10-19 10:00', $payment->paid_at->utc()->format('Y-m-d H:i'));
        $this->assertSame('2026-10-19 12:00', $payment->paid_at->timezone('Africa/Kigali')->format('Y-m-d H:i'));
        // The admins are told at once by email and SMS, with the MoMo details.
        Notification::assertSentTo($this->admin, SubscriptionPaymentSubmitted::class, function ($notification, array $channels) {
            $mail = implode(' ', $notification->toMail($this->admin)->introLines);

            return in_array(\App\Notifications\Channels\SmsChannel::class, $channels, true)
                && str_contains($notification->toSms($this->admin), 'MoMo Pay')
                && str_contains($mail, 'Kigali Heights for 1 month')
                && str_contains($mail, 'MoMo transaction ID: 1234567890')
                && str_contains($mail, 'Jean Bosco · 0788123456 · paid 19 Oct 2026, 12:00');
        });

        // The admin sees the sender details, then approves.
        $this->actingAs($this->admin)->get(route('admin.subscriptions', ['search' => '0788123456']))
            ->assertInertia(fn (Assert $page) => $page->where('payments.data.0.sender_name', 'Jean Bosco')->where('payments.data.0.reference', '1234567890'));
        $this->post(route('admin.subscriptions.approve', $payment))->assertSessionHasNoErrors();
        $this->assertSame('2026-11-25', $this->house->fresh()->paid_until->toDateString());
        Notification::assertSentTo($this->owner, SubscriptionPaymentDecided::class, fn ($notification) => $notification->payment->status === 'approved');
        // The list shows the property as paid.
        $this->get(route('admin.subscriptions', ['status' => 'approved']))
            ->assertInertia(fn (Assert $page) => $page->where('payments.data.0.property_state', 'active')
                ->where('payments.data.0.property_paid_until', fn ($value) => str_starts_with((string) $value, '2026-11-25')));

        // The same transaction ID cannot pay a second time, even for another owner.
        $other = User::factory()->create(['role' => 'owner', 'status' => 'approved', 'profile_completed' => true, 'phone' => '0788000003']);
        $other->forceFill(['email_verified_at' => now(), 'phone_verified_at' => now()])->save();
        $theirs = Property::create(['owner_id' => $other->id, 'name' => 'Other', 'address' => 'KG 2 Ave', 'total_floors' => 1]);
        $this->actingAs($other)->post(route('subscription.momopay'), $form(['property_id' => $theirs->id]))->assertSessionHasErrors('transaction_id');
        // And nobody pays for someone else's property.
        $this->post(route('subscription.momopay'), $form(['transaction_id' => '999888777']))->assertSessionHasErrors('property_id');
    }

    public function test_a_new_property_is_paid_on_its_own_before_it_takes_tenants_or_shows_publicly(): void
    {
        // Creating a property opens its payment form.
        $this->actingAs($this->owner)->get(route('properties.create'))->assertOk();
        $new = $this->property('Rubavu Lodge');
        $this->assertSame('unpaid', $new->fresh()->subscriptionState());
        $this->get(route('subscription.show', ['property' => $new->id]))->assertInertia(fn (Assert $page) => $page
            ->where('selectedProperty', $new->id)
            ->where('subscription.unpaid', 1)
            ->where('subscription.properties.1.name', 'Rubavu Lodge')
            ->where('subscription.properties.1.state', 'unpaid'));

        // Not paid: no tenant can be added there, and it is not on the public website.
        $this->post(route('properties.tenants.store', $new), [])->assertSessionHas('error', fn ($message) => str_contains($message, 'Rubavu Lodge'));
        $type = \App\Models\UnitType::create(['name' => 'Apartment']);
        $room = \App\Models\Unit::create(['property_id' => $new->id, 'unit_type_id' => $type->id, 'floor_number' => 0, 'unit_number' => 'A1', 'rent_amount' => 200000, 'rent_frequency' => 'monthly', 'status' => 'available']);
        $this->assertFalse(\App\Models\Unit::query()->publiclyListed()->whereKey($room->id)->exists());

        // 100,000 RWF per month for that property only; the other keeps its own date.
        $this->post(route('subscription.transfer'), ['property_id' => $new->id, 'months' => 3, 'method' => 'bank_transfer', 'reference' => 'BK-1', 'proof' => $this->slip()])
            ->assertSessionHasNoErrors();
        $payment = SubscriptionPayment::query()->latest('id')->firstOrFail();
        $this->assertSame([300000.0, $new->id, 3], [(float) $payment->amount, $payment->property_id, $payment->months]);
        $this->actingAs($this->admin)->post(route('admin.subscriptions.approve', $payment))->assertSessionHasNoErrors();

        $this->assertSame('2027-01-19', $new->fresh()->paid_until->toDateString());
        $this->assertTrue(\App\Models\Unit::query()->publiclyListed()->whereKey($room->id)->exists());
        $this->assertSame('2026-10-25', $this->house->fresh()->paid_until->toDateString());
        // The owner's date follows the latest paid property.
        $this->assertSame('2027-01-19', $this->owner->fresh()->expires_at->toDateString());
        Notification::assertSentTo($this->owner, SubscriptionPaymentDecided::class, fn ($notification) => str_contains(implode(' ', $notification->toMail($this->owner)->introLines), 'Rubavu Lodge for 3 months'));
    }

    public function test_creating_a_property_goes_to_payment_and_units_wait_for_the_approved_payment(): void
    {
        $province = \App\Models\Province::create(['name' => 'Kigali City']);
        $district = \App\Models\District::create(['name' => 'Gasabo', 'province_id' => $province->id]);
        $sector = \App\Models\Sector::create(['name' => 'Remera', 'district_id' => $district->id]);
        $cell = \App\Models\Cell::create(['name' => 'Rukiri', 'sector_id' => $sector->id]);

        // Step 1: details. Saving goes straight to step 2, the payment.
        $this->actingAs($this->owner)->post(route('properties.store'), ['name' => 'Remera Plaza', 'cell_id' => $cell->id, 'total_floors' => 2, 'basement_floors' => 0])
            ->assertRedirect(route('properties.pay', Property::query()->where('name', 'Remera Plaza')->value('id')));
        $plaza = Property::query()->where('name', 'Remera Plaza')->firstOrFail();
        $this->get(route('properties.pay', $plaza))->assertInertia(fn (Assert $page) => $page
            ->component('Properties/Pay')->where('subscription.state', 'unpaid')->where('subscription.pending', null));

        // Before paying: no units, rooms or tenants; the property page shows the lock.
        $this->post(route('properties.property-units.store', $plaza), [])->assertRedirect(route('properties.pay', $plaza));
        $this->get(route('properties.units.create', $plaza))->assertRedirect(route('properties.pay', $plaza));
        $this->get(route('properties.show', $plaza))->assertInertia(fn (Assert $page) => $page->where('subscription.active', false));

        // Step 2: pay. Still locked while ITUZE checks it.
        $this->post(route('subscription.transfer'), ['property_id' => $plaza->id, 'months' => 1, 'method' => 'bank_transfer', 'reference' => 'BK-77', 'proof' => $this->slip()])
            ->assertSessionHasNoErrors();
        $this->get(route('properties.pay', $plaza))->assertInertia(fn (Assert $page) => $page->where('subscription.pending.amount', 100000));
        $this->get(route('properties.units.create', $plaza))->assertRedirect(route('properties.pay', $plaza))
            ->assertSessionHas('error', fn ($message) => str_contains($message, 'being checked'));

        // Approved: step 3 unlocks.
        $this->actingAs($this->admin)->post(route('admin.subscriptions.approve', SubscriptionPayment::query()->latest('id')->first()))->assertSessionHasNoErrors();
        $this->actingAs($this->owner)->get(route('properties.units.create', $plaza))->assertOk();
        $this->get(route('properties.show', $plaza))->assertInertia(fn (Assert $page) => $page->where('subscription.active', true));
        Notification::assertSentTo($this->owner, SubscriptionPaymentDecided::class, fn ($notification) => str_contains($notification->toSms($this->owner), 'Remera Plaza is paid until')
            && str_contains($notification->toSms($this->owner), route('properties.show', $plaza)));
    }

    public function test_the_test_mobile_money_driver_never_runs_on_the_live_site(): void
    {
        $this->app['env'] = 'production';

        $this->actingAs($this->owner)->get(route('subscription.show'))->assertInertia(fn (Assert $page) => $page->where('momoApi', false));
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class)
            ->postJson(route('subscription.momo.start'), ['property_id' => $this->house->id, 'months' => 1, 'phone' => '0788123456'])->assertNotFound();
        $this->assertSame(0, SubscriptionPayment::count());
    }

    public function test_seven_day_grace_then_the_property_pauses_but_the_account_keeps_working(): void
    {
        // Ended 3 days ago: still working, with a warning.
        $this->house->forceFill(['paid_until' => now()->subDays(3)])->save();
        $this->actingAs($this->owner)->get(route('properties.index'))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('auth.subscription.grace', 1)->where('auth.subscription.blocked', false));
        $this->assertTrue($this->house->fresh()->subscriptionIsActive());

        // Ended 8 days ago: that property is paused, the account still opens.
        $this->house->forceFill(['paid_until' => now()->subDays(8)])->save();
        $this->assertSame('paused', $this->house->fresh()->subscriptionState());
        $this->get(route('properties.index'))->assertOk();
        $this->get(route('subscription.show'))->assertInertia(fn (Assert $page) => $page->where('subscription.paused', 1));

        // Paying after the end starts from today and lifts the pause.
        $id = $this->postJson(route('subscription.momo.start'), ['property_id' => $this->house->id, 'months' => 1, 'phone' => '0788123456'])->json('payment.id');
        $this->getJson(route('subscription.momo.status', $id))->assertJsonPath('payment.status', 'approved');
        $this->assertSame('2026-11-19', $this->house->fresh()->paid_until->toDateString());
        $this->assertSame('active', $this->house->fresh()->subscriptionState());
    }

    public function test_reminders_go_once_per_step_and_per_property(): void
    {
        $this->house->forceFill(['paid_until' => Carbon::parse('2026-10-22 10:00:00')])->save(); // 3 days left
        $this->property('Paid Far Ahead', '2027-06-01 10:00:00');

        $this->artisan('subscriptions:send-reminders')->assertExitCode(0);
        $this->artisan('subscriptions:send-reminders')->assertExitCode(0);
        Notification::assertSentToTimes($this->owner, SubscriptionReminder::class, 1);
        Notification::assertSentTo($this->owner, SubscriptionReminder::class, fn ($notification) => $notification->kind === 'days_3'
            && $notification->property->is($this->house)
            && str_contains($notification->toSms($this->owner), 'Kigali Heights'));

        // The end day: grace starts.
        $this->travelTo(Carbon::parse('2026-10-22 09:00:00'));
        $this->artisan('subscriptions:send-reminders');
        Notification::assertSentTo($this->owner, SubscriptionReminder::class, fn ($notification) => $notification->kind === 'due');

        // Grace over: paused.
        $this->travelTo(Carbon::parse('2026-10-30 09:00:00'));
        $this->artisan('subscriptions:send-reminders');
        Notification::assertSentTo($this->owner, SubscriptionReminder::class, fn ($notification) => $notification->kind === 'blocked');
        Notification::assertSentToTimes($this->owner, SubscriptionReminder::class, 3);
    }

    public function test_the_admin_dashboard_counts_the_money(): void
    {
        $id = $this->actingAs($this->owner)->postJson(route('subscription.momo.start'), ['property_id' => $this->house->id, 'months' => 1, 'phone' => '0788123456'])
            ->assertJsonPath('payment.amount', 100000)->json('payment.id');
        $this->getJson(route('subscription.momo.status', $id))->assertJsonPath('payment.status', 'approved');

        $this->actingAs($this->admin)->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
            ->where('adminOverview.subscriptionMoney.month', 100000)
            ->where('adminOverview.subscriptionMoney.paying_owners', 1));
    }

    public function test_only_self_registered_owners_pay_a_subscription(): void
    {
        $managed = User::factory()->create(['role' => 'owner', 'status' => 'approved', 'created_by' => $this->admin->id, 'profile_completed' => true, 'phone' => '0788000003']);
        $managed->forceFill(['email_verified_at' => now(), 'phone_verified_at' => now()])->save();
        $this->actingAs($managed)->get(route('subscription.show'))->assertForbidden();
        // A managed owner's property needs no subscription.
        $this->assertSame('free', Property::create(['owner_id' => $managed->id, 'name' => 'Managed', 'address' => 'KG 3 Ave', 'total_floors' => 1])->subscriptionState());

        $this->actingAs($this->owner)->postJson(route('subscription.momo.start'), ['property_id' => $this->house->id, 'months' => 2, 'phone' => '0788123456'])->assertUnprocessable();
        $this->actingAs($this->admin)->get(route('subscription.show'))->assertForbidden();
    }
}
