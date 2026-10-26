<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Property;
use App\Models\PropertyUnit;
use App\Models\RentCharge;
use App\Models\RentPayment;
use App\Models\Tenancy;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\UnitType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ManagerAccessTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Property $whole;      // given to the manager entirely
    private Property $partial;    // only the Offices unit is given
    private Property $other;      // not given
    private PropertyUnit $offices;
    private PropertyUnit $shops;
    private Unit $officeRoom;
    private Unit $shopRoom;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = $this->makeOwner('owner@example.com', '0788000010');
        $type = UnitType::create(['name' => 'Offices']);
        $shopType = UnitType::create(['name' => 'Shops']);
        $this->whole = Property::create(['paid_until' => now()->addYear(), 'owner_id' => $this->owner->id, 'name' => 'Whole Plaza', 'total_floors' => 2]);
        $this->partial = Property::create(['paid_until' => now()->addYear(), 'owner_id' => $this->owner->id, 'name' => 'Partial Tower', 'total_floors' => 3]);
        $this->other = Property::create(['paid_until' => now()->addYear(), 'owner_id' => $this->owner->id, 'name' => 'Other House', 'total_floors' => 1]);
        $this->offices = PropertyUnit::create(['property_id' => $this->partial->id, 'unit_type_id' => $type->id, 'floor_number' => 1]);
        $this->shops = PropertyUnit::create(['property_id' => $this->partial->id, 'unit_type_id' => $shopType->id, 'floor_number' => 0]);
        $this->officeRoom = $this->room($this->partial, $this->offices, '101');
        $this->shopRoom = $this->room($this->partial, $this->shops, 'S1');
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

    private function room(Property $property, PropertyUnit $unit, string $number): Unit
    {
        return Unit::create([
            'property_id' => $property->id, 'property_unit_id' => $unit->id, 'unit_type_id' => $unit->unit_type_id,
            'floor_number' => $unit->floor_number, 'unit_number' => $number, 'rent_amount' => 200000, 'rent_frequency' => 'monthly', 'status' => 'available',
        ]);
    }

    /** Owner adds a manager through the page; the manager then finishes the first sign-in steps. */
    private function hireManager(): User
    {
        $this->actingAs($this->owner)->post(route('managers.store'), [
            'first_name' => 'Jean', 'last_name' => 'Manager', 'username' => 'jean.manager', 'email' => 'jean@example.com', 'phone' => '0788 555 444',
            'password' => 'Temp-Pass#2026', 'password_confirmation' => 'Temp-Pass#2026',
            'assignments' => [
                ['property_id' => $this->whole->id, 'property_unit_id' => null],
                ['property_id' => $this->partial->id, 'property_unit_id' => $this->offices->id],
            ],
        ])->assertSessionHasNoErrors();

        $manager = User::query()->where('email', 'jean@example.com')->firstOrFail();
        $this->assertSame('manager', $manager->role);
        $this->assertSame($this->owner->id, $manager->employer_id);
        $this->assertTrue($manager->must_change_password);
        // New password, email and phone confirmed, terms accepted and profile completed.
        $manager->forceFill([
            'must_change_password' => false, 'email_verified_at' => now(), 'phone_verified_at' => now(),
            'profile_completed' => true, 'terms_accepted_at' => now(),
        ])->save();

        return $manager->fresh();
    }

    public function test_owner_adds_a_manager_who_must_change_the_temporary_password(): void
    {
        \Illuminate\Support\Facades\Notification::fake();
        $this->actingAs($this->owner)->post(route('managers.store'), [
            // A username to sign in with, and an email like an owner's.
            'first_name' => 'Jean', 'last_name' => 'Manager', 'username' => 'Jean.Ikaze', 'email' => '', 'phone' => '0788555444',
            'password' => 'Temp-Pass#2026', 'password_confirmation' => 'Temp-Pass#2026',
            'assignments' => [['property_id' => $this->whole->id]],
        ])->assertSessionHasErrors('email');
        $this->post(route('managers.store'), [
            'first_name' => 'Jean', 'last_name' => 'Manager', 'username' => 'Jean.Ikaze', 'email' => 'jean.ikaze@example.com', 'phone' => '0788555444',
            'password' => 'Temp-Pass#2026', 'password_confirmation' => 'Temp-Pass#2026',
            'assignments' => [['property_id' => $this->whole->id]],
        ])->assertSessionHasNoErrors();

        $manager = User::query()->where('username', 'jean.ikaze')->firstOrFail();
        $this->assertSame([false, null, null], [$manager->profile_completed, $manager->email_verified_at, $manager->phone_verified_at]);

        // The manager is told by email and SMS: who added them, the username, never the password.
        \Illuminate\Support\Facades\Notification::assertSentTo($manager, \App\Notifications\ManagerAccountCreated::class, function ($notification, $channels) use ($manager) {
            $sms = $notification->toSms($manager);

            return in_array('mail', $channels, true) && in_array(\App\Notifications\Channels\SmsChannel::class, $channels, true)
                && str_contains($sms, 'jean.ikaze') && ! str_contains($sms, 'Temp-Pass#2026')
                && $notification->buildings === ['Whole Plaza'];
        });

        // The owner resets the password: the manager is told again.
        $this->post(route('managers.password', $manager), ['password' => 'Temp-Pass#2027', 'password_confirmation' => 'Temp-Pass#2027'])->assertSessionHasNoErrors();
        \Illuminate\Support\Facades\Notification::assertSentTo($manager, \App\Notifications\ManagerPasswordChanged::class, fn ($notification) => $notification->byOwner === $this->owner->name);
        $manager->forceFill(['password' => 'Temp-Pass#2026'])->save();
        // Email codes are on for the live site, as for owners.
        config(['auth.email_otp_enabled' => true]);
        \Illuminate\Support\Facades\Auth::logout();
        $this->post(route('login'), ['email' => 'jean.ikaze', 'password' => 'Temp-Pass#2026'])->assertSessionHasNoErrors();
        $this->assertAuthenticatedAs($manager);

        // First sign-in, like an owner: new password, email code, phone code, then the full profile.
        $this->get(route('dashboard'))->assertRedirect(route('password.change'));
        $this->post(route('password.change.update'), ['current_password' => 'Temp-Pass#2026', 'password' => 'Own-Pass#2026x', 'password_confirmation' => 'Own-Pass#2026x'])->assertSessionHasNoErrors();
        // Changing it themselves sends a security notice too.
        \Illuminate\Support\Facades\Notification::assertSentTo($manager, \App\Notifications\ManagerPasswordChanged::class, fn ($notification) => $notification->byOwner === null);
        $this->assertNotNull($manager->fresh()->phone_otp, 'The phone code is sent after the new password.');
        $this->actingAs($manager->refresh());
        $this->get(route('dashboard'))->assertRedirect(route('verification.notice'));
        $manager->forceFill(['email_verified_at' => now()])->save();
        $this->actingAs($manager);
        $this->get(route('dashboard'))->assertRedirect(route('phone.notice'));
        $manager->forceFill(['phone_verified_at' => now()])->save();
        $this->actingAs($manager);
        $this->get(route('dashboard'))->assertRedirect(route('profile.complete'));
        $this->get(route('profile.complete'))->assertInertia(fn (Assert $page) => $page->where('needsTerms', true));

        \Illuminate\Support\Facades\Storage::fake('public');
        \Illuminate\Support\Facades\Storage::fake('local');
        $sector = \App\Models\Sector::create(['name' => 'Remera', 'district_id' => \App\Models\District::create(['name' => 'Gasabo', 'province_id' => \App\Models\Province::create(['name' => 'Kigali City'])->id])->id]);
        $profile = [
            'identity_document_type' => 'nida', 'national_id' => '1199080012345678', 'sector_id' => $sector->id,
            'profile_photo' => \Illuminate\Http\UploadedFile::fake()->image('me.jpg'), 'identity_document' => \Illuminate\Http\UploadedFile::fake()->image('id.jpg'),
        ];
        $this->post(route('profile.complete.store'), $profile)->assertSessionHasErrors('terms');
        $this->post(route('profile.complete.store'), [...$profile, 'terms' => '1'])->assertSessionHasNoErrors();
        $manager->refresh();
        $this->assertTrue($manager->profile_completed);
        $this->assertNotNull($manager->terms_accepted_at);
        $this->assertSame('approved', $manager->status);
        $this->get(route('dashboard'))->assertOk();

        // The owner sees the manager's ID and can open the ID copy; nobody else can.
        $this->actingAs($this->owner)->get(route('managers.index'))->assertInertia(fn (Assert $page) => $page
            ->where('managers.0.national_id', '1199080012345678')->where('managers.0.profile_completed', true));
        $this->get(route('managers.identity-document', $manager))->assertOk();
        $this->actingAs($this->makeOwner('nosy@example.com', '0788000099'))->get(route('managers.identity-document', $manager))->assertNotFound();
        $this->actingAs($this->owner);

        // The username is taken once only.
        $this->actingAs($this->owner)->post(route('managers.store'), [
            'first_name' => 'Other', 'last_name' => 'One', 'username' => 'jean.ikaze', 'phone' => '0788555446',
            'password' => 'Temp-Pass#2026', 'password_confirmation' => 'Temp-Pass#2026',
            'assignments' => [['property_id' => $this->whole->id]],
        ])->assertSessionHasErrors('username');

        // Another owner's property cannot be given.
        $stranger = $this->makeOwner('stranger@example.com', '0788000020');
        $foreign = Property::create(['paid_until' => now()->addYear(), 'owner_id' => $stranger->id, 'name' => 'Foreign', 'total_floors' => 1]);
        $this->actingAs($this->owner)->post(route('managers.store'), [
            'first_name' => 'Bad', 'last_name' => 'Pick', 'username' => 'bad.pick', 'email' => 'bad@example.com', 'phone' => '0788555445',
            'password' => 'Temp-Pass#2026', 'password_confirmation' => 'Temp-Pass#2026',
            'assignments' => [['property_id' => $foreign->id]],
        ])->assertSessionHasErrors('assignments');

        // No payment, no manager: an unpaid building is locked until its payment is approved.
        $unpaid = Property::create(['owner_id' => $this->owner->id, 'name' => 'Unpaid House', 'total_floors' => 1]);
        $this->post(route('managers.store'), [
            'first_name' => 'Too', 'last_name' => 'Soon', 'username' => 'too.soon', 'email' => 'too.soon@example.com', 'phone' => '0788555447',
            'password' => 'Temp-Pass#2026', 'password_confirmation' => 'Temp-Pass#2026',
            'assignments' => [['property_id' => $unpaid->id]],
        ])->assertSessionHasErrors(['assignments' => '“Unpaid House” is not paid yet. Pay for it and wait for the approval, then give it to a manager.']);
        $this->get(route('managers.index'))->assertInertia(fn (Assert $page) => $page
            ->where('properties', fn ($rows) => collect($rows)->firstWhere('name', 'Unpaid House')['paid'] === false
                && collect($rows)->firstWhere('name', 'Whole Plaza')['paid'] === true));
    }

    public function test_manager_sees_and_changes_only_what_was_assigned(): void
    {
        $manager = $this->hireManager();
        $this->actingAs($manager);

        // Property list: the whole property and the partly assigned one, never the third.
        $this->get(route('properties.index'))->assertInertia(fn (Assert $page) => $page
            ->has('properties.data', 2)
            ->where('canCreate', false));

        // Partly assigned property: only the Offices unit and its room.
        $this->get(route('properties.show', $this->partial))->assertInertia(fn (Assert $page) => $page
            ->has('property.property_units', 1)
            ->where('property.property_units.0.id', $this->offices->id)
            ->where('canEditProperty', false)
            ->where('canDeleteProperty', false));
        $this->get(route('properties.show', $this->other))->assertForbidden();
        $this->get(route('properties.units.show', [$this->partial, $this->officeRoom]))->assertOk();
        $this->get(route('properties.units.show', [$this->partial, $this->shopRoom]))->assertForbidden();

        // Buildings, floors, units and prices are the owner's: a manager runs tenants, payments and utilities.
        $this->get(route('properties.edit', $this->whole))->assertForbidden();
        $this->get(route('properties.edit', $this->partial))->assertForbidden();
        $this->get(route('properties.create'))->assertForbidden();
        $this->delete(route('properties.destroy', $this->whole))->assertForbidden();
        $this->get(route('properties.show', $this->whole))->assertInertia(fn (Assert $page) => $page->where('canEdit', false)->where('canEditProperty', false));
        \Illuminate\Support\Facades\Storage::fake('public');
        $room = ['unit_number' => '102', 'rent_amount' => 250000, 'rent_frequency' => 'monthly', 'images' => [\Illuminate\Http\UploadedFile::fake()->image('unit.png')]];
        $this->post(route('properties.units.store', $this->partial), [...$room, 'property_unit_id' => $this->offices->id])->assertForbidden();
        $this->get(route('properties.units.edit', [$this->partial, $this->officeRoom]))->assertForbidden();
        $this->put(route('properties.units.update', [$this->partial, $this->officeRoom]), ['rent_amount' => 1])->assertForbidden();
        $this->delete(route('properties.units.destroy', [$this->partial, $this->officeRoom]))->assertForbidden();
        $this->post(route('properties.property-units.store', $this->whole), ['floor_number' => 1])->assertForbidden();
        $this->assertDatabaseMissing('units', ['unit_number' => '102']);

        // A tenant the manager adds shows up in the owner's activity history.
        \App\Models\Tenant::create(['type' => 'individual', 'name' => 'Manager Tenant', 'status' => 'active', 'created_by' => $manager->id]);
        $log = ActivityLog::query()->where('action', 'tenant.created')->firstOrFail();
        $this->assertSame($manager->id, $log->actor_id);
        $this->assertSame($this->owner->id, $log->owner_id);
        $this->actingAs($this->owner)->get(route('managers.index'))->assertInertia(fn (Assert $page) => $page
            ->component('Managers/Index')
            ->has('managers', 1)
            ->where('managers.0.assignments.1.property_unit_id', $this->offices->id)
            ->where('activity.data.0.actor.name', 'Jean Manager'));

        // A building given whole to a manager: the owner sees everything there, read only; the manager makes the changes.
        $this->get(route('utilities.index'))->assertInertia(fn (Assert $page) => $page
            ->has('properties', 3)->where('lockedPropertyIds', [$this->whole->id]));
        $this->post(route('utilities.readings.store'), ['property_id' => $this->whole->id, 'type' => 'water', 'month' => '2026-10', 'reading' => 10])->assertForbidden();
        $wholeRoom = Unit::create(['property_id' => $this->whole->id, 'unit_type_id' => \App\Models\UnitType::space()->id, 'floor_number' => 0, 'unit_number' => 'W1', 'rent_amount' => 100000, 'rent_frequency' => 'monthly', 'status' => 'available']);
        $this->get(route('properties.units.show', [$this->whole, $wholeRoom]))->assertOk()->assertInertia(fn (Assert $page) => $page->where('delegatedToManager', true));
        $this->post(route('properties.units.tenancy.store', [$this->whole, $wholeRoom]), ['tenant_id' => 1])->assertForbidden();
        $this->get(route('properties.units.show', [$this->partial, $this->shopRoom]))->assertInertia(fn (Assert $page) => $page->where('delegatedToManager', false));
        $this->actingAs($manager)->get(route('utilities.index'))->assertInertia(fn (Assert $page) => $page
            ->has('properties', 1)->where('properties.0.id', $this->whole->id)->where('lockedPropertyIds', []));
        // A disabled manager hands the work back to the owner.
        $manager->forceFill(['disabled_at' => now()])->save();
        $this->actingAs($this->owner)->get(route('utilities.index'))->assertInertia(fn (Assert $page) => $page->where('lockedPropertyIds', []));
        $manager->forceFill(['disabled_at' => null])->save();

        // The owner's own actions are not listed: the history is about the managers.
        ActivityLog::query()->whereKey($log->id)->update(['actor_id' => $this->owner->id]);
        $this->get(route('managers.index'))->assertInertia(fn (Assert $page) => $page
            ->where('activity.data', fn ($rows) => collect($rows)->every(fn ($row) => $row['actor']['role'] === 'manager')));
    }

    public function test_manager_payments_and_reports_cover_only_their_rooms(): void
    {
        $manager = $this->hireManager();
        foreach ([$this->officeRoom, $this->shopRoom] as $room) {
            $tenant = Tenant::create(['created_by' => $this->owner->id, 'type' => 'individual', 'name' => 'Tenant '.$room->unit_number, 'identity_type' => 'national_id', 'identity_number' => '11999'.str_pad((string) $room->id, 11, '0', STR_PAD_LEFT), 'email' => "t{$room->id}@example.com", 'phone' => '078800'.str_pad((string) $room->id, 4, '0', STR_PAD_LEFT), 'status' => 'active']);
            $tenancy = Tenancy::create(['unit_id' => $room->id, 'tenant_id' => $tenant->id, 'assigned_by' => $this->owner->id, 'start_date' => now()->startOfMonth(), 'end_date' => now()->addYear(), 'monthly_rent' => 200000, 'rent_frequency' => 'monthly', 'deposit_amount' => 200000, 'status' => 'active']);
            $charge = RentCharge::create(['tenancy_id' => $tenancy->id, 'charge_type' => 'rent', 'period_start' => now()->startOfMonth(), 'period_end' => now()->endOfMonth(), 'due_date' => now()->startOfMonth(), 'amount' => 200000]);
            RentPayment::create(['rent_charge_id' => $charge->id, 'transaction_id' => (string) Str::uuid(), 'recorded_by' => $this->owner->id, 'amount' => 200000, 'method' => 'bank_transfer', 'reference' => 'SLIP', 'paid_at' => now()]);
        }

        $this->actingAs($manager)->get(route('payments.index'))->assertInertia(fn (Assert $page) => $page->has('payments.data', 1));
        $this->get(route('reports.index'))->assertInertia(fn (Assert $page) => $page->where('overview.rent_collected', 200000));
        // The owner's payout statement is not for managers.
        $this->get(route('reports.index', ['tab' => 'owners']))->assertInertia(fn (Assert $page) => $page->where('filters.tab', 'overview'));
        $this->get(route('tenants.index'))->assertInertia(fn (Assert $page) => $page->has('tenants.data', 2)); // both added by the owner
        $this->get(route('leases.index'))->assertOk();

        // The owner still sees everything.
        $this->actingAs($this->owner)->get(route('reports.index'))->assertInertia(fn (Assert $page) => $page->where('overview.rent_collected', 400000));
    }

    public function test_manager_keeps_working_when_a_property_lapses_and_can_be_disabled(): void
    {
        $manager = $this->hireManager();
        $this->actingAs($manager)->get(route('dashboard'))->assertOk();

        // Paid per property: a lapsed property limits that property only, the team keeps working.
        $this->whole->forceFill(['paid_until' => now()->subDays(8)])->save(); // past the 7-day grace
        $this->owner->forceFill(['expires_at' => now()->subDays(8)])->save();
        $this->assertSame('paused', $this->whole->fresh()->subscriptionState());
        $this->actingAs($manager->fresh())->get(route('properties.index'))->assertOk();

        // The owner disables the manager.
        $this->actingAs($this->owner)->post(route('managers.disable', $manager))->assertSessionHasNoErrors();
        $this->assertTrue($manager->fresh()->isDisabled());
        $this->actingAs($manager->fresh())->get(route('dashboard'))->assertRedirect(route('login'));
    }

    public function test_admin_sees_managers_under_their_owner_and_cannot_delete_them(): void
    {
        $manager = $this->hireManager();
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'approved', 'profile_completed' => true]);

        // All users: the manager is not a row of their own; they are listed under the owner.
        $this->actingAs($admin)->get(route('admin.users'))->assertInertia(fn (Assert $page) => $page
            ->where('users.data', fn ($rows) => ! collect($rows)->contains('id', $manager->id)
                && collect(collect($rows)->firstWhere('id', $this->owner->id)['team'])->pluck('id')->all() === [$manager->id]));
        // Found through the manager's username.
        $this->get(route('admin.users', ['search' => 'jean.manager']))->assertInertia(fn (Assert $page) => $page
            ->where('users.data.0.id', $this->owner->id));

        // The admin cannot delete a manager; only the owner removes them.
        $this->delete(route('admin.users.destroy', $manager))->assertSessionHasErrors('user');
        $this->assertNotSoftDeleted($manager);

        // The admin suspends the owner: the managers are blocked with them.
        $this->post(route('admin.users.disable', $this->owner), ['disabled_reason' => 'Unpaid'])->assertSessionHasNoErrors();
        $this->assertFalse($manager->fresh()->employerWorkspaceIsActive());
        $this->actingAs($manager->fresh())->get(route('dashboard'))->assertRedirect();
    }

    public function test_only_self_registered_owners_manage_their_own_team(): void
    {
        $manager = $this->hireManager();

        // Q.R.A-managed owners do not hire managers.
        $admin = User::factory()->create(['role' => 'admin']);
        $managed = $this->makeOwner('managed@example.com', '0788000030', ['created_by' => $admin->id, 'expires_at' => null]);
        $this->actingAs($managed)->get(route('managers.index'))->assertForbidden();

        // Another owner cannot touch this owner's manager.
        $stranger = $this->makeOwner('stranger@example.com', '0788000040');
        $this->actingAs($stranger)->post(route('managers.disable', $manager))->assertNotFound();

        // A manager cannot hire managers.
        $this->actingAs($manager)->get(route('managers.index'))->assertForbidden();
        $this->actingAs($manager)->post(route('managers.store'), [
            'first_name' => 'Sub', 'last_name' => 'Manager', 'email' => 'sub@example.com', 'phone' => '0788 555 999',
            'password' => 'Temp-Pass#2026', 'password_confirmation' => 'Temp-Pass#2026',
            'assignments' => [['property_id' => $this->whole->id, 'property_unit_id' => null]],
        ])->assertForbidden();
        $this->assertDatabaseMissing('users', ['email' => 'sub@example.com']);

        // The subscription belongs to the owner: a manager neither sees nor pays it.
        $this->actingAs($manager)->get(route('subscription.show'))->assertForbidden();
        $this->actingAs($manager)->postJson(route('subscription.momo.start'), ['months' => 1, 'phone' => '0788123456'])->assertForbidden();
        $this->actingAs($manager)->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page->where('auth.canHireManagers', false)->where('auth.subscription', null));

        // An admin can open an owner's team.
        $this->actingAs($admin)->get(route('managers.index', ['owner_id' => $this->owner->id]))
            ->assertInertia(fn (Assert $page) => $page->has('managers', 1)->where('adminView', true));

        DB::table('users')->where('id', $manager->id)->update(['deleted_at' => now()]);
        $this->actingAs($this->owner)->get(route('managers.index'))->assertInertia(fn (Assert $page) => $page->has('managers', 0));
    }
}
