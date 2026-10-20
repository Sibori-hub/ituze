import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import RwandaFlag from '@/Components/RwandaFlag';
import { formatPhone, getNetwork, RWANDA_MOBILE_REGEX, toLocalDigits } from '@/lib/rwanda';
import { useTranslation } from '@/localization';
import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertCircle, AlertTriangle, Banknote, CalendarCheck2, CheckCircle2, Clock3, FileCheck2, FileText, Landmark,
    Loader2, Receipt, Send, ShieldCheck, Smartphone, Upload, Wallet, XCircle,
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

const STATUS_STYLE = {
    approved: ['bg-emerald-50 text-emerald-800 ring-emerald-200', 'Paid'],
    pending: ['bg-amber-50 text-amber-900 ring-amber-200', 'Being checked'],
    rejected: ['bg-red-50 text-red-800 ring-red-200', 'Not accepted'],
    failed: ['bg-gray-100 text-gray-700 ring-gray-200', 'Not completed'],
};
const METHOD_LABEL = { mobile_money: 'Mobile money', bank_transfer: 'Bank transfer', cheque: 'Cheque' };

export default function SubscriptionIndex({ subscription: initial, monthlyPrice, monthOptions = [1, 3, 6, 12], payments = [], phone: ownerPhone, bank = null }) {
    const { t, language } = useTranslation();
    const locale = localeFor(language);
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    // A plain date (2026-11-19) is read at midday so no time zone moves it to another day.
    const longDate = (value) => (value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(typeof value === 'string' && value.length === 10 ? `${value}T12:00:00` : value)) : '—');
    const [subscription, setSubscription] = useState(initial);
    useEffect(() => setSubscription(initial), [initial]);

    const [months, setMonths] = useState(1);
    const [method, setMethod] = useState('mobile_money');
    const total = months * monthlyPrice;
    const paidUntil = subscription.paid_until ? new Date(subscription.paid_until) : null;
    const startFrom = paidUntil && paidUntil > new Date() ? paidUntil : new Date();
    const newEnd = new Date(startFrom);
    newEnd.setMonth(newEnd.getMonth() + months);

    const tone = subscription.blocked ? 'red' : subscription.in_grace ? 'red' : subscription.days_left !== null && subscription.days_left <= 7 ? 'amber' : 'green';
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
                                {subscription.blocked || subscription.in_grace ? <AlertTriangle size={26} /> : <ShieldCheck size={26} />}
                            </span>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">{t('ITUZE subscription')}</p>
                                <h1 className="mt-1 font-[Sora] text-2xl font-bold sm:text-3xl">
                                    {subscription.blocked
                                        ? t('Your account is paused')
                                        : subscription.in_grace
                                            ? t('Payment overdue')
                                            : paidUntil ? t('Paid until :date', { date: longDate(paidUntil) }) : t('Not paid yet')}
                                </h1>
                                <p className="mt-1 text-sm text-white/85">
                                    {subscription.blocked
                                        ? t('Your data is safe. Pay below and you and your managers can continue straight away.')
                                        : subscription.in_grace
                                            ? t('Your subscription ended on :end. Pay before :grace to avoid a pause.', { end: longDate(paidUntil), grace: longDate(subscription.grace_ends_at) })
                                            : subscription.days_left !== null ? t(':days days left', { days: Math.max(0, subscription.days_left) }) : ''}
                                </p>
                            </div>
                        </div>
                        <div className="rounded-2xl bg-white/15 px-5 py-4 text-right ring-1 ring-white/20">
                            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{t('Price')}</p>
                            <p className="font-[Sora] text-2xl font-bold">{money(monthlyPrice)}</p>
                            <p className="text-xs text-white/80">{t('per month, all your buildings and managers')}</p>
                        </div>
                    </div>
                </section>

                <div className="grid gap-5 lg:grid-cols-5">
                    {/* Pay */}
                    <section aria-labelledby="pay-title" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6 lg:col-span-3">
                        <h2 id="pay-title" className="flex items-center gap-2 font-[Sora] text-lg font-bold text-gray-900"><Wallet size={19} className="text-[#0E3B2E]" aria-hidden="true" />{t('Pay your subscription')}</h2>

                        <fieldset className="mt-5">
                            <legend className="text-sm font-semibold text-gray-900">{t('1. How many months?')}</legend>
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
                                <CalendarCheck2 size={16} className="text-[#0E3B2E]" aria-hidden="true" />
                                {t('Total :total · paid until :date after payment', { total: money(total), date: longDate(newEnd) })}
                            </p>
                        </fieldset>

                        <fieldset className="mt-6">
                            <legend className="text-sm font-semibold text-gray-900">{t('2. How do you pay?')}</legend>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                                {[
                                    ['mobile_money', 'Mobile money', Smartphone],
                                    ['bank_transfer', 'Bank transfer', Landmark],
                                    ['cheque', 'Cheque', Banknote],
                                ].map(([value, label, Icon]) => (
                                    <label key={value} className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 p-3 text-center text-xs font-semibold transition sm:text-sm ${method === value ? 'border-[#0E3B2E] bg-emerald-50/60 text-[#0E3B2E]' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                                        <input type="radio" name="method" value={value} checked={method === value} onChange={() => setMethod(value)} className="sr-only" />
                                        <Icon size={20} aria-hidden="true" />
                                        {t(label)}
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <div className="mt-5">
                            {method === 'mobile_money'
                                ? <MobileMoneyPay months={months} total={total} defaultPhone={ownerPhone} money={money} onPaid={(status) => { setSubscription(status); router.reload({ only: ['payments', 'subscription'] }); }} />
                                : <TransferPay key={method} months={months} method={method} total={total} money={money} bank={bank} />}
                        </div>
                    </section>

                    {/* How it works */}
                    <aside className="space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6 lg:col-span-2">
                        <h2 className="font-[Sora] font-semibold text-gray-900">{t('Good to know')}</h2>
                        {[
                            [Smartphone, t('Mobile money is applied at once, as soon as you approve with your PIN.')],
                            [FileCheck2, t('A bank slip or cheque is checked by ITUZE, usually the same day. You get an email and SMS.')],
                            [CalendarCheck2, t('Paying early adds the months after your current end date: you never lose days.')],
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
function MobileMoneyPay({ months, total, defaultPhone, money, onPaid }) {
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
            const result = await call(route('subscription.momo.start'), { method: 'POST', body: JSON.stringify({ months, phone: `0${phone}` }) });
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

/** Bank transfer or cheque: reference plus a photo / PDF of the slip or cheque. */
function TransferPay({ months, method, total, money, bank }) {
    const { t } = useTranslation();
    const form = useForm({ months, method, reference: '', proof: null });
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => { form.setData((current) => ({ ...current, months, method })); }, [months, method]);

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
