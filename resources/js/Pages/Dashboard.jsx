import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Activity, ArrowUpRight, BadgeCheck, BarChart3, Building2, CalendarDays, CalendarX,
    CheckCircle2, Clock3, CreditCard, DoorOpen, FileText, Home, Mail, MessageSquare,
    Phone, Plus, ShieldCheck, TrendingUp, Users, UsersRound, X,
} from 'lucide-react';
import UserAvatar from '@/Components/UserAvatar';
import useCanEdit from '@/hooks/useCanEdit';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/localization';

const imageSource = (path) => {
    if (!path) return null;
    return /^https?:\/\//i.test(path) ? path : `/storage/${path}`;
};

const localeForLanguage = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';

/** Animates a number from 0 up to its value; jumps straight there for reduced motion. */
function useCountUp(value, duration = 700) {
    const target = Number(value) || 0;
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || target === 0) {
            setCurrent(target);
            return undefined;
        }

        let frame;
        const start = performance.now();
        const tick = (now) => {
            const progress = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCurrent(Math.round(target * eased));
            if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(frame);
    }, [target, duration]);

    return current;
}

function CountUp({ value }) {
    return <>{useCountUp(value).toLocaleString()}</>;
}

const greetingFor = (hour) => (hour < 12 ? 'Good morning, :name' : hour < 18 ? 'Good afternoon, :name' : 'Good evening, :name');

