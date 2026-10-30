import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ConfirmActionModal from '@/Components/ConfirmActionModal';
import UserAvatar from '@/Components/UserAvatar';
import usePresence, { useLatest } from '@/hooks/usePresence';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Ban,
    CalendarClock,
    KeyRound,
    Percent,
    ChevronLeft,
    ChevronRight,
    Download,
    FileSpreadsheet,
    FileText,
    IdCard,
    Loader2,
    MapPin,
    Phone,
    RotateCcw,
    Search,
    SearchX,
    Trash2,
    UserCheck,
    UserPlus,
    UsersRound,
    Building2,
    UserCog,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/localization';
import RwandaPhoneInput, { isRwandaMobile } from '@/Components/RwandaPhoneInput';
import { toLocalDigits } from '@/lib/rwanda';

const ROLE_TABS = [
    { value: '', label: 'All users' },
    { value: 'owner', label: 'Owners' },
    { value: 'advertiser', label: 'Advertisers' },
    { value: 'admin', label: 'Admins' },
];

const SOURCE_CHIPS = [
    { value: 'managed', label: 'Managed by Q.R.A', Icon: Building2 },
    { value: 'self', label: 'Self-registered', Icon: UserCheck },
];

const STATUS_CHIPS = [
    { value: 'pending', label: 'Pending', dot: 'bg-amber-400' },
    { value: 'approved', label: 'Approved', dot: 'bg-emerald-500' },
    { value: 'rejected', label: 'Rejected', dot: 'bg-red-500' },
    { value: 'disabled', label: 'Disabled', dot: 'bg-gray-400' },
];

const statusStyles = {
    approved: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-600/15',
    pending: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-600/15',
    rejected: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 ring-red-600/15',
    disabled: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 ring-gray-600/15',
};

const roleStyles = {
    admin: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-purple-600/15',
    owner: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-600/15',
    advertiser: 'bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-teal-600/15',
    manager: 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-amber-600/15',
};

const ROLE_LABELS = { admin: 'Admin', owner: 'Owner', advertiser: 'Advertiser', manager: 'Manager' };
const STATUS_LABELS = { approved: 'Approved', pending: 'Pending', rejected: 'Rejected', disabled: 'Disabled' };

function formatDate(value, language) {
    if (!value) return '—';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    const locale = ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';

    return Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

const toInputDate = (value) => (value ? String(value).slice(0, 10) : '');

function Badge({ className, children }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${className}`}>
            {children}
        </span>
    );
}

/** Days left on an owner's paid subscription, as a short bar. */
function PlanCell({ user }) {
    const { t, language } = useTranslation();

    if (user.role === 'owner' && user.created_by) {
        return (
            <div className="w-36">
                <p className="text-[11px] font-semibold text-indigo-800 dark:text-indigo-300">
                    {t('Management fee :rate%', { rate: Number(user.management_fee_percent ?? 10).toLocaleString(undefined, { maximumFractionDigits: 2 }) })}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-slate-400">{user.login_enabled ? t('Can sign in (view only)') : t('No sign-in yet')}</p>
            </div>
        );
    }
    if (user.role !== 'owner') {
        return <span className="text-xs text-gray-300">{t('Not applicable')}</span>;
    }
    if (user.status !== 'approved') {
        return <span className="text-xs text-gray-400 dark:text-slate-500">{t('Not active')}</span>;
    }

    const days = Math.max(0, user.plan_remaining_days ?? 0);
    const expired = user.plan_is_expired;
    const tone = expired ? 'bg-red-500' : days <= 30 ? 'bg-amber-400' : 'bg-emerald-500';
    const label = expired
        ? t('Expired')
        : days === 0
          ? t('Expires today')
          : t(':days days left', { days });

    return (
        <div className="w-36">
            <div className="flex items-center justify-between text-[11px]">
                <span className={`font-semibold ${expired ? 'text-red-600 dark:text-red-400' : days <= 30 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-700 dark:text-slate-200'}`}>{label}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                <div className={`h-full rounded-full ${tone}`} style={{ width: `${expired ? 100 : Math.min(100, (days / 365) * 100)}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
                {user.expires_at ? t('Until :date', { date: formatDate(user.expires_at, language) }) : t('No expiry date set')}
            </p>
        </div>
    );
}

function IconAction({ label, onClick, disabled, tone = 'gray', children }) {
    const tones = {
        gray: 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-800 dark:hover:text-white',
        green: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10',
        amber: 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10',
        red: 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600',
        brand: 'text-[#0E3B2E] dark:text-emerald-300 hover:bg-[#0E3B2E]/5',
    };

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={label}
            aria-label={label}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent ${tones[tone]}`}
        >
            {children}
        </button>
    );
}

/** Centred dialog rendered into document.body, so the page wrapper can never offset it. */
function DialogShell({ open, onClose, title, description, children }) {
    const { mounted, closing } = usePresence(open);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => event.key === 'Escape' && onClose?.();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!mounted) return null;

    return createPortal(
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm ${
                closing ? 'pointer-events-none animate-fade-out' : 'animate-fade-in'
            }`}
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}
        >
            <div className={`w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl ${closing ? 'animate-pop-out' : 'animate-pop-in'}`}>
                <h3 className="font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100">{title}</h3>
                {description && <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-slate-400">{description}</p>}
                {children}
            </div>
        </div>,
        document.body,
    );
}

