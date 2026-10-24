<?php

namespace Tests\Feature;

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

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(Carbon::parse('2026-10-19 10:00:00'));
        config(['services.mobile_money.driver' => 'fake', 'services.mobile_money.fake_delay_seconds' => 0]);
        Notification::fake();
        Storage::fake('local');

        $this->admin = User::factory()->create(['role' => 'admin', 'phone' => '0788000001']);
        $this->owner = User::factory()->create([
            'role' => 'owner', 'status' => 'approved', 'expires_at' => Carbon::parse('2026-10-25 10:00:00'),
            'profile_completed' => true, 'phone' => '0788000002',
        ]);
        $this->owner->forceFill(['email_verified_at' => now(), 'phone_verified_at' => now()])->save();
    }

    public function test_mobile_money_payment_adds_months_after_the_current_end(): void
    {
        $start = $this->actingAs($this->owner)->postJson(route('subscription.momo.start'), ['months' => 3, 'houses' => 1, 'phone' => '0788123456'])
            ->assertCreated()
            ->assertJsonPath('payment.amount', 300000)
            ->assertJsonPath('request.amount', 300000);

        $this->getJson(route('subscription.momo.status', $start->json('payment.id')))
            ->assertOk()
            ->assertJsonPath('request.status', 'successful')
            ->assertJsonPath('payment.status', 'approved');

        // Paid early: three months after 25 October, not after today.
        $this->assertSame('2027-01-25', $this->owner->fresh()->expires_at->toDateString());
        $payment = SubscriptionPayment::query()->firstOrFail();
        $this->assertSame('ITZ-SUB-2026-'.str_pad((string) $payment->id, 6, '0', STR_PAD_LEFT), $payment->receipt_number);
        Notification::assertSentTo($this->owner, SubscriptionPaymentDecided::class);
        // Paid by phone with no admin involved: the admins are told by email and SMS.
        Notification::assertSentTo($this->admin, \App\Notifications\SubscriptionPaymentReceived::class, fn ($notification, array $channels) => in_array('mail', $channels, true) && in_array(\App\Notifications\Channels\SmsChannel::class, $channels, true));

        // The page lists it as paid.
        $this->get(route('subscription.show'))->assertInertia(fn (Assert $page) => $page
            ->component('Subscription/Index')
            ->where('payments.0.status', 'approved')
            ->where('monthlyPrice', 100000));
    }

    public function test_bank_slip_is_checked_by_an_admin_then_approved_or_rejected(): void
    {
        $slip = fn () => UploadedFile::fake()->create('slip.pdf', 100, 'application/pdf');

        $this->actingAs($this->owner)->post(route('subscription.transfer'), [
            'months' => 1, 'houses' => 1, 'method' => 'bank_transfer', 'reference' => 'BK-778899', 'proof' => $slip(),
        ])->assertSessionHasNoErrors();
        $payment = SubscriptionPayment::query()->firstOrFail();
        $this->assertSame('pending', $payment->status);
        Storage::disk('local')->assertExists($payment->proof_path);
        Notification::assertSentTo($this->admin, SubscriptionPaymentSubmitted::class);

        // Only one slip at a time.
        $this->post(route('subscription.transfer'), ['months' => 1, 'houses' => 1, 'method' => 'cheque', 'reference' => 'CHQ-1', 'proof' => $slip()])
            ->assertSessionHasErrors('reference');

        // The owner cannot approve; the admin can, and sees the proof.
        $this->post(route('admin.subscriptions.approve', $payment))->assertForbidden();
        $this->actingAs($this->admin)->get(route('subscription.proof', $payment))->assertOk();
        $this->get(route('admin.subscriptions'))->assertInertia(fn (Assert $page) => $page->where('counts.pending', 1)->has('payments.data', 1));
        $this->post(route('admin.subscriptions.approve', $payment))->assertSessionHasNoErrors();
        $this->assertSame('2026-11-25', $this->owner->fresh()->expires_at->toDateString());

        // A second slip is rejected with a reason the owner is told.
        $this->actingAs($this->owner)->post(route('subscription.transfer'), ['months' => 6, 'houses' => 1, 'method' => 'cheque', 'reference' => 'CHQ-2', 'proof' => $slip()]);
        $second = SubscriptionPayment::query()->latest('id')->firstOrFail();
        $this->actingAs($this->admin)->post(route('admin.subscriptions.reject', $second), ['reason' => ''])->assertSessionHasErrors('reason');
        $this->post(route('admin.subscriptions.reject', $second), ['reason' => 'Cheque not signed'])->assertSessionHasNoErrors();
        $this->assertSame('rejected', $second->fresh()->status);
        $this->assertSame('2026-11-25', $this->owner->fresh()->expires_at->toDateString());
        Notification::assertSentTo($this->owner, SubscriptionPaymentDecided::class, fn ($notification) => $notification->payment->status === 'rejected');
    }

    public function test_momo_pay_details_are_checked_by_the_admin_and_a_transaction_id_is_used_once(): void
    {
        config(['services.momo_pay.code' => '123456']);
        $form = fn (array $overrides = []) => [
            'months' => 1, 'houses' => 1, 'amount' => 100000, 'sender_name' => 'Jean Bosco', 'sender_phone' => '+250 788 123 456',
            'paid_at' => '2026-10-19 09:30', 'transaction_id' => '12345 67890', ...$overrides,
        ];

        $this->actingAs($this->owner)->get(route('subscription.show'))
            ->assertInertia(fn (Assert $page) => $page->where('momoPay.code', '123456')->where('momoApi', true));

        // Wrong amount, future time, letters in the ID: refused.
        $this->post(route('subscription.momopay'), $form(['amount' => 50000, 'paid_at' => '2026-10-20 09:00', 'transaction_id' => 'ABC']))
            ->assertSessionHasErrors(['amount', 'paid_at', 'transaction_id']);

        $this->post(route('subscription.momopay'), $form())->assertSessionHasNoErrors()->assertSessionHas('success');
        $payment = SubscriptionPayment::query()->firstOrFail();
        $this->assertSame(['momo_pay', 'pending', '1234567890', '0788123456', 'Jean Bosco'], [$payment->method, $payment->status, $payment->reference, $payment->sender_phone, $payment->sender_name]);
        $this->assertSame('2026-10-19 09:30', $payment->paid_at->format('Y-m-d H:i'));
        // The admins are told at once by email and SMS, with the MoMo details.
        Notification::assertSentTo($this->admin, SubscriptionPaymentSubmitted::class, function ($notification, array $channels) {
            $mail = implode(' ', $notification->toMail($this->admin)->introLines);

            return in_array(\App\Notifications\Channels\SmsChannel::class, $channels, true)
                && str_contains($notification->toSms($this->admin), 'MoMo Pay')
                && str_contains($mail, 'MoMo transaction ID: 1234567890')
                && str_contains($mail, 'Jean Bosco · 0788123456');
        });

        // The admin sees the sender details, then approves.
        $this->actingAs($this->admin)->get(route('admin.subscriptions', ['search' => '0788123456']))
            ->assertInertia(fn (Assert $page) => $page->where('payments.data.0.sender_name', 'Jean Bosco')->where('payments.data.0.reference', '1234567890'));
        $this->post(route('admin.subscriptions.approve', $payment))->assertSessionHasNoErrors();
        $this->assertSame('2026-11-25', $this->owner->fresh()->expires_at->toDateString());
        Notification::assertSentTo($this->owner, SubscriptionPaymentDecided::class, fn ($notification) => $notification->payment->status === 'approved');
        // The list shows the owner as paid, not "Not paid yet".
        $this->get(route('admin.subscriptions', ['status' => 'approved']))
            ->assertInertia(fn (Assert $page) => $page->where('payments.data.0.owner_status.blocked', false)
                ->where('payments.data.0.owner_status.paid_until', fn ($value) => str_starts_with((string) $value, '2026-11-25')));

        // The same transaction ID cannot pay a second time, even for another owner.
        $other = User::factory()->create(['role' => 'owner', 'status' => 'approved', 'profile_completed' => true, 'phone' => '0788000003']);
        $other->forceFill(['email_verified_at' => now(), 'phone_verified_at' => now()])->save();
        $this->actingAs($other)->post(route('subscription.momopay'), $form())->assertSessionHasErrors('transaction_id');
    }

    public function test_the_price_is_per_house_and_an_owner_pays_for_a_house_before_adding_it(): void
    {
        $this->owner->forceFill(['expires_at' => null, 'paid_houses' => 0])->save();
        $slip = fn () => UploadedFile::fake()->create('slip.pdf', 100, 'application/pdf');
        $house = fn (string $name) => \App\Models\Property::create(['owner_id' => $this->owner->id, 'name' => $name, 'address' => 'KG 1 Ave', 'total_floors' => 1]);

        // Not paid yet: no house can be added.
        $this->assertFalse($this->owner->fresh()->canAddHouse());

        // 2 houses × 3 months = 600,000 RWF.
        $this->actingAs($this->owner)->post(route('subscription.transfer'), [
            'months' => 3, 'houses' => 2, 'method' => 'bank_transfer', 'reference' => 'BK-1', 'proof' => $slip(),
        ])->assertSessionHasNoErrors();
        $payment = SubscriptionPayment::query()->latest('id')->firstOrFail();
        $this->assertSame([600000.0, 2, 3, 'renewal'], [(float) $payment->amount, $payment->houses, $payment->months, $payment->purpose]);
        $this->actingAs($this->admin)->post(route('admin.subscriptions.approve', $payment))->assertSessionHasNoErrors();

        $owner = $this->owner->fresh();
        $this->assertSame(2, $owner->paid_houses);
        $this->assertSame('2027-01-19', $owner->expires_at->toDateString());

        // Two houses fit; the third needs a payment first.
        $house('House A');
        $house('House B');
        $this->assertFalse($owner->fresh()->canAddHouse());
        $this->actingAs($owner)->get(route('properties.create'))->assertRedirect(route('subscription.show', ['add' => 1]));

        // Renewing for fewer houses than the owner has is refused.
        $this->post(route('subscription.transfer'), ['months' => 1, 'houses' => 1, 'method' => 'cheque', 'reference' => 'CHQ-9', 'proof' => $slip()])
            ->assertSessionHasErrors('houses');

        // One extra house for the 3 months left = 300,000 RWF; the end date stays.
        $this->get(route('subscription.show'))->assertInertia(fn (Assert $page) => $page
            ->where('subscription.paid_houses', 2)->where('subscription.houses_used', 2)->where('subscription.months_left', 3));
        $this->post(route('subscription.transfer'), ['purpose' => 'add_houses', 'months' => 12, 'houses' => 1, 'method' => 'cheque', 'reference' => 'CHQ-10', 'proof' => $slip()])
            ->assertSessionHasNoErrors();
        $extra = SubscriptionPayment::query()->latest('id')->firstOrFail();
        $this->assertSame([300000.0, 1, 3, 'add_houses'], [(float) $extra->amount, $extra->houses, $extra->months, $extra->purpose]);
        $this->actingAs($this->admin)->post(route('admin.subscriptions.approve', $extra))->assertSessionHasNoErrors();

        $owner->refresh();
        $this->assertSame(3, $owner->paid_houses);
        $this->assertSame('2027-01-19', $owner->expires_at->toDateString());
        $this->assertTrue($owner->canAddHouse());
        Notification::assertSentTo($owner, SubscriptionPaymentDecided::class, fn ($notification) => str_contains(implode(' ', $notification->toMail($owner)->introLines), '1 extra house for 3 months'));
    }

    public function test_the_test_mobile_money_driver_never_runs_on_the_live_site(): void
    {
        $this->app['env'] = 'production';

        $this->actingAs($this->owner)->get(route('subscription.show'))->assertInertia(fn (Assert $page) => $page->where('momoApi', false));
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class)
            ->postJson(route('subscription.momo.start'), ['months' => 1, 'houses' => 1, 'phone' => '0788123456'])->assertNotFound();
        $this->assertSame(0, SubscriptionPayment::count());
    }

    public function test_seven_day_grace_then_pause_but_paying_is_always_possible(): void
    {
        // Ended 3 days ago: still working, with a warning.
        $this->owner->forceFill(['expires_at' => now()->subDays(3)])->save();
        $this->actingAs($this->owner->fresh())->get(route('properties.index'))->assertOk();
        $this->get(route('subscription.show'))->assertInertia(fn (Assert $page) => $page
            ->where('subscription.in_grace', true)
            ->where('subscription.blocked', false));

        // Ended 8 days ago: paused, but the payment page stays open.
        $this->owner->forceFill(['expires_at' => now()->subDays(8)])->save();
        $this->actingAs($this->owner->fresh())->get(route('properties.index'))->assertRedirect(route('account.status'));
        $this->get(route('account.status'))->assertInertia(fn (Assert $page) => $page->where('canPay', true));
        $this->get(route('subscription.show'))->assertOk();

        // Paying after the end starts from today and lifts the pause.
        $id = $this->postJson(route('subscription.momo.start'), ['months' => 1, 'houses' => 1, 'phone' => '0788123456'])->json('payment.id');
        $this->getJson(route('subscription.momo.status', $id))->assertJsonPath('subscription.blocked', false);
        $this->assertSame('2026-11-19', $this->owner->fresh()->expires_at->toDateString());
        $this->actingAs($this->owner->fresh())->get(route('properties.index'))->assertOk();
    }

    public function test_reminders_go_once_per_step(): void
    {
        $this->owner->forceFill(['expires_at' => Carbon::parse('2026-10-22 10:00:00')])->save(); // 3 days left

        $this->artisan('subscriptions:send-reminders')->assertExitCode(0);
        $this->artisan('subscriptions:send-reminders')->assertExitCode(0);
        Notification::assertSentToTimes($this->owner, SubscriptionReminder::class, 1);
        Notification::assertSentTo($this->owner, SubscriptionReminder::class, fn ($notification) => $notification->kind === 'days_3');

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

    public function test_an_approved_owner_pays_the_first_month_before_using_the_system(): void
    {
        $this->owner->approveAccount();
        $this->actingAs($this->owner->fresh())->get(route('properties.index'))->assertRedirect(route('account.status'));
        $this->get(route('account.status'))->assertInertia(fn (Assert $page) => $page->where('neverPaid', true)->where('canPay', true));

        $id = $this->postJson(route('subscription.momo.start'), ['months' => 1, 'houses' => 1, 'phone' => '0788123456'])->json('payment.id');
        $this->getJson(route('subscription.momo.status', $id))->assertJsonPath('payment.status', 'approved');
        $this->assertSame('2026-11-19', $this->owner->fresh()->expires_at->toDateString());
        $this->actingAs($this->owner->fresh())->get(route('properties.index'))->assertOk();

        // The admin dashboard counts the money.
        $this->actingAs($this->admin)->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
            ->where('adminOverview.subscriptionMoney.month', 100000)
            ->where('adminOverview.subscriptionMoney.paying_owners', 1));
    }

    public function test_only_self_registered_owners_pay_a_subscription(): void
    {
        $managed = User::factory()->create(['role' => 'owner', 'status' => 'approved', 'created_by' => $this->admin->id, 'profile_completed' => true, 'phone' => '0788000003']);
        $managed->forceFill(['email_verified_at' => now(), 'phone_verified_at' => now()])->save();
        $this->actingAs($managed)->get(route('subscription.show'))->assertForbidden();

        $this->actingAs($this->owner)->postJson(route('subscription.momo.start'), ['months' => 2, 'houses' => 1, 'phone' => '0788123456'])->assertUnprocessable();
        $this->actingAs($this->admin)->get(route('subscription.show'))->assertForbidden();
    }
}
