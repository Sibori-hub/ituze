@props(['url'])
{{-- Slim ITUZE bar like the website's top bar: small logo and the name side by side. --}}
<tr>
<td class="header">
<a href="{{ $url }}" style="display: inline-block; text-decoration: none;">
<table class="brand" align="center" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td class="brand-logo"><img src="{{ rtrim(config('app.url'), '/') }}/images/logo.png" class="logo" width="36" height="36" alt="ITUZE"></td>
<td class="brand-text">
<span class="brand-name">ITUZE GREEN PLATFORM</span>
<span class="brand-tagline">by Q.R.A GROUP LTD</span>
</td>
</tr>
</table>
</a>
</td>
</tr>
