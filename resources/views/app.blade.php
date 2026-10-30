<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        {{-- Light or dark (resources/js/lib/theme.js), applied before the first paint. --}}
        <script>
            try {
                var theme = localStorage.getItem('ituze-theme');
                var dark = theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
                document.documentElement.classList.toggle('dark', dark);
                document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
            } catch (e) {}
        </script>

        @php
            // Link previews and Google: public pages are indexed, the rest of the app is not.
            $meta = array_merge(\App\Support\Seo::defaults(), $meta ?? []);
            $public = request()->is('/', 'spaces/*', 'terms', 'privacy');
            $canonical = request()->is('/') ? url('/') : $meta['url'];
        @endphp
        <title inertia>{{ $public ? $meta['title'] : config('app.name', 'ITUZE GREEN PLATFORM') }}</title>
        <meta name="description" content="{{ $meta['description'] }}">
        @if ($public)
            <link rel="canonical" href="{{ $canonical }}">
        @else
            <meta name="robots" content="noindex, nofollow">
        @endif
        <meta property="og:site_name" content="ITUZE GREEN PLATFORM">
        <meta property="og:type" content="{{ $meta['type'] }}">
        <meta property="og:title" content="{{ $meta['title'] }}">
        <meta property="og:description" content="{{ $meta['description'] }}">
        <meta property="og:url" content="{{ $canonical }}">
        <meta property="og:image" content="{{ $meta['image'] }}">
        <meta property="og:image:alt" content="{{ $meta['title'] }}">
        <meta property="og:locale" content="en_RW">
        <meta property="og:locale:alternate" content="fr_FR">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="{{ $meta['title'] }}">
        <meta name="twitter:description" content="{{ $meta['description'] }}">
        <meta name="twitter:image" content="{{ $meta['image'] }}">
        @if (request()->is('/'))
            <script type="application/ld+json">{!! json_encode([
                '@context' => 'https://schema.org',
                '@type' => 'Organization',
                'name' => 'ITUZE GREEN PLATFORM',
                'legalName' => 'Q.R.A GROUP LTD',
                'url' => url('/'),
                'logo' => url('/images/logo.png'),
                'email' => 'info@qraltd.com',
                'telephone' => '+250793905166',
                'address' => ['@type' => 'PostalAddress', 'streetAddress' => 'KG 14 Ave, Gisozi', 'addressLocality' => 'Kigali', 'addressCountry' => 'RW'],
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) !!}</script>
        @endif

        <!-- Favicon -->
        <link rel="icon" type="image/png" href="/images/logo.png">
        {{-- Installable app (PWA): home screen icon, full screen, colours. --}}
        <link rel="manifest" href="/manifest.webmanifest">
        <meta name="theme-color" content="#0E3B2E">
        <meta name="application-name" content="ITUZE">
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-title" content="ITUZE">
        <meta name="apple-mobile-web-app-status-bar-style" content="default">

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=sora:600,700,800|inter:400,500,600&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        @routes
        @viteReactRefresh
        @vite(['resources/js/app.jsx', "resources/js/Pages/{$page['component']}.jsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>