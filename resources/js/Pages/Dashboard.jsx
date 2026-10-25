import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Activity, ArrowUpRight, BadgeCheck, BarChart3, Building2, CalendarDays, CalendarX,
    AlertTriangle, CheckCircle2, Clock3, CreditCard, DoorOpen, Droplets, FileText, Home, Leaf, Mail, MessageSquare,
    Phone, Plus, ShieldCheck, TrendingUp, Users, UsersRound, Wallet, X, Zap,
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

/** Utilities at a glance: green score, alerts and this month against last. */
function UtilityCard({ snapshot, locale }) {
    const { t } = useTranslation();
    if (!snapshot) return null;
    const number = (value) => Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 1 });
    const change = (value) => (value === null || value === undefined ? t('no data last month') : value > 0 ? `+${value}%` : `${value}%`);
    const tone = (value) => (value > 0 ? 'text-red-700' : value < 0 ? 'text-emerald-700' : 'text-gray-600');
    const score = snapshot.score;

    return (
        <section aria-labelledby="utility-card-title" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6">
            <div className="flex items-start justify-between gap-3">
                <h2 id="utility-card-title" className="flex items-center gap-2 font-[Sora] font-semibold text-gray-900"><Leaf size={17} className="text-emerald-700" aria-hidden="true" />{t('Utilities & environment')}</h2>
                <Link href={route('utilities.index')} className="text-sm font-semibold text-[#0E3B2E] hover:underline">{t('Open')}</Link>
            </div>
            <div className="mt-4 flex items-center gap-4">
                <div className="flex h-16 w-16 flex-none flex-col items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-100">
                    <span className="font-[Sora] text-xl font-bold text-[#0E3B2E]">{score ?? '—'}</span>
                    <span className="text-[10px] font-semibold text-emerald-800">/100</span>
                </div>
                <div className="min-w-0 text-sm">
                    <p className="font-semibold text-gray-900">{t('Green score')}</p>
                    {snapshot.alerts > 0 ? (
                        <p className="mt-0.5 flex items-center gap-1.5 font-medium text-amber-800"><AlertTriangle size={14} aria-hidden="true" />{t(':count high-use alerts', { count: snapshot.alerts })}</p>
                    ) : (
                        <p className="mt-0.5 flex items-center gap-1.5 text-emerald-800"><CheckCircle2 size={14} aria-hidden="true" />{t('No unusual use')}</p>
                    )}
                </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {[
                    [Droplets, t('Water'), `${number(snapshot.water.current)} m³`, snapshot.water.change],
                    [Zap, t('Electricity'), `${number(snapshot.electricity.current)} kWh`, snapshot.electricity.change],
                ].map(([Icon, label, value, delta]) => (
                    <div key={label} className="rounded-xl bg-gray-50 p-3">
                        <dt className="flex items-center gap-1.5 text-xs text-gray-600"><Icon size={13} aria-hidden="true" />{label} · {t('this month')}</dt>
                        <dd className="mt-1 font-[Sora] font-bold tabular-nums text-gray-900">{value}</dd>
                        <dd className={`text-xs font-semibold ${tone(delta)}`}>{change(delta)}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

function AdminDashboard({ overview, inquiries, user, language }) {
    const { t } = useTranslation();
    const locale = localeForLanguage(language);
    const [moneyView, setMoneyView] = useState('rent');
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    const short = (value) => (value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${Math.round(value / 1000)}k` : `${Math.round(value)}`);
    const monthLabel = (value, style = 'short') => new Intl.DateTimeFormat(locale, { month: style, ...(style === 'long' ? { year: 'numeric' } : {}) }).format(new Date(`${value}-01T12:00:00`));
    const when = (value) => {
        if (!value) return '';
        const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
        if (minutes < 1) return t('just now');
        if (minutes < 60) return t(':count min ago', { count: minutes });
        if (minutes < 1440) return t(':count h ago', { count: Math.round(minutes / 60) });
        return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(value));
    };
    const firstName = user.first_name || user.name?.split(' ')[0];
    const today = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

    const rent = overview.rentCollections || [];
    const subs = overview.subscriptionCollections || [];
    const ads = overview.adCollections || [];
    const series = moneyView === 'rent' ? rent : moneyView === 'ads' ? ads : subs;
    const seriesMax = Math.max(0, ...series.map((item) => Number(item.amount)));
    const chartMax = Math.max(1, seriesMax);
    const rentNow = Number(rent.at(-1)?.amount || 0);
    const rentBefore = Number(rent.at(-2)?.amount || 0);
    const rentChange = rentBefore > 0 ? Math.round(((rentNow - rentBefore) / rentBefore) * 100) : null;
    const owners = overview.owners || {};
    const subscriptionMoney = overview.subscriptionMoney || {};
    const units = overview.occupancy.occupied + overview.occupancy.available + overview.occupancy.maintenance;
    const occupancy = units ? Math.round((overview.occupancy.occupied / units) * 100) : 0;

    const attention = [
        { count: overview.pendingApprovals, label: overview.pendingApprovals === 1 ? t('owner waiting for approval') : t('owners waiting for approval'), href: route('admin.approvals'), icon: ShieldCheck, tone: 'amber' },
        { count: subscriptionMoney.to_check || 0, label: subscriptionMoney.to_check === 1 ? t('bank slip to check') : t('bank slips to check'), href: route('admin.subscriptions'), icon: Wallet, tone: 'amber' },
        { count: overview.newInquiries, label: overview.newInquiries === 1 ? t('new visitor inquiry') : t('new visitor inquiries'), href: '#visitor-inquiries', icon: MessageSquare, tone: 'sky' },
        { count: overview.leasesExpired || 0, label: overview.leasesExpired === 1 ? t('lease expired, not renewed') : t('leases expired, not renewed'), href: route('leases.index', { status: 'expired' }), icon: CalendarX, tone: 'red' },
        { count: overview.leasesEndingSoon || 0, label: overview.leasesEndingSoon === 1 ? t('lease ending in 60 days') : t('leases ending in 60 days'), href: route('leases.index', { status: 'ending_soon' }), icon: CalendarDays, tone: 'violet' },
    ].filter((item) => Number(item.count) > 0);
    const tones = {
        amber: 'bg-amber-50 text-amber-900 ring-amber-200 hover:bg-amber-100',
        sky: 'bg-sky-50 text-sky-900 ring-sky-200 hover:bg-sky-100',
        red: 'bg-red-50 text-red-800 ring-red-200 hover:bg-red-100',
        violet: 'bg-violet-50 text-violet-900 ring-violet-200 hover:bg-violet-100',
    };

    const ownerSlices = [
        { key: 'managed', label: t('Managed by Q.R.A (10%)'), value: owners.managed || 0, color: '#0E3B2E' },
        { key: 'paying', label: t('Self-registered, paid up'), value: owners.paying || 0, color: '#1F9D6B' },
        { key: 'grace', label: t('Overdue (grace)'), value: owners.grace || 0, color: '#D9A441' },
        { key: 'unpaid', label: t('Not paid / paused'), value: owners.unpaid || 0, color: '#E5484D' },
        { key: 'pending', label: t('Waiting for approval'), value: owners.pending || 0, color: '#94A3B8' },
    ];
    const ownerTotal = ownerSlices.reduce((sum, slice) => sum + slice.value, 0);
    let offset = 0;
    const ring = ownerSlices.map((slice) => {
        const length = ownerTotal ? (slice.value / ownerTotal) * 264 : 0;
        const piece = { ...slice, dash: `${length} ${264 - length}`, offset: -offset };
        offset += length;
        return piece;
    });

    const shortcuts = [
        { label: 'All Users', href: route('admin.users'), icon: UsersRound, count: overview.totalAccounts },
        { label: 'Approvals', href: route('admin.approvals'), icon: ShieldCheck, count: overview.pendingApprovals, alert: overview.pendingApprovals > 0 },
        { label: 'Subscriptions', href: route('admin.subscriptions'), icon: Wallet, count: subscriptionMoney.to_check, alert: subscriptionMoney.to_check > 0 },
        { label: 'Properties', href: route('properties.index'), icon: Building2, count: overview.properties },
        { label: 'Tenants', href: route('tenants.index'), icon: Users, count: overview.tenants },
        { label: 'Leases', href: route('leases.index'), icon: FileText, count: overview.leases },
        { label: 'Payments', href: route('payments.index'), icon: CreditCard, count: overview.payments },
        { label: 'Reports', href: route('reports.index'), icon: BarChart3 },
    ];

    return (
        <AuthenticatedLayout header="Admin control center">
            <Head title={t('Dashboard')} />
            <div className="mx-auto max-w-7xl space-y-5">
                {/* Welcome and today's to-do */}
                <section className="relative animate-fade-in overflow-hidden rounded-3xl bg-gradient-to-br from-white via-white to-emerald-50 p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-7">
                    <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#D9A441]/15 blur-3xl" />
                    <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
                    <div className="relative flex flex-wrap items-start justify-between gap-5">
                        <div className="flex items-center gap-4">
                            <UserAvatar user={user} size="xl" className="ring-4 ring-white shadow-lg shadow-[#0E3B2E]/15" />
                            <div>
                                <p className="inline-flex items-center gap-1.5 rounded-full bg-[#0E3B2E]/[0.06] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0E3B2E]">
                                    <ShieldCheck size={13} aria-hidden="true" />{t('Platform administration')}
                                </p>
                                <h1 className="mt-2 font-[Sora] text-2xl font-bold tracking-[-0.02em] text-gray-900 sm:text-3xl">{t(greetingFor(new Date().getHours()), { name: firstName })}</h1>
                                <p className="mt-1 text-sm text-gray-600">{today}</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Link href={route('admin.users')} className="inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(14,59,46,0.8)] transition hover:bg-[#124B3A] active:scale-[0.98]">
                                <UsersRound size={16} aria-hidden="true" />{t('Manage accounts')}
                            </Link>
                            <Link href={route('reports.index')} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 ring-1 ring-gray-200 transition hover:text-[#0E3B2E] hover:ring-[#0E3B2E]/30 active:scale-[0.98]">
                                <BarChart3 size={16} aria-hidden="true" />{t('Reports')}
                            </Link>
                        </div>
                    </div>

                    <div className="relative mt-6 border-t border-gray-200/70 pt-5">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">{t('Needs your attention')}</p>
                        {attention.length ? (
                            <ul className="mt-3 flex flex-wrap gap-2">
                                {attention.map(({ count, label, href, icon: Icon, tone }) => (
                                    <li key={label}>
                                        <Link href={href} className={`group inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium ring-1 transition ${tones[tone]}`}>
                                            <Icon size={16} aria-hidden="true" />
                                            <span className="font-[Sora] font-bold">{count}</span> {label}
                                            <ArrowUpRight size={14} className="opacity-60 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2 text-sm font-medium text-emerald-900 ring-1 ring-emerald-200">
                                <CheckCircle2 size={16} aria-hidden="true" />{t('All clear: nothing is waiting for you.')}
                            </p>
                        )}
                    </div>
                </section>

                {/* Key figures */}
                <section aria-label={t('Key figures')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                    {[
                        {
                            label: t('Rent collected for managed owners'), value: money(rentNow), icon: TrendingUp, tone: 'from-emerald-500/15 to-emerald-500/5 text-emerald-800',
                            note: rentChange === null ? t('No rent last month to compare') : t(':change% vs last month', { change: rentChange > 0 ? `+${rentChange}` : rentChange }),
                            noteTone: rentChange === null ? 'text-gray-500' : rentChange >= 0 ? 'text-emerald-700' : 'text-red-700',
                        },
                        { label: t('Subscriptions this month'), value: money(subscriptionMoney.month), icon: Wallet, tone: 'from-amber-500/20 to-amber-500/5 text-amber-800', note: owners.paying === 1 ? t('1 paying owner') : t(':count paying owners', { count: owners.paying || 0 }) },
                        { label: t('Occupancy'), value: `${occupancy}%`, icon: Home, tone: 'from-sky-500/15 to-sky-500/5 text-sky-800', note: t(':occupied of :total rooms rented', { occupied: overview.occupancy.occupied, total: units }), bar: occupancy },
                        { label: t('Owners'), value: overview.totalOwners, icon: UsersRound, tone: 'from-violet-500/15 to-violet-500/5 text-violet-800', href: route('admin.owners'), linkLabel: t('Open owners'), note: owners.managers === 1 ? t('1 manager working for owners') : t(':count managers working for owners', { count: owners.managers || 0 }) },
                    ].map(({ label, value, icon: Icon, tone, note, noteTone, bar, href, linkLabel }, index) => (
                        <div key={label} className="animate-fade-in rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5" style={{ animationDelay: `${index * 60}ms` }}>
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</p>
                                <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br ${tone}`} aria-hidden="true"><Icon size={18} /></span>
                            </div>
                            <p className="mt-3 break-words font-[Sora] text-xl font-bold tabular-nums tracking-tight text-gray-900 sm:text-2xl">{value}</p>
                            {bar !== undefined && (
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-gradient-to-r from-[#1F7A5A] to-[#D9A441] transition-all duration-700" style={{ width: `${bar}%` }} /></div>
                            )}
                            <p className={`mt-1.5 text-xs ${noteTone || 'text-gray-600'}`}>{note}</p>
                            {href && <Link href={href} className="mt-2 inline-block text-xs font-semibold text-[#0E3B2E] underline underline-offset-2">{linkLabel}</Link>}
                        </div>
                    ))}
                </section>

                <div className="grid gap-5 lg:grid-cols-5">
                    {/* Money chart */}
                    <section aria-labelledby="admin-money-title" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6 lg:col-span-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 id="admin-money-title" className="font-[Sora] font-semibold text-gray-900">{t('Money received')}</h2>
                                <p className="mt-0.5 text-xs text-gray-600">{moneyView === 'ads' ? t(':count advertisers · :listed buildings on the homepage now', { count: overview.advertisers || 0, listed: overview.listedBuildings || 0 }) : t('Last six months')}</p>
                            </div>
                            <div role="tablist" aria-label={t('Money received')} className="flex rounded-xl bg-gray-100 p-1 text-sm">
                                {[['rent', t('Rent (managed owners)')], ['subscriptions', t('Subscriptions')], ['ads', t('Ads')]].map(([key, label]) => (
                                    <button key={key} type="button" role="tab" aria-selected={moneyView === key} onClick={() => setMoneyView(key)}
                                        className={`rounded-lg px-3 py-1.5 font-semibold transition ${moneyView === key ? 'bg-white text-[#0E3B2E] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <p className="mt-4 font-[Sora] text-2xl font-bold tabular-nums text-gray-900">
                            {money(series.reduce((sum, item) => sum + Number(item.amount), 0))}
                            <span className="ml-2 text-sm font-medium text-gray-500">{t('in 6 months')}</span>
                        </p>
                        <div className="mt-4 flex h-48 items-end gap-2 sm:gap-3" role="img" aria-label={t('Money received')}>
                            {series.map((item, index) => {
                                const value = Number(item.amount);
                                const height = value > 0 ? Math.max(4, (value / chartMax) * 100) : 0;
                                const current = index === series.length - 1;
                                return (
                                    <div key={item.month} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                                        <span className="text-[10px] font-semibold tabular-nums text-gray-500 opacity-0 transition group-hover:opacity-100">{value ? short(value) : ''}</span>
                                        <div className="relative w-full flex-1 overflow-hidden rounded-xl bg-gray-50">
                                            <div
                                                className={`absolute inset-x-0 bottom-0 rounded-xl transition-all duration-700 ease-out ${moneyView === 'rent' ? (current ? 'bg-gradient-to-t from-[#0E3B2E] to-[#1F9D6B]' : 'bg-[#0E3B2E]/70') : moneyView === 'ads' ? (current ? 'bg-gradient-to-t from-violet-700 to-violet-400' : 'bg-violet-500/60') : (current ? 'bg-gradient-to-t from-[#b9862c] to-[#F2C46D]' : 'bg-[#D9A441]/70')}`}
                                                style={{ height: `${height}%` }}
                                                title={`${monthLabel(item.month, 'long')}: ${money(value)}`}
                                            />
                                        </div>
                                        <span className={`text-xs ${current ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{monthLabel(item.month)}</span>
                                    </div>
                                );
                            })}
                        </div>
                        {seriesMax === 0 && <p className="mt-3 text-center text-xs text-gray-500">{t('Nothing received in this period yet.')}</p>}
                    </section>

                    {/* Owners */}
                    <section aria-labelledby="admin-owners-title" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6 lg:col-span-2">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 id="admin-owners-title" className="font-[Sora] font-semibold text-gray-900">{t('Owners at a glance')}</h2>
                                <p className="mt-0.5 text-xs text-gray-600">{t(':count owner accounts', { count: ownerTotal })}</p>
                            </div>
                            <Link href={route('admin.users', { role: 'owner' })} className="text-sm font-semibold text-[#0E3B2E] hover:underline">{t('View all')}</Link>
                        </div>
                        <div className="mt-4 flex items-center gap-5">
                            <svg viewBox="0 0 100 100" className="h-32 w-32 flex-none -rotate-90" role="img" aria-label={t('Owners at a glance')}>
                                <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="12" />
                                {ring.map((slice) => slice.value > 0 && (
                                    <circle key={slice.key} cx="50" cy="50" r="42" fill="none" stroke={slice.color} strokeWidth="12" strokeDasharray={slice.dash} strokeDashoffset={slice.offset} className="transition-all duration-700" />
                                ))}
                            </svg>
                            <ul className="min-w-0 flex-1 space-y-2 text-sm">
                                {ownerSlices.map((slice) => (
                                    <li key={slice.key} className="flex items-center justify-between gap-2">
                                        <span className="flex min-w-0 items-center gap-2 text-gray-700"><span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: slice.color }} /><span className="truncate">{slice.label}</span></span>
                                        <span className="font-[Sora] font-bold tabular-nums text-gray-900">{slice.value}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <dl className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 text-center">
                            <div><dt className="text-[11px] text-gray-600">{t('Subscriptions in total')}</dt><dd className="font-[Sora] text-sm font-bold text-gray-900">{money(subscriptionMoney.total)}</dd></div>
                            <div><dt className="text-[11px] text-gray-600">{t('New owners this month')}</dt><dd className="font-[Sora] text-sm font-bold text-gray-900">{overview.newOwnersThisMonth}</dd></div>
                        </dl>
                    </section>
                </div>

                <div className="grid gap-5 lg:grid-cols-5">
                    {/* Occupancy and shortcuts */}
                    <div className="grid items-start gap-5 lg:col-span-5 lg:grid-cols-2">
                        <UtilityCard snapshot={overview.utilitySnapshot} locale={locale} />
                        <section aria-labelledby="admin-occupancy-title" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6">
                            <div className="flex items-start justify-between gap-3">
                                <h2 id="admin-occupancy-title" className="flex items-center gap-2 font-[Sora] font-semibold text-gray-900"><Activity size={17} className="text-[#1F7A5A]" aria-hidden="true" />{t('Rooms across the platform')}</h2>
                                <Link href={route('properties.index')} className="text-sm font-semibold text-[#0E3B2E] hover:underline">{t('View all')}</Link>
                            </div>
                            <div className="mt-4 flex items-center gap-5">
                                <OccupancyRing
                                    occupied={overview.occupancy.occupied}
                                    available={overview.occupancy.available}
                                    maintenance={overview.occupancy.maintenance}
                                    label={t('Portfolio occupancy: :rate% occupied', { rate: occupancy })}
                                />
                                <ul className="flex-1 space-y-2.5 text-sm">
                                    {[
                                        ['Rented', overview.occupancy.occupied, 'bg-[#0E3B2E]'],
                                        ['Empty', overview.occupancy.available, 'bg-[#D9A441]'],
                                        ['Maintenance', overview.occupancy.maintenance, 'bg-slate-400'],
                                    ].map(([label, value, color]) => (
                                        <li key={label} className="flex items-center justify-between gap-2">
                                            <span className="flex items-center gap-2 text-gray-700"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{t(label)}</span>
                                            <span className="font-[Sora] font-bold tabular-nums text-gray-900">{value}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </section>

                        <nav aria-label={t('Shortcuts')} className="grid grid-cols-4 gap-2">
                            {shortcuts.map(({ label, href, icon: Icon, count, alert }) => (
                                <Link key={label} href={href} className="group relative flex flex-col items-center gap-1.5 rounded-2xl bg-white px-1 py-3 text-center shadow-sm ring-1 ring-black/[0.04] transition hover:-translate-y-0.5 hover:shadow-md hover:ring-[#0E3B2E]/20">
                                    {alert && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />}
                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-[#0E3B2E] transition group-hover:bg-[#0E3B2E] group-hover:text-white" aria-hidden="true"><Icon size={17} /></span>
                                    <span className="text-[11px] font-semibold leading-tight text-gray-800">{t(label)}</span>
                                    {count !== undefined && count !== null && <span className="text-[10px] tabular-nums text-gray-500">{count}</span>}
                                </Link>
                            ))}
                        </nav>
                    </div>
                </div>

                <VisitorInquiries inquiries={inquiries} />
            </div>
        </AuthenticatedLayout>
    );
}

export default function Dashboard({ summary, recentProperties = [], recentTenancies = [], recentInquiries = [], adminOverview, ownerReport, utilitySnapshot = null }) {
    const { auth } = usePage().props;
    const { t, language } = useTranslation();
    const user = auth.user;
    const isAdmin = user.role === 'admin';
    const isExpired = !isAdmin && user.expires_at && new Date(user.expires_at) < new Date();

    if (isExpired) {
        return <AuthenticatedLayout header="Dashboard"><Head title={t('Dashboard')} /><div className="mx-auto max-w-lg rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50"><CalendarX size={30} className="text-red-500" /></div><h2 className="mt-4 font-[Sora] text-xl font-bold text-gray-800">{t('Your account has expired')}</h2><p className="mt-2 text-sm text-gray-500">{t('Your subscription ended on :date. Please contact support to renew access.', { date: formatDate(user.expires_at, language) })}</p></div></AuthenticatedLayout>;
    }
    if (isAdmin) {
        return <AdminDashboard overview={{ ...adminOverview, utilitySnapshot }} inquiries={recentInquiries} user={user} language={language} />;
    }

    return <OwnerDashboard {...{ user, language, summary, recentProperties, recentTenancies, recentInquiries, ownerReport, utilitySnapshot }} />;
}

/**
 * Owner home: a reporting view of their buildings. Money this month, what is
 * owed, occupancy, leases ending and recent payments. Managed owners only
 * read; Q.R.A does the work.
 */
function OwnerDashboard({ user, language, summary, recentProperties, recentTenancies, recentInquiries, ownerReport, utilitySnapshot }) {
    const { t } = useTranslation();
    const canEdit = useCanEdit();
    const locale = localeForLanguage(language);
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    const short = (value) => (value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${Math.round(value / 1000)}k` : `${Math.round(value)}`);
    const monthName = (value, style = 'short') => new Intl.DateTimeFormat(locale, { month: style, ...(style === 'long' ? { year: 'numeric' } : {}) }).format(new Date(`${value.slice(0, 7)}-01T12:00:00`));
    const firstName = user.first_name || user.name?.split(' ')[0];
    const today = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    const daysLeft = user.expires_at ? Math.ceil((new Date(user.expires_at) - new Date()) / 86400000) : null;
    const report = ownerReport || { month: {}, months: [], arrears: { rows: [] }, ending_soon: [], recent_payments: [] };
    const month = report.month;
    const thisMonth = month.from ? monthName(month.from, 'long') : '';
    const rate = month.collection_rate;
    const chartData = Math.max(0, ...report.months.flatMap((item) => [item.expected, item.collected]));
    const chartMax = Math.max(1, chartData);
    const statementHref = route('reports.index', { tab: 'owners' });
    const lastMonthStatementHref = route('reports.index', { tab: 'owners', period: 'last_month' });
    const daysUntil = (date) => Math.max(0, Math.ceil((new Date(`${String(date).slice(0, 10)}T12:00:00`) - new Date()) / 86400000));

    const isManager = !!report.is_manager;
    const moneyCards = isManager ? [
        { label: 'Rent collected', value: month.rent_collected, note: t('Received in :month', { month: thisMonth }), icon: CreditCard, tone: 'bg-emerald-50 text-emerald-800 ring-emerald-100', highlight: true },
        { label: 'Deposits received', value: month.deposits_received, note: t('In :month · refundable at move-out', { month: thisMonth }), icon: ShieldCheck, tone: 'bg-violet-50 text-violet-800 ring-violet-100' },
        { label: 'Overdue rent', value: report.arrears.total, note: Number(report.arrears.total) > 0 ? t(':count tenants late', { count: report.arrears.tenants }) : t('Nobody is late with rent'), icon: Clock3, tone: 'bg-red-50 text-red-700 ring-red-100' },
    ] : [
        { label: 'Rent collected', value: month.rent_collected, note: t('Received in :month', { month: thisMonth }), icon: CreditCard, tone: 'bg-emerald-50 text-emerald-800 ring-emerald-100' },
        ...(report.managed ? [{ label: 'Q.R.A management fee', value: month.commission, note: t(':rate% of rent collected', { rate: Number(report.fee_rate) }), icon: BadgeCheck, tone: 'bg-amber-50 text-amber-800 ring-amber-100' }] : []),
        { label: report.managed ? 'Your payout' : 'Your income', value: month.payout, note: report.managed ? t('Rent collected less the management fee') : t('Rent collected this month'), icon: TrendingUp, tone: 'bg-[#0E3B2E] text-white ring-[#0E3B2E]', highlight: true },
        { label: 'Deposits received', value: month.deposits_received, note: t('In :month · refundable, not your income', { month: thisMonth }), icon: ShieldCheck, tone: 'bg-violet-50 text-violet-800 ring-violet-100' },
    ];

    return (
        <AuthenticatedLayout header="Dashboard">
            <Head title={t('Dashboard')} />
            <div className="mx-auto max-w-7xl space-y-5">
                {/* Greeting */}
                <section className="relative overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-7">
                    <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#D9A441]/15 blur-3xl" />
                    <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
                    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4 sm:gap-5">
                            <Link href={route('profile.edit')} className="group relative shrink-0 rounded-full" title={t('Edit profile')}>
                                <UserAvatar user={user} size="xl" className="ring-4 ring-white shadow-lg shadow-[#0E3B2E]/15 transition group-hover:scale-[1.03]" />
                            </Link>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a6420]">{today}</p>
                                <h1 className="mt-1 font-[Sora] text-2xl font-bold tracking-[-0.02em] text-gray-900 sm:text-[1.7rem]">{t(greetingFor(new Date().getHours()), { name: firstName })}</h1>
                                <p className="mt-1 text-sm text-gray-600">
                                    {isManager
                                        ? t('Here is how the buildings you manage for :owner are doing.', { owner: report.employer || t('the owner') })
                                        : report.managed ? t('Q.R.A manages your buildings. Here is how they are doing.') : t('Here’s what’s happening across your portfolio.')}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {report.managed && (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-200">
                                            <ShieldCheck size={13} aria-hidden="true" /> {t('Managed by Q.R.A · :rate% fee', { rate: Number(report.fee_rate) })}
                                        </span>
                                    )}
                                    {!report.managed && !isManager && daysLeft !== null && (
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${daysLeft > 30 ? 'bg-emerald-50 text-emerald-800 ring-emerald-100' : 'bg-amber-50 text-amber-800 ring-amber-100'}`}>
                                            <BadgeCheck size={13} aria-hidden="true" /> {t('Plan active · :days days left', { days: Math.max(0, daysLeft) })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
                            {!isManager && <Link href={statementHref} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(14,59,46,0.8)] transition hover:bg-[#124B3A]">
                                <FileText size={16} aria-hidden="true" /> {t('My statement')}
                            </Link>}
                            <Link href={route('reports.index')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-800 ring-1 ring-inset ring-gray-200 transition hover:bg-white hover:text-[#0E3B2E]">
                                <BarChart3 size={16} aria-hidden="true" /> {t('Reports')}
                            </Link>
                            {canEdit && !isManager && (
                                <Link href={route('properties.create')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-800 ring-1 ring-inset ring-gray-200 transition hover:bg-white hover:text-[#0E3B2E]">
                                    <Plus size={16} aria-hidden="true" /> {t('Add property')}
                                </Link>
                            )}
                        </div>
                    </div>
                </section>

                {/* Money this month */}
                <section aria-labelledby="owner-money-title">
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                        <h2 id="owner-money-title" className="font-[Sora] text-lg font-bold text-gray-900">{isManager ? t('Money in :month', { month: thisMonth }) : t('Your money in :month', { month: thisMonth })}</h2>
                        {!isManager && <Link href={lastMonthStatementHref} className="text-sm font-semibold text-[#0E3B2E] hover:underline">{t('Last month’s statement')} →</Link>}
                    </div>
                    <div className={`grid gap-3 sm:grid-cols-2 ${moneyCards.length === 4 ? 'xl:grid-cols-4' : 'lg:grid-cols-3'}`}>
                        {moneyCards.map(({ label, value, note, icon: Icon, tone, highlight }) => (
                            <div key={label} className={`rounded-2xl p-5 shadow-sm ring-1 ${highlight ? 'bg-gradient-to-br from-[#0E3B2E] to-[#145240] text-white ring-[#0E3B2E]' : 'bg-white ring-black/[0.04]'}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <p className={`text-xs font-semibold uppercase tracking-wide ${highlight ? 'text-emerald-100' : 'text-gray-600'}`}>{t(label)}</p>
                                    <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ring-1 ${highlight ? 'bg-white/10 text-[#F2C46D] ring-white/20' : tone}`} aria-hidden="true"><Icon size={17} /></span>
                                </div>
                                <p className={`mt-3 font-[Sora] text-2xl font-bold tabular-nums ${highlight ? 'text-white' : 'text-gray-900'}`}><CountUp value={Math.round(value || 0)} /> <span className="text-base font-semibold">RWF</span></p>
                                <p className={`mt-1 text-xs ${highlight ? 'text-emerald-100' : 'text-gray-600'}`}>{note}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="grid gap-5 lg:grid-cols-3">
                    {/* Collection chart */}
                    <section aria-labelledby="owner-chart-title" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6 lg:col-span-2">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 id="owner-chart-title" className="font-[Sora] font-semibold text-gray-900">{t('Rent due vs collected')}</h2>
                                <p className="mt-1 text-xs text-gray-600">{t('Last six months')}</p>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs font-medium text-gray-700">
                                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-200 ring-1 ring-emerald-400" />{t('Rent due')}</span>
                                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#0E3B2E]" />{t('Rent collected')}</span>
                            </div>
                        </div>
                        <svg viewBox="0 0 600 220" role="img" aria-label={t('Rent due vs collected')} className="mt-4 h-52 w-full">
                            {[0, 0.5, 1].map((step) => (
                                <g key={step}>
                                    <line x1="44" x2="592" y1={186 - step * 160} y2={186 - step * 160} stroke="#e5e7eb" strokeDasharray={step ? '4 5' : undefined} />
                                    <text x="38" y={190 - step * 160} textAnchor="end" fontSize="10" fill="#6b7280">{chartData > 0 || step === 0 ? short(chartMax * step) : ''}</text>
                                </g>
                            ))}
                            {report.months.map((item, index) => {
                                const x = 64 + index * 88;
                                const due = (item.expected / chartMax) * 160;
                                const got = (item.collected / chartMax) * 160;
                                return (
                                    <g key={item.month}>
                                        <rect x={x} y={186 - due} width="26" height={due} rx="5" fill="#a7f3d0" stroke="#34d399"><title>{`${monthName(item.month, 'long')} — ${t('Rent due')}: ${money(item.expected)}`}</title></rect>
                                        <rect x={x + 30} y={186 - got} width="26" height={got} rx="5" fill="#0E3B2E"><title>{`${monthName(item.month, 'long')} — ${t('Rent collected')}: ${money(item.collected)}`}</title></rect>
                                        <text x={x + 28} y="206" textAnchor="middle" fontSize="11" fill="#4b5563">{monthName(item.month)}</text>
                                    </g>
                                );
                            })}
                        </svg>
                        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 text-sm">
                            <span className="font-semibold text-gray-800">{t('Collection rate this month')}</span>
                            <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rate ?? 0} aria-label={t('Collection rate')}>
                                <div className={`h-full rounded-full ${rate === null || rate >= 90 ? 'bg-emerald-600' : rate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${rate ?? 0}%` }} />
                            </div>
                            <span className="font-[Sora] font-bold text-gray-900">{rate === null ? '—' : `${rate}%`}</span>
                        </div>
                    </section>

                    {/* Occupancy and utilities */}
                    <div className="space-y-5">
                    <section aria-labelledby="owner-occupancy-title" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6">
                        <h2 id="owner-occupancy-title" className="flex items-center gap-2 font-[Sora] font-semibold text-gray-900"><Activity size={17} className="text-[#1F7A5A]" aria-hidden="true" />{t('Occupancy')}</h2>
                        <p className="mt-1 text-xs text-gray-600">{t(':occupied of :total rooms rented', { occupied: summary?.occupiedUnits ?? 0, total: summary?.units ?? 0 })}</p>
                        <div className="mt-5 flex items-center gap-5">
                            <OccupancyRing
                                occupied={summary?.occupiedUnits ?? 0}
                                available={summary?.availableUnits ?? 0}
                                maintenance={summary?.maintenanceUnits ?? 0}
                                label={t('Portfolio occupancy: :rate% occupied', { rate: summary?.occupancyRate ?? 0 })}
                            />
                            <ul className="flex-1 space-y-2.5 text-sm">
                                {[
                                    ['Rented', summary?.occupiedUnits ?? 0, 'bg-[#0E3B2E]'],
                                    ['Empty', summary?.availableUnits ?? 0, 'bg-[#D9A441]'],
                                    ['Maintenance', summary?.maintenanceUnits ?? 0, 'bg-slate-400'],
                                ].map(([label, value, color]) => (
                                    <li key={label} className="flex items-center justify-between gap-2">
                                        <span className="flex items-center gap-2 text-gray-700"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{t(label)}</span>
                                        <span className="font-[Sora] font-bold tabular-nums text-gray-900">{value}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {Number(report.vacant_rent) > 0 && (
                            <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900 ring-1 ring-amber-100">
                                {t('Empty rooms could bring :amount more per month.', { amount: money(report.vacant_rent) })}
                            </p>
                        )}
                    </section>
                    <UtilityCard snapshot={utilitySnapshot} locale={locale} />
                    </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                    {/* Who owes */}
                    <section aria-labelledby="owner-arrears-title" className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
                        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                            <h2 id="owner-arrears-title" className="flex items-center gap-2 font-[Sora] font-semibold text-gray-900"><Clock3 size={17} className="text-red-600" aria-hidden="true" />{t('Overdue rent')}</h2>
                            <span className={`font-[Sora] font-bold ${Number(report.arrears.total) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{money(report.arrears.total)}</span>
                        </div>
                        {report.arrears.rows.length ? (
                            <ul className="divide-y divide-gray-100">
                                {report.arrears.rows.map((row) => (
                                    <li key={row.tenancy_id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-gray-900">{row.tenant.name}</p>
                                            <p className="text-xs text-gray-600">{row.property.name} · {t('Room :number', { number: row.unit.unit_number })} · <span className="font-semibold text-red-700">{t(':days days late', { days: row.days_late })}</span></p>
                                        </div>
                                        <span className="shrink-0 font-semibold tabular-nums text-red-700">{money(row.total)}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="flex items-center gap-2 px-5 py-6 text-sm text-gray-700"><CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />{t('Nobody is late with rent')}</p>
                        )}
                        {report.arrears.tenants > report.arrears.rows.length && (
                            <Link href={route('reports.index', { tab: 'arrears' })} className="block border-t border-gray-100 px-5 py-3 text-sm font-semibold text-[#0E3B2E] hover:bg-gray-50">{t('See all :count late tenants', { count: report.arrears.tenants })} →</Link>
                        )}
                    </section>

                    {/* Leases ending */}
                    <section aria-labelledby="owner-ending-title" className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
                        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                            <h2 id="owner-ending-title" className="flex items-center gap-2 font-[Sora] font-semibold text-gray-900"><CalendarDays size={17} className="text-amber-700" aria-hidden="true" />{t('Leases ending soon')}</h2>
                            <span className="text-xs text-gray-600">{t('Next 60 days')}</span>
                        </div>
                        {report.ending_soon.length ? (
                            <ul className="divide-y divide-gray-100">
                                {report.ending_soon.map((tenancy) => (
                                    <li key={tenancy.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-gray-900">{tenancy.tenant?.name}</p>
                                            <p className="text-xs text-gray-600">{tenancy.unit?.property?.name} · {t('Room :number', { number: tenancy.unit?.unit_number })} · {formatDate(tenancy.end_date, language)}</p>
                                        </div>
                                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${daysUntil(tenancy.end_date) <= 7 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{t('in :days days', { days: daysUntil(tenancy.end_date) })}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="flex items-center gap-2 px-5 py-6 text-sm text-gray-700"><CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />{t('No lease ends in the next 60 days')}</p>
                        )}
                    </section>
                </div>

                {/* Recent payments */}
                <section aria-labelledby="owner-payments-title" className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                        <h2 id="owner-payments-title" className="flex items-center gap-2 font-[Sora] font-semibold text-gray-900"><CreditCard size={17} className="text-[#1F7A5A]" aria-hidden="true" />{t('Recent rent payments')}</h2>
                        <Link href={route('payments.index')} className="text-sm font-semibold text-[#0E3B2E] hover:underline">{t('View all')}</Link>
                    </div>
                    {report.recent_payments.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[620px] text-left text-sm">
                                <caption className="sr-only">{t('Recent rent payments')}</caption>
                                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-600">
                                    <tr>
                                        <th scope="col" className="px-5 py-3 font-semibold">{t('Date paid')}</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">{t('Tenant')}</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">{t('Months covered')}</th>
                                        <th scope="col" className="px-5 py-3 text-right font-semibold">{t('Rent')}</th>
                                        <th scope="col" className="px-5 py-3 text-right font-semibold">{t('Deposit')}</th>
                                        <th scope="col" className="px-5 py-3 text-right font-semibold">{t('Total')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {report.recent_payments.map((payment) => (
                                        <tr key={payment.id}>
                                            <td className="px-5 py-3"><p className="text-gray-900">{formatDate(payment.paid_at, language)}</p>{payment.receipt_number && <p className="font-mono text-[11px] text-gray-500">{payment.receipt_number}</p>}</td>
                                            <td className="px-5 py-3"><p className="font-semibold text-gray-900">{payment.tenant}</p><p className="text-xs text-gray-600">{payment.property} · {t('Room :number', { number: payment.unit })}</p></td>
                                            <td className="px-5 py-3 text-gray-700">{payment.months ? t(payment.months === 1 ? '1 month' : ':count months', { count: payment.months }) : '—'}</td>
                                            <td className="px-5 py-3 text-right tabular-nums text-emerald-800">{payment.rent ? money(payment.rent) : '—'}</td>
                                            <td className="px-5 py-3 text-right tabular-nums text-violet-800">{payment.deposit ? money(payment.deposit) : '—'}</td>
                                            <td className="px-5 py-3 text-right font-semibold tabular-nums text-gray-900">{money(payment.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <p className="px-5 py-6 text-sm text-gray-700">{t('No rent payments in the last three months.')}</p>}
                    {report.recent_payments.length > 0 && <p className="border-t border-gray-100 px-5 py-2.5 text-xs text-gray-600">{t('The deposit is the tenant’s money, held until move-out: it is not part of your income.')}</p>}
                </section>

                {/* Buildings */}
                <section aria-labelledby="owner-properties-title" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 id="owner-properties-title" className="font-[Sora] font-semibold text-gray-900">{t('Your buildings')}</h2>
                        <Link href={route('properties.index')} className="text-sm font-semibold text-[#0E3B2E] hover:underline">{t('View all')}</Link>
                    </div>
                    {recentProperties.length ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {recentProperties.map((property) => {
                                const coverPath = property.images?.find((img) => img.is_cover)?.image_path || property.images?.[0]?.image_path;
                                const units = property.units_count ?? 0;
                                const occupied = property.occupied_units_count ?? 0;
                                return (
                                    <Link key={property.id} href={route('properties.show', property.id)} className="group overflow-hidden rounded-xl ring-1 ring-gray-100 transition hover:shadow-md hover:ring-[#D9A441]/60">
                                        <div className="h-28 overflow-hidden bg-gradient-to-br from-[#0E3B2E]/10 to-[#D9A441]/10">
                                            {coverPath
                                                ? <img src={imageSource(coverPath)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                                                : <span className="flex h-full items-center justify-center"><Building2 size={26} className="text-[#0E3B2E]/50" aria-hidden="true" /></span>}
                                        </div>
                                        <div className="p-3">
                                            <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-[#0E3B2E]">{property.name}</p>
                                            <p className="mt-0.5 text-xs text-gray-600">{t(':occupied of :total rooms rented', { occupied, total: units })}</p>
                                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#0E3B2E]" style={{ width: `${units ? (occupied / units) * 100 : 0}%` }} /></div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                            <Building2 size={26} className="mx-auto text-gray-300" aria-hidden="true" />
                            <p className="mt-2 text-sm text-gray-600">{t('No properties yet.')}</p>
                            {canEdit && <Link href={route('properties.create')} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#0E3B2E] px-3 py-2 text-xs font-semibold text-white hover:bg-[#124B3A]"><Plus size={14} /> {t('Add your first property')}</Link>}
                        </div>
                    )}
                </section>

                <VisitorInquiries inquiries={recentInquiries} />
            </div>
        </AuthenticatedLayout>
    );
}
