<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Auth\RegisteredUserController;
use App\Models\ActivityLog;
use App\Models\ManagerAssignment;
use App\Models\Property;
use App\Models\PropertyUnit;
use App\Models\RentPayment;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Self-registered owners add managers (free staff accounts), give each one
 * whole properties or single units, and follow what they do. Admins can
 * look at any owner's team.
 */
class ManagerController extends Controller
{
    public function index(Request $request): Response
    {
        $owner = $this->workspaceOwner($request);
        $filters = $request->validate([
            'manager_id' => ['nullable', 'integer'],
            'days' => ['nullable', 'integer', Rule::in([7, 30, 90, 365])],
        ]);
        $days = (int) ($filters['days'] ?? 30);

        $managers = $owner->managers()
            ->with(['managerAssignments.property:id,name', 'managerAssignments.propertyUnit.unitType:id,name', 'sector.district:id,name'])
            ->orderBy('name')
            ->get();
        $monthStart = now()->startOfMonth();
        $collected = RentPayment::query()
            ->whereIn('recorded_by', $managers->pluck('id'))
            ->where('paid_at', '>=', $monthStart)
            ->groupBy('recorded_by')
            ->selectRaw('recorded_by, SUM(amount) as total, COUNT(DISTINCT COALESCE(transaction_id, id)) as payments')
            ->get()
            ->keyBy('recorded_by');
        $actions = ActivityLog::query()
            ->whereIn('actor_id', $managers->pluck('id'))
            ->where('created_at', '>=', now()->subDays(30))
            ->groupBy('actor_id')
            ->selectRaw('actor_id, COUNT(*) as total, MAX(created_at) as last_at')
            ->get()
            ->keyBy('actor_id');

        $activity = ActivityLog::query()
            ->with('actor:id,name,role', 'property:id,name')
            ->where('owner_id', $owner->id)
            // Only what the managers did: the owner knows their own actions.
            ->whereIn('actor_id', User::withTrashed()->select('id')->where('role', 'manager')->where('employer_id', $owner->id))
            ->where('created_at', '>=', now()->subDays($days))
            ->when($filters['manager_id'] ?? null, fn ($query, $managerId) => $query->where('actor_id', $managerId))
            ->latest('created_at')
            ->latest('id')
            ->paginate(25)
            ->withQueryString();

        return Inertia::render('Managers/Index', [
            'owner' => $owner->only(['id', 'name']),
            'canManage' => $request->user()->id === $owner->id || $request->user()->isAdmin(),
            'adminView' => $request->user()->isAdmin(),
            'managers' => $managers->map(fn (User $manager) => [
                'id' => $manager->id,
                'name' => $manager->name,
                'first_name' => $manager->first_name,
                'last_name' => $manager->last_name,
                'username' => $manager->username,
                'email' => $manager->email,
                'profile_completed' => (bool) $manager->profile_completed,
                'identity_type' => $manager->identity_document_type,
                'national_id' => $manager->national_id,
                'photo_url' => $manager->profile_photo ? \Illuminate\Support\Facades\Storage::disk('public')->url($manager->profile_photo) : null,
                'location' => $manager->sector?->district?->name ? $manager->sector->district->name.' · '.$manager->sector->name : null,
                'identity_document_url' => $manager->identity_document ? route('managers.identity-document', $manager) : null,
                'phone' => $manager->phone,
                'disabled' => $manager->isDisabled(),
                'must_change_password' => (bool) $manager->must_change_password,
                'assignments' => $manager->managerAssignments->map(fn (ManagerAssignment $assignment) => [
                    'property_id' => $assignment->property_id,
                    'property_unit_id' => $assignment->property_unit_id,
                    'label' => $assignment->property?->name.($assignment->propertyUnit
                        ? ' · '.($assignment->propertyUnit->unitType?->name ?? 'Unit').' · '.PropertyUnit::floorLabel((int) $assignment->propertyUnit->floor_number)
                        : ''),
                ])->values(),
                'collected_this_month' => round((float) ($collected->get($manager->id)->total ?? 0), 2),
                'payments_this_month' => (int) ($collected->get($manager->id)->payments ?? 0),
                'actions_30_days' => (int) ($actions->get($manager->id)->total ?? 0),
                'last_activity_at' => isset($actions->get($manager->id)->last_at)
                    ? \Illuminate\Support\Carbon::parse($actions->get($manager->id)->last_at)->toIso8601String()
                    : null,
            ])->values(),
            'properties' => $this->propertyTree($owner),
            'activity' => $activity->through(fn (ActivityLog $log) => [
                'id' => $log->id,
                'at' => $log->created_at,
                'actor' => $log->actor ? ['id' => $log->actor->id, 'name' => $log->actor->name, 'role' => $log->actor->role] : null,
                'property' => $log->property?->name,
                'action' => $log->action,
                'description' => $log->description,
                'amount' => $log->amount,
            ]),
            'filters' => ['manager_id' => $filters['manager_id'] ?? null, 'days' => $days],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $owner = $this->workspaceOwner($request, write: true);
        $request->merge([
            'phone' => RegisteredUserController::normalizeRwandaPhone((string) $request->input('phone')),
            'username' => Str::lower(trim((string) $request->input('username'))),
        ]);

        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            // Managers sign in with this username (or their phone).
            'username' => ['required', 'regex:/^[a-z0-9][a-z0-9._-]{2,29}$/', 'unique:'.User::class],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'phone' => ['required', 'regex:/^(072|073|078|079)\d{7}$/', 'unique:'.User::class],
            'password' => ['required', 'confirmed', Password::defaults()],
            ...$this->assignmentRules(),
        ], [
            'phone.regex' => 'Enter a valid Rwanda mobile number (072, 073, 078 or 079).',
            'username.regex' => 'Use 3 to 30 letters or numbers; dots, dashes and underscores are allowed (e.g. jean.ikaze).',
            'username.unique' => 'This username is already taken. Choose another one.',
            'assignments.required' => 'Give the manager at least one property or unit.',
        ]);
        $assignments = $this->checkedAssignments($owner, $data['assignments']);

        $manager = DB::transaction(function () use ($owner, $data, $assignments) {
            $manager = new User([
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'name' => $data['first_name'].' '.$data['last_name'],
                'username' => $data['username'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'role' => 'manager',
                'status' => 'approved',
                // Like an owner's registration: ID, ID copy, photo, location and the terms at first sign-in.
                'profile_completed' => false,
                'password' => $data['password'],
            ]);
            // At first sign-in the manager replaces the temporary password, then
            // confirms the email and the phone with a code, like an owner.
            $manager->forceFill([
                'employer_id' => $owner->id,
                'login_enabled' => true,
                'must_change_password' => true,
                'email_verified_at' => null,
                'phone_verified_at' => null,
            ])->save();
            $this->syncAssignments($manager, $assignments);

            return $manager;
        });

        return back()->with('success', $manager->name.' was added as a manager. Give them their email and temporary password; they must change the password at first sign-in.');
    }

    public function update(Request $request, User $manager): RedirectResponse
    {
        $owner = $this->workspaceOwner($request, write: true);
        $this->ensureTeamMember($owner, $manager);
        $request->merge([
            'phone' => RegisteredUserController::normalizeRwandaPhone((string) $request->input('phone')),
            'username' => Str::lower(trim((string) $request->input('username'))),
        ]);

        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'username' => ['required', 'regex:/^[a-z0-9][a-z0-9._-]{2,29}$/', Rule::unique(User::class)->ignore($manager->id)],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique(User::class)->ignore($manager->id)],
            'phone' => ['required', 'regex:/^(072|073|078|079)\d{7}$/', Rule::unique(User::class)->ignore($manager->id)],
            ...$this->assignmentRules(),
        ], [
            'phone.regex' => 'Enter a valid Rwanda mobile number (072, 073, 078 or 079).',
            'username.regex' => 'Use 3 to 30 letters or numbers; dots, dashes and underscores are allowed (e.g. jean.ikaze).',
            'username.unique' => 'This username is already taken. Choose another one.',
            'assignments.required' => 'Give the manager at least one property or unit.',
        ]);
        // Buildings the manager already runs stay, even if their payment has since ended.
        $assignments = $this->checkedAssignments($owner, $data['assignments'], $manager->managerAssignments()->pluck('property_id')->map(fn ($id) => (int) $id)->all());

        $contactChanged = [
            'email_verified_at' => $data['email'] !== $manager->email,
            'phone_verified_at' => $data['phone'] !== $manager->phone,
        ];
        DB::transaction(function () use ($manager, $data, $assignments) {
            $manager->update([
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'name' => $data['first_name'].' '.$data['last_name'],
                'username' => $data['username'],
                'email' => $data['email'],
                'phone' => $data['phone'],
            ]);
            $this->syncAssignments($manager, $assignments);
            // A new email or phone is confirmed again with a code at the next sign-in.
            $reset = array_keys(array_filter($contactChanged));
            if ($reset) {
                $manager->forceFill(array_fill_keys($reset, null))->save();
            }
        });

        return back()->with('success', $manager->name.'’s details and buildings were saved.');
    }

    public function setPassword(Request $request, User $manager): RedirectResponse
    {
        $owner = $this->workspaceOwner($request, write: true);
        $this->ensureTeamMember($owner, $manager);
        $data = $request->validate(['password' => ['required', 'confirmed', Password::defaults()]]);

        $manager->forceFill(['password' => $data['password'], 'must_change_password' => true])->save();
        $manager->endAllSessions();

        return back()->with('success', 'A new temporary password was set for '.$manager->name.'. They must change it at their next sign-in.');
    }

    public function disable(Request $request, User $manager): RedirectResponse
    {
        $owner = $this->workspaceOwner($request, write: true);
        $this->ensureTeamMember($owner, $manager);

        if (! $manager->isDisabled()) {
            $manager->forceFill([
                'status_before_disabled' => $manager->status,
                'status' => 'disabled',
                'disabled_at' => now(),
                'disabled_reason' => 'Disabled by '.$request->user()->name,
            ])->save();
            $manager->endAllSessions();
        }

        return back()->with('success', $manager->name.' can no longer sign in.');
    }

    public function enable(Request $request, User $manager): RedirectResponse
    {
        $owner = $this->workspaceOwner($request, write: true);
        $this->ensureTeamMember($owner, $manager);

        $manager->forceFill([
            'status' => $manager->status_before_disabled ?: 'approved',
            'status_before_disabled' => null,
            'disabled_at' => null,
            'disabled_reason' => null,
        ])->save();

        return back()->with('success', $manager->name.' can sign in again.');
    }

    /** Removes the account; everything they recorded stays in the history. */
    public function destroy(Request $request, User $manager): RedirectResponse
    {
        $owner = $this->workspaceOwner($request, write: true);
        $this->ensureTeamMember($owner, $manager);

        $manager->endAllSessions();
        $manager->managerAssignments()->delete();
        $manager->delete();

        return back()->with('success', $manager->name.' was removed. Their past work stays in the activity history.');
    }

    /**
     * The owner whose team is shown: the signed-in self-registered owner, or
     * for an admin the owner chosen with ?owner_id.
     */
    private function workspaceOwner(Request $request, bool $write = false): User
    {
        $user = $request->user();

        if ($user->isAdmin()) {
            $ownerId = $request->integer('owner_id') ?: $request->route('manager')?->employer_id;
            abort_unless($ownerId, 404);

            return User::query()->where('role', 'owner')->findOrFail($ownerId);
        }

        abort_unless($user->canHireManagers(), 403, 'Only owners who registered themselves can add managers.');

        return $user;
    }

    private function ensureTeamMember(User $owner, User $manager): void
    {
        abort_unless($manager->isManager() && $manager->employer_id === $owner->id, 404);
    }

    private function assignmentRules(): array
    {
        return [
            'assignments' => ['required', 'array', 'min:1', 'max:500'],
            'assignments.*.property_id' => ['required', 'integer'],
            'assignments.*.property_unit_id' => ['nullable', 'integer'],
        ];
    }

    /**
     * Keeps only the owner's own properties and units. A whole property makes
     * single units of that property redundant.
     *
     * @return Collection<int, array{property_id: int, property_unit_id: int|null}>
     */
    /** The manager's ID copy, for the owner they work for (private file). */
    public function identityDocument(Request $request, User $manager): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $owner = $this->workspaceOwner($request);
        $this->ensureTeamMember($owner, $manager);
        $path = $manager->identity_document;
        abort_unless($path && \Illuminate\Support\Facades\Storage::disk('local')->exists($path), 404);

        return \Illuminate\Support\Facades\Storage::disk('local')->response($path, 'manager-id-'.$manager->id.'.'.pathinfo($path, PATHINFO_EXTENSION));
    }

    private function checkedAssignments(User $owner, array $rows, array $alreadyRunning = []): Collection
    {
        $properties = Property::query()->where('owner_id', $owner->id)->get()->each->setRelation('owner', $owner)->keyBy('id');
        $propertyIds = $properties->keys()->all();
        $units = PropertyUnit::query()->whereIn('property_id', $propertyIds)->pluck('property_id', 'id');
        $rows = collect($rows)->map(fn ($row) => [
            'property_id' => (int) $row['property_id'],
            'property_unit_id' => isset($row['property_unit_id']) && $row['property_unit_id'] !== '' ? (int) $row['property_unit_id'] : null,
        ]);

        foreach ($rows as $row) {
            $ownsProperty = in_array($row['property_id'], $propertyIds, true);
            $unitMatches = $row['property_unit_id'] === null || (int) ($units[$row['property_unit_id']] ?? 0) === $row['property_id'];
            if (! $ownsProperty || ! $unitMatches) {
                throw ValidationException::withMessages(['assignments' => 'Choose only your own properties and units.']);
            }
            // No payment, no work: a building is given to a manager only once its payment is approved.
            $property = $properties->get($row['property_id']);
            if (! $property->subscriptionIsActive() && ! in_array($property->id, $alreadyRunning, true)) {
                throw ValidationException::withMessages(['assignments' => '“'.$property->name.'” is not paid yet. Pay for it and wait for the approval, then give it to a manager.']);
            }
        }

        $whole = $rows->whereNull('property_unit_id')->pluck('property_id')->unique();

        return $rows
            ->reject(fn ($row) => $row['property_unit_id'] !== null && $whole->contains($row['property_id']))
            ->unique(fn ($row) => $row['property_id'].'-'.($row['property_unit_id'] ?? 'all'))
            ->values();
    }

    private function syncAssignments(User $manager, Collection $assignments): void
    {
        $manager->managerAssignments()->delete();
        foreach ($assignments as $row) {
            $manager->managerAssignments()->create($row);
        }
        $manager->forgetManagerScope();
    }

    /** The owner's properties with their units, for the assignment picker. */
    private function propertyTree(User $owner): array
    {
        return Property::query()
            ->where('owner_id', $owner->id)
            ->with(['propertyUnits' => fn ($query) => $query->with('unitType:id,name')->withCount('rooms')])
            ->withCount('units')
            ->orderBy('name')
            ->get(['id', 'name', 'owner_id', 'paid_until'])
            ->each->setRelation('owner', $owner)
            ->map(fn (Property $property) => [
                'id' => $property->id,
                'name' => $property->name,
                // Only paid (approved) buildings can be given to a manager.
                'paid' => $property->subscriptionIsActive(),
                'state' => $property->subscriptionState(),
                'rooms' => $property->units_count,
                'units' => $property->propertyUnits->map(fn (PropertyUnit $unit) => [
                    'id' => $unit->id,
                    'label' => ($unit->unitType?->name ?? 'Unit').' · '.PropertyUnit::floorLabel((int) $unit->floor_number),
                    'rooms' => $unit->rooms_count,
                ])->values(),
            ])
            ->all();
    }
}
