import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import RwandaFlag from '@/Components/RwandaFlag';
import RwandaPhoneInput from '@/Components/RwandaPhoneInput';
import { formatPhone, getNetwork, RWANDA_MOBILE_REGEX, toLocalDigits } from '@/lib/rwanda';
import { useTranslation } from '@/localization';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertCircle, AlertTriangle, Banknote, Building2, CalendarCheck2, CheckCircle2, Clock3, FileCheck2, FileText, Landmark,
    Loader2, Receipt, Send, ShieldCheck, Smartphone, Upload, Wallet, XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { csrfFetch } from '@/lib/csrf';

const localeFor = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';
const call = async (url, options = {}) => {
    const res = await csrfFetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const first = json?.errors ? Object.values(json.errors)[0] : null;
        throw new Error((Array.isArray(first) ? first[0] : first) || json?.message || 'Request failed');
    }
    return json;
};

const STATUS_STYLE = {
    approved: ['bg-emerald-50 text-emerald-800 ring-emerald-200', 'Paid'],
    pending: ['bg-amber-50 text-amber-900 ring-amber-200', 'Being checked'],
    rejected: ['bg-red-50 text-red-800 ring-red-200', 'Not accepted'],
    failed: ['bg-gray-100 text-gray-700 ring-gray-200', 'Not completed'],
};
const METHOD_LABEL = { momo_pay: 'MoMo Pay', mobile_money: 'Mobile money', bank_transfer: 'Bank transfer', cheque: 'Cheque' };

const STATE_STYLE = {
    unpaid: ['bg-amber-50 text-amber-900 ring-amber-200', 'Waiting for payment'],
    active: ['bg-emerald-50 text-emerald-800 ring-emerald-200', 'Active'],
    expiring: ['bg-sky-50 text-sky-800 ring-sky-200', 'Ends soon'],
    grace: ['bg-red-50 text-red-800 ring-red-200', 'Overdue'],
    paused: ['bg-gray-100 text-gray-700 ring-gray-200', 'Paused'],
};

