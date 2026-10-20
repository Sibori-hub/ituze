import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import RwandaFlag from '@/Components/RwandaFlag';
import UserAvatar from '@/Components/UserAvatar';
import { formatPhone, getNetwork, RWANDA_MOBILE_REGEX, toLocalDigits } from '@/lib/rwanda';
import { useTranslation } from '@/localization';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle, BadgeCheck, Building2, CalendarClock, CheckCircle2, Eye, Gift, Hourglass, Loader2, Mail, Megaphone,
    MessageSquare, Phone, Plus, Receipt, Rocket, Send, Sparkles, XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const localeFor = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';
const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
    || decodeURIComponent(document.cookie.match(/(^|;\s*)XSRF-TOKEN=([^;]+)/)?.[2] || '');
const call = async (url, options = {}) => {
    const res = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf(), 'X-XSRF-TOKEN': csrf() },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const first = json?.errors ? Object.values(json.errors)[0] : null;
        throw new Error((Array.isArray(first) ? first[0] : first) || json?.message || 'Request failed');
    }
    return json;
};
const imageSource = (path) => (!path ? null : /^https?:\/\//i.test(path) ? path : `/storage/${path}`);

export default function AdvertiserDashboard({
    status, adUnitPrice = 25000, welcomeBonusUnits = 3, bonusAvailable = true, listingDays = 60,
    credits = 0, buildings = [], purchases = [], inquiries = [], phone, hasPaid = false,
}) {
    const { t, language } = useTranslation();
    const user = usePage().props.auth.user;
    const locale = localeFor(language);
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    const date = (value) => (value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—');
    const approved = status === 'approved';
    const [publishing, setPublishing] = useState(null);
    const listedCount = buildings.filter((building) => building.is_listed).length;

    if (!approved) {
        return (
            <AuthenticatedLayout header="Advertiser dashboard">
                <Head title={t('Advertiser dashboard')} />
                <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-black/[0.04]">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700" aria-hidden="true"><Hourglass size={26} /></span>
                    <h1 className="mt-4 font-[Sora] text-xl font-bold text-gray-900">{t('Your advertiser account is under review')}</h1>
                    <p className="mt-2 text-sm text-gray-600">{t('Our team is reviewing your details. You will be able to advertise as soon as an administrator approves your account.')}</p>
                </div>
            </AuthenticatedLayout>
        );
    }

    const publish = (building) => {
        setPublishing(building.id);
        router.post(route('advertising.publish', building.id), {}, { preserveScroll: true, onFinish: () => setPublishing(null) });
    };

    return (
        <AuthenticatedLayout header="Advertiser dashboard">
            <Head title={t('Listings')} />
            <div className="mx-auto max-w-6xl space-y-5">
                {/* Welcome */}
                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-white to-amber-50 p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-7">
                    <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#D9A441]/20 blur-3xl" />
                    <div className="relative flex flex-wrap items-center justify-between gap-5">
                        <div className="flex items-center gap-4">
                            <UserAvatar user={user} size="xl" className="ring-4 ring-white shadow-lg" />
                            <div>
                                <p className="inline-flex items-center gap-1.5 rounded-full bg-[#0E3B2E]/[0.06] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0E3B2E]"><Megaphone size={13} aria-hidden="true" />{t('Advertiser')}</p>
                                <h1 className="mt-2 font-[Sora] text-2xl font-bold text-gray-900 sm:text-3xl">{t('Welcome back, :name', { name: user.first_name || user.name })}</h1>
                                <p className="mt-1 text-sm text-gray-600">{t('Show your buildings to people looking for a space on the ITUZE homepage.')}</p>
                            </div>
                        </div>
                        {hasPaid && <Link href={route('properties.create')} className="inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(14,59,46,0.8)] transition hover:bg-[#124B3A]">
                            <Plus size={16} aria-hidden="true" />{t('Add a building')}
                        </Link>}
                    </div>
                </section>

                {!hasPaid && (
                    <section className="flex flex-wrap items-center gap-4 rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50/70 p-5 sm:p-6" role="status">
                        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#D9A441] font-[Sora] text-xl font-bold text-[#0E3B2E]" aria-hidden="true">1</span>
                        <div className="min-w-0 flex-1">
                            <p className="font-[Sora] text-lg font-bold text-gray-900">{t('Start with your first payment')}</p>
                            <p className="mt-0.5 text-sm text-gray-700">{t('Pay :price for your first listing (you also get :bonus free). Then you can add your buildings, rooms and photos and publish them.', { price: money(adUnitPrice), bonus: welcomeBonusUnits })}</p>
                        </div>
                        <a href="#buy-title" className="inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#124B3A]">{t('Pay now')}</a>
                    </section>
                )}

                {/* Figures */}
                <section aria-label={t('Summary')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                        { label: t('Listings available'), value: credits, icon: Sparkles, tone: 'bg-amber-50 text-amber-800 ring-amber-100', note: t('Each one shows a building for :days days', { days: listingDays }) },
                        { label: t('On the homepage now'), value: listedCount, icon: Eye, tone: 'bg-emerald-50 text-emerald-800 ring-emerald-100', note: buildings.length === 1 ? t('1 building in total') : t(':count buildings in total', { count: buildings.length }) },
                        { label: t('New inquiries'), value: inquiries.filter((inquiry) => inquiry.status === 'new').length, icon: MessageSquare, tone: 'bg-sky-50 text-sky-800 ring-sky-100', note: t('From visitors interested in your spaces') },
                        { label: t('Price per listing'), value: money(adUnitPrice), icon: Receipt, tone: 'bg-violet-50 text-violet-800 ring-violet-100', note: t(':days days on the homepage', { days: listingDays }) },
                    ].map(({ label, value, icon: Icon, tone, note }) => (
                        <div key={label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] sm:p-5">
                            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${tone}`} aria-hidden="true"><Icon size={17} /></span>
                            <p className="mt-3 font-[Sora] text-xl font-bold tabular-nums text-gray-900 sm:text-2xl">{value}</p>
                            <p className="mt-0.5 text-xs font-semibold text-gray-700 sm:text-sm">{label}</p>
                            <p className="text-[11px] text-gray-500">{note}</p>
                        </div>
                    ))}
                </section>

                <div className="grid gap-5 lg:grid-cols-5">
                    {/* Buildings */}
                    <section aria-labelledby="buildings-title" className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/[0.04] lg:col-span-3">
                        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                            <h2 id="buildings-title" className="flex items-center gap-2 font-[Sora] font-semibold text-gray-900"><Building2 size={17} className="text-[#0E3B2E]" aria-hidden="true" />{t('Your buildings')}</h2>
                            {hasPaid && <Link href={route('properties.index')} className="text-sm font-semibold text-[#0E3B2E] hover:underline">{t('Manage')}</Link>}
                        </div>
                        {buildings.length ? (
                            <ul className="divide-y divide-gray-100">
                                {buildings.map((building) => (
                                    <li key={building.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                                        <div className="h-16 w-20 flex-none overflow-hidden rounded-xl bg-gradient-to-br from-[#0E3B2E]/10 to-[#D9A441]/10">
                                            {building.cover
                                                ? <img src={imageSource(building.cover)} alt="" className="h-full w-full object-cover" loading="lazy" />
                                                : <span className="flex h-full items-center justify-center"><Building2 size={22} className="text-[#0E3B2E]/50" aria-hidden="true" /></span>}
                                        </div>
                                        <div className="min-w-[160px] flex-1">
                                            <Link href={route('properties.show', building.id)} className="font-semibold text-gray-900 hover:text-[#0E3B2E] hover:underline">{building.name}</Link>
                                            <p className="text-xs text-gray-600">{t(building.rooms === 1 ? '1 room' : ':count rooms', { count: building.rooms })}{building.new_inquiries ? ` · ${t(':count new inquiries', { count: building.new_inquiries })}` : ''}</p>
                                            {building.is_listed
                                                ? <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200"><Eye size={12} aria-hidden="true" />{t('On the homepage until :date (:days days left)', { date: date(building.listed_until), days: building.days_left })}</p>
                                                : <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">{building.listed_until ? t('Ended on :date', { date: date(building.listed_until) }) : t('Not on the homepage')}</p>}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {building.is_listed && <a href={route('public.properties.show', building.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"><Eye size={13} aria-hidden="true" />{t('See it')}</a>}
                                            <button type="button" onClick={() => publish(building)} disabled={credits < 1 || building.rooms < 1 || publishing === building.id}
                                                title={building.rooms < 1 ? t('Add at least one room first') : credits < 1 ? t('Buy listings first') : undefined}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E3B2E] px-3 py-2 text-xs font-semibold text-white hover:bg-[#124B3A] disabled:cursor-not-allowed disabled:opacity-40">
                                                {publishing === building.id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Rocket size={13} aria-hidden="true" />}
                                                {building.is_listed ? t('Extend :days days', { days: listingDays }) : t('Publish (1 listing)')}
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="px-5 py-10 text-center">
                                <Building2 size={30} className="mx-auto text-gray-300" aria-hidden="true" />
                                <p className="mt-2 font-semibold text-gray-900">{t('No buildings yet')}</p>
                                <p className="mt-1 text-sm text-gray-600">{hasPaid ? t('Add a building with its rooms and photos, then publish it.') : t('Your buildings appear here after your first payment.')}</p>
                                {hasPaid && <Link href={route('properties.create')} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-4 py-2 text-sm font-semibold text-white"><Plus size={15} aria-hidden="true" />{t('Add a building')}</Link>}
                            </div>
                        )}
                    </section>

                    {/* Buy */}
                    <BuyListings price={adUnitPrice} bonus={bonusAvailable ? welcomeBonusUnits : 0} listingDays={listingDays} defaultPhone={phone} money={money} />
                </div>

                {/* Inquiries */}
                <section id="ad-inquiries" aria-labelledby="ad-inquiries-title" className="scroll-mt-20 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/[0.04]">
                    <h2 id="ad-inquiries-title" className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 font-[Sora] font-semibold text-gray-900"><MessageSquare size={17} className="text-[#0E3B2E]" aria-hidden="true" />{t('Visitor inquiries')}</h2>
                    {inquiries.length ? (
                        <ul className="divide-y divide-gray-100">
                            {inquiries.map((inquiry) => (
                                <li key={inquiry.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                                    <div className="min-w-[200px] flex-1">
                                        <p className="font-semibold text-gray-900">{inquiry.visitor_name}
                                            {inquiry.status === 'new' && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase text-amber-800 ring-1 ring-amber-200">{t('New')}</span>}
                                        </p>
                                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-600">
                                            <a href={`tel:${inquiry.visitor_phone}`} className="inline-flex items-center gap-1 hover:text-[#0E3B2E]"><Phone size={12} aria-hidden="true" />{inquiry.visitor_phone}</a>
                                            <a href={`mailto:${inquiry.visitor_email}`} className="inline-flex items-center gap-1 hover:text-[#0E3B2E]"><Mail size={12} aria-hidden="true" />{inquiry.visitor_email}</a>
                                        </p>
                                        <p className="mt-1.5 text-sm text-gray-800">“{inquiry.message}”</p>
                                        <p className="mt-1 text-xs text-gray-500">{inquiry.property?.name}{inquiry.unit ? ` · ${t('Room :number', { number: inquiry.unit.unit_number })}` : ''} · {date(inquiry.created_at)}</p>
                                    </div>
                                    {inquiry.status === 'new' && (
                                        <button type="button" onClick={() => router.post(route('inquiries.read', inquiry.id), {}, { preserveScroll: true })}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50">
                                            <CheckCircle2 size={13} aria-hidden="true" />{t('Mark as read')}
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : <p className="px-5 py-8 text-center text-sm text-gray-600">{t('Inquiries from visitors appear here once a building is on the homepage.')}</p>}
                </section>

                {/* Purchases */}
                {purchases.length > 0 && (
                    <section aria-labelledby="purchases-title" className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/[0.04]">
                        <h2 id="purchases-title" className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 font-[Sora] font-semibold text-gray-900"><Receipt size={17} className="text-[#0E3B2E]" aria-hidden="true" />{t('Your payments')}</h2>
                        <ul className="divide-y divide-gray-100 text-sm">
                            {purchases.map((purchase) => (
                                <li key={purchase.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                                    <div>
                                        <p className="font-semibold text-gray-900">{t(':count listings', { count: purchase.listings + purchase.bonus })}{purchase.bonus ? <span className="ml-1.5 text-xs font-semibold text-amber-800">({t(':paid paid + :free free', { paid: purchase.listings, free: purchase.bonus })})</span> : null}</p>
                                        <p className="text-xs text-gray-500">{date(purchase.created_at)}{purchase.receipt_number ? ` · ${purchase.receipt_number}` : ''}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold tabular-nums text-gray-900">{money(purchase.amount)}</p>
                                        <span className={`text-xs font-semibold ${purchase.status === 'approved' ? 'text-emerald-700' : purchase.status === 'pending' ? 'text-amber-700' : 'text-gray-500'}`}>
                                            {t({ approved: 'Paid', pending: 'Waiting on phone', failed: 'Not completed' }[purchase.status] || purchase.status)}
                                        </span>
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

/** Choose how many listings, then pay on the phone with MoMo. */
function BuyListings({ price, bonus, listingDays, defaultPhone, money }) {
    const { t } = useTranslation();
    const [count, setCount] = useState(1);
    const [phone, setPhone] = useState(toLocalDigits(defaultPhone || ''));
    const [state, setState] = useState({ step: 'idle', error: '', purchase: null });
    const poll = useRef(null);
    const phoneValid = RWANDA_MOBILE_REGEX.test(phone);
    const total = count * price;

    const stop = () => { clearInterval(poll.current); poll.current = null; };
    useEffect(() => stop, []);

    const follow = (id) => {
        stop();
        poll.current = setInterval(async () => {
            try {
                const result = await call(route('advertising.purchases.status', id));
                if (result.request.status === 'successful') {
                    stop();
                    setState({ step: 'paid', error: '', purchase: result.purchase });
                    router.reload();
                } else if (['failed', 'expired'].includes(result.request.status)) {
                    stop();
                    setState({ step: 'failed', error: result.request.failure_reason || t('The payment was not completed.'), purchase: null });
                }
            } catch {
                /* keep trying until the request times out */
            }
        }, 4000);
    };

    const pay = async () => {
        if (!phoneValid) {
            setState((current) => ({ ...current, error: t('Enter 10 digits starting with 078, 079, 072, or 073.') }));
            return;
        }
        setState({ step: 'sending', error: '', purchase: null });
        try {
            const result = await call(route('advertising.purchases.start'), { method: 'POST', body: JSON.stringify({ listings: count, phone: `0${phone}` }) });
            setState({ step: 'waiting', error: '', purchase: result.purchase });
            follow(result.purchase.id);
        } catch (error) {
            setState({ step: 'idle', error: error.message, purchase: null });
        }
    };

    return (
        <section aria-labelledby="buy-title" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6 lg:col-span-2">
            <h2 id="buy-title" className="flex items-center gap-2 font-[Sora] font-semibold text-gray-900"><Sparkles size={17} className="text-amber-600" aria-hidden="true" />{t('Buy listings')}</h2>
            <p className="mt-1 text-xs text-gray-600">{t(':price per building, shown for :days days. Paid by MTN MoMo or Airtel Money.', { price: money(price), days: listingDays })}</p>

            {bonus > 0 && (
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-gradient-to-r from-amber-100 to-amber-50 px-3 py-2.5 text-sm text-amber-950 ring-1 ring-amber-200">
                    <Gift size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
                    <span><strong>{t('First purchase gift:')}</strong> {t('get :bonus extra listings free. Pay 1, get :total.', { bonus, total: bonus + 1 })}</span>
                </p>
            )}

            {state.step === 'paid' ? (
                <div className="mt-5 animate-pop-in rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center" role="status">
                    <CheckCircle2 size={34} className="mx-auto text-emerald-700" aria-hidden="true" />
                    <p className="mt-2 font-[Sora] text-lg font-bold text-emerald-950">{t('Payment received!')}</p>
                    <p className="mt-1 text-sm text-emerald-900">{t('Your listings are ready. Publish a building on the left.')}</p>
                    <button type="button" onClick={() => setState({ step: 'idle', error: '', purchase: null })} className="mt-3 text-sm font-semibold text-[#0E3B2E] hover:underline">{t('Buy more')}</button>
                </div>
            ) : (
                <>
                    <fieldset className="mt-5">
                        <legend className="text-sm font-semibold text-gray-900">{t('How many buildings?')}</legend>
                        <div className="mt-2 grid grid-cols-4 gap-2">
                            {[1, 2, 3, 5].map((option) => (
                                <label key={option} className={`cursor-pointer rounded-xl border-2 py-2 text-center transition ${count === option ? 'border-[#0E3B2E] bg-emerald-50/60' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <input type="radio" name="listings" value={option} checked={count === option} onChange={() => setCount(option)} className="sr-only" />
                                    <span className="block font-[Sora] text-lg font-bold text-gray-900">{option}</span>
                                    {bonus > 0 && <span className="block text-[10px] font-semibold text-amber-700">+{bonus}</span>}
                                </label>
                            ))}
                        </div>
                        <p className="mt-2 text-sm text-gray-700">
                            {t('You get :count listings for :total', { count: count + bonus, total: money(total) })}
                        </p>
                    </fieldset>

                    <label htmlFor="ad-phone" className="mt-4 block text-sm font-medium text-gray-800">{t('Phone that pays (MTN MoMo or Airtel Money)')}</label>
                    <div className={`mt-1.5 flex items-stretch overflow-hidden rounded-xl border bg-white shadow-sm focus-within:ring-2 ${state.error ? 'border-red-400 focus-within:ring-red-500/20' : 'border-gray-300 focus-within:border-[#0E3B2E] focus-within:ring-[#0E3B2E]/15'}`}>
                        <span className="flex select-none items-center gap-2 border-r border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700"><RwandaFlag className="h-[15px] w-[22px]" />+250</span>
                        <input id="ad-phone" type="tel" inputMode="numeric" value={formatPhone(phone)} placeholder="788 123 456" disabled={state.step === 'waiting' || state.step === 'sending'}
                            onChange={(event) => setPhone(toLocalDigits(event.target.value))} className="w-full min-w-0 border-0 bg-transparent px-3 py-2.5 text-sm tracking-wide focus:ring-0" />
                    </div>
                    {phoneValid && !state.error && state.step === 'idle' && <p className="mt-1 text-xs text-green-700">{t(':network number', { network: getNetwork(phone) })}</p>}
                    {state.error && <p className="mt-2 flex items-center gap-1.5 text-sm text-red-700" role="alert"><AlertCircle size={15} aria-hidden="true" />{state.error}</p>}

                    {state.step === 'waiting' ? (
                        <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200" role="status" aria-live="polite">
                            <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-amber-700" aria-hidden="true" />
                            <p>{t('Check your phone: approve the payment of :amount with your PIN. This page updates by itself.', { amount: money(total) })}</p>
                        </div>
                    ) : (
                        <button type="button" onClick={pay} disabled={state.step === 'sending'}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-3 text-sm font-semibold text-white hover:bg-[#124B3A] disabled:opacity-60">
                            {state.step === 'sending' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                            {t('Pay :amount', { amount: money(total) })}
                        </button>
                    )}
                    {state.step === 'failed' && <p className="mt-2 flex items-center gap-1.5 text-sm text-red-700"><XCircle size={15} aria-hidden="true" />{t('The payment was not completed. You can try again.')}</p>}
                </>
            )}

            <ul className="mt-5 space-y-2 border-t border-gray-100 pt-4 text-xs text-gray-600">
                <li className="flex items-start gap-2"><BadgeCheck size={14} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />{t('Your building appears on the homepage the moment you publish it.')}</li>
                <li className="flex items-start gap-2"><CalendarClock size={14} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />{t('Extending adds :days days after the current end date.', { days: listingDays })}</li>
                <li className="flex items-start gap-2"><MessageSquare size={14} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />{t('Visitors contact you by email and phone through the listing.')}</li>
            </ul>
        </section>
    );
}
