<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
                // Owners Q.R.A manages can look but not change anything.
                'readOnly' => (bool) $request->user()?->isReadOnly(),
            ],
            // Read-only legal metadata so the Terms/Privacy dialog can show the
            // same version and contact details as the full pages.
            'legal' => [
                'termsVersion' => config('legal.terms_version'),
                'termsUpdatedAt' => config('legal.terms_updated_at'),
                'company' => [
                    'name' => config('legal.company_name'),
                    'email' => config('legal.contact_email'),
                    'phone' => config('legal.contact_phone'),
                    'address' => config('legal.contact_address'),
                ],
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error'   => fn () => $request->session()->get('error'),
                'warning' => fn () => $request->session()->get('warning'),
                'info'    => fn () => $request->session()->get('info'),
                'status'  => fn () => $request->session()->get('status'),
            ],
        ];
    }
}