/** Ring chart of occupied / available / maintenance units. */
function OccupancyRing({ occupied = 0, available = 0, maintenance = 0, label }) {
    const total = occupied + available + maintenance;
    const rate = total ? Math.round((occupied / total) * 100) : 0;
    const circumference = 2 * Math.PI * 42;
    const arcs = [
        [occupied, '#0E3B2E'],
        [available, '#D9A441'],
        [maintenance, '#94a3b8'],
    ];
    let offset = 0;

    return (
        <div className="relative h-36 w-36 shrink-0">
            <svg viewBox="0 0 112 112" role="img" aria-label={label} className="h-full w-full -rotate-90">
                <circle cx="56" cy="56" r="42" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                {arcs.map(([value, color]) => {
                    if (!total || !value) return null;
                    const length = (value / total) * circumference;
                    const arc = (
                        <circle
                            key={color}
                            cx="56"
                            cy="56"
                            r="42"
                            fill="none"
                            stroke={color}
                            strokeWidth="12"
                            strokeLinecap="butt"
                            strokeDasharray={`${length} ${circumference - length}`}
                            strokeDashoffset={-offset}
                            className="transition-all duration-700"
                        />
                    );
                    offset += length;
                    return arc;
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-[Sora] text-3xl font-bold text-gray-900"><CountUp value={rate} />%</span>
            </div>
        </div>
    );
}

const formatDate = (value, language) => {
    if (!value) return '—';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);

    return Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat(localeForLanguage(language), { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

function VisitorInquiries({ inquiries }) {
    const { t, language } = useTranslation();
    const canEdit = useCanEdit();
    const [replies, setReplies] = useState({});
    const [selectedInquiryId, setSelectedInquiryId] = useState(null);
    const selectedInquiry = inquiries.find(inquiry => inquiry.id === selectedInquiryId);
    const selectedReply = selectedInquiry
        ? replies[selectedInquiry.id] ?? selectedInquiry.response_message ?? ''
        : '';
    const phone = (selectedInquiry?.visitor_phone || '').replace(/\D/g, '');
    const whatsappPhone = phone.startsWith('00')
        ? phone.slice(2)
        : phone.startsWith('0')
            ? `250${phone.slice(1)}`
            : phone.length === 9
                ? `250${phone}`
                : phone;
    const validWhatsAppPhone = whatsappPhone.length >= 7 && whatsappPhone.length <= 15;
    const whatsappHref = validWhatsAppPhone && selectedReply.trim()
        ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(selectedReply.trim())}`
        : null;

    const prepareWhatsAppReply = () => {
        router.post(route('inquiries.read', selectedInquiry.id), {
            reply_message: selectedReply.trim(),
        }, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const markSelectedInquiryRead = () => {
        router.post(route('inquiries.read', selectedInquiry.id), {}, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    return (
        <div id="visitor-inquiries" className="mt-5 scroll-mt-20 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h2 className="font-[Sora] font-semibold text-gray-900">{t('Visitor inquiries')}</h2>
                    <p className="mt-1 text-xs text-gray-500">{t('Review visitor questions and reply directly to visitors about your properties.')}</p>
                </div>
                <MessageSquare size={18} className="text-[#D9A441]" />
            </div>
            {inquiries.length ? (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full min-w-[680px] divide-y divide-gray-100 text-left">
                        <thead className="bg-slate-50">
                            <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                <th className="px-4 py-3">{t('Visitor')}</th>
                                <th className="px-4 py-3">{t('Property / unit')}</th>
                                <th className="px-4 py-3">{t('Inquiry')}</th>
                                <th className="px-4 py-3">{t('Status')}</th>
                                <th className="px-4 py-3">{t('Received')}</th>
                                <th className="px-4 py-3"><span className="sr-only">{t('View inquiry')}</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {inquiries.map(inquiry => (
                                <tr key={inquiry.id} className="transition hover:bg-slate-50/80">
                                    <td className="px-4 py-3">
                                        <button type="button" onClick={() => setSelectedInquiryId(inquiry.id)} className="text-left">
                                            <span className="block text-sm font-semibold text-gray-800 hover:text-[#0E3B2E]">{inquiry.visitor_name}</span>
                                            <span className="mt-0.5 block text-xs text-gray-500">{inquiry.visitor_email || inquiry.visitor_phone}</span>
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-600">
                                        <span className="block font-semibold text-gray-800">{inquiry.property?.name || '—'}</span>
                                        <span className="mt-0.5 block">{t('Unit')} {inquiry.unit?.unit_number || '—'}</span>
                                    </td>
                                    <td className="max-w-xs px-4 py-3 text-xs text-gray-600">
                                        <p className="line-clamp-2">{inquiry.message}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${inquiry.status === 'read' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                            {t(inquiry.status === 'new' ? 'New' : inquiry.status)}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                                        {formatDate(inquiry.created_at, language)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button type="button" onClick={() => setSelectedInquiryId(inquiry.id)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#0E3B2E] hover:bg-emerald-50">
                                            {t('View')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : <p className="py-4 text-sm text-gray-500">{t('No visitor inquiries yet.')}</p>}

            {selectedInquiry && (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setSelectedInquiryId(null);
                    }}
                >
                    <section
                        className="my-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="visitor-inquiry-dialog-title"
                    >
                        <header className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a4772f]">{t('Visitor inquiry')}</p>
                                <h3 id="visitor-inquiry-dialog-title" className="mt-1 font-[Sora] text-lg font-semibold text-gray-900">{selectedInquiry.visitor_name}</h3>
                                <p className="mt-1 text-xs text-gray-500">{selectedInquiry.property?.name} · {t('Unit')} {selectedInquiry.unit?.unit_number || '—'}</p>
                            </div>
                            <button type="button" onClick={() => setSelectedInquiryId(null)} aria-label={t('Close')} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                                <X size={18} />
                            </button>
                        </header>
                        <div className="max-h-[min(70vh,620px)] space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
                            <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
                                <div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{t('Email')}</p><p className="mt-1 break-all text-gray-700">{selectedInquiry.visitor_email || '—'}</p></div>
                                <div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{t('Phone')}</p><p className="mt-1 text-gray-700">{selectedInquiry.visitor_phone || '—'}</p></div>
                                {selectedInquiry.owner?.name && <div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{t('Owner')}</p><p className="mt-1 text-gray-700">{selectedInquiry.owner.name}</p></div>}
                                <div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{t('Received')}</p><p className="mt-1 text-gray-700">{formatDate(selectedInquiry.created_at, language)}</p></div>
                            </div>
                            <div className="rounded-xl border border-gray-100 p-4">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{t('Visitor inquiry')}</p>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{selectedInquiry.message}</p>
                            </div>
                            {canEdit && (<>
                            <label className="block text-sm font-semibold text-gray-800" htmlFor={`inquiry-reply-${selectedInquiry.id}`}>
                                {t('Your reply')}
                                <textarea
                                    id={`inquiry-reply-${selectedInquiry.id}`}
                                    value={selectedReply}
                                    onChange={(event) => setReplies(current => ({ ...current, [selectedInquiry.id]: event.target.value }))}
                                    rows={4}
                                    maxLength={2000}
                                    placeholder={t('Write a reply to the visitor...')}
                                    className="mt-2 w-full resize-y rounded-xl border-gray-200 text-sm font-normal text-gray-800 shadow-sm placeholder:text-gray-400 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]"
                                />
                            </label>
                            {selectedInquiry.response_message && (
                                <p className="text-xs text-gray-500">{t('Your last reply is saved here so you can reuse or edit it.')}</p>
                            )}
                            <p className="text-xs leading-5 text-gray-500">{t('WhatsApp opens outside Ituze. The inquiry is marked as read and this reply is saved when you open WhatsApp; Ituze cannot confirm delivery or retrieve the visitor’s reply.')}</p>
                            </>)}
                            {!canEdit && (
                                <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-950">{t('ITUZE GREEN PLATFORM answers visitor inquiries for your properties.')}</p>
                            )}
                        </div>
                        <footer className="flex flex-wrap justify-end gap-2 border-t border-gray-100 bg-slate-50/70 px-5 py-4 sm:px-6">
                            {canEdit && selectedInquiry.status !== 'read' && (
                                <button type="button" onClick={markSelectedInquiryRead} className="mr-auto inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                                    <CheckCircle2 size={14} /> {t('Mark as read')}
                                </button>
                            )}
                            {!canEdit ? null : whatsappHref ? (
                                <a href={whatsappHref} target="_blank" rel="noreferrer" onClick={prepareWhatsAppReply} className="inline-flex items-center gap-2 rounded-lg bg-[#168447] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#116c39]">
                                    <MessageSquare size={15} /> {t('Reply via WhatsApp')}
                                </a>
                            ) : (
                                <button type="button" disabled className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-500" title={!validWhatsAppPhone ? t('Visitor phone number is unavailable.') : t('Write a reply before opening WhatsApp.')}>
                                    <MessageSquare size={15} /> {t('Reply via WhatsApp')}
                                </button>
                            )}
                            <button type="button" onClick={() => setSelectedInquiryId(null)} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                                {t('Close')}
                            </button>
                        </footer>
                    </section>
                </div>
            )}
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
        { title: 'Visitor inquiries', description: 'Review visitor requests and reply about listed properties.', href: `${route('dashboard')}#visitor-inquiries`, icon: MessageSquare, count: overview.newInquiries, tone: 'bg-amber-50 text-amber-700', attention: overview.newInquiries > 0 },
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
                            <div className="mt-5 flex items-center gap-4">
                                <Link href={route('profile.edit')} className="shrink-0 rounded-full" title={t('Edit profile')}>
                                    <UserAvatar user={user} size="lg" className="ring-4 ring-white/15 transition hover:scale-[1.03]" />
                                </Link>
                                <h1 className="font-[Sora] text-3xl font-bold tracking-tight sm:text-4xl">
                                    {t('Welcome back, :name', { name: user.first_name || user.name?.split(' ')[0] })}
                                </h1>
                            </div>
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
                                <p className="mt-5 font-[Sora] text-3xl font-bold tracking-tight text-gray-900"><CountUp value={value} /></p>
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
    const isAdmin = user.role === 'admin';
    const isExpired = !isAdmin && user.expires_at && new Date(user.expires_at) < new Date();

    if (isExpired) {
        return <AuthenticatedLayout header="Dashboard"><Head title={t('Dashboard')} /><div className="mx-auto max-w-lg rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50"><CalendarX size={30} className="text-red-500" /></div><h2 className="mt-4 font-[Sora] text-xl font-bold text-gray-800">{t('Your account has expired')}</h2><p className="mt-2 text-sm text-gray-500">{t('Your subscription ended on :date. Please contact support to renew access.', { date: formatDate(user.expires_at, language) })}</p></div></AuthenticatedLayout>;
    }
    if (isAdmin) {
        return <AdminDashboard overview={adminOverview} inquiries={recentInquiries} user={user} language={language} />;
    }

    const firstName = user.first_name || user.name?.split(' ')[0];
    const today = new Intl.DateTimeFormat(localeForLanguage(language), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    const daysLeft = user.expires_at ? Math.ceil((new Date(user.expires_at) - new Date()) / 86400000) : null;
    const canEdit = useCanEdit();
    const quickActions = [
        ...(canEdit ? [{ label: 'Add property', href: route('properties.create'), icon: Plus, primary: true }] : []),
        { label: 'Tenants', href: route('tenants.index'), icon: UsersRound },
        { label: 'Payments', href: route('payments.index'), icon: CreditCard },
        { label: 'Reports', href: route('reports.index'), icon: BarChart3 },
    ];
    const statCards = [
        { key: 'properties', label: 'Properties', icon: Building2, tone: 'from-emerald-500/15 to-emerald-500/5 text-emerald-700', route: 'properties.index' },
        { key: 'units', label: 'Total units', icon: DoorOpen, tone: 'from-sky-500/15 to-sky-500/5 text-sky-700', route: 'properties.index' },
        { key: 'occupiedUnits', label: 'Occupied units', icon: Users, tone: 'from-violet-500/15 to-violet-500/5 text-violet-700', route: 'tenants.index', of: 'units' },
        { key: 'availableUnits', label: 'Available units', icon: Home, tone: 'from-amber-500/20 to-amber-500/5 text-amber-700', route: 'properties.index', of: 'units' },
    ];

    return (
        <AuthenticatedLayout header="Dashboard">
            <Head title={t('Dashboard')} />
            <div className="mx-auto max-w-7xl space-y-5">
                <section className="relative overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-7">
                    <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#D9A441]/15 blur-3xl" />
                    <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
                    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4 sm:gap-5">
                            <Link href={route('profile.edit')} className="group relative shrink-0 rounded-full" title={t('Edit profile')}>
                                <UserAvatar user={user} size="xl" className="ring-4 ring-white shadow-lg shadow-[#0E3B2E]/15 transition group-hover:scale-[1.03]" />
                                <span className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full bg-emerald-500 ring-[3px] ring-white" aria-hidden="true" />
                            </Link>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b58632]">{today}</p>
                                <h1 className="mt-1 font-[Sora] text-2xl font-bold tracking-[-0.02em] text-gray-900 sm:text-[1.7rem]">
                                    {t(greetingFor(new Date().getHours()), { name: firstName })}
                                </h1>
                                <p className="mt-1 text-sm text-gray-500">{t('Here’s what’s happening across your portfolio.')}</p>
                                {daysLeft !== null && (
                                    <span
                                        className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                                            daysLeft > 30 ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-amber-50 text-amber-700 ring-amber-100'
                                        }`}
                                    >
                                        <BadgeCheck size={13} />
                                        {t('Plan active · :days days left', { days: Math.max(0, daysLeft) })}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
                            {quickActions.map(({ label, href, icon: Icon, primary }) => (
                                <Link
                                    key={label}
                                    href={href}
                                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
                                        primary
                                            ? 'bg-[#0E3B2E] text-white shadow-[0_10px_24px_-12px_rgba(14,59,46,0.8)] hover:bg-[#124B3A]'
                                            : 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-200 hover:bg-white hover:text-[#0E3B2E] hover:ring-[#0E3B2E]/20'
                                    }`}
                                >
                                    <Icon size={16} />
                                    {t(label)}
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label={t('Overview')}>
                    {statCards.map(({ key, label, icon: Icon, tone, route: destination, of }) => {
                        const value = summary?.[key] ?? 0;
                        const total = of ? summary?.[of] ?? 0 : null;
                        return (
                            <Link
                                key={key}
                                href={route(destination)}
                                className="group rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] transition duration-200 hover:-translate-y-0.5 sm:p-5 hover:shadow-md hover:ring-[#0E3B2E]/15"
                            >
                                <div className="flex items-center justify-between">
                                    <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${tone}`}><Icon size={20} /></span>
                                    <ArrowUpRight size={17} className="text-gray-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#0E3B2E]" />
                                </div>
                                <p className="mt-3 font-[Sora] text-2xl font-bold tracking-tight text-gray-900 sm:mt-4 sm:text-3xl"><CountUp value={value} /></p>
                                <p className="mt-1 text-sm font-medium text-gray-500">{t(label)}</p>
                                {total !== null && (
                                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
                                        <div className="h-full rounded-full bg-gradient-to-r from-[#1F7A5A] to-[#D9A441] transition-all duration-700" style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
                                    </div>
                                )}
                            </Link>
                        );
                    })}
                </section>

                <div className="grid gap-5 lg:grid-cols-3">
                    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04]">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="flex items-center gap-2 font-[Sora] font-semibold text-gray-900"><Activity size={17} className="text-[#1F7A5A]" />{t('Portfolio occupancy')}</h2>
                                <p className="mt-1 text-xs text-gray-500">{t('Unit status across your properties')}</p>
                            </div>
                        </div>
                        <div className="mt-5 flex items-center gap-5">
                            <OccupancyRing
                                occupied={summary?.occupiedUnits ?? 0}
                                available={summary?.availableUnits ?? 0}
                                maintenance={summary?.maintenanceUnits ?? 0}
                                label={t('Portfolio occupancy: :rate% occupied', { rate: summary?.occupancyRate ?? 0 })}
                            />
                            <ul className="flex-1 space-y-2.5 text-sm">
                                {[
                                    ['Occupied', summary?.occupiedUnits ?? 0, 'bg-[#0E3B2E]'],
                                    ['Available', summary?.availableUnits ?? 0, 'bg-[#D9A441]'],
                                    ['Maintenance', summary?.maintenanceUnits ?? 0, 'bg-slate-400'],
                                ].map(([label, value, color]) => (
                                    <li key={label} className="flex items-center justify-between gap-2">
                                        <span className="flex items-center gap-2 text-gray-600"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{t(label)}</span>
                                        <span className="font-[Sora] font-bold tabular-nums text-gray-900">{value}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>

                    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04] lg:col-span-2">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="font-[Sora] font-semibold text-gray-900">{t('Recent properties')}</h2>
                            <Link href={route('properties.index')} className="text-sm font-semibold text-[#0E3B2E] hover:underline">{t('View all')}</Link>
                        </div>
                        {recentProperties.length ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {recentProperties.map((property) => {
                                    const coverPath = property.images?.find((img) => img.is_cover)?.image_path || property.images?.[0]?.image_path;
                                    const units = property.units_count ?? 0;
                                    const occupied = property.occupied_units_count ?? 0;
                                    return (
                                        <Link
                                            key={property.id}
                                            href={route('properties.show', property.id)}
                                            className="group flex gap-3 overflow-hidden rounded-xl p-2 ring-1 ring-gray-100 transition hover:ring-[#D9A441]/60 hover:shadow-sm"
                                        >
                                            <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-[#0E3B2E]/10 to-[#D9A441]/10">
                                                {coverPath ? (
                                                    <img src={imageSource(coverPath)} alt={property.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                                                ) : (
                                                    <span className="flex h-full items-center justify-center"><Building2 size={22} className="text-[#0E3B2E]/50" /></span>
                                                )}
                                            </div>
                                            <div className="flex min-w-0 flex-1 flex-col justify-center pr-1">
                                                <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-[#0E3B2E]">{property.name}</p>
                                                <p className="mt-0.5 text-xs text-gray-500">{t(':units units · :occupied occupied', { units, occupied })}</p>
                                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                                                    <div className="h-full rounded-full bg-[#0E3B2E]" style={{ width: `${units ? (occupied / units) * 100 : 0}%` }} />
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                                <Building2 size={26} className="mx-auto text-gray-300" />
                                <p className="mt-2 text-sm text-gray-500">{t('No properties yet.')}</p>
                                {canEdit && <Link href={route('properties.create')} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#0E3B2E] px-3 py-2 text-xs font-semibold text-white hover:bg-[#124B3A]"><Plus size={14} /> {t('Add your first property')}</Link>}
                            </div>
                        )}
                    </section>
                </div>

                <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-6">
                        <div><h2 className="font-[Sora] font-semibold text-gray-900">{t('Tenants & active leases')}</h2><p className="mt-1 text-xs text-gray-500">{t('Current occupants, lease terms, and direct tenant records.')}</p></div>
                        <Link href={route('tenants.index')} className="text-sm font-semibold text-[#0E3B2E] hover:underline">{t('Open tenant directory')}</Link>
                    </div>
                    {recentTenancies.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="bg-gray-50/80 text-[11px] uppercase tracking-wide text-gray-500"><tr><th className="px-6 py-3 font-semibold">{t('Tenant')}</th><th className="px-6 py-3 font-semibold">{t('Property / unit')}</th><th className="px-6 py-3 font-semibold">{t('Lease term')}</th><th className="px-6 py-3 font-semibold">{t('Rent')}</th><th className="px-6 py-3 font-semibold">{t('Status')}</th><th className="px-6 py-3 font-semibold">{t('Details')}</th></tr></thead>
                                <tbody className="divide-y divide-gray-100">
                                    {recentTenancies.map((tenancy) => (
                                        <tr key={tenancy.id} className="transition hover:bg-gray-50/70">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <UserAvatar user={{ name: tenancy.tenant?.name }} size="sm" className="from-[#0E3B2E]/10 to-[#0E3B2E]/5" />
                                                    <div className="min-w-0">
                                                        <Link href={route('tenants.show', tenancy.tenant?.id)} className="font-semibold text-gray-900 hover:text-[#0E3B2E] hover:underline">{tenancy.tenant?.name || t('Tenant')}</Link>
                                                        <p className="mt-0.5 text-xs text-gray-500">{tenancy.tenant?.phone || tenancy.tenant?.email || '—'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4"><p className="font-medium text-gray-800">{tenancy.unit?.property?.name || t('Property')}</p><p className="mt-1 text-xs text-gray-500">{t('Unit')} {tenancy.unit?.unit_number || '—'}</p></td>
                                            <td className="px-6 py-4 text-xs text-gray-600">{formatDate(tenancy.start_date, language)} – {tenancy.end_date ? formatDate(tenancy.end_date, language) : t('Ongoing')}</td>
                                            <td className="px-6 py-4 font-medium text-gray-800">{Number(tenancy.monthly_rent || 0).toLocaleString()} RWF <span className="text-xs font-normal text-gray-500">/{t(tenancy.rent_frequency || 'monthly')}</span></td>
                                            <td className="px-6 py-4"><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={13} /> {t('Active')}</span></td>
                                            <td className="px-6 py-4"><Link href={route('properties.units.show', [tenancy.unit?.property_id, tenancy.unit?.id])} className="inline-flex items-center gap-1 font-semibold text-[#0E3B2E] hover:underline">{t('Open unit')} <ArrowUpRight size={14} /></Link></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <p className="p-6 text-sm text-gray-500">{t('No active tenants yet. Add a lease from a unit or assign a tenant from the tenant directory.')}</p>}
                </section>
                <VisitorInquiries inquiries={recentInquiries} />
            </div>
        </AuthenticatedLayout>
    );
}
