<?php

namespace Tests\Feature;

use App\Models\AdPurchase;
use App\Models\Property;
use App\Models\PropertyUnit;
use App\Models\Unit;
use App\Models\UnitType;
use App\Models\User;
use App\Notifications\AdPurchasePaid;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdvertiserListingTest extends TestCase
{
    use RefreshDatabase;

    private User $advertiser;
    private User $admin;
    private Property $building;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(Carbon::parse('2026-10-20 10:00:00'));
        config(['services.mobile_money.driver' => 'fake', 'services.mobile_money.fake_delay_seconds' => 0]);
        Notification::fake();

        $this->admin = User::factory()->create(['role' => 'admin', 'phone' => '0788000001']);
        $this->advertiser = User::factory()->create(['role' => 'advertiser', 'status' => 'approved', 'profile_completed' => true, 'phone' => '0788000005']);
        $this->advertiser->forceFill(['email_verified_at' => now(), 'phone_verified_at' => now()])->save();

        $type = UnitType::create(['name' => 'Offices']);
        $this->building = Property::create(['paid_until' => now()->addYear(), 'owner_id' => $this->advertiser->id, 'name' => 'Ad Tower', 'total_floors' => 2, 'requires_listing' => true]);
        $unit = PropertyUnit::create(['property_id' => $this->building->id, 'unit_type_id' => $type->id, 'floor_number' => 1]);
        Unit::create([
            'property_id' => $this->building->id, 'property_unit_id' => $unit->id, 'unit_type_id' => $type->id, 'floor_number' => 1,
            'unit_number' => 'A1', 'rent_amount' => 300000, 'rent_frequency' => 'monthly', 'status' => 'available',
        ]);
    }

    private function buy(int $listings): void
    {
        $id = $this->actingAs($this->advertiser)->postJson(route('advertising.purchases.start'), ['listings' => $listings, 'phone' => '0788123456'])
            ->assertCreated()
            ->assertJsonPath('purchase.amount', $listings * 25000)
            ->json('purchase.id');
        $this->getJson(route('advertising.purchases.status', $id))->assertOk()->assertJsonPath('purchase.status', 'approved');
    }

    public function test_each_property_is_paid_for_then_checked_by_an_admin_and_goes_online(): void
    {
        \Illuminate\Support\Facades\Storage::fake('local');
        // Step 2 after adding a property: its pay page shows it is not paid yet.
        $this->actingAs($this->advertiser)->get(route('advertising.pay', $this->building))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Advertiser/Pay')->where('property.status.key', 'unpaid')->where('price', 25000));
        // MoMo Pay to QRA's code for THIS property: the details from the SMS. Admins are told; it is not online yet.
        $momo = ['property_id' => $this->building->id, 'sender_name' => 'Ad Payer', 'sender_phone' => '0788000005', 'paid_at' => now('Africa/Kigali')->subMinutes(5)->format('Y-m-d\TH:i'), 'transaction_id' => '5512345678'];
        $this->actingAs($this->advertiser)->post(route('advertising.purchases.momopay'), $momo)->assertSessionHasNoErrors();
        $purchase = AdPurchase::query()->latest('id')->firstOrFail();
        $this->assertSame(['pending', 'momo_pay', 25000.0, $this->building->id], [$purchase->status, $purchase->method, (float) $purchase->amount, $purchase->property_id]);
        $this->assertSame(0, (int) $this->advertiser->fresh()->ad_credits);
        $this->assertNull($this->building->fresh()->listed_until);
        $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page->where('buildings.0.status.key', 'checking'));
        Notification::assertSentTo($this->admin, \App\Notifications\AdPurchaseDecision::class, fn ($n) => $n->kind === 'submitted');
        // One waiting at a time.
        $this->post(route('advertising.purchases.momopay'), [...$momo, 'transaction_id' => '5512345679'])->assertSessionHasErrors('property_id');
        // Only the advertiser's own property.
        $other = Property::create(['owner_id' => $this->admin->id, 'name' => 'Not mine', 'total_floors' => 1]);
        $this->post(route('advertising.purchases.momopay'), [...$momo, 'property_id' => $other->id, 'transaction_id' => '5512345670'])->assertNotFound();

        // The admin approves: the property goes on the homepage, and the first-payment gift of 3 free listings is added.
        $this->actingAs($this->admin)->get(route('admin.ad-payments'))->assertOk()->assertInertia(fn (\Inertia\Testing\AssertableInertia $page) => $page
            ->component('Admin/AdPayments')->where('counts.pending', 1)->where('payments.0.bonus_due', 3));
        $this->post(route('admin.ad-payments.approve', $purchase))->assertSessionHasNoErrors();
        $this->assertSame(3, (int) $this->advertiser->fresh()->ad_credits);
        $this->assertTrue($this->building->fresh()->listed_until->isFuture());
        $this->actingAs($this->advertiser)->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page->where('buildings.0.status.key', 'listed'));
        $this->actingAs($this->admin);
        $this->assertSame($this->admin->id, $purchase->fresh()->reviewed_by);

        // The same transaction ID cannot pay twice; a bank slip can be rejected with a reason.
        $this->actingAs($this->advertiser)->post(route('advertising.purchases.momopay'), $momo)->assertSessionHasErrors('transaction_id');
        $this->post(route('advertising.purchases.transfer'), [
            'property_id' => $this->building->id, 'method' => 'bank_transfer', 'bank_name' => 'Bank of Kigali', 'account_number' => '00040-0123456-78',
            'sender_name' => 'AD LTD', 'reference' => 'FT26299XYZ', 'paid_at' => now()->toDateString(),
            'proof' => \Illuminate\Http\UploadedFile::fake()->image('slip.jpg'),
        ])->assertSessionHasNoErrors();
        $slip = AdPurchase::query()->latest('id')->firstOrFail();
        $this->get(route('ad-payments.proof', $slip))->assertOk();
        $this->actingAs($this->admin)->post(route('admin.ad-payments.reject', $slip), ['reason' => ''])->assertSessionHasErrors('reason');
        $this->post(route('admin.ad-payments.reject', $slip), ['reason' => 'No such transfer'])->assertSessionHasNoErrors();
        $this->assertSame('rejected', $slip->fresh()->status);
        $this->assertSame(3, (int) $this->advertiser->fresh()->ad_credits);
        Notification::assertSentTo($this->advertiser, \App\Notifications\AdPurchaseDecision::class, fn ($n) => $n->kind === 'rejected');
    }

    public function test_first_purchase_gives_three_free_listings_once_and_admins_are_told(): void
    {
        $this->buy(1);
        $this->assertSame(4, $this->advertiser->fresh()->ad_credits); // 1 paid + 3 free
        Notification::assertSentTo($this->admin, AdPurchasePaid::class);
        Notification::assertSentTo($this->advertiser, AdPurchasePaid::class);

        $this->buy(2);
        $this->assertSame(6, $this->advertiser->fresh()->ad_credits); // no second bonus

        $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
            ->component('Advertiser/Dashboard')
            ->where('credits', 6)
            ->where('bonusAvailable', false)
            ->has('purchases', 2));
    }

    public function test_a_published_building_shows_on_the_homepage_for_sixty_days(): void
    {
        // Not paid: not public.
        $this->get(route('public.properties.show', $this->building))->assertNotFound();
        $this->actingAs($this->advertiser)->post(route('advertising.publish', $this->building))->assertSessionHasErrors('credits');

        $this->buy(1);
        $this->post(route('advertising.publish', $this->building))->assertSessionHasNoErrors();
        $this->assertSame('2026-12-19', $this->building->fresh()->listed_until->toDateString());
        $this->assertSame(3, $this->advertiser->fresh()->ad_credits);
        $this->get(route('public.properties.show', $this->building))->assertInertia(fn (Assert $page) => $page->has('property.units', 1));

        // Extending adds 60 days after the current end.
        $this->post(route('advertising.publish', $this->building))->assertSessionHasNoErrors();
        $this->assertSame('2027-02-17', $this->building->fresh()->listed_until->toDateString());

        // After it ends, it leaves the homepage.
        $this->travelTo(Carbon::parse('2027-02-18 10:00:00'));
        $this->get(route('public.properties.show', $this->building))->assertNotFound();
    }

    public function test_the_admin_neither_sees_nor_changes_an_advertisers_property(): void
    {
        $this->admin->markEmailAsVerified();
        $this->admin->update(['profile_completed' => true]);
        $this->actingAs($this->admin);

        $this->get(route('properties.index'))->assertOk()
            ->assertDontSee('Ad Tower');
        $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page->where('adminOverview.properties', 0));
        $this->get(route('properties.edit', $this->building))->assertStatus(403);
        $this->put(route('properties.update', $this->building), ['name' => 'Changed', 'total_floors' => 2])->assertStatus(403);
        $this->delete(route('properties.destroy', $this->building))->assertStatus(403);
        $this->assertSame('Ad Tower', $this->building->fresh()->name);
    }

    public function test_an_advertiser_adds_a_property_first_then_pays_for_it(): void
    {
        $this->actingAs($this->advertiser);
        foreach ([route('properties.index'), route('properties.create'), route('properties.show', $this->building)] as $url) {
            $this->get($url)->assertOk();
        }
        // Not paid: not on the homepage.
        $this->assertFalse(Unit::query()->publiclyListed()->where('property_id', $this->building->id)->exists());
        $this->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page->where('buildings.0.status.key', 'unpaid'));
    }

    public function test_advertisers_manage_buildings_but_have_no_tenants_or_leases(): void
    {
        $this->buy(1);
        $this->actingAs($this->advertiser);
        $this->get(route('properties.index'))->assertOk();
        $this->get(route('properties.create'))->assertOk();
        $this->get(route('properties.show', $this->building))->assertOk();
        $room = $this->building->units()->first();
        $this->get(route('properties.units.show', [$this->building, $room]))->assertRedirect(route('properties.show', $this->building));

        foreach (['tenants.index', 'leases.index', 'payments.index', 'reports.index', 'managers.index'] as $name) {
            $this->get(route($name))->assertForbidden();
        }
        $this->post(route('properties.units.tenancy.store', [$this->building, $room]), [])->assertForbidden();

        // Another advertiser cannot publish this building.
        $other = User::factory()->create(['role' => 'advertiser', 'status' => 'approved', 'profile_completed' => true, 'phone' => '0788000006', 'ad_credits' => 2]);
        $other->forceFill(['email_verified_at' => now(), 'phone_verified_at' => now()])->save();
        $this->actingAs($other)->post(route('advertising.publish', $this->building))->assertNotFound();
    }

    public function test_a_building_an_advertiser_adds_waits_for_a_paid_listing(): void
    {
        $this->buy(1);
        $province = \Illuminate\Support\Facades\DB::table('provinces')->insertGetId(['name' => 'Kigali City', 'created_at' => now(), 'updated_at' => now()]);
        $district = \Illuminate\Support\Facades\DB::table('districts')->insertGetId(['name' => 'Gasabo', 'province_id' => $province, 'created_at' => now(), 'updated_at' => now()]);
        $sector = \Illuminate\Support\Facades\DB::table('sectors')->insertGetId(['name' => 'Remera', 'district_id' => $district, 'created_at' => now(), 'updated_at' => now()]);
        $cell = \Illuminate\Support\Facades\DB::table('cells')->insertGetId(['name' => 'Rukiri', 'sector_id' => $sector, 'created_at' => now(), 'updated_at' => now()]);

        $this->actingAs($this->advertiser)->post(route('properties.store'), ['name' => 'Form Tower', 'total_floors' => 1, 'basement_floors' => 0, 'cell_id' => $cell])
            ->assertSessionHasNoErrors();
        $this->assertTrue(Property::query()->where('name', 'Form Tower')->firstOrFail()->requires_listing);
    }

    public function test_android_app_link_file_names_the_app_and_its_key(): void
    {
        $this->get('/.well-known/assetlinks.json')
            ->assertOk()
            ->assertJsonPath('0.target.package_name', 'com.qragroup.ituze')
            ->assertJsonPath('0.relation.0', 'delegate_permission/common.handle_all_urls')
            ->assertJsonCount(1, '0.target.sha256_cert_fingerprints');
    }

    public function test_owner_buildings_stay_on_the_homepage_without_a_listing(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'status' => 'approved', 'expires_at' => now()->addMonth(), 'phone' => '0788000007']);
        $property = Property::create(['paid_until' => now()->addYear(), 'owner_id' => $owner->id, 'name' => 'Owner House', 'total_floors' => 1]);
        Unit::create([
            'property_id' => $property->id, 'unit_type_id' => UnitType::first()->id, 'floor_number' => 0,
            'unit_number' => 'B1', 'rent_amount' => 200000, 'rent_frequency' => 'monthly', 'status' => 'available',
        ]);

        $this->get(route('public.properties.show', $property))->assertInertia(fn (Assert $page) => $page->has('property.units', 1));
    }
}
