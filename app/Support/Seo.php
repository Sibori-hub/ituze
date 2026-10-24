<?php

namespace App\Support;

use App\Models\Property;
use App\Models\Unit;
use Illuminate\Support\Str;

/**
 * Title, description and picture for link previews (WhatsApp, Facebook, X)
 * and for Google. They are written into the page by the server, because the
 * apps that make previews do not run the site's JavaScript.
 */
class Seo
{
    public const IMAGE = '/images/og-ituze.jpg';

    public static function defaults(): array
    {
        return [
            'title' => 'ITUZE GREEN PLATFORM · Spaces to rent in Rwanda',
            'description' => 'Find offices, apartments, coffee shops, shops and warehouses to rent in Kigali and across Rwanda. Contact owners directly on ITUZE.',
            'image' => url(self::IMAGE),
            'url' => url()->current(),
            'type' => 'website',
        ];
    }

    public static function property(Property $property, ?Unit $unit = null): array
    {
        $place = collect([
            $property->cell?->sector?->name,
            $property->cell?->sector?->district?->name,
        ])->filter()->implode(', ');
        $type = $unit?->unitType?->name;
        $title = $unit
            ? trim(($type ?: 'Space').' to rent · '.$property->name.($place ? ', '.$place : ''))
            : $property->name.' · Spaces to rent'.($place ? ' in '.$place : '');

        $facts = $unit ? collect([
            $unit->rent_amount ? number_format((float) $unit->rent_amount).' RWF / '.(['daily' => 'day', 'weekly' => 'week', 'monthly' => 'month', 'quarterly' => 'quarter', 'yearly' => 'year', 'annually' => 'year'][$unit->rent_frequency] ?? 'month') : null,
            $unit->size_sqm ? rtrim(rtrim(number_format((float) $unit->size_sqm, 1), '0'), '.').' m²' : null,
            $unit->floor_number !== null ? 'Floor '.$unit->floor_number : null,
        ])->filter()->implode(' · ') : $property->units->count().' space'.($property->units->count() === 1 ? '' : 's').' available';

        $about = Str::of(strip_tags((string) ($unit?->description ?: $property->description)))->squish()->limit(150);

        $photo = $unit?->images->sortByDesc('is_cover')->first()?->image_path
            ?? $property->images->sortByDesc('is_cover')->first()?->image_path;

        return [
            'title' => $title.' | ITUZE',
            'description' => trim($facts.'. '.$about, '. ').'.',
            'image' => $photo ? asset('storage/'.$photo) : url(self::IMAGE),
            'url' => $unit ? route('public.units.show', [$property->id, $unit->id]) : route('public.properties.show', $property->id),
            'type' => 'article',
        ];
    }
}