export default function SubscriptionIndex({ subscription: initial, monthlyPrice, monthOptions = [1, 3, 6, 12], payments = [], phone: ownerPhone, bank = null, momoPay = {}, momoApi = false, selectedProperty = null }) {
    const { t, language } = useTranslation();
    const locale = localeFor(language);
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    // A plain date (2026-11-19) is read at midday so no time zone moves it to another day.
    const longDate = (value) => (value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(typeof value === 'string' && value.length === 10 ? `${value}T12:00:00` : value)) : '—');
    const [subscription, setSubscription] = useState(initial);
    useEffect(() => setSubscription(initial), [initial]);

    // Each property is paid on its own: 100,000 RWF per month.
    const properties = subscription.properties || [];
    const firstToPay = properties.find((p) => p.id === selectedProperty) || properties.find((p) => p.state !== 'active') || properties[0];
    const [propertyId, setPropertyId] = useState(firstToPay?.id ?? null);
    useEffect(() => {
        if (!properties.some((p) => p.id === propertyId)) setPropertyId(firstToPay?.id ?? null);
    }, [properties.length]);
    const property = properties.find((p) => p.id === propertyId) || null;
    const waiting = new Set(payments.filter((p) => p.status === 'pending').map((p) => p.property_id));

    const [months, setMonths] = useState(1);
    const plan = { property_id: propertyId, months };
    // MoMo Pay and bank transfer (with the slip); the phone request only where
    // the MoMo API is connected.
    const methods = [
        ['momo_pay', 'MoMo Pay', Smartphone],
        momoApi && ['mobile_money', 'Mobile money', Smartphone],
        ['bank_transfer', 'Bank transfer', Landmark],
        ['cheque', 'Cheque', Banknote],
    ].filter(Boolean);
    const [method, setMethod] = useState('momo_pay');
    const total = months * monthlyPrice;
    const paidUntil = property?.paid_until ? new Date(property.paid_until) : null;
    const startFrom = paidUntil && paidUntil > new Date() ? paidUntil : new Date();
    const newEnd = new Date(startFrom);
    newEnd.setMonth(newEnd.getMonth() + months);

    const needsAttention = (subscription.unpaid || 0) + (subscription.grace || 0) + (subscription.paused || 0);
    const tone = subscription.grace || subscription.paused ? 'red' : subscription.unpaid || subscription.expiring ? 'amber' : 'green';
    const tones = {
        green: 'from-[#0E3B2E] to-[#1F7A5A] text-white',
        amber: 'from-amber-500 to-amber-600 text-white',
        red: 'from-red-600 to-red-700 text-white',
    };

    return (
        <AuthenticatedLayout header="Subscription">
            <Head title={t('Subscription')} />
            <div className="mx-auto max-w-6xl space-y-5">
                {/* Status */}
                <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br p-6 shadow-sm sm:p-8 ${tones[tone]}`}>
                    <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative flex flex-wrap items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <span className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25" aria-hidden="true">
                                {tone === 'green' ? <ShieldCheck size={26} /> : <AlertTriangle size={26} />}
                            </span>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">{t('ITUZE subscription')}</p>
                                <h1 className="mt-1 font-[Sora] text-2xl font-bold sm:text-3xl">
                                    {properties.length === 0
                                        ? t('Add your first property')
                                        : needsAttention
                                            ? t(':count property(ies) need payment', { count: needsAttention })
                                            : t('All your properties are paid')}
                                </h1>
                                <p className="mt-1 text-sm text-white/85">
                                    {properties.length === 0
                                        ? t('Create a property, then pay for it here to activate it.')
                                        : t(':active of :total properties active', { active: subscription.active || 0, total: properties.length })}
                                </p>
                            </div>
                        </div>
                        <div className="rounded-2xl bg-white/15 px-5 py-4 text-right ring-1 ring-white/20">
                            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{t('Price')}</p>
                            <p className="font-[Sora] text-2xl font-bold">{money(monthlyPrice)}</p>
                            <p className="text-xs text-white/80">{t('per property, per month')}</p>
                        </div>
                    </div>
                </section>

                <div className="grid gap-5 lg:grid-cols-5">
                    {/* Pay */}
                    <section aria-labelledby="pay-title" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6 lg:col-span-3">
                        <h2 id="pay-title" className="flex items-center gap-2 font-[Sora] text-lg font-bold text-gray-900"><Wallet size={19} className="text-[#0E3B2E]" aria-hidden="true" />{t('Pay for a property')}</h2>

                        {properties.length === 0 ? (
                            <div className="mt-5 rounded-2xl border-2 border-dashed border-gray-200 p-6 text-center">
                                <p className="text-sm text-gray-700">{t('You have no property yet. Create one, and its payment form opens right after.')}</p>
                                <Link href={route('properties.create')} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#124B3A]">{t('Add a property')}</Link>
                            </div>
                        ) : (
                        <>
                        <fieldset className="mt-5">
                            <legend className="text-sm font-semibold text-gray-900">{t('1. Which property?')}</legend>
                            <div className="mt-2 space-y-2">
                                {properties.map((item) => {
                                    const [style, label] = STATE_STYLE[item.state] || STATE_STYLE.active;
                                    return (
                                        <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 transition ${propertyId === item.id ? 'border-[#0E3B2E] bg-emerald-50/60' : 'border-gray-200 hover:border-gray-300'}`}>
                                            <input type="radio" name="property" value={item.id} checked={propertyId === item.id} onChange={() => setPropertyId(item.id)} className="sr-only" />
                                            <Building2 size={18} className="flex-none text-[#0E3B2E]" aria-hidden="true" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-semibold text-gray-900">{item.name}</span>
                                                <span className="block text-xs text-gray-600">
                                                    {item.paid_until ? t('Paid until :date', { date: longDate(item.paid_until) }) : t('Not paid yet')}
                                                    {waiting.has(item.id) ? ` · ${t('a payment is being checked')}` : ''}
                                                </span>
                                            </span>
                                            <span className={`flex-none rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style}`}>{t(label)}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>

                        <fieldset className="mt-5">
                            <legend className="text-sm font-semibold text-gray-900">{t('2. How many months?')}</legend>
                            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {monthOptions.map((option) => (
                                    <label key={option} className={`relative cursor-pointer rounded-2xl border-2 p-3 text-center transition ${months === option ? 'border-[#0E3B2E] bg-emerald-50/60 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
                                        <input type="radio" name="months" value={option} checked={months === option} onChange={() => setMonths(option)} className="sr-only" />
                                        {option === 12 && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[#D9A441] px-2 py-0.5 text-[10px] font-bold uppercase text-[#0E3B2E]">{t('1 year')}</span>}
                                        <span className="block font-[Sora] text-xl font-bold text-gray-900">{option}</span>
                                        <span className="block text-xs text-gray-600">{t(option === 1 ? 'month' : 'months')}</span>
                                        <span className="mt-1 block text-xs font-semibold text-[#0E3B2E]">{money(option * monthlyPrice)}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="mt-3 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
                                <CalendarCheck2 size={16} className="flex-none text-[#0E3B2E]" aria-hidden="true" />
                                {t('Total :total · :property paid until :date after payment', { total: money(total), property: property?.name ?? '', date: longDate(newEnd) })}
                            </p>
                        </fieldset>

                        <fieldset className="mt-6">
                            <legend className="text-sm font-semibold text-gray-900">{t('3. How do you pay?')}</legend>
                            <div className={`mt-2 grid gap-2 ${methods.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                {methods.map(([value, label, Icon]) => (
                                    <label key={value} className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 p-3 text-center text-xs font-semibold transition sm:text-sm ${method === value ? 'border-[#0E3B2E] bg-emerald-50/60 text-[#0E3B2E]' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                                        <input type="radio" name="method" value={value} checked={method === value} onChange={() => setMethod(value)} className="sr-only" />
                                        <Icon size={20} aria-hidden="true" />
                                        {t(label)}
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <div className="mt-5">
                            {method === 'momo_pay' ? <MomoPayForm plan={plan} propertyName={property?.name} total={total} money={money} momoPay={momoPay} defaultPhone={ownerPhone} />
                            : method === 'mobile_money'
                                ? <MobileMoneyPay plan={plan} total={total} defaultPhone={ownerPhone} money={money} onPaid={(status) => { setSubscription(status); router.reload({ only: ['payments', 'subscription'] }); }} />
                                : <TransferPay key={method} plan={plan} method={method} total={total} money={money} bank={bank} />}
                        </div>
                        </>
                        )}
                    </section>

                    {/* How it works */}
                    <aside className="space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6 lg:col-span-2">
                        <h2 className="font-[Sora] font-semibold text-gray-900">{t('Good to know')}</h2>
                        {[
                            momoApi
                                ? [Smartphone, t('Mobile money is applied at once, as soon as you approve with your PIN.')]
                                : [Smartphone, t('Keep the MoMo SMS: its transaction ID proves your payment.')],
                            [FileCheck2, t('Every payment is checked by ITUZE, usually the same day. You get an email and SMS.')],
                            [CalendarCheck2, t('Paying early adds the months after your current end date: you never lose days.')],
                            [Building2, t('Each property is paid on its own: :price per month. Until it is paid you can set up its units, but not add tenants.', { price: money(monthlyPrice) })],
                            [Clock3, t('Reminders come 7 and 3 days before the end. After the end you have :days days before a pause.', { days: 7 })],
                            [ShieldCheck, t('A pause never deletes anything. Pay and everything is back immediately.')],
                        ].map(([Icon, text], index) => (
                            <p key={index} className="flex items-start gap-3 text-sm text-gray-700">
                                <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-emerald-50 text-[#0E3B2E]" aria-hidden="true"><Icon size={15} /></span>
                                {text}
                            </p>
                        ))}
                    </aside>
                </div>

                {/* History */}
                <section aria-labelledby="history-title" className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/[0.04]">
                    <h2 id="history-title" className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 font-[Sora] font-semibold text-gray-900"><Receipt size={17} className="text-[#0E3B2E]" aria-hidden="true" />{t('Payment history')}</h2>
                    {payments.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] text-left text-sm">
                                <caption className="sr-only">{t('Payment history')}</caption>
                                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-600">
                                    <tr>
                                        <th scope="col" className="px-5 py-3 font-semibold">{t('Date')}</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">{t('Property')}</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">{t('Months')}</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">{t('Method')}</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">{t('Status')}</th>
                                        <th scope="col" className="px-5 py-3 font-semibold">{t('Covers')}</th>
                                        <th scope="col" className="px-5 py-3 text-right font-semibold">{t('Amount')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {payments.map((payment) => {
                                        const [style, label] = STATUS_STYLE[payment.status] || STATUS_STYLE.failed;
                                        return (
                                            <tr key={payment.id} className="align-top">
                                                <td className="px-5 py-3">
                                                    <p className="text-gray-900">{longDate(payment.created_at)}</p>
                                                    {payment.receipt_number && <p className="font-mono text-[11px] text-gray-500">{payment.receipt_number}</p>}
                                                </td>
                                                <td className="px-5 py-3 font-medium text-gray-900">{payment.property || '—'}</td>
                                                <td className="px-5 py-3 text-gray-800">{payment.months}</td>
                                                <td className="px-5 py-3 text-gray-800">
                                                    {t(METHOD_LABEL[payment.method] || payment.method)}
                                                    {payment.reference && <span className="block break-all font-mono text-[11px] text-gray-500">{payment.reference}</span>}
                                                    {payment.has_proof && <a href={route('subscription.proof', payment.id)} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-[#0E3B2E] hover:underline"><FileText size={12} aria-hidden="true" />{t('Proof')}</a>}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style}`}>{t(label)}</span>
                                                    {payment.rejection_reason && <p className="mt-1 max-w-[220px] text-xs text-red-700">{payment.rejection_reason}</p>}
                                                </td>
                                                <td className="px-5 py-3 text-xs text-gray-700">{payment.period_end ? `${longDate(payment.period_start)} – ${longDate(payment.period_end)}` : '—'}</td>
                                                <td className="px-5 py-3 text-right font-semibold tabular-nums text-gray-900">{money(payment.amount)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : <p className="px-5 py-8 text-center text-sm text-gray-600">{t('No payments yet.')}</p>}
                </section>
            </div>
        </AuthenticatedLayout>
    );
}

/** Request to pay on the owner's phone, then follow it until approved. */
function MobileMoneyPay({ plan, total, defaultPhone, money, onPaid }) {
    const { t } = useTranslation();
    const [phone, setPhone] = useState(toLocalDigits(defaultPhone || ''));
    const [state, setState] = useState({ step: 'idle', error: '', payment: null, request: null });
    const poll = useRef(null);
    const phoneValid = RWANDA_MOBILE_REGEX.test(phone);

    const stop = () => { clearInterval(poll.current); poll.current = null; };
    useEffect(() => stop, []);
    useEffect(() => { stop(); setState({ step: 'idle', error: '', payment: null, request: null }); }, [months]);

    const follow = (paymentId) => {
        stop();
        poll.current = setInterval(async () => {
            try {
                const result = await call(route('subscription.momo.status', paymentId));
                if (result.request.status === 'successful') {
                    stop();
                    setState((current) => ({ ...current, step: 'paid', request: result.request, payment: result.payment }));
                    onPaid(result.subscription);
                } else if (['failed', 'expired'].includes(result.request.status)) {
                    stop();
                    setState((current) => ({ ...current, step: 'failed', error: result.request.failure_reason || t('The payment was not completed.') }));
                }
            } catch {
                /* keep trying until the request times out */
            }
        }, 4000);
    };

    const send = async () => {
        if (!phoneValid) {
            setState((current) => ({ ...current, error: t('Enter 10 digits starting with 078, 079, 072, or 073.') }));
            return;
        }
        setState({ step: 'sending', error: '', payment: null, request: null });
        try {
            const result = await call(route('subscription.momo.start'), { method: 'POST', body: JSON.stringify({ ...plan, phone: `0${phone}` }) });
            setState({ step: 'waiting', error: '', payment: result.payment, request: result.request });
            follow(result.payment.id);
        } catch (error) {
            setState({ step: 'idle', error: error.message, payment: null, request: null });
        }
    };

    if (state.step === 'paid') {
        return (
            <div className="animate-pop-in rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center" role="status">
                <CheckCircle2 size={36} className="mx-auto text-emerald-700" aria-hidden="true" />
                <p className="mt-2 font-[Sora] text-lg font-bold text-emerald-950">{t('Payment received. Thank you!')}</p>
                <p className="mt-1 text-sm text-emerald-900">{t('Receipt :number. You get a confirmation by email and SMS.', { number: state.payment?.receipt_number || '' })}</p>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-gray-200 p-4">
            <label htmlFor="momo-phone" className="text-sm font-medium text-gray-800">{t('Phone that pays (MTN MoMo or Airtel Money)')}</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
                <div className={`flex min-w-0 flex-1 items-stretch overflow-hidden rounded-xl border bg-white shadow-sm focus-within:ring-2 ${state.error ? 'border-red-400 focus-within:ring-red-500/20' : 'border-gray-300 focus-within:border-[#0E3B2E] focus-within:ring-[#0E3B2E]/15'}`}>
                    <span className="flex select-none items-center gap-2 border-r border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700"><RwandaFlag className="h-[15px] w-[22px]" />+250</span>
                    <input id="momo-phone" type="tel" inputMode="numeric" value={formatPhone(phone)} placeholder="788 123 456" disabled={state.step === 'waiting' || state.step === 'sending'}
                        onChange={(event) => setPhone(toLocalDigits(event.target.value))}
                        className="w-full min-w-0 border-0 bg-transparent px-3 py-2.5 text-sm tracking-wide focus:ring-0" />
                </div>
                <button type="button" onClick={send} disabled={state.step === 'waiting' || state.step === 'sending'}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#124B3A] disabled:opacity-60">
                    {state.step === 'sending' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                    {t('Pay :amount', { amount: money(total) })}
                </button>
            </div>
            {phoneValid && !state.error && state.step === 'idle' && <p className="mt-1 text-xs text-green-700">{t(':network number', { network: getNetwork(phone) })}</p>}
            {state.error && <p className="mt-2 flex items-center gap-1.5 text-sm text-red-700" role="alert"><AlertCircle size={15} aria-hidden="true" />{state.error}</p>}
            {state.step === 'waiting' && (
                <div className="mt-3 flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200" role="status" aria-live="polite">
                    <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-amber-700" aria-hidden="true" />
                    <p>{t('Check your phone: approve the payment of :amount with your PIN. This page updates by itself.', { amount: money(total) })}</p>
                </div>
            )}
            {state.step === 'failed' && (
                <div className="mt-3 flex items-start gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200" role="alert">
                    <XCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <p>{t('The payment was not completed. You can try again.')}</p>
                </div>
            )}
        </div>
    );
}

// "2026-10-24T14:05" for a datetime-local box, in the visitor's own time.
const localDateTime = (date) => {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * MoMo Pay without the API: pay our merchant code, then type what the MoMo
 * SMS says. ITUZE checks it against the MoMo statement and approves.
 */
function MomoPayForm({ plan, propertyName, total, money, momoPay, defaultPhone }) {
    const { t } = useTranslation();
    const form = useForm({ ...plan, amount: total, sender_name: '', sender_phone: toLocalDigits(defaultPhone || ''), paid_at: localDateTime(new Date()), transaction_id: '', proof: null });
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => { form.setData((current) => ({ ...current, ...plan, amount: total })); }, [plan.property_id, plan.months, total]);

    const dial = momoPay.code ? `*182*8*1*${momoPay.code}#` : null;
    const clientErrors = {};
    if (!form.data.sender_name.trim()) clientErrors.sender_name = t('Enter the name of the person who paid.');
    if (!RWANDA_MOBILE_REGEX.test(form.data.sender_phone)) clientErrors.sender_phone = t('Enter the 9 digits after +250, starting with 72, 73, 78 or 79.');
    if (!form.data.paid_at) clientErrors.paid_at = t('Enter the date and time of the payment.');
    if (!/^[0-9]{6,20}$/.test(form.data.transaction_id.replace(/\s+/g, ''))) clientErrors.transaction_id = t('Enter the transaction ID from the MoMo SMS: numbers only.');
    const errorFor = (field) => form.errors[field] || (submitted ? clientErrors[field] : null);
    const fieldClass = (field) => `mt-1.5 w-full rounded-xl border px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 ${errorFor(field) ? 'border-red-400 focus:ring-red-500/20' : 'border-gray-300 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]/15'}`;

    const submit = (event) => {
        event.preventDefault();
        setSubmitted(true);
        if (Object.keys(clientErrors).length) return;
        form.transform((data) => ({ ...data, sender_phone: `0${data.sender_phone}` }));
        form.post(route('subscription.momopay'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => { form.reset('transaction_id', 'proof', 'sender_name'); setSubmitted(false); },
        });
    };

    return (
        <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-gray-200 p-4">
            <div className="rounded-xl bg-[#FFCC00]/15 p-4 ring-1 ring-[#FFCC00]/50">
                <p className="text-sm font-bold text-gray-900">{t('Pay with MoMo Pay')}</p>
                {dial ? (
                    <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-gray-800">
                        <li>
                            {t('Dial')}{' '}
                            <a href={`tel:${encodeURIComponent(dial)}`} className="rounded bg-white px-1.5 py-0.5 font-mono font-bold text-gray-900 ring-1 ring-gray-200">{dial}</a>
                            {' '}{t('or choose MoMo Pay in the MoMo app and enter the code')}{' '}
                            <span className="font-mono font-bold">{momoPay.code}</span>
                            <button type="button" onClick={() => navigator.clipboard?.writeText(momoPay.code)} className="ml-1.5 rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-[#0E3B2E] ring-1 ring-gray-200 hover:bg-gray-50">{t('Copy')}</button>
                        </li>
                        <li>{t('Pay exactly :amount to :name.', { amount: money(total), name: momoPay.name })}</li>
                        <li>{t('Fill in the form below with the details from your MoMo SMS.')}</li>
                    </ol>
                ) : (
                    <p className="mt-1 text-sm text-gray-800">{t('The MoMo Pay code will be shown here soon. Until then, call ITUZE on 0793 905 166 to get it.')}</p>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-gray-800">
                    {t('Name of the person who paid')}
                    <input value={form.data.sender_name} onChange={(event) => form.setData('sender_name', event.target.value)} autoComplete="name" className={fieldClass('sender_name')} aria-invalid={errorFor('sender_name') ? 'true' : undefined} />
                    {errorFor('sender_name') && <span className="mt-1 block text-xs text-red-600">{t(errorFor('sender_name'))}</span>}
                </label>
                <div>
                    <label htmlFor="momo-sender-phone" className="block text-sm font-medium text-gray-800">{t('Phone number that paid')}</label>
                    <RwandaPhoneInput id="momo-sender-phone" value={form.data.sender_phone} onChange={(digits) => form.setData('sender_phone', digits)} error={errorFor('sender_phone')} className="mt-1.5" />
                </div>
                <label className="block text-sm font-medium text-gray-800">
                    {t('Amount paid')}
                    <input value={money(total)} readOnly className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-900" aria-describedby="momo-amount-help" />
                    <span id="momo-amount-help" className="mt-1 block text-xs text-gray-600">{t(':property for :months month(s). Change it above if you paid for more.', { property: propertyName ?? '', months: plan.months })}</span>
                    {form.errors.amount && <span className="mt-1 block text-xs text-red-600">{t(form.errors.amount)}</span>}
                </label>
                <label className="block text-sm font-medium text-gray-800">
                    {t('Date and time of the payment')}
                    <input type="datetime-local" value={form.data.paid_at} max={localDateTime(new Date())} onChange={(event) => form.setData('paid_at', event.target.value)} className={fieldClass('paid_at')} aria-invalid={errorFor('paid_at') ? 'true' : undefined} />
                    {errorFor('paid_at') && <span className="mt-1 block text-xs text-red-600">{t(errorFor('paid_at'))}</span>}
                </label>
                <label className="block text-sm font-medium text-gray-800 sm:col-span-2">
                    {t('MoMo transaction ID')}
                    <input value={form.data.transaction_id} onChange={(event) => form.setData('transaction_id', event.target.value.replace(/[^\d\s]/g, ''))} inputMode="numeric" placeholder="1234567890" className={`${fieldClass('transaction_id')} font-mono tracking-wide`} aria-invalid={errorFor('transaction_id') ? 'true' : undefined} aria-describedby="momo-txn-help" />
                    <span id="momo-txn-help" className="mt-1 block text-xs text-gray-600">{t('In the MoMo SMS, after "Financial Transaction Id" or "TxId".')}</span>
                    {errorFor('transaction_id') && <span className="mt-1 block text-xs text-red-600">{t(errorFor('transaction_id'))}</span>}
                </label>
            </div>

            <div>
                <p className="text-sm font-medium text-gray-800">{t('Screenshot of the MoMo SMS')} <span className="font-normal text-gray-500">({t('optional')})</span></p>
                <label className={`mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-sm transition ${form.data.proof ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-300 hover:border-[#0E3B2E]/40 hover:bg-gray-50'}`}>
                    <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(event) => form.setData('proof', event.target.files?.[0] || null)} />
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white text-[#0E3B2E] ring-1 ring-gray-200" aria-hidden="true">{form.data.proof ? <FileCheck2 size={17} /> : <Upload size={17} />}</span>
                    <span className="min-w-0">
                        <span className="block truncate font-semibold text-gray-900">{form.data.proof ? form.data.proof.name : t('Choose a file')}</span>
                        <span className="block text-xs text-gray-600">{t('JPG, PNG or PDF, up to 5 MB')}</span>
                    </span>
                </label>
                {form.errors.proof && <span className="mt-1 block text-xs text-red-600">{t(form.errors.proof)}</span>}
            </div>

            {(form.errors.property_id || form.errors.months) && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">{t(form.errors.property_id || form.errors.months)}</p>}
            {form.errors.reference && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">{t(form.errors.reference)}</p>}

            <button disabled={form.processing} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-3 text-sm font-semibold text-white hover:bg-[#124B3A] disabled:opacity-60">
                {form.processing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                {form.processing ? t('Sending…') : t('Send for checking · :amount', { amount: money(total) })}
            </button>
        </form>
    );
}

/** Bank transfer or cheque: reference plus a photo / PDF of the slip or cheque. */
function TransferPay({ plan, method, total, money, bank }) {
    const { t } = useTranslation();
    const form = useForm({ ...plan, method, reference: '', proof: null });
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => { form.setData((current) => ({ ...current, ...plan, method })); }, [plan.property_id, plan.months, method]);

    const isCheque = method === 'cheque';
    const clientErrors = {};
    if (!form.data.reference.trim()) clientErrors.reference = isCheque ? t('Enter the cheque number.') : t('Enter the bank slip reference.');
    if (!form.data.proof) clientErrors.proof = isCheque ? t('Attach a photo of the cheque.') : t('Attach a photo or PDF of the bank slip.');
    const errorFor = (field) => form.errors[field] || (submitted ? clientErrors[field] : null);

    const submit = (event) => {
        event.preventDefault();
        setSubmitted(true);
        if (Object.keys(clientErrors).length) return;
        form.post(route('subscription.transfer'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => { form.reset('reference', 'proof'); setSubmitted(false); },
        });
    };

    return (
        <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-gray-200 p-4">
            <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-950 ring-1 ring-sky-100">
                {isCheque
                    ? t('Write the cheque to Q.R.A GROUP LTD for :amount, then send its number and a photo here.', { amount: money(total) })
                    : t('Pay :amount to the Q.R.A GROUP LTD bank account, then send the slip reference and a photo of the slip here.', { amount: money(total) })}
            </p>
            {!isCheque && bank && (
                <dl className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm sm:grid-cols-2">
                    {[[t('Bank'), bank.bank], [t('Account name'), bank.account_name], [t('Account number'), bank.account_number]].filter(([, value]) => value).map(([label, value]) => (
                        <div key={label}>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{label}</dt>
                            <dd className="mt-0.5 flex items-center justify-between gap-2 font-semibold text-gray-900">
                                <span className="min-w-0 break-words">{value}</span>
                                <button type="button" onClick={() => navigator.clipboard?.writeText(value)} className="shrink-0 whitespace-nowrap rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-[#0E3B2E] ring-1 ring-emerald-200 hover:bg-emerald-50">{t('Copy')}</button>
                            </dd>
                        </div>
                    ))}
                    {!bank.account_number && <p className="text-xs text-emerald-900 sm:col-span-2">{t('Ask ITUZE GREEN PLATFORM for the account number before paying.')}</p>}
                </dl>
            )}
            <label className="block text-sm font-medium text-gray-800">
                {isCheque ? t('Cheque number') : t('Bank slip reference')}
                <input value={form.data.reference} onChange={(event) => form.setData('reference', event.target.value)}
                    className={`mt-1.5 w-full rounded-xl border px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 ${errorFor('reference') ? 'border-red-400 focus:ring-red-500/20' : 'border-gray-300 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]/15'}`}
                    aria-invalid={errorFor('reference') ? 'true' : undefined} />
                {errorFor('reference') && <span className="mt-1 block text-xs text-red-600">{errorFor('reference')}</span>}
                {(form.errors.property_id || form.errors.months) && <span className="mt-1 block text-xs text-red-600">{t(form.errors.property_id || form.errors.months)}</span>}
            </label>
            <div>
                <p className="text-sm font-medium text-gray-800">{isCheque ? t('Photo of the cheque') : t('Photo or PDF of the slip')}</p>
                <label className={`mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 text-sm transition ${form.data.proof ? 'border-emerald-300 bg-emerald-50/50' : errorFor('proof') ? 'border-red-300 bg-red-50/40' : 'border-gray-300 hover:border-[#0E3B2E]/40 hover:bg-gray-50'}`}>
                    <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(event) => form.setData('proof', event.target.files?.[0] || null)} />
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white text-[#0E3B2E] ring-1 ring-gray-200" aria-hidden="true">{form.data.proof ? <FileCheck2 size={18} /> : <Upload size={18} />}</span>
                    <span className="min-w-0">
                        <span className="block truncate font-semibold text-gray-900">{form.data.proof ? form.data.proof.name : t('Choose a file')}</span>
                        <span className="block text-xs text-gray-600">{t('JPG, PNG or PDF, up to 5 MB')}</span>
                    </span>
                </label>
                {errorFor('proof') && <span className="mt-1 block text-xs text-red-600">{errorFor('proof')}</span>}
            </div>
            <button disabled={form.processing} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-3 text-sm font-semibold text-white hover:bg-[#124B3A] disabled:opacity-60">
                {form.processing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                {form.processing ? t('Sending…') : t('Send for checking · :amount', { amount: money(total) })}
            </button>
        </form>
    );
}
