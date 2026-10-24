<?php

namespace App\Http\Controllers;

use App\Models\Unit;
use Illuminate\Http\Response;

/**
 * sitemap.xml for Google: the home page, the legal pages and every building
 * and space that is listed for rent right now.
 */
class SitemapController extends Controller
{
    public function __invoke(): Response
    {
        $units = Unit::query()->publiclyListed()->with('property:id,updated_at')->get(['id', 'property_id', 'updated_at']);

        $urls = collect([
            ['loc' => url('/'), 'lastmod' => $units->max('updated_at'), 'priority' => '1.0'],
            ['loc' => route('legal.terms'), 'lastmod' => null, 'priority' => '0.2'],
            ['loc' => route('legal.privacy'), 'lastmod' => null, 'priority' => '0.2'],
        ]);
        foreach ($units->groupBy('property_id') as $propertyId => $propertyUnits) {
            $urls->push(['loc' => route('public.properties.show', $propertyId), 'lastmod' => $propertyUnits->max('updated_at'), 'priority' => '0.8']);
            foreach ($propertyUnits as $unit) {
                $urls->push(['loc' => route('public.units.show', [$propertyId, $unit->id]), 'lastmod' => $unit->updated_at, 'priority' => '0.7']);
            }
        }

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n".'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n";
        foreach ($urls as $url) {
            $xml .= '  <url><loc>'.e($url['loc']).'</loc>'
                .($url['lastmod'] ? '<lastmod>'.$url['lastmod']->toDateString().'</lastmod>' : '')
                .'<priority>'.$url['priority'].'</priority></url>'."\n";
        }

        return response($xml.'</urlset>'."\n", 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
    }
}
