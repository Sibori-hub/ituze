<x-mail::layout>
    {{-- Header --}}
    <x-slot:header>
        <x-mail::header :url="config('app.url')">
ITUZE GREEN PLATFORM · Q.R.A GROUP LTD
</x-mail::header>
    </x-slot:header>

    {{-- Body --}}
    {{ $slot }}

    {{-- Subcopy --}}
    @isset($subcopy)
        <x-slot:subcopy>
            <x-mail::subcopy>
                {{ $subcopy }}
            </x-mail::subcopy>
        </x-slot:subcopy>
    @endisset

    {{-- Footer --}}
    <x-slot:footer>
        <x-mail::footer>
ITUZE GREEN PLATFORM · Q.R.A GROUP LTD
KG 14 Ave, Gisozi (ULK-Kagugu Road, Source Oil Building), Kigali, Rwanda
Phone & WhatsApp: 0793 905 166 · Email: info@qraltd.com · {{ config('app.url') }}
© {{ date('Y') }} Q.R.A GROUP LTD. All rights reserved.
</x-mail::footer>
    </x-slot:footer>
</x-mail::layout>
