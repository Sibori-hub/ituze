<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class LegalController extends Controller
{
    /**
     * Display the Terms and Conditions.
     */
    public function terms(): Response
    {
        return Inertia::render('Legal/Terms', $this->shared());
    }

    /**
     * Display the Privacy Policy.
     */
    public function privacy(): Response
    {
        return Inertia::render('Legal/Privacy', $this->shared());
    }

    /**
     * @return array<string, mixed>
     */
    protected function shared(): array
    {
        return [
            'version' => config('legal.terms_version'),
            'updatedAt' => config('legal.terms_updated_at'),
            'company' => [
                'name' => config('legal.company_name'),
                'operator' => config('legal.operator'),
                'email' => config('legal.contact_email'),
                'phone' => config('legal.contact_phone'),
                'address' => config('legal.contact_address'),
            ],
        ];
    }
}
