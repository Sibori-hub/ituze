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
import { MobileMoneyPay, MomoPayForm, TransferPay } from '@/Components/SubscriptionPayForms';
import { useEffect, useState } from 'react';

const localeFor = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';
const STATUS_STYLE = {
    approved: ['bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30', 'Paid'],
    pending: ['bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30', 'Being checked'],
    rejected: ['bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 ring-red-200 dark:ring-red-500/30', 'Not accepted'],
    failed: ['bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 ring-gray-200 dark:ring-slate-700', 'Not completed'],
};
const METHOD_LABEL = { momo_pay: 'MoMo Pay', mobile_money: 'Mobile money', bank_transfer: 'Bank transfer', cheque: 'Cheque' };

const STATE_STYLE = {
    unpaid: ['bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30', 'Waiting for payment'],
    active: ['bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30', 'Active'],
    expiring: ['bg-sky-50 dark:bg-sky-500/10 text-sky-800 dark:text-sky-300 ring-sky-200 dark:ring-sky-500/30', 'Ends soon'],
    grace: ['bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 ring-red-200 dark:ring-red-500/30', 'Overdue'],
    paused: ['bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 ring-gray-200 dark:ring-slate-700', 'Paused'],
};

export default function SubscriptionIndex({ subscription: initial, monthlyPrice, monthOptions = [1, 3, 6, 12], payments = [], phone: ownerPhone, bank = null, momoPay = {}, momoApi = false, selectedProperty = null, totals = { properties: 0, per_month: 0, paid: 0, pending: 0 } }) {
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
                        <dl className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
                            <div className="rounded-2xl bg-white/15 px-4 py-3 ring-1 ring-white/20 sm:text-right">
                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/80">{t('Total per month')}</dt>
                                <dd className="font-[Sora] text-2xl font-bold tabular-nums">{money(totals.per_month)}</dd>
                                <dd className="text-xs text-white/80">{t(':count × :price', { count: totals.properties, price: money(monthlyPrice) })}</dd>
                            </div>
                            <div className="rounded-2xl bg-white/15 px-4 py-3 ring-1 ring-white/20 sm:text-right">
                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/80">{t('Total paid')}</dt>
                                <dd className="font-[Sora] text-2xl font-bold tabular-nums">{money(totals.paid)}</dd>
                                <dd className="text-xs text-white/80">{t('approved payments')}</dd>
                            </div>
                            <div className="rounded-2xl bg-white/15 px-4 py-3 ring-1 ring-white/20 sm:text-right">
                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/80">{t('Waiting for approval')}</dt>
                                <dd className="font-[Sora] text-2xl font-bold tabular-nums">{money(totals.pending)}</dd>
                                <dd className="text-xs text-white/80">{t(':price per property, per month', { price: money(monthlyPrice) })}</dd>
                            </div>
                        </dl>
                    </div>
                </section>

                <div className="grid gap-5 lg:grid-cols-5">
                    {/* Pay */}
                    <section aria-labelledby="pay-title" className="rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6 lg:col-span-3">
                        <h2 id="pay-title" className="flex items-center gap-2 font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100"><Wallet size={19} className="text-[#0E3B2E] dark:text-emerald-300" aria-hidden="true" />{t('Pay for a property')}</h2>

                        {properties.length === 0 ? (
                            <div className="mt-5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 p-6 text-center">
                                <p className="text-sm text-gray-700 dark:text-slate-200">{t('You have no property yet. Create one, and its payment form opens right after.')}</p>
                                <Link href={route('properties.create')} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#124B3A]">{t('Add a property')}</Link>
                            </div>
                        ) : (
                        <>
                        <fieldset className="mt-5">
                            <legend className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t('1. Which property?')}</legend>
                            <div className="mt-2 space-y-2">
                                {properties.map((item) => {
                                    const [style, label] = STATE_STYLE[item.state] || STATE_STYLE.active;
                                    return (
                                        <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 transition ${propertyId === item.id ? 'border-[#0E3B2E] dark:border-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/10' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-500'}`}>
                                            <input type="radio" name="property" value={item.id} checked={propertyId === item.id} onChange={() => setPropertyId(item.id)} className="sr-only" />
                                            <Building2 size={18} className="flex-none text-[#0E3B2E] dark:text-emerald-300" aria-hidden="true" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-semibold text-gray-900 dark:text-slate-100">{item.name}</span>
                                                <span className="block text-xs text-gray-600 dark:text-slate-300">
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
                            <legend className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t('2. How many months?')}</legend>
                            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {monthOptions.map((option) => (
                                    <label key={option} className={`relative cursor-pointer rounded-2xl border-2 p-3 text-center transition ${months === option ? 'border-[#0E3B2E] dark:border-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/10 shadow-sm' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-500'}`}>
                                        <input type="radio" name="months" value={option} checked={months === option} onChange={() => setMonths(option)} className="sr-only" />
                                        {option === 12 && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[#D9A441] px-2 py-0.5 text-[10px] font-bold uppercase text-[#0E3B2E]">{t('1 year')}</span>}
                                        <span className="block font-[Sora] text-xl font-bold text-gray-900 dark:text-slate-100">{option}</span>
                                        <span className="block text-xs text-gray-600 dark:text-slate-300">{t(option === 1 ? 'month' : 'months')}</span>
                                        <span className="mt-1 block text-xs font-semibold text-[#0E3B2E] dark:text-emerald-300">{money(option * monthlyPrice)}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="mt-3 flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-slate-800/60 px-3 py-2 text-sm text-gray-700 dark:text-slate-200">
                                <CalendarCheck2 size={16} className="flex-none text-[#0E3B2E] dark:text-emerald-300" aria-hidden="true" />
                                {t('Total :total · :property paid until :date after payment', { total: money(total), property: property?.name ?? '', date: longDate(newEnd) })}
                            </p>
                        </fieldset>

                        <fieldset className="mt-6">
                            <legend className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t('3. How do you pay?')}</legend>
                            <div className={`mt-2 grid gap-2 ${methods.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                {methods.map(([value, label, Icon]) => (
                                    <label key={value} className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 p-3 text-center text-xs font-semibold transition sm:text-sm ${method === value ? 'border-[#0E3B2E] dark:border-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/10 text-[#0E3B2E] dark:text-emerald-300' : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:border-gray-300 dark:hover:border-slate-500'}`}>
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
                    <aside className="space-y-3 rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6 lg:col-span-2">
                        <h2 className="font-[Sora] font-semibold text-gray-900 dark:text-slate-100">{t('Good to know')}</h2>
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
                            <p key={index} className="flex items-start gap-3 text-sm text-gray-700 dark:text-slate-200">
                                <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-[#0E3B2E] dark:text-emerald-300" aria-hidden="true"><Icon size={15} /></span>
                                {text}
                            </p>
                        ))}
                    </aside>
                </div>

                {/* History */}
                <section aria-labelledby="history-title" className="overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-black/[0.04]">
                    <h2 id="history-title" className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 px-5 py-4 font-[Sora] font-semibold text-gray-900 dark:text-slate-100"><Receipt size={17} className="text-[#0E3B2E] dark:text-emerald-300" aria-hidden="true" />{t('Payment history')}</h2>
                    {payments.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] text-left text-sm">
                                <caption className="sr-only">{t('Payment history')}</caption>
                                <thead className="bg-gray-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wide text-gray-600 dark:text-slate-300">
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
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {payments.map((payment) => {
                                        const [style, label] = STATUS_STYLE[payment.status] || STATUS_STYLE.failed;
                                        return (
                                            <tr key={payment.id} className="align-top">
                                                <td className="px-5 py-3">
                                                    <p className="text-gray-900 dark:text-slate-100">{longDate(payment.created_at)}</p>
                                                    {payment.receipt_number && <p className="font-mono text-[11px] text-gray-500 dark:text-slate-400">{payment.receipt_number}</p>}
                                                </td>
                                                <td className="px-5 py-3 font-medium text-gray-900 dark:text-slate-100">{payment.property || '—'}</td>
                                                <td className="px-5 py-3 text-gray-800 dark:text-slate-100">{payment.months}</td>
                                                <td className="px-5 py-3 text-gray-800 dark:text-slate-100">
                                                    {t(METHOD_LABEL[payment.method] || payment.method)}
                                                    {payment.reference && <span className="block break-all font-mono text-[11px] text-gray-500 dark:text-slate-400">{payment.reference}</span>}
                                                    {payment.has_proof && <a href={route('subscription.proof', payment.id)} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-[#0E3B2E] dark:text-emerald-300 hover:underline"><FileText size={12} aria-hidden="true" />{t('Proof')}</a>}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style}`}>{t(label)}</span>
                                                    {payment.rejection_reason && <p className="mt-1 max-w-[220px] text-xs text-red-700 dark:text-red-300">{payment.rejection_reason}</p>}
                                                </td>
                                                <td className="px-5 py-3 text-xs text-gray-700 dark:text-slate-200">{payment.period_end ? `${longDate(payment.period_start)} – ${longDate(payment.period_end)}` : '—'}</td>
                                                <td className="px-5 py-3 text-right font-semibold tabular-nums text-gray-900 dark:text-slate-100">{money(payment.amount)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : <p className="px-5 py-8 text-center text-sm text-gray-600 dark:text-slate-300">{t('No payments yet.')}</p>}
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
