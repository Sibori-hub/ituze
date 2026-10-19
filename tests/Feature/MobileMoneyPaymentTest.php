<?php

namespace Tests\Feature;

use App\Models\MobileMoneyRequest;
use App\Models\Property;
use App\Models\PropertyUnit;
use App\Models\Tenancy;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\UnitType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MobileMoneyPaymentTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Unit $unit;
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => 'admin']);
        $owner = User::factory()->create(['role' => 'owner', 'status' => 'approved', 'expires_at' => now()->addYear(), 'created_by' => $this->admin->id]);
        $property = Property::create(['owner_id' => $owner->id, 'name' => 'Momo Plaza', 'total_floors' => 2]);
        $type = UnitType::create(['name' => 'Offices']);
        $parent = PropertyUnit::create(['property_id' => $property->id, 'unit_type_id' => $type->id, 'floor_number' => 1]);
        $this->unit = Unit::create([
            'property_id' => $property->id, 'property_unit_id' => $parent->id, 'unit_type_id' => $type->id, 'floor_number' => 1,
            'unit_number' => '101', 'rent_amount' => 300000, 'rent_frequency' => 'monthly', 'status' => 'available',
        ]);
        $province = DB::table('provinces')->insertGetId(['name' => 'Kigali City', 'created_at' => now(), 'updated_at' => now()]);
        $district = DB::table('districts')->insertGetId(['name' => 'Gasabo', 'province_id' => $province, 'created_at' => now(), 'updated_at' => now()]);
        $sector = DB::table('sectors')->insertGetId(['name' => 'Kacyiru', 'district_id' => $district, 'created_at' => now(), 'updated_at' => now()]);
        $this->tenant = Tenant::create([
            'created_by' => $this->admin->id, 'type' => 'individual', 'name' => 'Momo Tenant', 'first_name' => 'Momo', 'last_name' => 'Tenant',
            'identity_type' => 'national_id', 'identity_number' => '1199880012345678', 'email' => 'momo@example.com', 'phone' => '0788123456',
            'address' => 'Kigali', 'province_id' => $province, 'district_id' => $district, 'sector_id' => $sector, 'status' => 'active',
        ]);
        config(['services.mobile_money.driver' => 'fake', 'services.mobile_money.fake_delay_seconds' => 0]);
    }

    private function sendRequest(string $phone = '0788123456')
    {
        return $this->actingAs($this->admin)->postJson(route('mobile-money.requests.store'), [
            'tenant_id' => $this->tenant->id,
            'unit_id' => $this->unit->id,
            'phone' => $phone,
        ]);
    }

    private function assign(array $overrides = [])
    {
        Storage::fake('local');

        return $this->actingAs($this->admin)->post(route('properties.units.tenancy.store', [$this->unit->property_id, $this->unit->id]), [
            'tenant_id' => $this->tenant->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->subDay()->toDateString(),
            'monthly_rent' => '300000',
            'rent_frequency' => 'monthly',
            'payment_method' => 'mobile_money',
            'lease' => UploadedFile::fake()->create('lease.pdf', 20, 'application/pdf'),
            ...$overrides,
        ]);
    }

    public function test_request_charges_rent_for_two_months_plus_deposit_to_the_tenants_phone(): void
    {
        $response = $this->sendRequest('+250 788 123 456')->assertCreated();

        $response->assertJsonPath('request.status', 'pending')
            ->assertJsonPath('request.phone', '250788123456')
            ->assertJsonPath('request.amount', 900000);
        $this->assertDatabaseHas('mobile_money_requests', ['phone' => '250788123456', 'amount' => '900000.00', 'requested_by' => $this->admin->id]);
    }

    public function test_status_check_confirms_payment_and_assignment_uses_it_once(): void
    {
        $id = $this->sendRequest()->json('request.id');

        $this->getJson(route('mobile-money.requests.show', $id))
            ->assertOk()
            ->assertJsonPath('request.status', 'successful');
        $transactionId = MobileMoneyRequest::findOrFail($id)->provider_transaction_id;
        $this->assertNotEmpty($transactionId);

        $this->assign(['mobile_money_request_id' => $id])->assertSessionHasNoErrors();
        $tenancy = Tenancy::query()->where('tenant_id', $this->tenant->id)->firstOrFail();
        $this->assertSame($transactionId, $tenancy->leases()->firstOrFail()->payment_reference);
        $this->assertSame($tenancy->id, MobileMoneyRequest::findOrFail($id)->tenancy_id);
        $this->assertSame(900000.0, (float) DB::table('rent_payments')->where('reference', $transactionId)->sum('amount'));

        // Deposit and both months are one payment with one receipt.
        $rows = DB::table('rent_payments')->where('reference', $transactionId)->get();
        $this->assertCount(3, $rows);
        $this->assertCount(1, $rows->pluck('transaction_id')->unique());
        $this->assertCount(1, $rows->pluck('receipt_number')->unique());
        $this->actingAs($this->admin)->get(route('payments.index'))
            ->assertInertia(fn (\Inertia\Testing\AssertableInertia $page) => $page
                ->has('payments.data', 1)
                ->where('payments.data.0.amount', '900000.00')
                ->where('payments.data.0.charge.charge_type', 'combined')
                ->where('payments.data.0.vat_amount', fn ($vat) => (float) $vat > 0)
                ->has('payments.data.0.allocations', 3));

        // The same payment cannot pay for a second assignment.
        DB::table('tenancies')->update(['status' => 'ended']);
        DB::table('units')->where('id', $this->unit->id)->update(['status' => 'available']);
        $this->assign(['mobile_money_request_id' => $id])->assertSessionHasErrors('mobile_money_request_id');
    }

    public function test_unconfirmed_declined_or_wrong_amount_payments_are_refused(): void
    {
        $pending = $this->sendRequest()->json('request.id');
        $this->assign(['mobile_money_request_id' => $pending])->assertSessionHasErrors('mobile_money_request_id');

        $declined = $this->sendRequest('0788120000')->json('request.id');
        $this->getJson(route('mobile-money.requests.show', $declined))->assertJsonPath('request.status', 'failed');
        $this->assign(['mobile_money_request_id' => $declined])->assertSessionHasErrors('mobile_money_request_id');

        $paid = $this->sendRequest()->json('request.id');
        $this->getJson(route('mobile-money.requests.show', $paid))->assertJsonPath('request.status', 'successful');
        $this->assign(['mobile_money_request_id' => $paid, 'monthly_rent' => '250000'])->assertSessionHasErrors('mobile_money_request_id');

        $this->assertSame(0, Tenancy::count());
    }

    public function test_numbers_outside_mtn_and_airtel_and_other_owners_are_refused(): void
    {
        $this->sendRequest('0751234567')->assertUnprocessable()->assertJsonValidationErrors('phone');

        $stranger = User::factory()->create(['role' => 'owner', 'status' => 'approved', 'expires_at' => now()->addYear()]);
        $this->actingAs($stranger)->postJson(route('mobile-money.requests.store'), [
            'tenant_id' => $this->tenant->id, 'unit_id' => $this->unit->id, 'phone' => '0788123456',
        ])->assertForbidden();
    }

    public function test_mtn_driver_sends_request_to_pay_and_reads_the_result(): void
    {
        config([
            'services.mobile_money.driver' => 'mtn',
            'services.mobile_money.mtn.base_url' => 'https://sandbox.momodeveloper.mtn.com',
            'services.mobile_money.mtn.environment' => 'sandbox',
            'services.mobile_money.mtn.currency' => 'EUR',
            'services.mobile_money.mtn.subscription_key' => 'sub-key',
            'services.mobile_money.mtn.api_user' => 'user-id',
            'services.mobile_money.mtn.api_key' => 'api-key',
        ]);
        Http::fake([
            'sandbox.momodeveloper.mtn.com/collection/token/' => Http::response(['access_token' => 'token-123', 'expires_in' => 3600]),
            'sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay' => Http::response(null, 202),
            'sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay/*' => Http::response(['status' => 'SUCCESSFUL', 'financialTransactionId' => '987654321']),
        ]);

        $id = $this->sendRequest()->assertCreated()->assertJsonPath('request.currency', 'EUR')->json('request.id');
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '/collection/v1_0/requesttopay')
            && $request['payer']['partyId'] === '250788123456'
            && $request['amount'] === '900000'
            && $request->hasHeader('X-Target-Environment', 'sandbox')
            && $request->hasHeader('Authorization', 'Bearer token-123'));

        $this->getJson(route('mobile-money.requests.show', $id))
            ->assertJsonPath('request.status', 'successful')
            ->assertJsonPath('request.transaction_id', '987654321');
    }

    public function test_callback_only_triggers_a_status_check_with_the_provider(): void
    {
        $id = $this->sendRequest('0788120000')->json('request.id');
        $reference = MobileMoneyRequest::findOrFail($id)->reference;

        // The body claims success; the provider (fake: number ends in 0000) says declined.
        $this->postJson(route('api.mobile-money.callback', $reference), ['status' => 'SUCCESSFUL', 'financialTransactionId' => 'forged'])
            ->assertOk();

        $this->assertSame('failed', MobileMoneyRequest::findOrFail($id)->status);
    }
}
