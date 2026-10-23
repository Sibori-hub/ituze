<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Auth\MobileAuthController;
use App\Support\IdentityNumber;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ProfileCompletionController extends Controller
{
    public function store(Request $request)
    {
        abort_unless($request->user()->isAccountHolder(), 403);
        abort_if($request->user()->status === 'rejected', 403, 'This account has been rejected.');
        abort_unless($request->user()->hasVerifiedEmail(), 403, 'Verify your email before completing your profile.');

        $request->merge([
            'national_id' => IdentityNumber::normalize(
                $request->input('identity_document_type'),
                $request->input('national_id'),
            ),
        ]);

        try {
            $validated = $request->validate(
                [
                    'national_id'   => IdentityNumber::rules($request->input('identity_document_type')),
                    'identity_document_type' => 'required|in:nida,passport',
                    'profile_photo' => 'required|image|max:2048',
                    // A NIDA card has two sides; a passport only its photo page.
                    'identity_document_front' => 'required|file|mimes:jpg,jpeg,png,webp,pdf|max:5120',
                    'identity_document_back' => 'exclude_unless:identity_document_type,nida|required|file|mimes:jpg,jpeg,png,webp,pdf|max:5120',
                    'sector_id'     => 'required|exists:sectors,id',
                ],
                // Custom user-friendly error messages instead of Laravel defaults:
                [
                    ...IdentityNumber::messages(),

                    'profile_photo.required' => '📸 Please upload a profile photo.',
                    'profile_photo.image'    => '📸 The file you uploaded is not a valid image. Only JPG, PNG, GIF, and WEBP are allowed.',
                    'profile_photo.max'      => '📸 Your photo is too large. Maximum size allowed is 2 MB (2048 KB). Please resize or compress your image and try again.',

                    'identity_document_front.required' => 'Please upload a photo of your ID document.',
                    'identity_document_back.required'  => 'Please upload a photo of the back of your ID card.',
                    'identity_document_front.mimes'    => 'The ID document must be a JPG, PNG, WEBP or PDF file.',
                    'identity_document_back.mimes'     => 'The ID document must be a JPG, PNG, WEBP or PDF file.',
                    'identity_document_front.max'      => 'The ID document is too large. The maximum is 5 MB.',
                    'identity_document_back.max'       => 'The ID document is too large. The maximum is 5 MB.',

                    'sector_id.required'     => '📍 Please select your location (Province → District → Sector).',
                    'sector_id.exists'       => '📍 The selected sector is not valid. Please select a sector from the dropdown list.',
                ]
            );

            $path = $request->file('profile_photo')->store('profile-photos', 'public');

            $user = $request->user();
            $previousDocuments = array_filter([$user->identity_document_front, $user->identity_document_back]);
            $documentFolder = 'identity-documents/'.$user->id;
            $updated = $user->update([
                'national_id'       => $validated['national_id'],
                'identity_document_type' => $validated['identity_document_type'],
                'identity_document_front' => $request->file('identity_document_front')->store($documentFolder, 'local'),
                'identity_document_back' => $request->hasFile('identity_document_back') && $validated['identity_document_type'] === 'nida'
                    ? $request->file('identity_document_back')->store($documentFolder, 'local')
                    : null,
                'profile_photo'     => $path,
                'sector_id'         => $validated['sector_id'],
                'profile_completed' => true,
            ]);

            if (!$updated) {
                Log::warning('Profile completion update returned false for user ID: ' . $request->user()->id);
                if ($request->expectsJson()) {
                    return response()->json([
                        'message' => 'Profile was not saved. Please try again.',
                    ], 500);
                }

                return back()->with('warning', 'Profile was not saved. Please try again or contact support.')->withInput();
            }

            // A resubmission replaces the earlier ID files.
            Storage::disk('local')->delete(array_diff($previousDocuments, [$user->identity_document_front, $user->identity_document_back]));

            Log::info('Profile completed successfully for user ID: ' . $request->user()->id);

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Profile completed successfully. Your account is waiting for admin approval.',
                    'user' => MobileAuthController::userData($user->fresh()),
                ]);
            }

            return redirect()
                ->route('dashboard')
                ->with('success', '🎉 Profile completed successfully! Welcome to '.config('app.name').'.');

        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::warning('Profile completion validation failed for user ' . $request->user()->id . ': ' . json_encode($e->errors()));
            throw $e;
        } catch (\Exception $e) {
            Log::error('Profile completion error: ' . $e->getMessage() . ' | File: ' . $e->getFile() . ' | Line: ' . $e->getLine());
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'Something went wrong while saving your profile. Please try again.',
                ], 500);
            }

            return back()
                ->with('error', '❌ Something went wrong while saving your profile. Please try again or contact support.')
                ->withInput();
        }
    }
}