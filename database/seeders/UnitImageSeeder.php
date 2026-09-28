<?php

namespace Database\Seeders;

use App\Models\Unit;
use Illuminate\Database\Seeder;

class UnitImageSeeder extends Seeder
{
    private const SAMPLE_PROPERTY_NAMES = [
        'Source Oil Building',
        'Makuza Peace Plaza',
        'Kigali Heights Building',
        'Ituze Sample Apartment',
    ];

    private const IMAGE_IDS_BY_UNIT_TYPE = [
        'Office' => ['photo-1497366216548-37526070297c', 'photo-1497366811353-6870744d04b2'],
        'Apartment' => ['photo-1600607687939-ce8a6c25118c', 'photo-1600607687920-4e2a09cf159d'],
        'Coffee Shop' => ['photo-1497366754035-f200968a6e72', 'photo-1497366216548-37526070297c'],
        'Commercial Space' => ['photo-1497366811353-6870744d04b2', 'photo-1486406146926-c627a92ad1ab'],
        'Warehouse' => ['photo-1486406146926-c627a92ad1ab', 'photo-1497366216548-37526070297c'],
    ];

    public function run(): void
    {
        $seededCount = 0;

        Unit::query()
            ->whereHas('property', fn ($query) => $query->whereIn('name', self::SAMPLE_PROPERTY_NAMES))
            ->with('unitType')
            ->each(function (Unit $unit) use (&$seededCount): void {
                $imageIds = self::IMAGE_IDS_BY_UNIT_TYPE[$unit->unitType?->name] ?? [];

                if ($unit->images()->exists() || $imageIds === []) {
                    return;
                }

                $imageId = $imageIds[($unit->id - 1) % count($imageIds)];
                $unit->images()->create([
                    'image_path' => "https://images.unsplash.com/{$imageId}?auto=format&fit=crop&w=1200&q=85",
                    'is_cover' => true,
                ]);

                $seededCount++;
            });

        $this->command?->info("Added sample images to {$seededCount} existing demo units.");
    }
}
