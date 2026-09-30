import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CompleteProfileModal from '@/Components/CompleteProfileModal';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Activity, ArrowUpRight, BadgeCheck, BarChart3, Building2, CalendarDays, CalendarX,
    CheckCircle2, Clock3, CreditCard, DoorOpen, FileText, Home, Mail, MessageSquare,
    Phone, Plus, ShieldCheck, TrendingUp, Users, UsersRound,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/localization';

const cards = [
    { key: 'properties', label: 'Properties', icon: Building2, color: 'bg-emerald-50 text-emerald-700', route: 'properties.index' },
    { key: 'units', label: 'Total units', icon: DoorOpen, color: 'bg-blue-50 text-blue-700', route: 'properties.index' },
    { key: 'occupiedUnits', label: 'Occupied units', icon: Users, color: 'bg-violet-50 text-violet-700', route: 'tenants.index' },
    { key: 'availableUnits', label: 'Available units', icon: Home, color: 'bg-amber-50 text-amber-700', route: 'properties.index' },
];

const imageSource = (path) => {
    if (!path) return null;
    return /^https?:\/\//i.test(path) ? path : `/storage/${path}`;
};

const localeForLanguage = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';

const formatDate = (value, language) => {
    if (!value) return '—';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);

    return Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat(localeForLanguage(language), { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

function VisitorInquiries({ inquiries }) {
    const { t } = useTranslation();

    return (
        <div id="visitor-inquiries" className="mt-5 scroll-mt-20 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h2 className="font-[Sora] font-semibold text-gray-900">{t('Visitor inquiries')}</h2>
                    <p className="mt-1 text-xs text-gray-500">{t('Contact the visitor, then mark the inquiry as read to allow a new inquiry for this property.')}</p>
                </div>
                <MessageSquare size={18} className="text-[#D9A441]" />
            </div>
            {inquiries.length ? (
                <div className="divide-y divide-gray-100">
                    {inquiries.map(inquiry => {
                        const replyText = `Hello ${inquiry.visitor_name}, regarding your inquiry about ${inquiry.property?.name}${inquiry.unit?.unit_number ? `, unit ${inquiry.unit.unit_number}` : ''}.`;

                        return (
                            <div key={inquiry.id} className="py-4 first:pt-0">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">{inquiry.visitor_name}</p>
                                        <p className="text-xs text-gray-500">{inquiry.property?.name} · {t('Unit')} {inquiry.unit?.unit_number || '—'}</p>
                                        {inquiry.owner?.name && <p className="mt-1 text-xs text-gray-400">{t('Owner')}: {inquiry.owner.name}</p>}
                                    </div>
                                    <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-bold uppercase ${inquiry.status === 'read' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                        {t(inquiry.status === 'new' ? 'New' : inquiry.status)}
                                    </span>
                                </div>
                                <p className="mt-2 text-sm text-gray-600">{inquiry.message}</p>
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                                    <a href={`tel:${inquiry.visitor_phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 font-semibold text-gray-700 transition hover:border-[#0E3B2E] hover:bg-emerald-50"><Phone size={13} /> {t('Call')}</a>
                                    <a href={`sms:${inquiry.visitor_phone}?body=${encodeURIComponent(replyText)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 font-semibold text-gray-700 transition hover:border-[#0E3B2E] hover:bg-emerald-50"><MessageSquare size={13} /> {t('SMS visitor')}</a>
                                    {inquiry.visitor_email && <a href={`mailto:${inquiry.visitor_email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 font-semibold text-gray-700 transition hover:border-[#0E3B2E] hover:bg-emerald-50"><Mail size={13} /> {t('Email')}</a>}
                                </div>
                                {inquiry.status !== 'read' && (
                                    <button type="button" onClick={() => router.post(route('inquiries.read', inquiry.id), {}, { preserveScroll: true })} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#0E3B2E] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0a2e23]">
                                        <CheckCircle2 size={14} /> {t('Mark as read')}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : <p className="py-4 text-sm text-gray-500">{t('No visitor inquiries yet.')}</p>}
        </div>
    );
}

function AdminDashboard({ overview, inquiries, user, language }) {
    const { t } = useTranslation();
    const locale = localeForLanguage(language);
    const dateLabel = new Intl.DateTimeFormat(localeForLanguage(language), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(new Date());
    const metrics = [
        { label: 'Platform accounts', value: overview.totalAccounts, detail: t(':count owner accounts', { count: overview.totalOwners }), icon: UsersRound, tone: 'bg-blue-50 text-blue-700' },
        { label: 'Awaiting approval', value: overview.pendingApprovals, detail: t('Complete profiles ready for review'), icon: Clock3, tone: 'bg-amber-50 text-amber-700', href: route('admin.approvals'), urgent: overview.pendingApprovals > 0 },
        { label: 'Active subscriptions', value: overview.activeSubscriptions, detail: t(':count expired accounts', { count: overview.expiredSubscriptions }), icon: BadgeCheck, tone: 'bg-emerald-50 text-emerald-700' },
        { label: 'New owners this month', value: overview.newOwnersThisMonth, detail: t('Out of :count registered owners', { count: overview.totalOwners }), icon: CalendarDays, tone: 'bg-violet-50 text-violet-700' },
    ];
    const managementCards = [
        { title: 'Owner accounts', description: 'Manage owner profiles, subscriptions, and account access.', href: route('admin.users'), icon: UsersRound, count: overview.totalOwners, tone: 'bg-blue-50 text-blue-700' },
        { title: 'Approval queue', description: 'Review complete profiles and approve eligible owners.', href: route('admin.approvals'), icon: ShieldCheck, count: overview.pendingApprovals, tone: 'bg-amber-50 text-amber-700', attention: overview.pendingApprovals > 0 },
        { title: 'Properties & units', description: 'Manage properties and units across all owner portfolios.', href: route('properties.index'), icon: Building2, count: overview.properties, detail: t(':count units', { count: overview.units }), tone: 'bg-emerald-50 text-emerald-700' },
        { title: 'Tenants', description: 'View and manage tenants across the platform.', href: route('tenants.index'), icon: Users, count: overview.tenants, tone: 'bg-violet-50 text-violet-700' },
        { title: 'Lease records', description: 'Review lease documents and tenancy records.', href: route('leases.index'), icon: FileText, count: overview.leases, tone: 'bg-cyan-50 text-cyan-700' },
        { title: 'Payments', description: 'Review payment history and owner collections.', href: route('payments.index'), icon: CreditCard, count: overview.payments, tone: 'bg-indigo-50 text-indigo-700' },
        { title: 'Manage inquiries', description: 'Contact visitors by SMS, email, or phone and track inquiry status.', href: `${route('dashboard')}#visitor-inquiries`, icon: MessageSquare, count: overview.newInquiries, tone: 'bg-amber-50 text-amber-700', attention: overview.newInquiries > 0 },
        { title: 'Platform reports', description: 'View financial and portfolio reports across all owners.', href: route('reports.index'), icon: BarChart3, tone: 'bg-rose-50 text-rose-700' },
    ];
    const monthLabel = value => new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(`${value}-01T12:00:00`));
    const moneyLabel = value => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    const maxRent = Math.max(1, ...overview.rentCollections.map(item => Number(item.amount)));
    const maxOwnerGrowth = Math.max(1, ...overview.ownerGrowth.map(item => Number(item.count)));
    const unitTotal = overview.occupancy.occupied + overview.occupancy.available + overview.occupancy.maintenance;
    const occupancyRate = unitTotal ? Math.round((overview.occupancy.occupied / unitTotal) * 100) : 0;
    const circumference = 2 * Math.PI * 42;
    const occupiedArc = unitTotal ? (overview.occupancy.occupied / unitTotal) * circumference : 0;
    const availableArc = unitTotal ? (overview.occupancy.available / unitTotal) * circumference : 0;
    const maintenanceArc = unitTotal ? (overview.occupancy.maintenance / unitTotal) * circumference : 0;
    const subscriptionStatuses = [
        { label: 'Active subscriptions', value: overview.activeSubscriptions, color: 'bg-emerald-500' },
        { label: 'Expired subscriptions', value: overview.expiredSubscriptions, color: 'bg-rose-500' },
        { label: 'Awaiting approval', value: overview.pendingApprovals, color: 'bg-amber-400' },
        { label: 'Rejected applications', value: overview.rejectedOwners, color: 'bg-slate-400' },
    ];
    const subscriptionTotal = subscriptionStatuses.reduce((sum, item) => sum + Number(item.value || 0), 0);

    return (
        <AuthenticatedLayout header="Admin control center">
            <Head title={t('Admin control center')} />
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="relative overflow-hidden rounded-3xl bg-[#102b27] px-6 py-7 text-white shadow-xl shadow-emerald-950/10 sm:px-8 sm:py-9">
                    <div className="pointer-events-none absolute -right-10 -top-24 h-72 w-72 rounded-full border border-white/10" />
                    <div className="pointer-events-none absolute -right-1 top-2 h-48 w-48 rounded-full border border-[#D9A441]/20" />
                    <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
                                <ShieldCheck size={14} />
                                {t('Platform administration')}
                            </div>
                            <h1 className="mt-5 font-[Sora] text-3xl font-bold tracking-tight sm:text-4xl">
                                {t('Welcome back, :name', { name: user.name?.split(' ')[0] })}
                            </h1>
                            <p className="mt-2 text-sm leading-6 text-white/65 sm:text-base">
                                {t('Your overview of owners, approvals, subscriptions, and platform activity.')}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white/75">
                                <CalendarDays size={16} className="text-[#D9A441]" />
                                {dateLabel}
                            </span>
                            <Link href={route('admin.users')} className="inline-flex items-center gap-2 rounded-xl bg-[#D9A441] px-4 py-2.5 text-sm font-bold text-[#18342d] transition hover:bg-amber-300">
                                <UsersRound size={16} />
                                {t('Manage accounts')}
                            </Link>
                        </div>
                    </div>
                    <div className="relative mt-7 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-sm text-white/65">
                        <span className="inline-flex items-center gap-2"><Building2 size={15} className="text-emerald-300" />{t(':count properties', { count: overview.properties })}</span>
                        <span className="inline-flex items-center gap-2"><DoorOpen size={15} className="text-emerald-300" />{t(':count units', { count: overview.units })}</span>
                        <span className="inline-flex items-center gap-2"><MessageSquare size={15} className="text-emerald-300" />{t(':count new inquiries', { count: overview.newInquiries })}</span>
                    </div>
                </section>

                <section aria-label={t('Platform overview')} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {metrics.map(({ label, value, detail, icon: Icon, tone, href, urgent }) => {
                        const cardClassName = `group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${urgent ? 'border-amber-200 ring-1 ring-amber-100' : 'border-gray-100'}`;
                        const content = (
                            <>
                                <div className="flex items-start justify-between gap-3">
                                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}><Icon size={20} /></div>
                                    {href && <ArrowUpRight size={17} className="text-gray-300 transition group-hover:text-[#0E3B2E]" />}
                                </div>
                                <p className="mt-5 font-[Sora] text-3xl font-bold tracking-tight text-gray-900">{Number(value || 0).toLocaleString()}</p>
                                <p className="mt-1 text-sm font-semibold text-gray-700">{t(label)}</p>
                                <p className="mt-1 text-xs text-gray-500">{detail}</p>
                            </>
                        );

                        return (
                            href
                                ? <Link key={label} href={href} className={cardClassName}>{content}</Link>
                                : <div key={label} className={cardClassName}>{content}</div>
                        );
                    })}
                </section>

                <section aria-label={t('Platform analytics')} className="grid gap-5 xl:grid-cols-2">
                    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><TrendingUp size={17} className="text-emerald-700" />{t('Rent collected')}</div>
                                <p className="mt-1 text-xs text-gray-500">{t('Monthly platform rent collections · last six months')}</p>
                            </div>
                            <Link href={route('reports.index')} className="text-xs font-semibold text-[#0E3B2E] hover:underline">{t('View reports')}</Link>
                        </div>
                        <div className="mt-5 grid grid-cols-6 items-end gap-2 sm:gap-4">
                            {overview.rentCollections.map(item => {
                                const amount = Number(item.amount || 0);
                                const height = amount ? Math.max(8, (amount / maxRent) * 120) : 4;
                                return (
                                    <div key={item.month} className="flex min-w-0 flex-col items-center gap-2">
                                        <span className="max-w-full truncate text-center text-[10px] font-medium text-gray-500">{amount ? moneyLabel(amount) : '—'}</span>
                                        <div className="flex h-32 w-full items-end justify-center rounded-t-lg bg-gray-50">
                                            <div className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-[#0E3B2E] to-emerald-500 transition-all" style={{ height: `${height}px` }} title={`${monthLabel(item.month)}: ${moneyLabel(amount)}`} />
                                        </div>
                                        <span className="text-[11px] font-medium text-gray-500">{monthLabel(item.month)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </article>

                    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Building2 size={17} className="text-emerald-700" />{t('Platform occupancy')}</div>
                                <p className="mt-1 text-xs text-gray-500">{t('Unit status across all owner properties')}</p>
                            </div>
                            <Link href={route('properties.index')} className="text-xs font-semibold text-[#0E3B2E] hover:underline">{t('View properties')}</Link>
                        </div>
                        <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
                            <div className="relative h-40 w-40 shrink-0">
                                <svg viewBox="0 0 112 112" role="img" aria-label={t('Platform occupancy: :rate% occupied', { rate: occupancyRate })} className="h-full w-full -rotate-90">
                                    <circle cx="56" cy="56" r="42" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                                    {occupiedArc > 0 && <circle cx="56" cy="56" r="42" fill="none" stroke="#0E3B2E" strokeWidth="12" strokeDasharray={`${occupiedArc} ${circumference - occupiedArc}`} />}
                                    {availableArc > 0 && <circle cx="56" cy="56" r="42" fill="none" stroke="#D9A441" strokeWidth="12" strokeDasharray={`${availableArc} ${circumference - availableArc}`} strokeDashoffset={-occupiedArc} />}
                                    {maintenanceArc > 0 && <circle cx="56" cy="56" r="42" fill="none" stroke="#94a3b8" strokeWidth="12" strokeDasharray={`${maintenanceArc} ${circumference - maintenanceArc}`} strokeDashoffset={-(occupiedArc + availableArc)} />}
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="font-[Sora] text-3xl font-bold text-gray-900">{occupancyRate}%</span>
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{t('Occupied')}</span>
                                </div>
                            </div>
                            <div className="grid w-full gap-3 sm:max-w-xs">
                                {[
                                    ['Occupied', overview.occupancy.occupied, 'bg-[#0E3B2E]'],
                                    ['Available', overview.occupancy.available, 'bg-[#D9A441]'],
                                    ['Maintenance', overview.occupancy.maintenance, 'bg-slate-400'],
                                ].map(([label, value, color]) => (
                                    <div key={label} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                                        <span className="flex items-center gap-2 text-sm text-gray-600"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{t(label)}</span>
                                        <span className="font-[Sora] text-sm font-bold text-gray-900">{Number(value).toLocaleString()}</span>
                                    </div>
                                ))}
                                <p className="text-center text-xs text-gray-400">{t(':count total units across the platform', { count: unitTotal })}</p>
                            </div>
                        </div>
                    </article>

                    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><BarChart3 size={17} className="text-violet-700" />{t('Owner growth')}</div>
                                <p className="mt-1 text-xs text-gray-500">{t('New owner accounts registered each month')}</p>
                            </div>
                            <Link href={route('admin.users')} className="text-xs font-semibold text-[#0E3B2E] hover:underline">{t('All accounts')}</Link>
                        </div>
                        <div className="mt-5 grid grid-cols-6 items-end gap-2 sm:gap-4">
                            {overview.ownerGrowth.map(item => {
                                const count = Number(item.count || 0);
                                const height = count ? Math.max(8, (count / maxOwnerGrowth) * 120) : 4;
                                return (
                                    <div key={item.month} className="flex min-w-0 flex-col items-center gap-2">
                                        <span className="text-xs font-semibold text-gray-600">{count}</span>
                                        <div className="flex h-32 w-full items-end justify-center rounded-t-lg bg-violet-50">
                                            <div className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-violet-700 to-violet-400 transition-all" style={{ height: `${height}px` }} title={`${monthLabel(item.month)}: ${count}`} />
                                        </div>
                                        <span className="text-[11px] font-medium text-gray-500">{monthLabel(item.month)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </article>

                    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900"><ShieldCheck size={17} className="text-amber-700" />{t('Approval & subscription status')}</div>
                                <p className="mt-1 text-xs text-gray-500">{t('Owner account status across the platform')}</p>
                            </div>
                            <Link href={route('admin.approvals')} className="text-xs font-semibold text-[#0E3B2E] hover:underline">{t('Review approvals')}</Link>
                        </div>
                        <div className="mt-6 space-y-5">
                            {subscriptionStatuses.map(item => (
                                <div key={item.label}>
                                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                                        <span className="font-medium text-gray-600">{t(item.label)}</span>
                                        <span className="font-bold tabular-nums text-gray-800">{Number(item.value || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                                        <div className={`h-full rounded-full ${item.color} transition-all`} style={{ width: `${subscriptionTotal ? (Number(item.value || 0) / subscriptionTotal) * 100 : 0}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </article>
                </section>

                <section>
                    <div className="mb-4">
                        <h2 className="font-[Sora] text-lg font-semibold text-gray-900">{t('Platform management')}</h2>
                        <p className="mt-1 text-sm text-gray-500">{t('Open any area to manage records across all owners, or filter by owner.')}</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {managementCards.map(({ title, description, href, icon: Icon, count, detail, tone, attention }) => (
                            <Link key={title} href={href} className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#0E3B2E]/20 hover:shadow-md">
                                <div className="flex items-start justify-between gap-3">
                                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}><Icon size={20} /></span>
                                    {count !== undefined && <span className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${attention ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>{Number(count).toLocaleString()}</span>}
                                </div>
                                <h3 className="mt-4 font-[Sora] text-base font-semibold text-gray-900 group-hover:text-[#0E3B2E]">{t(title)}</h3>
                                <p className="mt-1 min-h-10 text-sm leading-5 text-gray-500">{t(description)}</p>
                                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs font-semibold text-[#0E3B2E]">
                                    <span>{detail || t('Open management')}</span>
                                    <ArrowUpRight size={16} className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
                <VisitorInquiries inquiries={inquiries} />
            </div>
        </AuthenticatedLayout>
    );
}

export default function Dashboard({ summary, recentProperties = [], recentTenancies = [], recentInquiries = [], adminOverview }) {
    const { auth } = usePage().props;
    const { t, language } = useTranslation();
    const user = auth.user;
    const [modalDismissed, setModalDismissed] = useState(false);
    const isAdmin = user.role === 'admin';
    const isExpired = !isAdmin && user.expires_at && new Date(user.expires_at) < new Date();

    if (isExpired) {
        return <AuthenticatedLayout header="Dashboard"><Head title={t('Dashboard')} /><div className="mx-auto max-w-lg rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50"><CalendarX size={30} className="text-red-500" /></div><h2 className="mt-4 font-[Sora] text-xl font-bold text-gray-800">{t('Your account has expired')}</h2><p className="mt-2 text-sm text-gray-500">{t('Your subscription ended on :date. Please contact support to renew access.', { date: formatDate(user.expires_at, language) })}</p></div></AuthenticatedLayout>;
    }
    if (!user.profile_completed && !modalDismissed) {
        return <AuthenticatedLayout header="Dashboard"><Head title={t('Dashboard')} /><CompleteProfileModal onDone={() => setModalDismissed(true)} /></AuthenticatedLayout>;
    }
    if (isAdmin) {
        return <AdminDashboard overview={adminOverview} inquiries={recentInquiries} user={user} language={language} />;
    }

    return (
        <AuthenticatedLayout header="Dashboard">
            <Head title={t('Dashboard')} />
            <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div><p className="text-sm font-medium text-[#D9A441]">{t('Overview')}</p><h1 className="mt-1 font-[Sora] text-2xl font-bold text-gray-900">{t('Good to see you, :name', { name: user.name?.split(' ')[0] })}</h1><p className="mt-1 text-sm text-gray-500">{t('Here’s what’s happening across your portfolio.')}</p></div>
                <Link href={route('properties.create')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0a2e23]"><Plus size={16} /> {t('Add property')}</Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map(({ key, label, icon: Icon, color, route: destination }) => (
                    <Link key={key} href={route(destination)} className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#0E3B2E]/20 hover:shadow-md">
                        <div className="flex items-center justify-between">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon size={19} /></div>
                            <ArrowUpRight size={17} className="text-gray-400 transition group-hover:text-[#0E3B2E]" />
                        </div>
                        <p className="mt-4 font-[Sora] text-2xl font-bold text-gray-900">{summary?.[key] ?? 0}</p>
                        <p className="mt-1 text-sm text-gray-500">{t(label)}</p>
                    </Link>
                ))}
            </div>

            <div id="portfolio-summary" className="mt-5 grid scroll-mt-20 gap-5 lg:grid-cols-3">
                <Link href={route('properties.index')} className="rounded-2xl bg-[#0E3B2E] p-6 text-white shadow-sm transition hover:bg-[#0b3328] lg:col-span-1">
                    <div className="flex items-center gap-2 text-white/70"><Activity size={17} /><span className="text-sm">{t('Portfolio occupancy')}</span></div>
                    <div className="mt-5 flex items-end gap-2"><span className="font-[Sora] text-4xl font-bold">{summary?.occupancyRate ?? 0}%</span><span className="mb-1 text-sm text-white/60">{t('occupied')}</span></div>
                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#D9A441]" style={{ width: `${summary?.occupancyRate ?? 0}%` }} /></div>
                    <p className="mt-3 text-xs text-white/60">{t(':available available · :maintenance under maintenance', { available: summary?.availableUnits ?? 0, maintenance: summary?.maintenanceUnits ?? 0 })}</p>
                </Link>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
                    <div className="mb-4 flex items-center justify-between"><h2 className="font-[Sora] font-semibold text-gray-900">{t('Recent properties')}</h2><Link href={route('properties.index')} className="text-sm font-medium text-[#0E3B2E] hover:underline">{t('View all')}</Link></div>
                    {recentProperties.length ? <div className="grid gap-3 sm:grid-cols-2">{recentProperties.map(property => {
                        const coverPath = property.images?.find(img => img.is_cover)?.image_path || property.images?.[0]?.image_path;
                        return (
                            <Link key={property.id} href={route('properties.show', property.id)} className="flex items-center justify-between rounded-xl border border-gray-100 p-3 hover:border-[#D9A441]">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#0E3B2E]/5">
                                        {coverPath ? (
                                            <img
                                                src={imageSource(coverPath)}
                                                alt={property.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <Building2 size={17} className="text-[#0E3B2E]" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-gray-800">{property.name}</p>
                                        <p className="text-xs text-gray-500">{property.units_count ?? 0} units · {property.occupied_units_count ?? 0} occupied</p>
                                    </div>
                                </div>
                                <ArrowUpRight size={15} className="text-gray-400" />
                            </Link>
                        );
                    })}</div> : <div className="rounded-xl bg-gray-50 p-6 text-center"><p className="text-sm text-gray-500">{t('No properties yet.')}</p><Link href={route('properties.create')} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#0E3B2E]"><Plus size={14} /> {t('Add your first property')}</Link></div>}
                </div>
            </div>

            <section className="mt-5 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-6">
                    <div><h2 className="font-[Sora] font-semibold text-gray-900">{t('Tenants & active leases')}</h2><p className="mt-1 text-xs text-gray-500">{t('Current occupants, lease terms, and direct tenant records.')}</p></div>
                    <Link href={route('tenants.index')} className="text-sm font-medium text-[#0E3B2E] hover:underline">{t('Open tenant directory')}</Link>
                </div>
                {recentTenancies.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-sm">
                            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-6 py-3 font-semibold">{t('Tenant')}</th><th className="px-6 py-3 font-semibold">{t('Property / unit')}</th><th className="px-6 py-3 font-semibold">{t('Lease term')}</th><th className="px-6 py-3 font-semibold">{t('Rent')}</th><th className="px-6 py-3 font-semibold">{t('Status')}</th><th className="px-6 py-3 font-semibold">{t('Details')}</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentTenancies.map(tenancy => (
                                    <tr key={tenancy.id} className="transition hover:bg-gray-50/70">
                                        <td className="px-6 py-4"><Link href={route('tenants.show', tenancy.tenant?.id)} className="font-semibold text-gray-900 hover:text-[#0E3B2E] hover:underline">{tenancy.tenant?.name || t('Tenant')}</Link><p className="mt-1 text-xs text-gray-500">{tenancy.tenant?.phone || tenancy.tenant?.email || '—'}</p></td>
                                        <td className="px-6 py-4"><p className="font-medium text-gray-800">{tenancy.unit?.property?.name || t('Property')}</p><p className="mt-1 text-xs text-gray-500">{t('Unit')} {tenancy.unit?.unit_number || '—'}</p></td>
                                        <td className="px-6 py-4 text-xs text-gray-600">{formatDate(tenancy.start_date, language)} – {tenancy.end_date ? formatDate(tenancy.end_date, language) : t('Ongoing')}</td>
                                        <td className="px-6 py-4 font-medium text-gray-800">{Number(tenancy.monthly_rent || 0).toLocaleString()} RWF <span className="text-xs font-normal text-gray-500">/{tenancy.rent_frequency || 'monthly'}</span></td>
                                        <td className="px-6 py-4"><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={13} /> {t('Active')}</span></td>
                                        <td className="px-6 py-4"><Link href={route('properties.units.show', [tenancy.unit?.property_id, tenancy.unit?.id])} className="inline-flex items-center gap-1 font-medium text-[#0E3B2E] hover:underline">{t('Open unit')} <ArrowUpRight size={14} /></Link></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <p className="p-6 text-sm text-gray-500">{t('No active tenants yet. Add a lease from a unit or assign a tenant from the tenant directory.')}</p>}
            </section>
            <VisitorInquiries inquiries={recentInquiries} />
        </AuthenticatedLayout>
    );
}
