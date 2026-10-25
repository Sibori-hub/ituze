@props(['url'])
{{-- ITUZE header on every email: logo, name and who runs it. --}}
<tr>
<td class="header">
<a href="{{ $url }}" style="display: inline-block; text-decoration: none;">
<img src="{{ rtrim(config('app.url'), '/') }}/images/logo.png" class="logo" width="64" height="64" alt="ITUZE GREEN PLATFORM">
<span class="brand-name">ITUZE GREEN PLATFORM</span>
<span class="brand-tagline">Property, tenant and rent management · by Q.R.A GROUP LTD</span>
</a>
</td>
</tr>
