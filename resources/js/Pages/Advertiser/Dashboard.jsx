import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import UserAvatar from '@/Components/UserAvatar';
import { useTranslation } from '@/localization';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertTriangle, ArrowRight, Building2, CheckCircle2, Clock3, CreditCard, Eye, Gift, Hourglass, Loader2, Mail, Megaphone,
    MessageSquare, Phone, Plus, Receipt, RefreshCw, Rocket, Sparkles,
} from 'lucide-react';
import { useState } from 'react';

const localeFor = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';
const imageSource = (path) => (!path ? null : /^https?:\/\//i.test(path) ? path : `/storage/${path}`);

// How each property's status looks.
const STATUS = {
    unpaid: { label: 'Not paid yet', tone: 'bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30', icon: CreditCard },
    checking: { label: 'Payment being checked', tone: 'bg-sky-50 dark:bg-sky-500/10 text-sky-900 dark:text-sky-300 ring-sky-200 dark:ring-sky-500/30', icon: Hourglass },
    rejected: { label: 'Payment not approved', tone: 'bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 ring-red-200 dark:ring-red-500/30', icon: AlertTriangle },
    listed: { label: 'On the homepage', tone: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30', icon: CheckCircle2 },
    ended: { label: 'Listing ended', tone: 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 ring-gray-200 dark:ring-slate-700', icon: Clock3 },
};

/**
 * The advertiser's workspace: add a property, pay 25,000 RWF for it, and it
 * goes on the homepage for 60 days once ITUZE approves the payment. Each
 * property shows where it stands.
 */
export default function AdvertiserDashboard({
    status, adUnitPrice = 25000, welcomeBonusUnits = 3, bonusAvailable = true, listingDays = 60,
    credits = 0, buildings = [], purchases = [], inquiries = [],
}) {
    const { t, language } = useTranslation();
    const user = usePage().props.auth.user;
    const locale = localeFor(language);
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    const date = (value) => (value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—');
    const [publishing, setPublishing] = useState(null);

    if (status !== 'approved') {
        return (
            <AuthenticatedLayout header="Advertiser dashboard">
                <Head title={t('Advertiser dashboard')} />
                <div className="mx-auto max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-8 text-center shadow-sm ring-1 ring-black/[0.04]">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300" aria-hidden="true"><Hourglass size={26} /></span>
                    <h1 className="mt-4 font-[Sora] text-xl font-bold text-gray-900 dark:text-slate-100">{t('Your advertiser account is under review')}</h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">{t('Our team is reviewing your details. You will be able to advertise as soon as an administrator approves your account.')}</p>
                </div>
            </AuthenticatedLayout>
        );
    }

    const count = (key) => buildings.filter((building) => building.status?.key === key).length;
    const newInquiries = inquiries.filter((inquiry) => inquiry.status === 'new').length;
    const publishFree = (building) => {
        setPublishing(building.id);
        router.post(route('advertising.publish', building.id), {}, { preserveScroll: true, onFinish: () => setPublishing(null) });
    };

    return (
        <AuthenticatedLayout header="Advertiser dashboard">
            <Head title={t('Listings')} />
            <div className="mx-auto max-w-6xl space-y-5">
                {/* Welcome */}
                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white dark:from-slate-900 via-white dark:via-slate-900 to-amber-50 dark:to-amber-500/10 p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-7">
                    <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#D9A441]/20 blur-3xl" />
                    <div className="relative flex flex-wrap items-center justify-between gap-5">
                        <div className="flex min-w-0 items-center gap-4">
                            <UserAvatar user={user} size="xl" className="ring-4 ring-white shadow-lg" />
                            <div className="min-w-0">
                                <p className="inline-flex items-center gap-1.5 rounded-full bg-[#0E3B2E]/[0.06] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0E3B2E] dark:text-emerald-300"><Megaphone size={13} aria-hidden="true" />{t('Advertiser')}</p>
                                <h1 className="mt-2 font-[Sora] text-2xl font-bold text-gray-900 dark:text-slate-100 sm:text-3xl">{t('Welcome back, :name', { name: user.first_name || user.name })}</h1>
                                <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{t(':price per property puts it on the ITUZE homepage for :days days.', { price: money(adUnitPrice), days: listingDays })}</p>
                            </div>
                        </div>
                        <Link href={route('properties.create')} className="inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(14,59,46,0.8)] transition hover:bg-[#124B3A]">
                            <Plus size={17} aria-hidden="true" />{t('Add a property')}
                        </Link>
                    </div>

                    {/* How it works */}
                    <ol className="relative mt-6 grid gap-2 sm:grid-cols-4">
                        {[
                            [Building2, t('Add the property'), t('Name, photos, rooms')],
                            [CreditCard, t('Pay :price', { price: money(adUnitPrice) }), t('MoMo Pay, bank or cheque')],
                            [Hourglass, t('ITUZE checks it'), t('Usually within a day')],
                            [Rocket, t('On the homepage'), t('For :days days', { days: listingDays })],
                        ].map(([Icon, title, hint], index) => (
                            <li key={title} className="flex items-center gap-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 px-3 py-2.5 ring-1 ring-black/[0.05]">
                                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[#0E3B2E] text-sm font-bold text-[#F3D58F]" aria-hidden="true">{index + 1}</span>
                                <span className="min-w-0">
                                    <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-gray-900 dark:text-slate-100"><Icon size={14} className="flex-none text-[#0E3B2E] dark:text-emerald-300" aria-hidden="true" />{title}</span>
                                    <span className="block truncate text-[11px] text-gray-500 dark:text-slate-400">{hint}</span>
                                </span>
                            </li>
                        ))}
                    </ol>
                    {bonusAvailable && (
                        <p className="relative mt-3 flex items-start gap-2 rounded-xl bg-gradient-to-r from-amber-100 to-amber-50 dark:to-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-500/30">
                            <Gift size={18} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
                            <span><strong>{t('First payment gift:')}</strong> {t('when your first payment is approved, you also get :bonus free listings for your other properties.', { bonus: welcomeBonusUnits })}</span>
                        </p>
                    )}
                </section>

                {/* Figures */}
                <section aria-label={t('Summary')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                        { label: t('On the homepage'), value: count('listed'), icon: Eye, tone: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 ring-emerald-100 dark:ring-emerald-500/30' },
                        { label: t('Being checked'), value: count('checking'), icon: Hourglass, tone: 'bg-sky-50 dark:bg-sky-500/10 text-sky-800 dark:text-sky-300 ring-sky-100 dark:ring-sky-500/30' },
                        { label: t('Not paid yet'), value: count('unpaid') + count('rejected') + count('ended'), icon: CreditCard, tone: 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-amber-100 dark:ring-amber-500/30' },
                        { label: t('New inquiries'), value: newInquiries, icon: MessageSquare, tone: 'bg-violet-50 dark:bg-violet-500/10 text-violet-800 dark:text-violet-300 ring-violet-100 dark:ring-violet-500/30' },
                    ].map(({ label, value, icon: Icon, tone }) => (
                        <div key={label} className="flex items-center gap-3 rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm ring-1 ring-black/[0.04]">
                            <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ring-1 ${tone}`} aria-hidden="true"><Icon size={19} /></span>
                            <span className="min-w-0">
                                <span className="block font-[Sora] text-2xl font-bold tabular-nums text-gray-900 dark:text-slate-100">{value}</span>
                                <span className="block truncate text-xs font-semibold text-gray-600 dark:text-slate-300">{label}</span>
                            </span>
                        </div>
                    ))}
                </section>
                {credits > 0 && (
                    <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-950 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-500/30">
                        <Sparkles size={17} className="flex-none text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                        {t(credits === 1 ? 'You have 1 free listing: use it on a property below.' : 'You have :count free listings: use them on the properties below.', { count: credits })}
                    </p>
                )}

                {/* Properties */}
                <section aria-labelledby="properties-title">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <h2 id="properties-title" className="flex items-center gap-2 font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100"><Building2 size={18} className="text-[#0E3B2E] dark:text-emerald-300" aria-hidden="true" />{t('Your properties')}</h2>
                        {buildings.length > 0 && <Link href={route('properties.index')} className="text-sm font-semibold text-[#0E3B2E] dark:text-emerald-300 hover:underline">{t('Manage')}</Link>}
                    </div>
                    {buildings.length ? (
                        <ul className="grid gap-4 md:grid-cols-2">
                            {buildings.map((building) => {
                                const state = building.status || { key: 'unpaid' };
                                const look = STATUS[state.key] || STATUS.unpaid;
                                const StatusIcon = look.icon;
                                const needsPay = ['unpaid', 'rejected', 'ended'].includes(state.key);
                                const percentLeft = state.key === 'listed' ? Math.max(4, Math.min(100, Math.round((state.days_left / listingDays) * 100))) : 0;

                                return (
                                    <li key={building.id} className="flex min-w-0 flex-col overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-black/[0.05] transition hover:shadow-md">
                                        <div className="relative h-36 bg-gradient-to-br from-[#0E3B2E]/10 to-[#D9A441]/10">
                                            {building.cover
                                                ? <img src={imageSource(building.cover)} alt="" className="h-full w-full object-cover" loading="lazy" />
                                                : <span className="flex h-full items-center justify-center"><Building2 size={34} className="text-[#0E3B2E]/40" aria-hidden="true" /></span>}
                                            <span className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ring-1 ${look.tone}`}>
                                                <StatusIcon size={12} aria-hidden="true" />{t(look.label)}
                                            </span>
                                            {building.new_inquiries > 0 && (
                                                <span className="absolute right-3 top-3 rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">{t(':count new inquiries', { count: building.new_inquiries })}</span>
                                            )}
                                        </div>
                                        <div className="flex flex-1 flex-col p-4">
                                            <Link href={route('properties.show', building.id)} className="truncate font-[Sora] text-base font-bold text-gray-900 dark:text-slate-100 hover:text-[#0E3B2E] dark:hover:text-emerald-200 hover:underline">{building.name}</Link>
                                            <p className="truncate text-xs text-gray-600 dark:text-slate-300">{building.address || '—'} · {t(building.rooms === 1 ? '1 room' : ':count rooms', { count: building.rooms })}</p>

                                            <div className="mt-3 text-sm">
                                                {state.key === 'listed' && (
                                                    <>
                                                        <p className="text-gray-800 dark:text-slate-100">{t('Until :date · :days days left', { date: date(state.until), days: state.days_left })}</p>
                                                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800" role="img" aria-label={t(':days days left', { days: state.days_left })}>
                                                            <div className={`h-full rounded-full ${state.days_left <= 7 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${percentLeft}%` }} />
                                                        </div>
                                                    </>
                                                )}
                                                {state.key === 'checking' && <p className="text-gray-700 dark:text-slate-200">{t('Your payment of :amount is being checked. It goes online as soon as it is approved.', { amount: money(state.amount) })}</p>}
                                                {state.key === 'rejected' && <p className="text-red-800 dark:text-red-300">{t('Not approved: :reason', { reason: state.reason || '—' })}</p>}
                                                {state.key === 'ended' && <p className="text-gray-700 dark:text-slate-200">{t('Ended on :date. Pay again to put it back on the homepage.', { date: date(state.until) })}</p>}
                                                {state.key === 'unpaid' && <p className="text-gray-700 dark:text-slate-200">{t('Pay :price to put it on the homepage for :days days.', { price: money(adUnitPrice), days: listingDays })}</p>}
                                                {building.rooms < 1 && <p className="mt-1 text-xs font-semibold text-amber-800 dark:text-amber-300">{t('Add at least one room so visitors can see what you offer.')}</p>}
                                            </div>

                                            <div className="mt-auto flex flex-wrap gap-2 pt-4">
                                                {needsPay && (
                                                    <Link href={route('advertising.pay', building.id)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#124B3A]">
                                                        {state.key === 'unpaid' ? <CreditCard size={15} aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
                                                        {state.key === 'unpaid' ? t('Pay :price', { price: money(adUnitPrice) }) : state.key === 'rejected' ? t('Pay again') : t('Renew · :price', { price: money(adUnitPrice) })}
                                                    </Link>
                                                )}
                                                {needsPay && credits > 0 && building.rooms > 0 && (
                                                    <button type="button" onClick={() => publishFree(building)} disabled={publishing === building.id}
                                                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-900 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-60">
                                                        {publishing === building.id ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Gift size={15} aria-hidden="true" />}{t('Use a free listing')}
                                                    </button>
                                                )}
                                                {state.key === 'listed' && (
                                                    <>
                                                        <a href={route('public.properties.show', building.id)} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-gray-800 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800"><Eye size={15} aria-hidden="true" />{t('See it')}</a>
                                                        <Link href={route('advertising.pay', building.id)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#124B3A]"><RefreshCw size={15} aria-hidden="true" />{t('Extend :days days', { days: listingDays })}</Link>
                                                    </>
                                                )}
                                                {state.key === 'checking' && (
                                                    <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-50 dark:bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-900 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-500/30"><Hourglass size={15} aria-hidden="true" />{t('Waiting for ITUZE')}</span>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                            <li>
                                <Link href={route('properties.create')} className="flex h-full min-h-[14rem] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-gray-300 dark:border-slate-600 bg-white/60 dark:bg-slate-900/60 p-6 text-center text-gray-600 dark:text-slate-300 transition hover:border-[#0E3B2E]/40 hover:bg-white dark:hover:bg-slate-800 hover:text-[#0E3B2E] dark:hover:text-emerald-200">
                                    <Plus size={28} aria-hidden="true" />
                                    <span className="font-semibold">{t('Add another property')}</span>
                                    <span className="text-xs">{t(':price for :days days on the homepage', { price: money(adUnitPrice), days: listingDays })}</span>
                                </Link>
                            </li>
                        </ul>
                    ) : (
                        <div className="rounded-3xl border-2 border-dashed border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-6 py-12 text-center">
                            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0E3B2E]/[0.06] text-[#0E3B2E] dark:text-emerald-300" aria-hidden="true"><Building2 size={26} /></span>
                            <p className="mt-3 font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100">{t('Add your first property')}</p>
                            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{t('Add its name, photos and rooms, then pay :price to show it on the homepage for :days days.', { price: money(adUnitPrice), days: listingDays })}</p>
                            <Link href={route('properties.create')} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-5 py-3 text-sm font-semibold text-white hover:bg-[#124B3A]"><Plus size={16} aria-hidden="true" />{t('Add a property')}<ArrowRight size={15} aria-hidden="true" /></Link>
                        </div>
                    )}
                </section>

                {/* Inquiries */}
                <section id="ad-inquiries" aria-labelledby="ad-inquiries-title" className="scroll-mt-20 overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-black/[0.04]">
                    <h2 id="ad-inquiries-title" className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 px-5 py-4 font-[Sora] font-semibold text-gray-900 dark:text-slate-100"><MessageSquare size={17} className="text-[#0E3B2E] dark:text-emerald-300" aria-hidden="true" />{t('Visitor inquiries')}</h2>
                    {inquiries.length ? (
                        <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                            {inquiries.map((inquiry) => (
                                <li key={inquiry.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-gray-900 dark:text-slate-100">{inquiry.visitor_name}
                                            {inquiry.status === 'new' && <span className="ml-2 rounded-full bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold uppercase text-amber-800 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-500/30">{t('New')}</span>}
                                        </p>
                                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-600 dark:text-slate-300">
                                            <a href={`tel:${inquiry.visitor_phone}`} className="inline-flex items-center gap-1 hover:text-[#0E3B2E] dark:hover:text-emerald-200"><Phone size={12} aria-hidden="true" />{inquiry.visitor_phone}</a>
                                            <a href={`mailto:${inquiry.visitor_email}`} className="inline-flex items-center gap-1 break-all hover:text-[#0E3B2E] dark:hover:text-emerald-200"><Mail size={12} aria-hidden="true" />{inquiry.visitor_email}</a>
                                        </p>
                                        <p className="mt-1.5 break-words text-sm text-gray-800 dark:text-slate-100">“{inquiry.message}”</p>
                                        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{inquiry.property?.name}{inquiry.unit ? ` · ${t('Room :number', { number: inquiry.unit.unit_number })}` : ''} · {date(inquiry.created_at)}</p>
                                    </div>
                                    {inquiry.status === 'new' && (
                                        <button type="button" onClick={() => router.post(route('inquiries.read', inquiry.id), {}, { preserveScroll: true })}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-gray-800 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800">
                                            <CheckCircle2 size={13} aria-hidden="true" />{t('Mark as read')}
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : <p className="px-5 py-8 text-center text-sm text-gray-600 dark:text-slate-300">{t('Inquiries from visitors appear here once a property is on the homepage. You also get them by SMS and email.')}</p>}
                </section>

                {/* Payments */}
                {purchases.length > 0 && (
                    <section aria-labelledby="purchases-title" className="overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-black/[0.04]">
                        <h2 id="purchases-title" className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 px-5 py-4 font-[Sora] font-semibold text-gray-900 dark:text-slate-100"><Receipt size={17} className="text-[#0E3B2E] dark:text-emerald-300" aria-hidden="true" />{t('Your payments')}</h2>
                        <ul className="divide-y divide-gray-100 dark:divide-slate-800 text-sm">
                            {purchases.map((purchase) => (
                                <li key={purchase.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 dark:text-slate-100">{purchase.property || t(':count listings', { count: purchase.listings + purchase.bonus })}
                                            {purchase.bonus ? <span className="ml-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">({t('+:free free listings', { free: purchase.bonus })})</span> : null}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-slate-400">{date(purchase.created_at)}{purchase.receipt_number ? ` · ${purchase.receipt_number}` : ''}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold tabular-nums text-gray-900 dark:text-slate-100">{money(purchase.amount)}</p>
                                        <span className={`text-xs font-semibold ${purchase.status === 'approved' ? 'text-emerald-700 dark:text-emerald-300' : purchase.status === 'pending' ? 'text-amber-700 dark:text-amber-300' : purchase.status === 'rejected' ? 'text-red-700 dark:text-red-300' : 'text-gray-500 dark:text-slate-400'}`}>
                                            {t({ approved: 'Paid', pending: purchase.method === 'mobile_money' ? 'Waiting on phone' : 'Waiting for checking', failed: 'Not completed', rejected: 'Not approved' }[purchase.status] || purchase.status)}
                                        </span>
                                        {purchase.status === 'rejected' && purchase.rejection_reason && <p className="max-w-[16rem] text-xs text-red-700 dark:text-red-300">{purchase.rejection_reason}</p>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
