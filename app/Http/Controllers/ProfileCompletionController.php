<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Auth\MobileAuthController;
use App\Models\User;
use App\Notifications\NewRegistrationAwaitingApproval;
use App\Support\IdentityNumber;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

class ProfileCompletionController extends Controller
{
    public function store(Request $request)
    {
        // Owners and advertisers after registering; managers at their first sign-in.
        abort_unless($request->user()->isAccountHolder() || $request->user()->isManager(), 403);
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
                    // One photo or PDF of the whole ID card, or of the passport photo page.
                    'identity_document' => 'required|file|mimes:jpg,jpeg,png,webp,pdf|max:5120',
                    'sector_id'     => 'required|exists:sectors,id',
                    // The same personal details as tenants (for a company, its representative's).
                    'gender'        => 'required|in:'.implode(',', \App\Support\TenantProfile::GENDERS),
                    'marital_status' => 'required|in:'.implode(',', \App\Support\TenantProfile::MARITAL_STATUSES),
                    // A company: its RDB certificate and its street address (the photo is its logo).
                    'rdb_certificate' => $request->user()->isCompany() ? 'required|file|mimes:jpg,jpeg,png,webp,pdf|max:5120' : 'nullable',
                    'address'       => $request->user()->isCompany() ? 'required|string|max:255' : 'nullable|string|max:255',
                    // Accounts created for someone (managers) accept the terms here.
                    'terms'         => $request->user()->isManager() && ! $request->user()->terms_accepted_at ? 'accepted' : 'nullable',
                ],
                // Custom user-friendly error messages instead of Laravel defaults:
                [
                    ...IdentityNumber::messages(),

                    'profile_photo.required' => '📸 Please upload a profile photo.',
                    'profile_photo.image'    => '📸 The file you uploaded is not a valid image. Only JPG, PNG, GIF, and WEBP are allowed.',
                    'profile_photo.max'      => '📸 Your photo is too large. Maximum size allowed is 2 MB (2048 KB). Please resize or compress your image and try again.',

                    'identity_document.required' => 'Please upload a photo of your ID document.',
                    'identity_document.mimes'    => 'The ID document must be a JPG, PNG, WEBP or PDF file.',
                    'identity_document.max'      => 'The ID document is too large. The maximum is 5 MB.',

                    'sector_id.required'     => '📍 Please select your location (Province → District → Sector).',
                    'sector_id.exists'       => '📍 The selected sector is not valid. Please select a sector from the dropdown list.',
                    'terms.accepted'         => 'You must accept the Terms and Conditions and the Privacy Policy to continue.',
                    'gender.required'        => 'Choose your gender.',
                    'marital_status.required' => 'Choose your marital status.',
                    'rdb_certificate.required' => 'Upload the company’s RDB registration certificate.',
                    'rdb_certificate.mimes'  => 'The RDB certificate must be a JPG, PNG, WEBP or PDF file.',
                    'rdb_certificate.max'    => 'The RDB certificate is too large. The maximum is 5 MB.',
                    'address.required'       => 'Enter the company’s street address (e.g. KG 7 Ave, building, floor).',
                ]
            );

            $path = $request->file('profile_photo')->store('profile-photos', 'public');

            $user = $request->user();
            $previousDocument = $user->identity_document;
            $previousCertificate = $user->rdb_certificate;
            $firstSubmission = ! $user->profile_completed;
            $updated = $user->update([
                'national_id'       => $validated['national_id'],
                'identity_document_type' => $validated['identity_document_type'],
                'identity_document' => $request->file('identity_document')->store('identity-documents/'.$user->id, 'local'),
                'profile_photo'     => $path,
                'sector_id'         => $validated['sector_id'],
                'gender'            => $validated['gender'],
                'marital_status'    => $validated['marital_status'],
                'profile_completed' => true,
                ...($user->isCompany() ? [
                    'rdb_certificate' => $request->file('rdb_certificate')->store('company-documents/'.$user->id, 'local'),
                    'company_address' => trim($validated['address']),
                ] : []),
                ...(! $user->isManager() || $user->terms_accepted_at ? [] : [
                    'terms_accepted_at' => now(),
                    'terms_version' => config('legal.terms_version'),
                    'terms_accepted_ip' => $request->ip(),
                ]),
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

            // A resubmission replaces the earlier ID file.
            if ($previousDocument && $previousDocument !== $user->identity_document) {
                Storage::disk('local')->delete($previousDocument);
            }
            if ($previousCertificate && $previousCertificate !== $user->rdb_certificate) {
                Storage::disk('local')->delete($previousCertificate);
            }

            // Tell every active admin once, so the new account can be reviewed.
            if ($firstSubmission && $user->status === 'pending') {
                Notification::send(
                    User::query()->where('role', 'admin')->whereNull('disabled_at')->get(),
                    new NewRegistrationAwaitingApproval($user),
                );
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
                ->with('error', '❌ Something went wrong while saving your profile. Please try again or contact support.')
                ->withInput();
        }
    }
}