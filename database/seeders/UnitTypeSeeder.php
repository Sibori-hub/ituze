<?php

namespace Database\Seeders;

use App\Models\UnitType;
use Illuminate\Database\Seeder;

class UnitTypeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $unitTypes = [
            ['name' => 'Studio'],
            ['name' => 'Apartment'],
            ['name' => 'Commercial Space'],
            ['name' => 'Coffee Shop'],
            ['name' => 'Office'],
            ['name' => 'Shop'],
            ['name' => 'Commercial Building'],
            ['name' => 'Warehouse'],
        ];

        foreach ($unitTypes as $type) {
            UnitType::firstOrCreate(['name' => $type['name']]);
        }
    }
}