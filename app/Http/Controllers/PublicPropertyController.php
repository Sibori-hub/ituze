<?php

namespace App\Http\Controllers;

use App\Models\Property;
use App\Models\PropertyInquiry;
use App\Models\Unit;
use App\Models\User;
use App\Notifications\NewPropertyInquiry;
use App\Support\Seo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Inertia\Inertia;
use Inertia\Response;

class PublicPropertyController extends Controller
{
    public function show(Property $property): Response
    {
        $property->load([
            'images',
            'owner:id,name,first_name,last_name,phone',
            'cell.sector.district.province',
            'units' => fn ($query) => $query->publiclyListed()->with(['unitType', 'images']),
        ]);

        abort_if($property->units->isEmpty(), 404);

        return Inertia::render('Public/Property', [
            'property' => $property,
        ])->withViewData(['meta' => Seo::property($property)]);
    }

    public function showUnit(Property $property, Unit $unit): Response
    {
        abort_unless($unit->property_id === $property->id && Unit::query()->publiclyListed()->whereKey($unit->id)->exists(), 404);

        $property->load([
            'images',
            'owner:id,name,first_name,last_name,phone',
            'cell.sector.district.province',
            'units' => fn ($query) => $query->publiclyListed()->with(['unitType', 'images']),
        ]);
        $unit->load(['unitType', 'images']);

        return Inertia::render('Public/Property', [
            'property' => $property,
            'selectedUnit' => $unit,
            'isUnitDetail' => true,
        ])->withViewData(['meta' => Seo::property($property, $unit)]);
    }

    public function inquire(Request $request, Property $property): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'unit_id' => ['nullable', 'integer', 'exists:units,id'],
            'visitor_name' => ['required', 'string', 'max:120'],
            'visitor_email' => ['required', 'email', 'max:255'],
            'visitor_phone' => ['required', 'string', 'regex:/^\+?[0-9\s().-]{7,40}$/'],
            'message' => ['required', 'string', 'max:2000'],
            // The business the visitor will run there (office, salon, shop...).
            'business_use' => ['nullable', 'string', 'max:120'],
        ]);
        $validated['visitor_email'] = strtolower(trim($validated['visitor_email']));
        $phoneDigits = preg_replace('/\D+/', '', $validated['visitor_phone']) ?? '';
        $phoneDigits = str_starts_with($phoneDigits, '00') ? substr($phoneDigits, 2) : $phoneDigits;
        if (strlen($phoneDigits) === 9) {
            $phoneDigits = '250'.$phoneDigits;
        } elseif (str_starts_with($phoneDigits, '0') && strlen($phoneDigits) === 10) {
            $phoneDigits = '250'.substr($phoneDigits, 1);
        }
        if (strlen($phoneDigits) < 7 || strlen($phoneDigits) > 15) {
            return $this->inquiryError($request, 'visitor_phone', 'Enter a valid phone number.');
        }
        $validated['visitor_phone'] = '+'.$phoneDigits;

        $unit = $property->units()
            ->publiclyListed()
            ->when($validated['unit_id'] ?? null, fn ($query, $unitId) => $query->whereKey($unitId))
            ->with('unitType')
            ->first();

        if (! $unit) {
            return $this->inquiryError($request, 'unit_id', 'That available space is no longer listed. Please refresh and try again.');
        }

        $phoneVariants = [$phoneDigits];
        if (str_starts_with($phoneDigits, '250') && strlen($phoneDigits) === 12) {
            $phoneVariants[] = '0'.substr($phoneDigits, 3);
        }
        if (str_starts_with($phoneDigits, '0') && strlen($phoneDigits) === 10) {
            $phoneVariants[] = '250'.substr($phoneDigits, 1);
        }

        $created = DB::transaction(function () use ($property, $unit, $validated, $phoneDigits, $phoneVariants): ?PropertyInquiry {
            Property::query()->whereKey($property->id)->lockForUpdate()->firstOrFail();

            $hasUnresolvedInquiry = PropertyInquiry::query()
                ->where('property_id', $property->id)
                ->where('status', '!=', 'read')
                ->where(function ($query) use ($validated, $phoneDigits, $phoneVariants) {
                    $query
                        ->whereRaw('LOWER(visitor_email) = ?', [$validated['visitor_email']])
                        ->orWhereIn('visitor_phone', array_map(fn ($phone) => '+'.$phone, $phoneVariants))
                        ->orWhereIn('visitor_phone', $phoneVariants)
                        ->orWhereRaw(
                            "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(visitor_phone, '+', ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') = ?",
                            [$phoneDigits],
                        );
                })
                ->exists();

            if ($hasUnresolvedInquiry) {
                return null;
            }

            return PropertyInquiry::create([
                ...$validated,
                'unit_id' => $unit->id,
                'property_id' => $property->id,
                'owner_id' => $property->owner_id,
                'status' => 'new',
            ]);
        });

        if (! $created) {
            return $this->inquiryError(
                $request,
                'inquiry',
                'We already have your inquiry for this property. The owner will review it shortly. You can send another inquiry after the owner marks this one as read.',
            );
        }

        // Tell the owner and every admin straight away, by email and SMS.
        $recipients = User::query()
            ->where(fn ($query) => $query->where('role', 'admin')->orWhere('id', $created->owner_id))
            ->get();
        Notification::send($recipients, new NewPropertyInquiry($created));

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Your inquiry was received and sent to the property owner.',
                'inquiry' => ['id' => $created->id],
            ], 201);
        }

        return back()->with('success', 'Your inquiry was received and sent to the property owner.');
    }

    private function inquiryError(Request $request, string $field, string $message): JsonResponse|RedirectResponse
    {
        if ($request->expectsJson()) {
            return response()->json([
                'message' => $message,
                'errors' => [$field => [$message]],
            ], 422);
        }

        return back()->withErrors([$field => $message])->withInput();
    }

    public function markRead(Request $request, PropertyInquiry $inquiry): RedirectResponse
    {
        abort_unless($request->user()->isAdmin() || ($inquiry->property && $request->user()->canAccessProperty($inquiry->property)), 403);

        $validated = $request->validate([
            'reply_message' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);
        $reply = trim($validated['reply_message'] ?? '');

        $inquiry->forceFill([
            'status' => 'read',
            ...($reply !== '' ? [
                'response_message' => $reply,
                'responded_at' => now(),
            ] : []),
        ])->save();

        return back()->with('success', $reply !== ''
            ? 'Reply prepared. The inquiry was marked as read.'
            : 'Inquiry marked as read. The visitor can submit another inquiry.');
    }
}
