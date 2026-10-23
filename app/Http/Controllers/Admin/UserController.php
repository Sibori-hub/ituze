<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Models\District;
use App\Models\Province;
use App\Models\Sector;
use App\Models\User;
use App\Services\OtpService;
use App\Services\SmsService;
use App\Support\IdentityNumber;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Response;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
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
        $source = $request->input('source');

        return User::query()
            ->with(['sector.district.province', 'creator:id,name', 'employer:id,name'])
            ->when($source === 'managed', fn ($query) => $query->whereNotNull('created_by'))
            ->when($source === 'self', fn ($query) => $query->whereNull('created_by')->where('role', '!=', 'admin'))
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
                'source' => $request->input('source'),
            ],
            // Totals for the role tabs and status chips, independent of the current filters.
            'counts' => [
                'all' => User::query()->count(),
                'roles' => User::query()->selectRaw('role, COUNT(*) as total')->groupBy('role')->pluck('total', 'role'),
                'statuses' => User::query()->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status'),
                'sources' => [
                    'managed' => User::query()->whereNotNull('created_by')->count(),
                    'self' => User::query()->whereNull('created_by')->where('role', '!=', 'admin')->count(),
                ],
            ],
        ]);
    }

    /**
     * Form for registering an owner or advertiser that Q.R.A manages.
     */
    public function create(): InertiaResponse
    {
        return Inertia::render('Admin/CreateUser', [
            'locations' => [
                'provinces' => Province::query()->orderBy('name')->get(['id', 'name']),
                'districts' => District::query()->orderBy('name')->get(['id', 'name', 'province_id']),
                'sectors' => Sector::query()->orderBy('name')->get(['id', 'name', 'district_id']),
            ],
        ]);
    }

    /**
     * Register an owner or advertiser on their behalf. The account is approved
     * straight away, does not sign in, and keeps its email and phone only so
     * Q.R.A can send information and updates.
     */
    public function store(Request $request): RedirectResponse
    {
        $request->merge([
            'phone' => $request->filled('phone')
                ? RegisteredUserController::normalizeRwandaPhone((string) $request->input('phone'))
                : $request->input('phone'),
            'national_id' => IdentityNumber::normalize($request->input('identity_document_type'), $request->input('national_id')),
        ]);

        $validated = $request->validate([
            'role' => ['required', 'in:'.implode(',', RegisteredUserController::SELF_SERVICE_ROLES)],
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'phone' => ['required', 'regex:/^(072|073|078|079)\d{7}$/', 'unique:'.User::class],
            'identity_document_type' => ['required', 'in:nida,passport'],
            'national_id' => IdentityNumber::rules($request->input('identity_document_type')),
            'sector_id' => ['required', 'exists:sectors,id'],
            'profile_photo' => ['required', 'image', 'max:2048'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'management_fee_percent' => [$request->input('role') === 'owner' ? 'required' : 'prohibited', 'nullable', 'numeric', 'between:0,100'],
        ], [
            'phone.regex' => 'Enter a valid Rwanda mobile number (072, 073, 078, or 079).',
            ...IdentityNumber::messages(),
        ]);

        $user = new User([
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'name' => $validated['first_name'].' '.$validated['last_name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'],
            'role' => $validated['role'],
            'status' => 'approved',
            // Managed owners pay a fee on collected rent instead of a subscription.
            'expires_at' => null,
            'management_fee_percent' => $validated['role'] === 'owner' ? $validated['management_fee_percent'] : null,
            'national_id' => $validated['national_id'],
            'identity_document_type' => $validated['identity_document_type'],
            'sector_id' => $validated['sector_id'],
            'profile_photo' => $request->file('profile_photo')->store('profile-photos', 'public'),
            'profile_completed' => true,
            'created_by' => $request->user()->id,
            'password' => $validated['password'],
        ]);
        // The administrator vouches for these contacts; the temporary password
        // must be replaced at first sign-in.
        $user->forceFill([
            'login_enabled' => true,
            'must_change_password' => true,
            'email_verified_at' => now(),
            'phone_verified_at' => now(),
        ])->save();

        return redirect()->route('admin.users', ['source' => 'managed'])
            ->with('success', $user->name.' was added as a '.strtolower($user->roleLabel()).' managed by ITUZE GREEN PLATFORM. Give them the temporary password; they must change it at first sign-in.');
    }

    /**
     * Give a managed account a (new) temporary password, which also turns its
     * sign-in on. The owner must replace it at the next sign-in.
     */
    public function setPassword(Request $request, User $user): RedirectResponse
    {
        abort_unless($user->isManaged() && ! $user->isAdmin(), 404);

        $validated = $request->validate([
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $user->forceFill([
            'password' => $validated['password'],
            'login_enabled' => true,
            'must_change_password' => true,
        ])->save();
        $user->endAllSessions();

        return back()->with('success', 'A temporary password was set for '.$user->name.'. They must change it at their next sign-in.');
    }

    /**
     * Only an admin changes a phone number (users cannot, so a stolen session
     * cannot move password resets to another phone). The person confirms the
     * new number with an SMS code at the next sign-in, and the old number is told.
     */
    public function updatePhone(Request $request, User $user, SmsService $sms, OtpService $otp): RedirectResponse
    {
        abort_if($user->isAdmin(), 404);

        $request->merge(['phone' => RegisteredUserController::normalizeRwandaPhone((string) $request->input('phone'))]);
        $validated = $request->validate(
            ['phone' => ['required', 'regex:/^(072|073|078|079)\d{7}$/', Rule::unique(User::class)->ignore($user->id)]],
            [
                'phone.regex' => 'Enter a valid 10-digit Rwanda mobile number (072, 073, 078, or 079).',
                'phone.unique' => 'This phone number is already registered.',
            ],
        );

        $oldPhone = $user->phone;

        if ($oldPhone === $validated['phone']) {
            return back()->with('success', $user->name.' already uses this phone number.');
        }

        $user->forceFill([
            'phone' => $validated['phone'],
            'phone_verified_at' => null,
        ])->save();
        $user->endAllSessions();

        // The code goes to the new number; signing in asks for it before anything else.
        $otp->sendPhoneOtp($user);

        if ($oldPhone) {
            try {
                $sms->send($oldPhone, 'ITUZE: the phone number on your account was changed by the ITUZE admin. If you did not ask for this, contact ITUZE now.');
            } catch (\Throwable $e) {
                Log::warning('Phone change alert SMS failed: '.$e->getMessage(), ['user_id' => $user->id]);
            }
        }

        return back()->with('success', 'The phone number of '.$user->name.' is now '.$validated['phone'].'. They confirm it with an SMS code at their next sign-in.');
    }

    /**
     * Change the share of collected rent Q.R.A keeps for a managed owner.
     */
    public function updateFee(Request $request, User $user): RedirectResponse
    {
        abort_unless($user->isManaged() && $user->isOwner(), 404);

        $validated = $request->validate([
            'management_fee_percent' => ['required', 'numeric', 'between:0,100'],
        ]);

        $user->forceFill(['management_fee_percent' => $validated['management_fee_percent']])->save();

        return back()->with('success', 'The management fee for '.$user->name.' is now '.rtrim(rtrim(number_format((float) $validated['management_fee_percent'], 2), '0'), '.').'%.');
    }

    public function updatePlan(Request $request, User $user): RedirectResponse
    {
        abort_unless($user->role === 'owner', 404);

        $validated = $request->validate([
            'renew' => ['sometimes', 'accepted'],
            'expires_at' => ['sometimes', 'required', 'date', 'after:today'],
        ]);

        if (empty($validated['renew']) && !isset($validated['expires_at'])) {
            return back()->withErrors(['plan' => 'Choose a new plan end date or add one month.']);
        }

        $newExpiry = DB::transaction(function () use ($user, $validated): Carbon {
            $lockedUser = User::query()->lockForUpdate()->findOrFail($user->id);
            abort_unless($lockedUser->role === 'owner', 404);

            if (!empty($validated['renew'])) {
                $currentExpiry = $lockedUser->expires_at;
                $renewalStart = $currentExpiry && $currentExpiry->isFuture()
                    ? $currentExpiry
                    : now();
                $newExpiry = $renewalStart->copy()->addMonthNoOverflow();
            } else {
                $newExpiry = Carbon::parse($validated['expires_at'])->endOfDay();
            }

            $lockedUser->forceFill(['expires_at' => $newExpiry])->save();

            return $newExpiry;
        });

        return back()->with('success', 'Owner plan updated. Access is available until '.$newExpiry->toDateString().'.');
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

        return back()->with('success', $user->name.' has been disabled and can no longer sign in.');
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

        return back()->with('success', $user->name.' has been re-enabled.');
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

        return back()->with('success', $user->name.' was deleted. Their tenant, lease and payment records were kept.');
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
            fputcsv($handle, ['Name', 'Email', 'Phone', 'Role', 'Status', 'Source', 'National ID', 'Location', 'Joined', 'Expires']);

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
                    $user->isManaged() ? 'Managed by Q.R.A' : ($user->isAdmin() ? 'Administrator' : 'Self-registered'),
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