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
        $start = $this->actingAs($this->owner)->postJson(route('subscription.momo.start'), ['months' => 3, 'phone' => '0788123456'])
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
            'months' => 1, 'method' => 'bank_transfer', 'reference' => 'BK-778899', 'proof' => $slip(),
        ])->assertSessionHasNoErrors();
        $payment = SubscriptionPayment::query()->firstOrFail();
        $this->assertSame('pending', $payment->status);
        Storage::disk('local')->assertExists($payment->proof_path);
        Notification::assertSentTo($this->admin, SubscriptionPaymentSubmitted::class);

        // Only one slip at a time.
        $this->post(route('subscription.transfer'), ['months' => 1, 'method' => 'cheque', 'reference' => 'CHQ-1', 'proof' => $slip()])
            ->assertSessionHasErrors('reference');

        // The owner cannot approve; the admin can, and sees the proof.
        $this->post(route('admin.subscriptions.approve', $payment))->assertForbidden();
        $this->actingAs($this->admin)->get(route('subscription.proof', $payment))->assertOk();
        $this->get(route('admin.subscriptions'))->assertInertia(fn (Assert $page) => $page->where('counts.pending', 1)->has('payments.data', 1));
        $this->post(route('admin.subscriptions.approve', $payment))->assertSessionHasNoErrors();
        $this->assertSame('2026-11-25', $this->owner->fresh()->expires_at->toDateString());

        // A second slip is rejected with a reason the owner is told.
        $this->actingAs($this->owner)->post(route('subscription.transfer'), ['months' => 6, 'method' => 'cheque', 'reference' => 'CHQ-2', 'proof' => $slip()]);
        $second = SubscriptionPayment::query()->latest('id')->firstOrFail();
        $this->actingAs($this->admin)->post(route('admin.subscriptions.reject', $second), ['reason' => ''])->assertSessionHasErrors('reason');
        $this->post(route('admin.subscriptions.reject', $second), ['reason' => 'Cheque not signed'])->assertSessionHasNoErrors();
        $this->assertSame('rejected', $second->fresh()->status);
        $this->assertSame('2026-11-25', $this->owner->fresh()->expires_at->toDateString());
        Notification::assertSentTo($this->owner, SubscriptionPaymentDecided::class, fn ($notification) => $notification->payment->status === 'rejected');
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
        $id = $this->postJson(route('subscription.momo.start'), ['months' => 1, 'phone' => '0788123456'])->json('payment.id');
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

        $id = $this->postJson(route('subscription.momo.start'), ['months' => 1, 'phone' => '0788123456'])->json('payment.id');
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

        $this->actingAs($this->owner)->postJson(route('subscription.momo.start'), ['months' => 2, 'phone' => '0788123456'])->assertUnprocessable();
        $this->actingAs($this->admin)->get(route('subscription.show'))->assertForbidden();
    }
}