/** A self-registered owner's managers, shown under the owner. The admin follows them; only the owner removes them. */
function TeamList({ team, ownerId, t }) {
    return (
        <div className="rounded-xl border border-sky-100 dark:border-sky-500/30 bg-white dark:bg-slate-900 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-300"><UserCog size={13} aria-hidden="true" />{t('Their managers (:count)', { count: team.length })}</p>
                <Link href={route('managers.index', { owner_id: ownerId })} className="text-[11px] font-semibold text-[#0E3B2E] dark:text-emerald-300 underline underline-offset-2">{t('Managers and activity')}</Link>
            </div>
            <ul className="mt-1.5 flex flex-wrap gap-2">
                {team.map((manager) => (
                    <li key={manager.id} className={`inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg px-2.5 py-1 text-xs ring-1 ${manager.disabled ? 'bg-gray-50 dark:bg-slate-800/60 text-gray-500 dark:text-slate-400 ring-gray-200 dark:ring-slate-700' : 'bg-sky-50 dark:bg-sky-500/10 text-sky-950 dark:text-sky-300 ring-sky-100 dark:ring-sky-500/30'}`}>
                        <span className="font-semibold">{manager.name}</span>
                        {manager.username && <span className="font-mono text-[11px]">@{manager.username}</span>}
                        {manager.phone && <span className="text-[11px]">{manager.phone}</span>}
                        <span className="text-[11px]">{t(manager.assignments === 1 ? '1 building or unit' : ':count buildings or units', { count: manager.assignments })}</span>
                        <span className={`rounded-full px-1.5 text-[10px] font-semibold ${manager.disabled ? 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200' : manager.profile_completed ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-900 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-500/15 text-amber-900 dark:text-amber-300'}`}>
                            {manager.disabled ? t('Disabled') : manager.profile_completed ? t('Active') : t('Not signed in yet')}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function Users({ users, filters, counts = {} }) {
    const { auth, errors } = usePage().props;
    const { t, language } = useTranslation();
    const currentUserId = auth.user.id;
    const [search, setSearch] = useState(filters.search || '');
    const [loading, setLoading] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [userToDisable, setUserToDisable] = useState(null);
    const [disableReason, setDisableReason] = useState('');
    const [userToEnable, setUserToEnable] = useState(null);
    const [planUser, setPlanUser] = useState(null);
    const [feeUser, setFeeUser] = useState(null);
    const [feeValue, setFeeValue] = useState('10');
    const [passwordUser, setPasswordUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [phoneUser, setPhoneUser] = useState(null);
    const [newPhone, setNewPhone] = useState('');
    const [planDate, setPlanDate] = useState('');
    const [processing, setProcessing] = useState(false);
    const exportRef = useRef(null);
    const disableShown = useLatest(userToDisable);
    const planShown = useLatest(planUser);
    const feeShown = useLatest(feeUser);
    const passwordShown = useLatest(passwordUser);
    const phoneShown = useLatest(phoneUser);

    // A strong temporary password the admin can read out to the account holder.
    const generatePassword = () => {
        const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '#@!%&*?'];
        const random = (max) => window.crypto.getRandomValues(new Uint32Array(1))[0] % max;
        const chars = sets.map((set) => set[random(set.length)]);
        const all = sets.join('');
        while (chars.length < 12) chars.push(all[random(all.length)]);
        setNewPassword(chars.sort(() => random(3) - 1).join(''));
    };

    const visit = (params) => {
        router.get(route('admin.users'), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onStart: () => setLoading(true),
            onFinish: () => setLoading(false),
        });
    };

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (search !== (filters.search || '')) visit({ ...filters, search: search || undefined });
        }, 350);
        return () => clearTimeout(timeout);
    }, [search]);

    // Close the export menu on any click outside it.
    useEffect(() => {
        if (!exportOpen) return undefined;
        const close = (event) => !exportRef.current?.contains(event.target) && setExportOpen(false);
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [exportOpen]);

    const updateFilter = (key, value) => visit({ ...filters, [key]: value || undefined, page: undefined });
    const clearFilters = () => {
        setSearch('');
        visit({});
    };
    const hasFilters = Boolean(filters.search || filters.role || filters.status || filters.source);

    const exportUrl = (format) => {
        const params = new URLSearchParams();
        if (filters.search) params.set('search', filters.search);
        if (filters.role) params.set('role', filters.role);
        if (filters.status) params.set('status', filters.status);
        if (filters.source) params.set('source', filters.source);
        return `${route(`admin.users.export.${format}`)}?${params.toString()}`;
    };

    const submit = (method, url, data, done) => {
        setProcessing(true);
        const options = {
            preserveScroll: true,
            onFinish: () => {
                setProcessing(false);
                done();
            },
        };
        // router.delete(url, options) takes no data argument, unlike post/patch.
        if (method === 'delete') router.delete(url, { ...options, data });
        else router[method](url, data, options);
    };

    const canManage = (user) => user.role !== 'admin' && user.id !== currentUserId;

    // Phone numbers change only here, never by the account holder (security).
    const savePhone = () => {
        if (!phoneUser) return;
        setProcessing(true);
        router.patch(route('admin.users.phone', phoneUser.id), { phone: `0${newPhone}` }, {
            preserveScroll: true,
            onSuccess: () => setPhoneUser(null),
            onFinish: () => setProcessing(false),
        });
    };
    const roleCount = (role) => (role ? counts.roles?.[role] ?? 0 : counts.all ?? 0);

    const actions = (user, onCard = false) => (
        <div className={`flex flex-wrap items-center gap-0.5 ${onCard ? 'justify-start' : 'justify-end'}`}>
            {(user.role === 'owner' && !user.created_by) || user.role === 'manager' ? (
                <Link href={route('managers.index', { owner_id: user.role === 'manager' ? user.employer_id : user.id })} className="rounded-lg p-2 text-[#0E3B2E] dark:text-emerald-300 transition hover:bg-emerald-50 dark:hover:bg-emerald-500/10" title={t('Managers and activity')} aria-label={t('Managers and activity')}>
                    <UserCog size={16} />
                </Link>
            ) : null}
            {user.role === 'owner' && user.created_by ? (
                <IconAction
                    label={t('Management fee')}
                    tone="brand"
                    onClick={() => {
                        setFeeUser(user);
                        setFeeValue(String(Number(user.management_fee_percent ?? 10)));
                    }}
                >
                    <Percent size={16} />
                </IconAction>
            ) : (
                <IconAction
                    label={t('Update plan')}
                    tone="brand"
                    disabled={user.role !== 'owner'}
                    onClick={() => {
                        setPlanUser(user);
                        setPlanDate(toInputDate(user.expires_at));
                    }}
                >
                    <CalendarClock size={16} />
                </IconAction>
            )}
            {user.created_by && user.role !== 'admin' && (
                <IconAction
                    label={t('Set temporary password')}
                    tone="brand"
                    onClick={() => {
                        setPasswordUser(user);
                        setNewPassword('');
                    }}
                >
                    <KeyRound size={16} />
                </IconAction>
            )}
            {canManage(user) && (
                <IconAction
                    label={t('Change phone')}
                    tone="brand"
                    onClick={() => {
                        setPhoneUser(user);
                        setNewPhone(toLocalDigits(user.phone || ''));
                    }}
                >
                    <Phone size={16} />
                </IconAction>
            )}
            {user.status === 'disabled' ? (
                <IconAction label={t('Enable')} tone="green" disabled={!canManage(user)} onClick={() => setUserToEnable(user)}>
                    <RotateCcw size={16} />
                </IconAction>
            ) : (
                <IconAction
                    label={t('Disable')}
                    tone="amber"
                    disabled={!canManage(user)}
                    onClick={() => {
                        setUserToDisable(user);
                        setDisableReason('');
                    }}
                >
                    <Ban size={16} />
                </IconAction>
            )}
            <IconAction label={t('Delete')} tone="red" disabled={!canManage(user) || user.role === 'manager'} onClick={() => setUserToDelete(user)}>
                <Trash2 size={16} />
            </IconAction>
        </div>
    );

    const location = (user) =>
        user.sector ? (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                <MapPin size={12} className="shrink-0 text-gray-400 dark:text-slate-500" />
                {user.sector.name}
                {user.sector.district?.name ? `, ${user.sector.district.name}` : ''}
            </span>
        ) : (
            <span className="text-xs text-gray-300">—</span>
        );

    const badges = (user) => (
        <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={roleStyles[user.role] || 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 ring-gray-600/15'}>{t(ROLE_LABELS[user.role] ?? user.role)}</Badge>
            <Badge className={statusStyles[user.status] || 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 ring-gray-600/15'}>{t(STATUS_LABELS[user.status] ?? user.status)}</Badge>
            {user.role !== 'admin' && (
                user.created_by ? (
                    <span title={user.creator?.name ? t('Added by :name', { name: user.creator.name }) : undefined}>
                        <Badge className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 ring-indigo-600/20">
                            <Building2 size={11} className="mr-1" aria-hidden="true" />
                            {t('Managed by Q.R.A')}
                        </Badge>
                    </span>
                ) : (
                    <Badge className="bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 ring-gray-300 dark:ring-slate-600">{t('Self-registered')}</Badge>
                )
            )}
        </div>
    );

    return (
        <AuthenticatedLayout header="All Users">
            <Head title={t('All Users')} />

            <div className="mx-auto max-w-7xl space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="font-[Sora] text-2xl font-bold tracking-[-0.02em] text-gray-900 dark:text-slate-100">{t('Users')}</h1>
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">{t(':count accounts on the platform', { count: counts.all ?? users.total })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                    <Link
                        href={route('admin.users.create')}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#0E3B2E]/20 dark:border-emerald-400/20 bg-white dark:bg-slate-900 px-4 text-sm font-semibold text-[#0E3B2E] dark:text-emerald-300 shadow-sm transition hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                    >
                        <UserPlus size={16} aria-hidden="true" />
                        {t('Add user')}
                    </Link>
                    <div className="relative" ref={exportRef}>
                        <button
                            type="button"
                            onClick={() => setExportOpen((open) => !open)}
                            aria-expanded={exportOpen}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#124B3A]"
                        >
                            <Download size={16} />
                            {t('Export')}
                        </button>
                        {exportOpen && (
                            <div className="absolute right-0 z-20 mt-2 w-52 animate-pop-in overflow-hidden rounded-xl bg-white dark:bg-slate-900 p-1 shadow-lg ring-1 ring-black/5">
                                <a href={exportUrl('excel')} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                                    <FileSpreadsheet size={16} className="text-emerald-600 dark:text-emerald-400" /> {t('Excel (.csv)')}
                                </a>
                                <a href={exportUrl('pdf')} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
                                    <FileText size={16} className="text-red-500" /> PDF
                                </a>
                                {hasFilters && <p className="px-3 pb-2 pt-1 text-[11px] text-gray-400 dark:text-slate-500">{t('Exports follow the current filters.')}</p>}
                            </div>
                        )}
                    </div>
                    </div>
                </div>

                {errors?.user && <div className="rounded-xl bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300">{errors.user}</div>}

                <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-black/[0.04]">
                    <div className="space-y-4 border-b border-gray-100 dark:border-slate-800 p-4 sm:p-5">
                        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label={t('Role')}>
                            {ROLE_TABS.map(({ value, label }) => {
                                const active = (filters.role || '') === value;
                                return (
                                    <button
                                        key={label}
                                        type="button"
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() => updateFilter('role', value)}
                                        className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                                            active ? 'bg-[#0E3B2E] text-white shadow-sm' : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        {t(label)}
                                        <span className={`rounded-full px-1.5 py-px text-[11px] tabular-nums ${active ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'}`}>
                                            {roleCount(value)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="relative w-full lg:max-w-sm">
                                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={t('Search name, email, phone...')}
                                    className="w-full rounded-xl border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/40 py-2.5 pl-10 pr-10 text-sm transition focus:border-[#0E3B2E] focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-[#0E3B2E]/10"
                                />
                                {loading ? (
                                    <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-gray-400 dark:text-slate-500" />
                                ) : search ? (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-600"
                                        aria-label={t('Clear search')}
                                    >
                                        <X size={14} />
                                    </button>
                                ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                                {SOURCE_CHIPS.map(({ value, label, Icon }) => {
                                    const active = filters.source === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => updateFilter('source', active ? '' : value)}
                                            aria-pressed={active}
                                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
                                                active ? 'bg-[#0E3B2E] text-white ring-[#0E3B2E]' : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 ring-gray-300 dark:ring-slate-600 hover:ring-gray-400'
                                            }`}
                                        >
                                            <Icon size={13} aria-hidden="true" />
                                            {t(label)}
                                            <span className={`tabular-nums ${active ? 'text-white/80' : 'text-gray-500 dark:text-slate-400'}`}>{counts.sources?.[value] ?? 0}</span>
                                        </button>
                                    );
                                })}
                                <span className="mx-1 hidden h-5 w-px bg-gray-200 dark:bg-slate-700 sm:block" aria-hidden="true" />
                                {STATUS_CHIPS.map(({ value, label, dot }) => {
                                    const active = filters.status === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => updateFilter('status', active ? '' : value)}
                                            aria-pressed={active}
                                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
                                                active ? 'bg-[#0E3B2E] text-white ring-[#0E3B2E]' : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 ring-gray-200 dark:ring-slate-700 hover:ring-gray-300'
                                            }`}
                                        >
                                            <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white dark:bg-slate-900' : dot}`} />
                                            {t(label)}
                                            <span className={`tabular-nums ${active ? 'text-white/70' : 'text-gray-400 dark:text-slate-500'}`}>{counts.statuses?.[value] ?? 0}</span>
                                        </button>
                                    );
                                })}
                                {hasFilters && (
                                    <button type="button" onClick={clearFilters} className="ml-1 text-xs font-semibold text-[#0E3B2E] dark:text-emerald-300 underline decoration-[#D9A441] decoration-2 underline-offset-4">
                                        {t('Clear filters')}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={`transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`}>
                        {users.data.length === 0 ? (
                            <div className="px-6 py-16 text-center">
                                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 dark:bg-slate-800/60 text-gray-400 dark:text-slate-500">
                                    {hasFilters ? <SearchX size={24} /> : <UsersRound size={24} />}
                                </span>
                                <p className="mt-4 font-semibold text-gray-800 dark:text-slate-100">{t('No users found.')}</p>
                                {hasFilters && (
                                    <>
                                        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t('Try another search or clear the filters.')}</p>
                                        <button type="button" onClick={clearFilters} className="mt-4 rounded-lg bg-[#0E3B2E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#124B3A]">
                                            {t('Clear filters')}
                                        </button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Wide screens: a table that always fits (no sideways page scroll). */}
                                <div className="hidden overflow-x-auto xl:block">
                                <table className="w-full table-fixed text-left text-sm">
                                    <colgroup>
                                        <col className="w-[36%]" />
                                        <col className="w-[28%]" />
                                        <col className="w-[16%]" />
                                        <col className="w-[20%]" />
                                    </colgroup>
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/40 text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                            <th className="px-4 py-3 font-semibold">{t('User')}</th>
                                            <th className="px-4 py-3 font-semibold">{t('Account')}</th>
                                            <th className="px-4 py-3 font-semibold">{t('Plan')}</th>
                                            <th className="px-4 py-3 text-right font-semibold">{t('Actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                        {users.data.map((user) => (
                                            <tr key={user.id} className="group align-top transition-colors hover:bg-[#0E3B2E]/[0.025]">
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-start gap-3">
                                                        <UserAvatar user={user} size="sm" />
                                                        <div className="min-w-0">
                                                            <p className="truncate font-semibold text-gray-900 dark:text-slate-100">
                                                                {user.name}
                                                                {user.id === currentUserId && <span className="ml-1.5 text-xs font-medium text-gray-400 dark:text-slate-500">({t('you')})</span>}
                                                            </p>
                                                            <p className="truncate text-xs text-gray-500 dark:text-slate-400">{user.email}</p>
                                                            {user.account_type === 'company' && (
                                                                <p className="truncate text-[11px] text-sky-900 dark:text-sky-300">{t('Company')} · TIN {user.company_tin} · {t('Rep.')} {`${user.first_name || ''} ${user.last_name || ''}`.trim()}</p>
                                                            )}
                                                            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-700 dark:text-slate-200">
                                                                <span className="inline-flex items-center gap-1"><Phone size={12} className="text-gray-400 dark:text-slate-500" />{user.phone || '—'}</span>
                                                                <span className="truncate">{location(user)}</span>
                                                            </p>
                                                            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-slate-500">{t('Joined')} {formatDate(user.created_at, language)}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    {badges(user)}
                                                    {user.created_by && user.creator?.name && (
                                                        <p className="mt-1.5 truncate text-[11px] text-gray-500 dark:text-slate-400">{t('Added by :name', { name: user.creator.name })}</p>
                                                    )}
                                                    {user.national_id && (
                                                        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-slate-500">
                                                            <IdCard size={12} />
                                                            {user.national_id}
                                                        </p>
                                                    )}
                                                    {user.status === 'disabled' && user.disabled_reason && (
                                                        <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">{user.disabled_reason}</p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <PlanCell user={user} />
                                                </td>
                                                <td className="px-4 py-3.5">{actions(user)}</td>
                                            </tr>
                                        )).flatMap((row, index) => {
                                            const team = users.data[index].team || [];
                                            return team.length ? [row, (
                                                <tr key={`team-${users.data[index].id}`} className="bg-sky-50/40 dark:bg-sky-500/10">
                                                    <td colSpan={4} className="px-4 pb-3 pt-0">
                                                        <TeamList team={team} ownerId={users.data[index].id} t={t} />
                                                    </td>
                                                </tr>
                                            )] : [row];
                                        })}
                                    </tbody>
                                </table>
                                </div>

                                {/* Phones, tablets and laptops: cards, two per row from tablet size. */}
                                <ul className="grid gap-3 p-3 sm:p-4 md:grid-cols-2 xl:hidden">
                                    {users.data.map((user) => (
                                        <li key={user.id} className={`flex min-w-0 flex-col rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 transition hover:shadow-md ${user.status === 'disabled' ? 'ring-gray-200 dark:ring-slate-700 opacity-90' : 'ring-black/[0.06]'}`}>
                                            <div className="flex items-start gap-3">
                                                <UserAvatar user={user} size="md" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-semibold text-gray-900 dark:text-slate-100">
                                                        {user.name}
                                                        {user.id === currentUserId && <span className="ml-1.5 text-xs font-medium text-gray-400 dark:text-slate-500">({t('you')})</span>}
                                                    </p>
                                                    <p className="truncate text-xs text-gray-500 dark:text-slate-400">{user.email}</p>
                                                    {user.account_type === 'company' && (
                                                        <p className="truncate text-[11px] text-sky-900 dark:text-sky-300">{t('Company')} · TIN {user.company_tin}</p>
                                                    )}
                                                    <div className="mt-2">{badges(user)}</div>
                                                </div>
                                            </div>
                                            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-gray-50 dark:bg-slate-800/60 px-3 py-2.5 text-xs">
                                                <div className="min-w-0">
                                                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">{t('Phone')}</dt>
                                                    <dd className="truncate text-gray-800 dark:text-slate-100">{user.phone || '—'}</dd>
                                                </div>
                                                <div className="min-w-0">
                                                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">{t('Joined')}</dt>
                                                    <dd className="truncate text-gray-800 dark:text-slate-100">{formatDate(user.created_at, language)}</dd>
                                                </div>
                                                <div className="col-span-2 min-w-0">{location(user)}</div>
                                                <div className="col-span-2 min-w-0"><PlanCell user={user} /></div>
                                            </dl>
                                            {(user.team || []).length > 0 && <div className="mt-2"><TeamList team={user.team} ownerId={user.id} t={t} /></div>}
                                            <div className="mt-auto border-t border-gray-100 dark:border-slate-800 pt-3">{actions(user, true)}</div>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>

                    {users.data.length > 0 && users.last_page > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 dark:border-slate-800 px-4 py-3 sm:px-5">
                            <p className="text-xs text-gray-500 dark:text-slate-400">{t('Showing :from–:to of :total', { from: users.from, to: users.to, total: users.total })}</p>
                            <div className="flex items-center gap-1">
                                {users.links.map((link, index) => {
                                    const isPrev = index === 0;
                                    const isNext = index === users.links.length - 1;
                                    const content = isPrev ? <ChevronLeft size={16} /> : isNext ? <ChevronRight size={16} /> : link.label;
                                    const className = `flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition ${
                                        link.active ? 'bg-[#0E3B2E] text-white' : link.url ? 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800' : 'text-gray-300'
                                    }`;

                                    return link.url ? (
                                        <Link
                                            key={index}
                                            href={link.url}
                                            preserveState
                                            preserveScroll
                                            onStart={() => setLoading(true)}
                                            onFinish={() => setLoading(false)}
                                            className={className}
                                            aria-label={isPrev ? t('Previous') : isNext ? t('Next') : undefined}
                                        >
                                            {content}
                                        </Link>
                                    ) : (
                                        <span key={index} className={className}>{content}</span>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmActionModal
                open={!!userToDelete}
                title={t('Delete this user?')}
                message={userToDelete ? t(':name will no longer be able to sign in. Their tenants, leases and payment history are kept for your records.', { name: userToDelete.name }) : ''}
                confirmLabel={t('Yes, Delete')}
                tone="danger"
                processing={processing}
                onConfirm={() => userToDelete && submit('delete', route('admin.users.destroy', userToDelete.id), {}, () => setUserToDelete(null))}
                onCancel={() => !processing && setUserToDelete(null)}
            />

            <ConfirmActionModal
                open={!!userToEnable}
                title={t('Re-enable this account?')}
                message={userToEnable ? t(':name will be restored to their previous status and can sign in again.', { name: userToEnable.name }) : ''}
                confirmLabel={t('Yes, Enable')}
                processing={processing}
                onConfirm={() => userToEnable && submit('post', route('admin.users.enable', userToEnable.id), {}, () => setUserToEnable(null))}
                onCancel={() => !processing && setUserToEnable(null)}
            />

            {disableShown && (
                <DialogShell
                    open={!!userToDisable}
                    onClose={() => !processing && setUserToDisable(null)}
                    title={t('Disable this account?')}
                    description={t(':name will be signed out and blocked from signing in. Their data stays untouched and you can re-enable them at any time.', { name: disableShown.name })}
                >
                    <label htmlFor="disable-reason" className="mt-4 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        {t('Reason (optional)')}
                    </label>
                    <input
                        id="disable-reason"
                        type="text"
                        value={disableReason}
                        maxLength={255}
                        onChange={(e) => setDisableReason(e.target.value)}
                        placeholder={t('e.g. Unpaid subscription')}
                        className="mt-1.5 w-full rounded-xl border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/40 px-3 py-2.5 text-sm focus:border-[#0E3B2E] focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-[#0E3B2E]/10"
                    />
                    <div className="mt-5 flex gap-3">
                        <button type="button" onClick={() => !processing && setUserToDisable(null)} disabled={processing} className="flex-1 rounded-xl border border-gray-200 dark:border-slate-700 py-2.5 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60">
                            {t('Cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={() => userToDisable && submit('post', route('admin.users.disable', userToDisable.id), { disabled_reason: disableReason || undefined }, () => setUserToDisable(null))}
                            disabled={processing}
                            className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                        >
                            {processing ? t('Please wait...') : t('Disable account')}
                        </button>
                    </div>
                </DialogShell>
            )}

            {planShown && (
                <DialogShell
                    open={!!planUser}
                    onClose={() => !processing && setPlanUser(null)}
                    title={t('Update plan')}
                    description={
                        planShown.plan_is_expired
                            ? t(':name — the plan has expired.', { name: planShown.name })
                            : t(':name — :days days remaining.', { name: planShown.name, days: planShown.plan_remaining_days ?? 0 })
                    }
                >
                    <button
                        type="button"
                        onClick={() => planUser && submit('patch', route('admin.users.plan', planUser.id), { renew: true }, () => setPlanUser(null))}
                        disabled={processing}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] py-2.5 text-sm font-semibold text-white hover:bg-[#124B3A] disabled:opacity-60"
                    >
                        <RotateCcw size={15} />
                        {t('Add 1 month')}
                    </button>
                    <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                        <span className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
                        {t('or set a date')}
                        <span className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
                    </div>
                    <label htmlFor="plan-date" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">{t('Plan end date')}</label>
                    <input
                        id="plan-date"
                        type="date"
                        value={planDate}
                        min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                        onChange={(e) => setPlanDate(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/40 px-3 py-2.5 text-sm focus:border-[#0E3B2E] focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-[#0E3B2E]/10"
                    />
                    <div className="mt-5 flex gap-3">
                        <button type="button" onClick={() => !processing && setPlanUser(null)} disabled={processing} className="flex-1 rounded-xl border border-gray-200 dark:border-slate-700 py-2.5 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60">
                            {t('Cancel')}
                        </button>
                        <button
                            type="button"
                            onClick={() => planUser && submit('patch', route('admin.users.plan', planUser.id), { expires_at: planDate }, () => setPlanUser(null))}
                            disabled={processing || !planDate}
                            className="flex-1 rounded-xl border border-[#0E3B2E]/20 dark:border-emerald-400/20 py-2.5 text-sm font-semibold text-[#0E3B2E] dark:text-emerald-300 hover:bg-[#0E3B2E]/5 disabled:opacity-60"
                        >
                            {processing ? t('Please wait...') : t('Save date')}
                        </button>
                    </div>
                </DialogShell>
            )}

            {feeShown && (
                <DialogShell
                    open={!!feeUser}
                    onClose={() => !processing && setFeeUser(null)}
                    title={t('Management fee')}
                    description={t('Share of the rent collected for :name that Q.R.A keeps.', { name: feeShown.name })}
                >
                    <label htmlFor="fee-value" className="mt-4 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-300">{t('Fee (%)')}</label>
                    <input
                        id="fee-value"
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={feeValue}
                        onChange={(e) => setFeeValue(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border-gray-300 dark:border-slate-600 px-3 py-2.5 text-sm focus:border-[#0E3B2E] focus:ring-4 focus:ring-[#0E3B2E]/10"
                    />
                    <div className="mt-5 flex gap-3">
                        <button type="button" onClick={() => !processing && setFeeUser(null)} disabled={processing} className="min-h-11 flex-1 rounded-xl border border-gray-300 dark:border-slate-600 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60">
                            {t('Cancel')}
                        </button>
                        <button
                            type="button"
                            disabled={processing || feeValue === '' || Number(feeValue) < 0 || Number(feeValue) > 100}
                            onClick={() => feeUser && submit('patch', route('admin.users.fee', feeUser.id), { management_fee_percent: feeValue }, () => setFeeUser(null))}
                            className="min-h-11 flex-1 rounded-xl bg-[#0E3B2E] text-sm font-semibold text-white hover:bg-[#124B3A] disabled:opacity-60"
                        >
                            {processing ? t('Please wait...') : t('Save')}
                        </button>
                    </div>
                </DialogShell>
            )}

            {passwordShown && (
                <DialogShell
                    open={!!passwordUser}
                    onClose={() => !processing && setPasswordUser(null)}
                    title={t('Set temporary password')}
                    description={t(':name signs in with this password and must change it at the next sign-in. Any open sessions are signed out.', { name: passwordShown.name })}
                >
                    <div className="mt-4 flex items-center justify-between">
                        <label htmlFor="temp-password" className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-300">{t('Temporary password')}</label>
                        <button type="button" onClick={generatePassword} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[#0E3B2E] dark:text-emerald-300 underline decoration-2 underline-offset-4 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                            <KeyRound size={14} aria-hidden="true" />
                            {t('Generate')}
                        </button>
                    </div>
                    <input
                        id="temp-password"
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="off"
                        aria-describedby="temp-password-hint"
                        className="mt-1.5 w-full rounded-xl border-gray-300 dark:border-slate-600 px-3 py-2.5 font-mono text-sm focus:border-[#0E3B2E] focus:ring-4 focus:ring-[#0E3B2E]/10"
                    />
                    <p id="temp-password-hint" className="mt-1.5 text-xs text-gray-600 dark:text-slate-300">{t('At least 10 characters with upper and lowercase letters, a number and a symbol.')}</p>
                    {errors?.password && <p className="mt-1.5 text-sm font-medium text-red-700 dark:text-red-300" role="alert">{errors.password}</p>}
                    <div className="mt-5 flex gap-3">
                        <button type="button" onClick={() => !processing && setPasswordUser(null)} disabled={processing} className="min-h-11 flex-1 rounded-xl border border-gray-300 dark:border-slate-600 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60">
                            {t('Cancel')}
                        </button>
                        <button
                            type="button"
                            disabled={processing || newPassword.length < 10}
                            onClick={() => passwordUser && submit('post', route('admin.users.password', passwordUser.id), { password: newPassword, password_confirmation: newPassword }, () => setPasswordUser(null))}
                            className="min-h-11 flex-1 rounded-xl bg-[#0E3B2E] text-sm font-semibold text-white hover:bg-[#124B3A] disabled:opacity-60"
                        >
                            {processing ? t('Please wait...') : t('Set password')}
                        </button>
                    </div>
                </DialogShell>
            )}
            {phoneShown && (
                <DialogShell
                    open={!!phoneUser}
                    onClose={() => !processing && setPhoneUser(null)}
                    title={t('Change phone')}
                    description={t(':name must confirm the new number with an SMS code at the next sign-in. The old number gets an SMS alert, and open sessions are signed out.', { name: phoneShown.name })}
                >
                    <label htmlFor="new-phone" className="mb-1.5 mt-4 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-slate-300">{t('New phone number')}</label>
                    <RwandaPhoneInput id="new-phone" value={newPhone} onChange={setNewPhone} error={errors?.phone} autoFocus />
                    <div className="mt-5 flex gap-3">
                        <button type="button" onClick={() => !processing && setPhoneUser(null)} disabled={processing} className="min-h-11 flex-1 rounded-xl border border-gray-300 dark:border-slate-600 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60">
                            {t('Cancel')}
                        </button>
                        <button
                            type="button"
                            disabled={processing || !isRwandaMobile(newPhone)}
                            onClick={savePhone}
                            className="min-h-11 flex-1 rounded-xl bg-[#0E3B2E] text-sm font-semibold text-white hover:bg-[#124B3A] disabled:opacity-60"
                        >
                            {processing ? t('Please wait...') : t('Save')}
                        </button>
                    </div>
                </DialogShell>
            )}
        </AuthenticatedLayout>
    );
}
