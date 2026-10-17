<?php

namespace Database\Seeders;

use App\Models\Cell;
use App\Models\Property;
use App\Models\PropertyImage;
use App\Models\PropertyType;
use App\Models\Unit;
use App\Models\UnitType;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

class DemoMarketplaceSeeder extends Seeder
{
    public function run(): void
    {
        $buildings = [
            [
                'owner_email' => 'sebakire@gmail.com',
                'owner_role' => 'owner',
                'name' => 'Source Oil Building',
                'address' => 'KG 14 Ave, Gisozi, Gasabo, Kigali, Rwanda',
                'district' => 'Gasabo',
                'sector' => 'Gisozi',
                'cell' => 'Musezero',
                'property_type' => 'Commercial',
                'floors' => 3,
                'rent_multiplier' => 1.15,
                'images' => [
                    'photo-1486406146926-c627a92ad1ab',
                    'photo-1497366216548-37526070297c',
                    'photo-1497366811353-6870744d04b2',
                ],
                'description' => 'Sample listing for testing only. Source Oil Building is shown as a three-floor mixed-use property in Gisozi. Unit availability, measurements, and rents are demonstration data and must be confirmed with the owner.',
            ],
            [
                'owner_email' => 'uwagrace@gmail.com',
                'owner_role' => 'owner',
                'name' => 'Makuza Peace Plaza',
                'address' => 'KN 4 Ave, Kiyovu, Nyarugenge, Kigali, Rwanda',
                'district' => 'Nyarugenge',
                'sector' => 'Nyarugenge',
                'cell' => 'Kiyovu',
                'property_type' => 'Commercial',
                'floors' => 5,
                'rent_multiplier' => 1.25,
                'images' => [
                    'photo-1497366754035-f200968a6e72',
                    'photo-1486406146926-c627a92ad1ab',
                    'photo-1497366811353-6870744d04b2',
                ],
                'description' => 'Sample listing for testing only. This Makuza Peace Plaza demonstration record includes mixed commercial unit categories. Unit availability, measurements, and rents are sample values and must be confirmed with the owner.',
            ],
            [
                'owner_email' => 'olivier1@gmail.com',
                'owner_role' => 'owner',
                'name' => 'Kigali Heights Building',
                'address' => 'KG 7 Ave, Kimihurura, Gasabo, Kigali, Rwanda',
                'district' => 'Gasabo',
                'sector' => 'Kimihurura',
                'cell' => 'Kimihurura',
                'property_type' => 'Commercial',
                'floors' => 5,
                'rent_multiplier' => 1.4,
                'images' => [
                    'photo-1486406146926-c627a92ad1ab',
                    'photo-1497366216548-37526070297c',
                    'photo-1497366754035-f200968a6e72',
                ],
                'description' => 'Sample listing for testing only. This Kigali Heights demonstration record includes a mix of rentable unit categories. Unit availability, measurements, and rents are sample values and must be confirmed with the owner.',
            ],
            [
                'owner_email' => 'admin@ituzeqraltd.com',
                'owner_role' => 'admin',
                'name' => 'Ituze Sample Apartment',
                'address' => 'Kicukiro, Kigali, Rwanda',
                'district' => 'Kicukiro',
                'sector' => 'Kicukiro',
                'cell' => 'Kicukiro',
                'property_type' => 'Apartment',
                'floors' => 4,
                'rent_multiplier' => 0.9,
                'images' => [
                    'photo-1600607687939-ce8a6c25118c',
                    'photo-1600607687920-4e2a09cf159d',
                    'photo-1600210492486-724fe5c67fb0',
                ],
                'description' => 'Sample apartment property for testing the marketplace. All unit categories, availability, measurements, and rents shown here are demonstration data, not a verified offer.',
            ],
        ];

        $unitDefinitions = [
            'Office' => [
                ['size' => 28, 'rent' => 420000, 'description' => 'Compact private office with natural light and shared building access.'],
                ['size' => 42, 'rent' => 560000, 'description' => 'Flexible office suite suitable for a small professional team.'],
                ['size' => 58, 'rent' => 720000, 'description' => 'Open-plan office area with room for desks and a reception corner.'],
                ['size' => 76, 'rent' => 900000, 'description' => 'Large office suite with adaptable workspace for a growing business.'],
            ],
            'Apartment' => [
                ['size' => 36, 'rent' => 280000, 'description' => 'Studio-style residential unit with a practical open living area.'],
                ['size' => 54, 'rent' => 390000, 'description' => 'One-bedroom sample apartment with a separate living space.'],
                ['size' => 78, 'rent' => 560000, 'description' => 'Two-bedroom sample apartment with a comfortable living area.'],
                ['size' => 96, 'rent' => 720000, 'description' => 'Spacious family apartment with flexible room layout.'],
            ],
            'Coffee Shop' => [
                ['size' => 32, 'rent' => 360000, 'description' => 'Customer-facing space suitable for a small coffee counter.'],
                ['size' => 48, 'rent' => 490000, 'description' => 'Cafe-ready sample unit with seating and service-counter space.'],
                ['size' => 66, 'rent' => 650000, 'description' => 'Coffee shop unit with room for seating and a preparation area.'],
                ['size' => 84, 'rent' => 820000, 'description' => 'Larger cafe-style space for seating, service, and storage.'],
            ],
            'Commercial Space' => [
                ['size' => 24, 'rent' => 300000, 'description' => 'Small commercial unit suitable for a service counter or showroom.'],
                ['size' => 40, 'rent' => 450000, 'description' => 'Flexible commercial space for customer-facing business use.'],
                ['size' => 62, 'rent' => 680000, 'description' => 'Adaptable shop or service unit with an open floor plan.'],
                ['size' => 88, 'rent' => 960000, 'description' => 'Large commercial unit suitable for a showroom or retail business.'],
            ],
            'Warehouse' => [
                ['size' => 110, 'rent' => 680000, 'description' => 'Sample storage unit with an open floor area.'],
                ['size' => 160, 'rent' => 920000, 'description' => 'Medium warehouse unit for stock storage or distribution.'],
                ['size' => 220, 'rent' => 1250000, 'description' => 'Large storage space with an adaptable open layout.'],
                ['size' => 300, 'rent' => 1650000, 'description' => 'Extra-large warehouse sample unit for storage or logistics use.'],
            ],
        ];

        DB::transaction(function () use ($buildings, $unitDefinitions): void {
            $this->ensureOwnerAccounts($buildings);

            $users = User::query()
                ->whereIn('email', array_column($buildings, 'owner_email'))
                ->get()
                ->keyBy('email');
            $unitTypes = UnitType::query()
                ->whereIn('name', array_keys($unitDefinitions))
                ->get()
                ->keyBy('name');
            $propertyTypes = PropertyType::query()
                ->whereIn('name', ['Commercial', 'Apartment'])
                ->get()
                ->keyBy('name');

            foreach ($buildings as $building) {
                $owner = $users->get($building['owner_email']);
                if (!$owner || $owner->role !== $building['owner_role']) {
                    throw new RuntimeException("Required {$building['owner_role']} account {$building['owner_email']} is missing or has the wrong role.");
                }

                if (!$propertyTypes->has($building['property_type'])) {
                    throw new RuntimeException("Required property type {$building['property_type']} is missing; run PropertyTypeSeeder first.");
                }

                $sector = \App\Models\Sector::query()
                    ->where('name', $building['sector'])
                    ->whereHas('district', fn ($query) => $query
                        ->where('name', $building['district'])
                        ->whereHas('province', fn ($province) => $province->where('name', 'Kigali City')))
                    ->first();

                $cell = $sector
                    ? Cell::query()
                        ->where('sector_id', $sector->id)
                        ->where('name', $building['cell'])
                        ->first()
                    : null;

                if (!$cell) {
                    throw new RuntimeException("The sample location {$building['cell']}, {$building['sector']}, {$building['district']} is missing from the location tables.");
                }

                foreach (array_keys($unitDefinitions) as $unitTypeName) {
                    if (!$unitTypes->has($unitTypeName)) {
                        throw new RuntimeException("Required unit type {$unitTypeName} is missing; run UnitTypeSeeder first.");
                    }
                }

                $property = Property::query()->updateOrCreate(
                    ['name' => $building['name']],
                    [
                        'owner_id' => $owner->id,
                        'cell_id' => $cell->id,
                        'property_type_id' => $propertyTypes->get($building['property_type'])->id,
                        'name' => $building['name'],
                        'address' => $building['address'],
                        'description' => $building['description'],
                        'status' => 'active',
                        'total_units' => 20,
                        'total_floors' => $building['floors'],
                        'amenities' => ['Sample listing', 'Road access', 'Secure building access'],
                        'proximity' => ['Public transport', 'Shops and services'],
                    ],
                );

                $categoryIndex = [];
                $unitNumber = 0;
                foreach ($unitDefinitions as $unitTypeName => $units) {
                    foreach ($units as $definition) {
                        $unitNumber++;
                        $categoryIndex[$unitTypeName] = ($categoryIndex[$unitTypeName] ?? 0) + 1;
                        $rent = (int) (round(($definition['rent'] * $building['rent_multiplier']) / 10000) * 10000);
                        $floor = min($building['floors'], (int) ceil($unitNumber * $building['floors'] / 20));
                        $unitLabel = sprintf('F%d-%02d', $floor, $unitNumber);

                        Unit::query()->updateOrCreate(
                            ['property_id' => $property->id, 'unit_number' => $unitLabel],
                            [
                                'unit_type_id' => $unitTypes->get($unitTypeName)->id,
                                'floor_number' => $floor,
                                'rent_amount' => $rent,
                                'rent_frequency' => 'monthly',
                                'size_sqm' => $definition['size'],
                                'description' => 'SAMPLE DATA — '.$definition['description'],
                                'status' => 'available',
                            ],
                        );
                    }
                }

                if ($unitNumber !== 20 || count($categoryIndex) !== 5 || min($categoryIndex) !== 4 || max($categoryIndex) !== 4) {
                    throw new RuntimeException("The sample units for {$building['name']} did not match the required category mix.");
                }

                foreach ($building['images'] as $imageIndex => $imageId) {
                    $imageUrl = "https://images.unsplash.com/{$imageId}?auto=format&fit=crop&w=1400&q=85";
                    PropertyImage::query()->updateOrCreate(
                        ['property_id' => $property->id, 'image_path' => $imageUrl],
                        ['is_cover' => $imageIndex === 0],
                    );
                }
            }
        });

        $this->command?->info('Created or updated 4 sample buildings with 20 searchable units each (4 per category).');
    }

    /**
     * The sample buildings reference fixed owner/admin accounts.
     * Create the ones that are missing so a clean database can be seeded.
     *
     * @param  array<int, array<string, mixed>>  $buildings
     */
    protected function ensureOwnerAccounts(array $buildings): void
    {
        $profiles = [
            'sebakire@gmail.com' => ['Se Bakire', '0780000001'],
            'uwagrace@gmail.com' => ['Uwase Grace', '0780000002'],
            'olivier1@gmail.com' => ['Olivier Demo', '0780000003'],
        ];

        foreach (array_unique(array_column($buildings, 'owner_email')) as $email) {
            if (User::query()->where('email', $email)->exists()) {
                continue;
            }

            [$name, $phone] = $profiles[$email] ?? [Str::headline(Str::before($email, '@')), null];

            User::query()->create([
                'first_name' => Str::before($name, ' '),
                'last_name' => Str::after($name, ' '),
                'name' => $name,
                'email' => $email,
                'phone' => $phone,
                'role' => 'owner',
                'status' => 'approved',
                'expires_at' => now()->addYear(),
                'profile_completed' => true,
                'email_verified_at' => now(),
                'password' => Hash::make('Owner@2026'),
            ]);
        }
    }
}
