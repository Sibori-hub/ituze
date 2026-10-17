<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Notifications\EmailVerificationOtp;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_screen_can_be_rendered(): void
    {
        $response = $this->get('/register');

        $response->assertStatus(200);
    }

    public function test_new_users_can_register(): void
    {
        config(['auth.email_otp_enabled' => false]);

        $response = $this->post('/register', [
            'first_name' => 'Test',
            'last_name' => 'User',
            'email' => 'test@example.com',
            'phone' => '0781234567',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'terms' => true,
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('phone.notice', absolute: false));
        $this->assertDatabaseHas('users', [
            'email' => 'test@example.com',
            'role' => 'owner',
            'status' => 'pending',
            'expires_at' => null,
            'profile_completed' => false,
        ]);

        $user = User::where('email', 'test@example.com')->firstOrFail();
        $this->assertNotNull($user->email_verified_at);
        $this->assertNotNull($user->terms_accepted_at);
        $this->assertSame(config('legal.terms_version'), $user->terms_version);
    }

    public function test_registration_form_can_check_if_email_or_phone_is_taken(): void
    {
        $existing = User::factory()->create(['email' => 'taken@example.com', 'phone' => '0788000111']);

        $check = fn (string $field, string $value) => $this->getJson(route('register.availability', compact('field', 'value')));

        $check('email', 'TAKEN@example.com')->assertOk()->assertJson(['available' => false]);
        $check('email', 'free@example.com')->assertOk()->assertJson(['available' => true]);
        $check('phone', '+250 788 000 111')->assertOk()->assertJson(['available' => false]);
        $check('phone', '0788000222')->assertOk()->assertJson(['available' => true]);
        $check('name', 'x')->assertUnprocessable();

        // Deleted accounts still block their details, matching the unique rule on submit.
        $existing->delete();
        $check('email', 'taken@example.com')->assertJson(['available' => false]);
    }

    public function test_international_rwanda_numbers_are_stored_in_local_form(): void
    {
        foreach (['+250 788 123 456', '250788123457', '788123458'] as $i => $phone) {
            $this->post('/register', [
                'first_name' => 'Test',
                'last_name' => 'User',
                'email' => "intl{$i}@example.com",
                'phone' => $phone,
                'password' => 'Password123!',
                'password_confirmation' => 'Password123!',
                'terms' => true,
            ])->assertSessionHasNoErrors();

            auth()->logout();
        }

        $this->assertSame(
            ['0788123456', '0788123457', '0788123458'],
            User::query()->orderBy('id')->pluck('phone')->all(),
        );

        $this->post('/register', [
            'first_name' => 'Test',
            'last_name' => 'User',
            'email' => 'bad@example.com',
            'phone' => '+250 688 123 456',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'terms' => true,
        ])->assertSessionHasErrors('phone');
    }

    public function test_email_otp_can_be_reenabled_for_registration(): void
    {
        Notification::fake();
        config(['auth.email_otp_enabled' => true]);

        $response = $this->post('/register', [
            'first_name' => 'Test',
            'last_name' => 'User',
            'email' => 'test@example.com',
            'phone' => '0781234567',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'terms' => true,
        ]);

        $response->assertRedirect(route('verification.notice', absolute: false));
        $user = User::where('email', 'test@example.com')->firstOrFail();
        $this->assertNull($user->email_verified_at);
        Notification::assertSentTo($user, EmailVerificationOtp::class);
    }
}
