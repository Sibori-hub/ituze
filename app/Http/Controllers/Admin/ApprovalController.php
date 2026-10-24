<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\AccountApproved;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ApprovalController extends Controller
{
    /**
     * Account types an administrator reviews.
     */
    public const REVIEWABLE_ROLES = ['owner', 'advertiser'];

    public function index(): Response
    {
        $pending = User::query()
            ->whereIn('role', self::REVIEWABLE_ROLES)
            ->where('status', 'pending')
            ->where('profile_completed', true)
            ->whereNotNull('email_verified_at')
            ->with('sector.district.province')
            ->latest()
            ->get()
            ->each(fn (User $user) => $user->setAttribute('has_identity_document', (bool) $user->identity_document));

        return Inertia::render('Admin/Approvals', [
            'pendingUsers' => $pending,
        ]);
    }

    /**
     * Stream an applicant's ID document (private file, admins only).
     */
    public function identityDocument(User $user): StreamedResponse
    {
        $path = $user->identity_document;
        abort_unless($path && Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->response($path, "id-{$user->id}.".pathinfo($path, PATHINFO_EXTENSION));
    }

    public function approve(Request $request, User $user): RedirectResponse
    {
        abort_unless(in_array($user->role, self::REVIEWABLE_ROLES, true), 404);

        $user->refresh();

        $request->validate([
            'payment_verified' => ['required', 'accepted'],
        ]);

        abort_unless($user->status === 'pending', 409, 'This account is no longer pending approval.');
        abort_unless($user->hasVerifiedEmail() && $user->profile_completed, 422, 'The account must verify their email and complete their profile before approval.');

        $user->approveAccount();
        $user->notify(new AccountApproved());

        return back()->with('status', $user->roleLabel().' account approved.');
    }

    public function reject(User $user): RedirectResponse
    {
        abort_unless(in_array($user->role, self::REVIEWABLE_ROLES, true), 404);

        $user->update(['status' => 'rejected']);

        return back()->with('status', 'Account rejected.');
    }
}
