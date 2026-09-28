import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ConfirmActionModal from '@/Components/ConfirmActionModal';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Search,
    IdCard,
    MapPin,
    Download,
    FileSpreadsheet,
    FileText,
    Trash2,
    CalendarClock,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/localization';

const statusStyles = {
    approved: 'bg-green-50 text-green-700 ring-1 ring-green-600/10',
    pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10',
    rejected: 'bg-red-50 text-red-700 ring-1 ring-red-600/10',
};

const roleStyles = {
    admin: 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/10',
    owner: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/10',
};

function formatDate(value, language) {
    if (!value) return '—';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    const locale = ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';

    return Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function toInputDate(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
}

function PlanBadge({ user }) {
    if (user.role === 'admin') {
        return (
            <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500 ring-1 ring-gray-600/10">
                Not applicable
            </span>
        );
    }

    if (user.status !== 'approved') {
        return (
            <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500 ring-1 ring-gray-600/10">
                Not active
            </span>
        );
    }

    const days = user.plan_remaining_days ?? 0;
    const expired = user.plan_is_expired;

    if (expired) {
        return (
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-600/10">
                Expired
            </span>
        );
    }

    if (days <= 30) {
        return (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-600/10">
                {days === 0 ? 'Expires today' : `${days} day${days === 1 ? '' : 's'} left`}
            </span>
        );
    }

    return (
        <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-green-600/10">
            {days} days left
        </span>
    );
}

export default function Users({ users, filters }) {
    const { auth, flash } = usePage().props;
    const { language } = useTranslation();
    const currentUserId = auth.user.id;
    const [search, setSearch] = useState(filters.search || '');
    const [exportOpen, setExportOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [planUser, setPlanUser] = useState(null);
    const [planDate, setPlanDate] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (search !== (filters.search || '')) {
                router.get(
                    route('admin.users'),
                    { ...filters, search },
                    { preserveState: true, replace: true },
                );
            }
        }, 400);
        return () => clearTimeout(timeout);
    }, [search]);

    const updateFilter = (key, value) => {
        router.get(
            route('admin.users'),
            { ...filters, [key]: value || undefined },
            { preserveState: true, replace: true },
        );
    };

    const exportUrl = (format) => {
        const params = new URLSearchParams();
        if (filters.search) params.set('search', filters.search);
        if (filters.role) params.set('role', filters.role);
        if (filters.status) params.set('status', filters.status);
        return route(`admin.users.export.${format}`) + '?' + params.toString();
    };

    const openPlan = (user) => {
        setPlanUser(user);
        setPlanDate(toInputDate(user.expires_at));
    };

    const closePlan = () => {
        if (!processing) setPlanUser(null);
    };

    const savePlan = () => {
        if (!planUser) return;
        setProcessing(true);
        router.patch(
            route('admin.users.plan', planUser.id),
            { expires_at: planDate },
            {
                preserveScroll: true,
                onFinish: () => {
                    setProcessing(false);
                    setPlanUser(null);
                },
            },
        );
    };

    const renewPlan = () => {
        if (!planUser) return;
        setProcessing(true);
        router.patch(
            route('admin.users.plan', planUser.id),
            { renew: true },
            {
                preserveScroll: true,
                onFinish: () => {
                    setProcessing(false);
                    setPlanUser(null);
                },
            },
        );
    };

    const deleteUser = () => {
        if (!userToDelete) return;
        setProcessing(true);
        router.delete(route('admin.users.destroy', userToDelete.id), {
            preserveScroll: true,
            onFinish: () => {
                setProcessing(false);
                setUserToDelete(null);
            },
        });
    };

    return (
        <AuthenticatedLayout header="All Users">
            <Head title="All Users" />

            {flash?.status && (
                <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
                    {flash.status}
                </div>
            )}
            {flash?.error && (
                <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
                    {flash.error}
                </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <Search
                            size={16}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name, email, phone..."
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pl-9 pr-3 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={filters.role || ''}
                            onChange={(e) =>
                                updateFilter('role', e.target.value)
                            }
                            className="rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 px-3 text-sm text-gray-600 transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                        >
                            <option value="">All roles</option>
                            <option value="owner">Owner</option>
                            <option value="admin">Admin</option>
                        </select>

                        <select
                            value={filters.status || ''}
                            onChange={(e) =>
                                updateFilter('status', e.target.value)
                            }
                            className="rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 px-3 text-sm text-gray-600 transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                        >
                            <option value="">All statuses</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>

                        <div className="relative">
                            <button
                                onClick={() => setExportOpen((v) => !v)}
                                onBlur={() =>
                                    setTimeout(
                                        () => setExportOpen(false),
                                        150,
                                    )
                                }
                                className="flex items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0a2e23]"
                            >
                                <Download size={15} />
                                Export
                            </button>
                            {exportOpen && (
                                <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
                                    <a
                                        href={exportUrl('excel')}
                                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                                    >
                                        <FileSpreadsheet
                                            size={15}
                                            className="text-green-600"
                                        />
                                        Excel (.csv)
                                    </a>
                                    <a
                                        href={exportUrl('pdf')}
                                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                                    >
                                        <FileText
                                            size={15}
                                            className="text-red-600"
                                        />
                                        PDF
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50 text-xs uppercase tracking-wide text-gray-400">
                                <th className="px-5 py-3 font-semibold">
                                    User
                                </th>
                                <th className="px-5 py-3 font-semibold">
                                    Contact
                                </th>
                                <th className="px-5 py-3 font-semibold">
                                    Location
                                </th>
                                <th className="px-5 py-3 font-semibold">
                                    Role
                                </th>
                                <th className="px-5 py-3 font-semibold">
                                    Status
                                </th>
                                <th className="px-5 py-3 font-semibold">
                                    Plan
                                </th>
                                <th className="px-5 py-3 font-semibold">
                                    Joined
                                </th>
                                <th className="px-5 py-3 font-semibold text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.data.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-5 py-10 text-center text-gray-400"
                                    >
                                        No users found.
                                    </td>
                                </tr>
                            ) : (
                                users.data.map((user) => (
                                    <tr
                                        key={user.id}
                                        className="border-b border-gray-50 transition-colors last:border-0 hover:bg-[#0E3B2E]/[0.02]"
                                    >
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                {user.profile_photo ? (
                                                    <img
                                                        src={`/storage/${user.profile_photo}`}
                                                        alt={user.name}
                                                        className="h-9 w-9 rounded-full object-cover ring-2 ring-white"
                                                    />
                                                ) : (
                                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0E3B2E]/10 text-xs font-semibold text-[#0E3B2E]">
                                                        {user.name
                                                            .charAt(0)
                                                            .toUpperCase()}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium text-gray-800">
                                                        {user.name}
                                                    </p>
                                                    {user.national_id && (
                                                        <p className="flex items-center gap-1 text-xs text-gray-400">
                                                            <IdCard
                                                                size={11}
                                                            />
                                                            {
                                                                user.national_id
                                                            }
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-gray-600">
                                            <p>{user.email}</p>
                                            <p className="text-xs text-gray-400">
                                                {user.phone}
                                            </p>
                                        </td>
                                        <td className="px-5 py-3.5 text-gray-600">
                                            {user.sector ? (
                                                <span className="flex items-center gap-1 text-xs">
                                                    <MapPin size={12} />
                                                    {user.sector.name},{' '}
                                                    {
                                                        user.sector.district
                                                            ?.name
                                                    }
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-300">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span
                                                className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${roleStyles[user.role] || 'bg-gray-100 text-gray-600'}`}
                                            >
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span
                                                className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[user.status] || 'bg-gray-100 text-gray-600'}`}
                                            >
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="space-y-1">
                                                <PlanBadge user={user} />
                                                {user.role === 'admin' ? (
                                                    <p className="text-xs text-gray-400">Owner plan not applicable</p>
                                                ) : (
                                                    <p className="text-xs text-gray-400">
                                                        {user.expires_at ? `Until ${formatDate(user.expires_at, language)}` : 'No expiry date set'}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-gray-400">
                                            {formatDate(user.created_at, language)}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    disabled={user.role === 'admin'}
                                                    onClick={() =>
                                                        openPlan(user)
                                                    }
                                                    className="inline-flex items-center gap-1 rounded-lg border border-[#0E3B2E]/20 px-2.5 py-1.5 text-xs font-medium text-[#0E3B2E] transition-colors hover:bg-[#0E3B2E]/5 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    <CalendarClock size={14} />
                                                    Plan
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={
                                                        user.id ===
                                                        currentUserId
                                                    }
                                                    onClick={() =>
                                                        setUserToDelete(user)
                                                    }
                                                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    <Trash2 size={14} />
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {users.data.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/30 p-4">
                        <p className="text-xs text-gray-400">
                            Showing {users.from} to {users.to} of {users.total}{' '}
                            users
                        </p>
                        <div className="flex gap-1">
                            {users.links.map((link, i) => (
                                <Link
                                    key={i}
                                    href={link.url || '#'}
                                    preserveState
                                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                        link.active
                                            ? 'bg-[#0E3B2E] text-white'
                                            : link.url
                                              ? 'text-gray-600 hover:bg-gray-100'
                                              : 'cursor-not-allowed text-gray-300'
                                    }`}
                                    dangerouslySetInnerHTML={{
                                        __html: link.label,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <ConfirmActionModal
                open={!!userToDelete}
                title="Delete this user?"
                message={
                    userToDelete
                        ? `${userToDelete.name} and their related property records will be permanently removed.`
                        : ''
                }
                confirmLabel="Yes, Delete"
                tone="danger"
                processing={processing}
                onConfirm={deleteUser}
                onCancel={() => {
                    if (!processing) setUserToDelete(null);
                }}
            />

            {planUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                        <h3 className="font-[Sora] text-lg font-bold text-gray-800">
                            Update plan
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            {planUser.name} — the subscription starts from
                            approval/renewal. Remaining:{' '}
                            {planUser.plan_is_expired
                                ? 'expired'
                                : `${planUser.plan_remaining_days} day${planUser.plan_remaining_days === 1 ? '' : 's'}`}
                            .
                        </p>

                        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-gray-400">
                            Plan end date
                        </label>
                        <input
                            type="date"
                            value={planDate}
                            min={new Date(Date.now() + 86400000)
                                .toISOString()
                                .slice(0, 10)}
                            onChange={(e) => setPlanDate(e.target.value)}
                            className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2.5 text-sm focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                        />

                        <button
                            type="button"
                            onClick={renewPlan}
                            disabled={processing}
                            className="mt-3 w-full rounded-xl border border-[#0E3B2E]/20 py-2.5 text-sm font-medium text-[#0E3B2E] hover:bg-[#0E3B2E]/5 disabled:opacity-60"
                        >
                            Renew +1 year
                        </button>

                        <div className="mt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={closePlan}
                                disabled={processing}
                                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={savePlan}
                                disabled={processing || !planDate}
                                className="flex-1 rounded-xl bg-[#0E3B2E] py-2.5 text-sm font-semibold text-white hover:bg-[#0a2e23] disabled:opacity-60"
                            >
                                {processing ? 'Please wait...' : 'Save date'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
