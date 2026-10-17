<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Response;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class UserController extends Controller
{
    protected function filteredUsers(Request $request)
    {
        $search = $request->input('search');
        $role = $request->input('role');
        $status = $request->input('status');

        return User::query()
            ->with('sector.district.province')
            ->when($search, function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%");
                });
            })
            ->when($role, fn ($query) => $query->where('role', $role))
            ->when($status, fn ($query) => $query->where('status', $status))
            ->latest();
    }

    public function index(Request $request): InertiaResponse
    {
        $users = $this->filteredUsers($request)->paginate(10)->withQueryString();
        $users->getCollection()->transform(function (User $user) {
            $expiresAt = $user->expires_at;
            $user->setAttribute('plan_is_expired', !$user->isAdmin() && $user->isExpired());
            $user->setAttribute(
                'plan_remaining_days',
                $expiresAt && !$user->isAdmin()
                    ? max(0, (int) now()->startOfDay()->diffInDays($expiresAt->copy()->startOfDay(), false))
                    : null
            );

            return $user;
        });

        return Inertia::render('Admin/Users', [
            'users' => $users,
            'filters' => [
                'search' => $request->input('search'),
                'role' => $request->input('role'),
                'status' => $request->input('status'),
            ],
        ]);
    }

    public function updatePlan(Request $request, User $user): RedirectResponse
    {
        abort_unless($user->role === 'owner', 404);

        $validated = $request->validate([
            'renew' => ['sometimes', 'accepted'],
            'expires_at' => ['sometimes', 'required', 'date', 'after:today'],
        ]);

        if (empty($validated['renew']) && !isset($validated['expires_at'])) {
            return back()->withErrors(['plan' => 'Choose a new plan end date or renew for one year.']);
        }

        $newExpiry = DB::transaction(function () use ($user, $validated): Carbon {
            $lockedUser = User::query()->lockForUpdate()->findOrFail($user->id);
            abort_unless($lockedUser->role === 'owner', 404);

            if (!empty($validated['renew'])) {
                $currentExpiry = $lockedUser->expires_at;
                $renewalStart = $currentExpiry && $currentExpiry->isFuture()
                    ? $currentExpiry
                    : now();
                $newExpiry = $renewalStart->copy()->addYear();
            } else {
                $newExpiry = Carbon::parse($validated['expires_at'])->endOfDay();
            }

            $lockedUser->forceFill(['expires_at' => $newExpiry])->save();

            return $newExpiry;
        });

        return back()->with('status', 'Owner plan updated. Access is available until '.$newExpiry->toDateString().'.');
    }

    /**
     * Suspend an account without losing any history.
     */
    public function disable(Request $request, User $user): RedirectResponse
    {
        $this->assertManageable($request, $user);

        if ($user->isDisabled()) {
            return back()->withErrors(['user' => 'This account is already disabled.']);
        }

        $validated = $request->validate([
            'disabled_reason' => ['nullable', 'string', 'max:255'],
        ]);

        $user->forceFill([
            'status_before_disabled' => $user->status,
            'status' => 'disabled',
            'disabled_at' => now(),
            'disabled_reason' => $validated['disabled_reason'] ?? null,
        ])->save();

        $user->endAllSessions();

        return back()->with('status', $user->name.' has been disabled and can no longer sign in.');
    }

    /**
     * Undo a suspension.
     */
    public function enable(Request $request, User $user): RedirectResponse
    {
        $this->assertManageable($request, $user);

        if (! $user->isDisabled()) {
            return back()->withErrors(['user' => 'This account is not disabled.']);
        }

        $user->forceFill([
            'status' => $user->status_before_disabled ?: ($user->profile_completed ? 'approved' : 'pending'),
            'status_before_disabled' => null,
            'disabled_at' => null,
            'disabled_reason' => null,
        ])->save();

        return back()->with('status', $user->name.' has been re-enabled.');
    }

    /**
     * Soft delete: the account disappears but tenants, leases and payment
     * history stay intact for reporting.
     */
    public function destroy(Request $request, User $user): RedirectResponse
    {
        $this->assertManageable($request, $user);

        $user->endAllSessions();
        $user->delete();

        return back()->with('status', $user->name.' was deleted. Their tenant, lease and payment records were kept.');
    }

    /**
     * An administrator may never act on themselves or on another administrator.
     */
    protected function assertManageable(Request $request, User $user): void
    {
        if ($user->isAdmin()) {
            throw ValidationException::withMessages([
                'user' => 'Administrator accounts cannot be disabled or deleted.',
            ]);
        }

        if ($user->id === $request->user()->id) {
            throw ValidationException::withMessages([
                'user' => 'You cannot disable or delete your own account.',
            ]);
        }
    }

    public function exportExcel(Request $request)
    {
        $users = $this->filteredUsers($request)->get();

        $callback = function () use ($users) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Name', 'Email', 'Phone', 'Role', 'Status', 'National ID', 'Location', 'Joined', 'Expires']);

            foreach ($users as $user) {
                $location = $user->sector
                    ? $user->sector->name.', '.optional($user->sector->district)->name
                    : '';

                fputcsv($handle, array_map([$this, 'csvSafe'], [
                    $user->name,
                    $user->email,
                    $user->phone,
                    $user->role,
                    $user->status,
                    $user->national_id,
                    $location,
                    $user->created_at->format('Y-m-d'),
                    $user->expires_at?->format('Y-m-d'),
                ]));
            }

            fclose($handle);
        };

        return Response::streamDownload($callback, 'users-'.now()->format('Y-m-d').'.csv', [
            'Content-Type' => 'text/csv',
        ]);
    }

    /**
     * Stop spreadsheet apps from running user-supplied text as a formula.
     */
    protected function csvSafe(mixed $value): mixed
    {
        if (is_string($value) && $value !== '' && in_array($value[0], ['=', '+', '-', '@', "\t", "\r"], true)) {
            return "'".$value;
        }

        return $value;
    }

    public function exportPdf(Request $request)
    {
        $users = $this->filteredUsers($request)->get();

        $pdf = Pdf::loadView('admin.users-pdf', [
            'users' => $users,
            'generatedAt' => now(),
        ])->setPaper('a4', 'landscape');

        return $pdf->download('users-'.now()->format('Y-m-d').'.pdf');
    }
}