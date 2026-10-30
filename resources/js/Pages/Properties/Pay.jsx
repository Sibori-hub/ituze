import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PropertySteps from '@/Components/PropertySteps';
import { MobileMoneyPay, MomoPayForm, TransferPay } from '@/Components/SubscriptionPayForms';
import { useTranslation } from '@/localization';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowRight, Banknote, CalendarCheck2, CheckCircle2, Clock3, Landmark, Smartphone, Wallet } from 'lucide-react';
import { useState } from 'react';

const localeFor = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';

/**
 * Step 2 of adding a property: pay for it (100,000 RWF per month). Units,
 * rooms and tenants unlock as soon as ITUZE approves the payment.
 */
export default function PropertyPay({ property, subscription, monthlyPrice, monthOptions = [1, 3, 6, 12], phone, bank, momoPay = {}, momoApi = false }) {
    const { t, language } = useTranslation();
    const locale = localeFor(language);
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    const longDate = (value) => (value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value)) : '—');

    const [months, setMonths] = useState(1);
    const [method, setMethod] = useState('momo_pay');
    const total = months * monthlyPrice;
    const plan = { property_id: property.id, months };
    const paidUntil = subscription.paid_until ? new Date(subscription.paid_until) : null;
    const newEnd = new Date(paidUntil && paidUntil > new Date() ? paidUntil : new Date());
    newEnd.setMonth(newEnd.getMonth() + months);
    const methods = [
        ['momo_pay', 'MoMo Pay', Smartphone],
        momoApi && ['mobile_money', 'Mobile money', Smartphone],
        ['bank_transfer', 'Bank transfer', Landmark],
        ['cheque', 'Cheque', Banknote],
    ].filter(Boolean);

    const waiting = Boolean(subscription.pending);
    const unlocked = subscription.active;

    return (
        <AuthenticatedLayout header={t('Add property')}>
            <Head title={t('Pay for :name', { name: property.name })} />

            <div className="mx-auto max-w-3xl space-y-5">
                <div>
                    <PropertySteps current={unlocked ? 3 : 2} waitingApproval={waiting} />
                    <h1 className="mt-4 font-[Sora] text-2xl font-bold text-gray-900 dark:text-slate-100">{t('Pay for :name', { name: property.name })}</h1>
                    <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{t('Each property costs :price per month. Units, rooms and tenants unlock as soon as ITUZE approves your payment.', { price: money(monthlyPrice) })}</p>
                </div>

                {unlocked ? (
                    <section className="rounded-3xl bg-emerald-50 dark:bg-emerald-500/10 p-6 text-emerald-950 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-500/30" role="status">
                        <p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={20} aria-hidden="true" /> {t(':name is paid until :date.', { name: property.name, date: longDate(subscription.paid_until) })}</p>
                        <p className="mt-1 text-sm">{t('Step 3: add its units and rooms, then assign tenants.')}</p>
                        <Link href={route('properties.show', property.id)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#124B3A]">
                            {t('Add units and rooms')} <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                    </section>
                ) : waiting ? (
                    <section className="rounded-3xl bg-amber-50 dark:bg-amber-500/10 p-6 text-amber-950 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-500/30" role="status">
                        <p className="flex items-center gap-2 font-semibold"><Clock3 size={20} aria-hidden="true" /> {t('Payment sent: ITUZE is checking it.')}</p>
                        <p className="mt-1 text-sm">
                            {t(':amount for :months month(s). You will get an SMS and email as soon as it is approved; then you can add units, rooms and tenants.', { amount: money(subscription.pending.amount), months: subscription.pending.months })}
                        </p>
                        <button type="button" onClick={() => router.reload()} className="mt-4 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-amber-900 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20">{t('Check again')}</button>
                    </section>
                ) : null}

                {!waiting && (
                    <section aria-labelledby="pay-title" className="rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6">
                        <h2 id="pay-title" className="flex items-center gap-2 font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100">
                            <Wallet size={19} className="text-[#0E3B2E] dark:text-emerald-300" aria-hidden="true" />{unlocked ? t('Renew :name', { name: property.name }) : t('Payment')}
                        </h2>

                        <fieldset className="mt-5">
                            <legend className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t('How many months?')}</legend>
                            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {monthOptions.map((option) => (
                                    <label key={option} className={`relative cursor-pointer rounded-2xl border-2 p-3 text-center transition ${months === option ? 'border-[#0E3B2E] dark:border-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/10 shadow-sm' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-500'}`}>
                                        <input type="radio" name="months" value={option} checked={months === option} onChange={() => setMonths(option)} className="sr-only" />
                                        <span className="block font-[Sora] text-xl font-bold text-gray-900 dark:text-slate-100">{option}</span>
                                        <span className="block text-xs text-gray-600 dark:text-slate-300">{t(option === 1 ? 'month' : 'months')}</span>
                                        <span className="mt-1 block text-xs font-semibold text-[#0E3B2E] dark:text-emerald-300">{money(option * monthlyPrice)}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="mt-3 flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-slate-800/60 px-3 py-2 text-sm text-gray-700 dark:text-slate-200">
                                <CalendarCheck2 size={16} className="flex-none text-[#0E3B2E] dark:text-emerald-300" aria-hidden="true" />
                                {t('Total :total · :property paid until :date after payment', { total: money(total), property: property.name, date: longDate(newEnd) })}
                            </p>
                        </fieldset>

                        <fieldset className="mt-6">
                            <legend className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t('How do you pay?')}</legend>
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
                            {method === 'momo_pay' ? <MomoPayForm plan={plan} propertyName={property.name} total={total} money={money} momoPay={momoPay} defaultPhone={phone} />
                            : method === 'mobile_money'
                                ? <MobileMoneyPay plan={plan} total={total} defaultPhone={phone} money={money} onPaid={() => router.reload()} />
                                : <TransferPay key={method} plan={plan} method={method} total={total} money={money} bank={bank} />}
                        </div>
                    </section>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
