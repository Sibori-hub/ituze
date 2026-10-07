<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Auth\MobileAuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ProfileCompletionController extends Controller
{
    public function store(Request $request)
    {
        abort_unless($request->user()->role === 'owner', 403);
        abort_if($request->user()->status === 'rejected', 403, 'This owner account has been rejected.');
        abort_unless($request->user()->hasVerifiedEmail(), 403, 'Verify your email before completing your profile.');

        try {
            $validated = $request->validate(
                [
                    'national_id'   => 'required|string|max:20',
                    'identity_document_type' => 'required|in:nida,passport',
                    'address'       => 'required|string|max:255',
                    'profile_photo' => 'required|image|max:2048',
                    'sector_id'     => 'required|exists:sectors,id',
                ],
                // Custom user-friendly error messages instead of Laravel defaults:
                [
                    'national_id.required'   => 'Please enter your NIDA or passport number.',
                    'national_id.max'        => 'The identification number must be 20 characters or fewer.',
                    'national_id.string'     => 'The identification number must be text.',

                    'profile_photo.required' => '📸 Please upload a profile photo.',
                    'profile_photo.image'    => '📸 The file you uploaded is not a valid image. Only JPG, PNG, GIF, and WEBP are allowed.',
                    'profile_photo.max'      => '📸 Your photo is too large. Maximum size allowed is 2 MB (2048 KB). Please resize or compress your image and try again.',

                    'sector_id.required'     => '📍 Please select your location (Province → District → Sector).',
                    'sector_id.exists'       => '📍 The selected sector is not valid. Please select a sector from the dropdown list.',
                ]
            );

            $path = $request->file('profile_photo')->store('profile-photos', 'public');

            $user = $request->user();
            $updated = $user->update([
                'national_id'       => $validated['national_id'],
                'identity_document_type' => $validated['identity_document_type'],
                'address'           => $validated['address'],
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
                ->with('error', '❌ Something went wrong while saving your profile: ' . $e->getMessage())
                ->withInput();
        }
    }
}