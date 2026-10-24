<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * A unit category name (Office, Restaurant…). Categories are typed by the admin
 * or owner when they add a unit to a property floor; this table only stores
 * the names so rooms can be searched and filtered by them.
 */
class UnitType extends Model
{
    /**
     * Homepage / app filters: words a typed category name may contain.
     */
    public const FILTER_KEYWORDS = [
        'offices' => ['office', 'bureau', 'biro'],
        // Only apartments (any common spelling) have bedrooms and bathrooms.
        'apartments' => ['apartment', 'appartement', 'apartement', 'appartment'],
        'coffee-shops' => ['coffee', 'cafe', 'café', 'restaurant'],
        'commercial-buildings' => ['commercial', 'shop', 'retail', 'boutique', 'store'],
        'warehouses' => ['warehouse', 'storage', 'depot'],
    ];

    protected $fillable = ['name'];

    /** The neutral type of a unit: a space whose use depends on the client renting it. */
    public const SPACE = 'Space';

    public static function space(): self
    {
        return self::query()->firstOrCreate(['name' => self::SPACE]);
    }

    public function units()
    {
        return $this->hasMany(Unit::class);
    }

    public function propertyUnits()
    {
        return $this->hasMany(PropertyUnit::class);
    }

    /**
     * Apartments: these rooms record bedrooms and bathrooms
     * and can be rented by the day.
     */
    public static function isResidentialName(?string $name): bool
    {
        $words = implode('|', array_map(fn ($keyword) => preg_quote($keyword, '/'), self::FILTER_KEYWORDS['apartments']));

        // A word starting with a keyword: "Apartments", "Appartement 2" — not "Ware Houses".
        return (bool) preg_match('/(^|[^\p{L}])('.$words.')/iu', (string) $name);
    }

    /**
     * Names that contain one of the filter's keywords, in any letter case.
     */
    public function scopeMatchingFilter(Builder $query, string $filter): Builder
    {
        $keywords = self::FILTER_KEYWORDS[$filter] ?? [];

        return $query->where(function (Builder $names) use ($keywords) {
            // At the start of the name or of a word, so "Warehouse" is not a "house".
            foreach ($keywords as $keyword) {
                $keyword = mb_strtolower($keyword);
                $names->orWhereRaw('LOWER(name) LIKE ?', [$keyword.'%'])
                    ->orWhereRaw('LOWER(name) LIKE ?', ['% '.$keyword.'%'])
                    ->orWhereRaw('LOWER(name) LIKE ?', ['%-'.$keyword.'%']);
            }
        });
    }

    /**
     * Remove a category name nothing uses any more.
     */
    public static function pruneIfUnused(?int $id): void
    {
        if (! $id) {
            return;
        }

        self::query()
            ->whereKey($id)
            ->whereDoesntHave('units')
            ->whereDoesntHave('propertyUnits')
            ->delete();
    }
}
