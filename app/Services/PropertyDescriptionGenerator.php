<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PropertyDescriptionGenerator
{
    private const BASIC_AMENITY_KEYS = ['parking', 'security', 'generator', 'water_tank', 'elevator', 'cleaning_service'];

    private const AMENITY_LABELS = [
        'wifi' => 'WiFi',
        'parking' => 'Parking',
        'gym' => 'Gym',
        'swimming_pool' => 'Swimming Pool',
        'restaurant' => 'Restaurant',
        'bar' => 'Bar',
        'security' => '24/7 Security',
        'generator' => 'Backup Generator',
        'water_tank' => 'Reserve Water Tank',
        'elevator' => 'Elevator / Lift',
        'cleaning_service' => 'Cleaning Services',
    ];

    private const PROXIMITY_LABELS = [
        'near_tarmac' => 'a paved tarmac road',
        'near_school' => 'top schools',
        'near_hospital' => 'major hospitals',
        'near_market' => 'vibrant markets',
        'near_public_transport' => 'public transport hubs',
    ];

    private function filterAmenitiesByType(array $amenityKeys, ?string $typeName): array
    {
        $isApartment = $typeName === 'Apartment';
        if ($isApartment) return $amenityKeys;
        return array_values(array_intersect($amenityKeys, self::BASIC_AMENITY_KEYS));
    }

    private function labelAmenities(array $amenityKeys): array
    {
        $out = [];
        foreach ($amenityKeys as $k) {
            $out[] = self::AMENITY_LABELS[$k] ?? ucwords(str_replace('_', ' ', $k));
        }
        return $out;
    }

    private function labelProximity(array $proxKeys): array
    {
        $out = [];
        foreach ($proxKeys as $k) {
            $out[] = self::PROXIMITY_LABELS[$k] ?? ucwords(str_replace('_', ' ', $k));
        }
        return $out;
    }
    public function generate(array $inputs): array
    {
        try {
            $apiKey = config('services.openai.api_key');
            $model = config('services.openai.model', 'gpt-4o-mini');

            if (empty($apiKey)) {
                Log::warning('AI description generation skipped: OpenAI API key not configured.');
                return $this->generateTemplate($inputs);
            }

            $systemPrompt = 'You are an expert SEO real estate copywriter for properties in Kigali, Rwanda. Rules: (1) Keep descriptions tight — 130 to 200 words max. (2) Match the tone strictly to the property type: Apartment = warm, residential, appealing to renters/families; Office = professional, business-focused, appealing to SMEs/startups and corporate tenants; Warehouse = logistics, secure loading, capacity-focused; Commercial = high foot traffic, retail/brand visibility. (3) Never use residential words ("home", "residents", "living", "family") for Office, Warehouse, or Commercial. (4) Do NOT invent missing details. (5) Structure: 1-sentence hook → 1 short structure/location sentence → 1 short amenities/nearby sentence → 1 soft CTA. Use short paragraphs, no bold headings.';

            $userPrompt = $this->buildUserPrompt($inputs);

            $response = Http::timeout(15)
                ->withToken($apiKey)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $model,
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => $userPrompt],
                    ],
                    'temperature' => 0.7,
                ]);

            if (!$response->successful()) {
                Log::warning('AI description generation failed: OpenAI returned status ' . $response->status());
                return $this->generateTemplate($inputs);
            }

            $data = $response->json();
            $content = $data['choices'][0]['message']['content'] ?? null;

            if (empty($content)) {
                Log::warning('AI description generation failed: Empty content in response.');
                return $this->generateTemplate($inputs);
            }

            return [
                'description' => trim($content),
                'source' => 'llm',
            ];
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::warning('AI description generation failed: Connection timeout - ' . $e->getMessage());
            return $this->generateTemplate($inputs);
        } catch (\Exception $e) {
            Log::warning('AI description generation failed: ' . $e->getMessage());
            return $this->generateTemplate($inputs);
        }
    }

    private function buildUserPrompt(array $inputs): string
    {
        $lines = [];

        if (!empty($inputs['name'])) {
            $lines[] = "Property Name: {$inputs['name']}";
        }
        if (!empty($inputs['property_type_name'])) {
            $lines[] = "Property Type: {$inputs['property_type_name']}";
        }
        if (!empty($inputs['address'])) {
            $lines[] = "Address: {$inputs['address']}";
        }

        $locationParts = array_filter([
            $inputs['location_parts']['province'] ?? null,
            $inputs['location_parts']['district'] ?? null,
            $inputs['location_parts']['sector'] ?? null,
            $inputs['location_parts']['cell'] ?? null,
        ]);
        if (!empty($locationParts)) {
            $lines[] = 'Location (Province > District > Sector > Cell): ' . implode(' > ', $locationParts);
        }

        if (isset($inputs['total_units']) && $inputs['total_units'] !== '') {
            $lines[] = 'Total Units: ' . $inputs['total_units'];
        }
        if (isset($inputs['total_floors']) && $inputs['total_floors'] !== '') {
            $lines[] = 'Total Floors (including ground floor): ' . $inputs['total_floors'];
        }
        if (isset($inputs['basement_floors'])) {
            $lines[] = 'Basements: ' . ((int) $inputs['basement_floors'] > 0 ? $inputs['basement_floors'] : 'none');
        }
        if (!empty($inputs['unit_size_range'])) {
            $lines[] = "Unit Size Range: {$inputs['unit_size_range']}";
        }

        $rawAmenities = $inputs['amenities'] ?? [];
        $filteredAmenities = $this->filterAmenitiesByType($rawAmenities, $inputs['property_type_name'] ?? null);
        $labeledAmenities = $this->labelAmenities($filteredAmenities);
        if (!empty($labeledAmenities)) {
            $lines[] = 'Amenities: ' . implode(', ', $labeledAmenities);
        }

        $rawProximity = $inputs['proximity'] ?? [];
        $labeledProximity = $this->labelProximity($rawProximity);
        if (!empty($labeledProximity)) {
            $lines[] = 'Close to (nearby landmarks/places): ' . implode(', ', $labeledProximity);
        }

        $prompt = "Please write a compelling 250-400 word property description for this listing in Kigali, Rwanda.\n\n";
        $prompt .= "Property details:\n" . implode("\n", $lines);
        $prompt .= "\n\nFocus on Kigali's unique appeal—cleanliness, safety, growing infrastructure—and make it feel like a desirable place to live or invest.";

        return $prompt;
    }

    public function generateTemplate(array $inputs): array
    {
        $name = trim($inputs['name'] ?? '') ?: 'This property';
        $typeRaw = $inputs['property_type_name'] ?? null;
        $type = $typeRaw ?: 'property';
        $address = trim($inputs['address'] ?? '') ?: null;

        $locationParts = array_values(array_filter([
            $inputs['location_parts']['sector'] ?? null,
            $inputs['location_parts']['district'] ?? null,
        ]));
        $locationLine = !empty($locationParts) ? implode(', ', $locationParts) : 'Kigali';
        $fullLocationPath = $address ? "{$locationLine} — {$address}" : $locationLine;

        $totalUnits = $inputs['total_units'] ?? null;
        $totalFloors = $inputs['total_floors'] ?? null;
        $unitSizeRange = $inputs['unit_size_range'] ?? null;

        $filteredAmenities = $this->filterAmenitiesByType($inputs['amenities'] ?? [], $typeRaw);
        $amenities = $this->labelAmenities($filteredAmenities);
        $proximity = $this->labelProximity($inputs['proximity'] ?? []);

        $structure = [];
        if ($totalUnits !== null && $totalUnits !== '') {
            $uw = (int)$totalUnits === 1 ? 'unit' : 'units';
            $structure[] = "{$totalUnits} {$uw}";
        }
        if ($totalFloors !== null && $totalFloors !== '') {
            $fw = (int)$totalFloors === 1 ? 'floor' : 'floors';
            $structure[] = "{$totalFloors} {$fw} (incl. ground)";
        }
        $basements = (int) ($inputs['basement_floors'] ?? 0);
        if ($basements > 0) {
            $structure[] = $basements === 1 ? '1 basement' : "{$basements} basements";
        }
        if ($unitSizeRange) {
            $structure[] = "sizes from {$unitSizeRange}";
        }
        $structureLine = !empty($structure) ? implode(' · ', $structure) : null;

        $amenList = !empty($amenities) ? implode(', ', $amenities) : null;
        $proxList = !empty($proximity) ? implode(', ', $proximity) : null;

        switch ($typeRaw) {
            case 'Office':
                $hook = "Presenting {$name} — a prime Office space in {$fullLocationPath}, designed for modern businesses and professional teams.";
                $who = 'SMEs, startups, and corporate teams';
                $benefit = 'benefit from Kigali’s business-friendly infrastructure and convenient connectivity across the city';
                $cta = 'Ideal for regional HQs, satellite offices, or co-working-style tenancies. Schedule a walkthrough today and find your team’s new address.';
                break;
            case 'Warehouse':
                $hook = "Introducing {$name} — a practical Warehouse in {$fullLocationPath}, built for reliable logistics and secure storage.";
                $who = 'Distributors, importers, and last-mile operators';
                $benefit = 'benefit from secure access and easy proximity to major routes across Kigali';
                $cta = 'Suitable for bulk storage, light assembly, or distribution hubs. Enquire today to secure the space your supply chain needs.';
                break;
            case 'Commercial':
                $hook = "Showcase your brand at {$name} — a Commercial property positioned in {$fullLocationPath}, Kigali.";
                $who = 'Retailers, showrooms, and service-based businesses';
                $benefit = 'benefit from strong visibility, footfall, and proximity to the city’s growing consumer areas';
                $cta = 'Perfect for shops, banks, showrooms, or service outlets. Book an inspection and position your brand for growth.';
                break;
            case 'Apartment':
            default:
                $hook = "Welcome to {$name} — a welcoming {$type} located in {$fullLocationPath}, Kigali.";
                $who = 'Young professionals, couples, and families';
                $benefit = 'enjoy Kigali’s clean, safe streets and growing amenities right on their doorstep';
                $cta = 'Whether you’re renting long-term or investing, this is Kigali living at its best. Schedule a viewing today.';
                break;
        }

        $lines = [];
        $lines[] = $hook;

        if ($structureLine) {
            $lines[] = "Offering {$structureLine} — well-proportioned spaces with natural light and room to grow.";
        } else {
            $lines[] = "Well-proportioned spaces with natural light and room to grow.";
        }

        $featParts = [];
        if ($amenList) $featParts[] = "amenities include {$amenList}";
        if ($proxList) $featParts[] = "close to {$proxList}";
        if (!empty($featParts)) {
            $lines[] = "Key " . implode(', and ', $featParts) . " — {$who} {$benefit}.";
        } else {
            $lines[] = "{$who} {$benefit}.";
        }

        $lines[] = $cta;

        $description = implode("\n\n", $lines);

        return [
            'description' => $description,
            'source' => 'template',
        ];
    }
    /**
     * A short description of one rentable room.
     *
     * @param  array{property: string, category: string, floor: string, room_number: string, size_sqm: ?float,
     *               rent_amount: ?float, rent_frequency: string, bedrooms: ?int, bathrooms: ?float,
     *               location: array<int, string>, amenities: array<int, string>, proximity: array<int, string>}  $room
     * @return array{description: string, source: string}
     */
    public function generateRoom(array $room): array
    {
        $apiKey = config('services.openai.api_key');
        if (empty($apiKey)) {
            return $this->roomTemplate($room);
        }

        try {
            $facts = array_filter([
                'Building: '.$room['property'],
                'Category: '.$room['category'],
                'Floor: '.$room['floor'],
                'Room number: '.$room['room_number'],
                $room['size_sqm'] ? 'Size: '.$this->number($room['size_sqm']).' m²' : null,
                $room['bedrooms'] !== null ? 'Bedrooms: '.$room['bedrooms'] : null,
                $room['bathrooms'] !== null ? 'Bathrooms: '.$this->number($room['bathrooms']) : null,
                $room['rent_amount'] ? 'Rent: '.number_format($room['rent_amount']).' RWF per '.($room['rent_frequency'] === 'daily' ? 'day' : 'month') : null,
                $room['location'] ? 'Location: '.implode(', ', $room['location']).', Rwanda' : null,
                $room['amenities'] ? 'Building amenities: '.implode(', ', $this->labelAmenities($room['amenities'])) : null,
                $room['proximity'] ? 'Nearby: '.implode(', ', $this->labelProximity($room['proximity'])) : null,
            ]);

            $response = Http::timeout(15)
                ->withToken($apiKey)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => config('services.openai.model', 'gpt-4o-mini'),
                    'messages' => [
                        ['role' => 'system', 'content' => 'You write short rental listings for rooms in buildings in Rwanda. Write 60 to 110 words in plain English, two short paragraphs, no headings, no emojis. Match the tone to the category (office = professional, shop or commercial = visibility and customers, apartment = comfortable home, storage or warehouse = secure and practical). Use only the facts given; never invent features. Prices are in RWF.'],
                        ['role' => 'user', 'content' => "Write the listing for this room:\n".implode("\n", $facts)],
                    ],
                    'temperature' => 0.6,
                ]);

            $content = trim((string) ($response->successful() ? $response->json('choices.0.message.content') : ''));

            return $content !== '' ? ['description' => $content, 'source' => 'llm'] : $this->roomTemplate($room);
        } catch (\Throwable $e) {
            Log::warning('Room description generation failed: '.$e->getMessage());

            return $this->roomTemplate($room);
        }
    }

    /**
     * @return array{description: string, source: string}
     */
    private function roomTemplate(array $room): array
    {
        $category = trim($room['category']) ?: 'space';
        $lower = mb_strtolower($category);
        // Location names are stored in capitals for some districts (KICUKIRO).
        $places = array_map(fn ($place) => mb_convert_case(mb_strtolower($place), MB_CASE_TITLE), array_slice($room['location'], 0, 2));
        $where = $places ? ' in '.implode(', ', $places) : '';
        $size = $room['size_sqm'] ? $this->number($room['size_sqm']).' m² ' : '';

        // "on the ground floor", "on floor 2", "in basement 1".
        $floor = mb_strtolower($room['floor']);
        $floorPhrase = match (true) {
            str_starts_with($floor, 'ground') => 'on the ground floor',
            str_starts_with($floor, 'basement') => 'in '.$floor,
            default => 'on '.$floor,
        };
        $opening = "Room {$room['room_number']} is a {$size}{$category} space {$floorPhrase} of {$room['property']}{$where}.";

        $use = match (true) {
            str_contains($lower, 'apart') => 'It is a comfortable place to live'
                .($room['bedrooms'] !== null ? ', with '.$room['bedrooms'].' '.($room['bedrooms'] == 1 ? 'bedroom' : 'bedrooms') : '')
                .($room['bathrooms'] !== null ? ' and '.$this->number($room['bathrooms']).' '.($room['bathrooms'] == 1 ? 'bathroom' : 'bathrooms') : '')
                .'.',
            str_contains($lower, 'office') || str_contains($lower, 'bureau') => 'It suits a business, a small team or a professional practice looking for a well-located workplace.',
            str_contains($lower, 'ware') || str_contains($lower, 'stor') || str_contains($lower, 'depot') => 'It is a practical, secure space for storing stock and equipment.',
            str_contains($lower, 'restaurant') || str_contains($lower, 'coffee') || str_contains($lower, 'cafe') || str_contains($lower, 'café') => 'It is a good place to welcome customers for food and drinks.',
            default => 'It is a good place for a shop or service that wants to be seen by customers.',
        };

        $extras = [];
        if ($room['amenities']) {
            $extras[] = 'The building offers '.$this->listing($this->labelAmenities($room['amenities']));
        }
        if ($room['proximity']) {
            $extras[] = ($room['amenities'] ? 'and is close to ' : 'The building is close to ').$this->listing($this->labelProximity($room['proximity']));
        }
        $building = $extras ? implode(' ', $extras).'.' : '';

        $rent = $room['rent_amount']
            ? 'Rent is '.number_format($room['rent_amount']).' RWF per '.($room['rent_frequency'] === 'daily' ? 'day' : 'month').'.'
            : '';

        $paragraphs = array_filter([
            trim($opening.' '.$use),
            trim($building.' '.$rent.' Contact us to arrange a visit.'),
        ]);

        return ['description' => implode("\n\n", $paragraphs), 'source' => 'template'];
    }

    /**
     * A short description of a unit: one category on one floor of a building.
     *
     * @param  array{property: string, category: string, floor: string, location: array<int, string>,
     *               amenities: array<int, string>, proximity: array<int, string>}  $unit
     * @return array{description: string, source: string}
     */
    public function generateUnit(array $unit): array
    {
        $apiKey = config('services.openai.api_key');
        if (empty($apiKey)) {
            return $this->unitTemplate($unit);
        }

        try {
            $facts = array_filter([
                'Building: '.$unit['property'],
                'Category: '.$unit['category'],
                'Floor: '.$unit['floor'],
                $unit['location'] ? 'Location: '.implode(', ', $unit['location']).', Rwanda' : null,
                $unit['amenities'] ? 'Building amenities: '.implode(', ', $this->labelAmenities($unit['amenities'])) : null,
                $unit['proximity'] ? 'Nearby: '.implode(', ', $this->labelProximity($unit['proximity'])) : null,
            ]);

            $response = Http::timeout(15)
                ->withToken($apiKey)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => config('services.openai.model', 'gpt-4o-mini'),
                    'messages' => [
                        ['role' => 'system', 'content' => 'You describe one floor area of a building in Rwanda that holds several rentable rooms of the same kind. Write 40 to 80 words in plain English, one or two short paragraphs, no headings, no emojis, no prices. Match the tone to the category (office = professional, shop or commercial = visibility and customers, apartment = comfortable homes, storage or warehouse = secure and practical). Use only the facts given; never invent features.'],
                        ['role' => 'user', 'content' => "Describe this unit:\n".implode("\n", $facts)],
                    ],
                    'temperature' => 0.6,
                ]);

            $content = trim((string) ($response->successful() ? $response->json('choices.0.message.content') : ''));

            return $content !== '' ? ['description' => $content, 'source' => 'llm'] : $this->unitTemplate($unit);
        } catch (\Throwable $e) {
            Log::warning('Unit description generation failed: '.$e->getMessage());

            return $this->unitTemplate($unit);
        }
    }

    /**
     * @return array{description: string, source: string}
     */
    private function unitTemplate(array $unit): array
    {
        $category = trim($unit['category']) ?: 'Rooms';
        $lower = mb_strtolower($category);
        $places = array_map(fn ($place) => mb_convert_case(mb_strtolower($place), MB_CASE_TITLE), array_slice($unit['location'], 0, 2));
        $where = $places ? ' in '.implode(', ', $places) : '';
        $floor = mb_strtolower($unit['floor']);
        $floorPhrase = match (true) {
            str_starts_with($floor, 'ground') => 'on the ground floor',
            str_starts_with($floor, 'basement') => 'in '.$floor,
            default => 'on '.$floor,
        };

        $use = match (true) {
            str_contains($lower, 'apart') => 'Its apartments are comfortable places to live.',
            str_contains($lower, 'office') || str_contains($lower, 'bureau') => 'Its rooms suit businesses, small teams and professional practices looking for a well-located workplace.',
            str_contains($lower, 'ware') || str_contains($lower, 'stor') || str_contains($lower, 'depot') => 'Its rooms are practical, secure spaces for storing stock and equipment.',
            str_contains($lower, 'restaurant') || str_contains($lower, 'coffee') || str_contains($lower, 'cafe') || str_contains($lower, 'café') => 'Its rooms are good places to welcome customers for food and drinks.',
            default => 'Its rooms are good places for shops and services that want to be seen by customers.',
        };

        $extras = [];
        if ($unit['amenities']) {
            $extras[] = 'The building offers '.$this->listing($this->labelAmenities($unit['amenities']));
        }
        if ($unit['proximity']) {
            $extras[] = ($unit['amenities'] ? 'and is close to ' : 'The building is close to ').$this->listing($this->labelProximity($unit['proximity']));
        }

        $paragraphs = array_filter([
            "{$category} {$floorPhrase} of {$unit['property']}{$where}. {$use}",
            $extras ? implode(' ', $extras).'.' : null,
        ]);

        return ['description' => implode("\n\n", $paragraphs), 'source' => 'template'];
    }

    private function listing(array $items): string
    {
        $items = array_values($items);
        if (count($items) <= 1) {
            return $items[0] ?? '';
        }

        return implode(', ', array_slice($items, 0, -1)).' and '.end($items);
    }

    private function number(float|int|string $value): string
    {
        return rtrim(rtrim(number_format((float) $value, 2, '.', ','), '0'), '.');
    }
}
