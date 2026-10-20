<?php

namespace Tests\Feature;

use Tests\TestCase;

class CsrfTokenRefreshTest extends TestCase
{
    public function test_a_page_left_open_can_get_a_fresh_token(): void
    {
        $response = $this->get('/csrf-token');

        $response->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertCookie('XSRF-TOKEN')
            ->assertJsonStructure(['token']);
        $this->assertSame(session()->token(), $response->json('token'));
    }
}
