import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { MomoPayForm, TransferPay } from '@/Components/SubscriptionPayForms';
import { useTranslation } from '@/localization';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Building2, Check, CheckCircle2, Gift, Hourglass, Loader2, Rocket } from 'lucide-react';
import { useState } from 'react';

const localeFor = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';

/**
 * Step 2 after adding a property: pay 25,000 RWF for it by MoMo Pay, bank
 * transfer or cheque. ITUZE checks it, then the property goes on the homepage.
 */
export default function AdvertiserPay({ property, price = 25000, listingDays = 60, bonusOnApproval = 0, credits = 0, momoPay = {}, bank = null, phone }) {
    const { t, language } = useTranslation();
    const locale = localeFor(language);
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    const [method, setMethod] = useState('momopay');
    const [publishing, setPublishing] = useState(false);
    const state = property.status?.key || 'unpaid';
    const extending = state === 'listed';

    const steps = [
        [t('Property added'), true],
        [t('Pay :price', { price: money(price) }), state === 'checking' || state === 'listed'],
        [t('On the homepage'), state === 'listed'],
    ];

    return (
        <AuthenticatedLayout header="Pay for a property">
            <Head title={t('Pay for :name', { name: property.name })} />
            <div className="mx-auto max-w-3xl space-y-5">
                <Link href={route('dashboard')} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#0E3B2E]"><ArrowLeft size={16} aria-hidden="true" />{t('Back to my properties')}</Link>

                <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6">
                    <ol className="grid grid-cols-3 gap-2" aria-label={t('Steps')}>
                        {steps.map(([label, done], index) => (
                            <li key={label} className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold ring-1 sm:text-sm ${done ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : index === 1 ? 'bg-[#0E3B2E] text-white ring-[#0E3B2E]' : 'bg-gray-50 text-gray-500 ring-gray-200'}`}>
                                <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] ${done ? 'bg-emerald-600 text-white' : index === 1 ? 'bg-white text-[#0E3B2E]' : 'bg-gray-200 text-gray-600'}`} aria-hidden="true">{done ? <Check size={13} strokeWidth={3} /> : index + 1}</span>
                                <span className="truncate">{label}</span>
                            </li>
                        ))}
                    </ol>

                    <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-br from-[#0E3B2E]/[0.04] to-amber-50 p-4 ring-1 ring-black/[0.04]">
                        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#0E3B2E] text-white" aria-hidden="true"><Building2 size={22} /></span>
                        <div className="min-w-0 flex-1">
                            <h1 className="truncate font-[Sora] text-xl font-bold text-gray-900">{property.name}</h1>
                            <p className="truncate text-sm text-gray-600">{property.address || '—'} · {t(property.rooms === 1 ? '1 room' : ':count rooms', { count: property.rooms })}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-[Sora] text-2xl font-bold tabular-nums text-gray-900">{money(price)}</p>
                            <p className="text-xs text-gray-600">{extending ? t(':days more days on the homepage', { days: listingDays }) : t(':days days on the homepage', { days: listingDays })}</p>
                        </div>
                    </div>

                    {bonusOnApproval > 0 && (
                        <p className="mt-3 flex items-start gap-2 rounded-xl bg-gradient-to-r from-amber-100 to-amber-50 px-3 py-2.5 text-sm text-amber-950 ring-1 ring-amber-200">
                            <Gift size={18} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
                            <span><strong>{t('First payment gift:')}</strong> {t('when this payment is approved, you also get :bonus free listings for your other properties.', { bonus: bonusOnApproval })}</span>
                        </p>
                    )}
                    {property.rooms < 1 && (
                        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-950 ring-1 ring-amber-200">
                            {t('This property has no room yet. You can pay now; it goes online once it has at least one room.')}{' '}
                            <Link href={route('properties.show', property.id)} className="font-semibold text-[#0E3B2E] underline underline-offset-2">{t('Add a room')}</Link>
                        </p>
                    )}
                </section>

                {state === 'checking' ? (
                    <section className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-black/[0.04]" role="status">
                        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-800" aria-hidden="true"><Hourglass size={26} /></span>
                        <h2 className="mt-3 font-[Sora] text-lg font-bold text-gray-900">{t('Your payment is being checked')}</h2>
                        <p className="mt-1 text-sm text-gray-600">{t('You get an SMS and an email as soon as ITUZE approves it, and the property goes on the homepage.')}</p>
                        <Link href={route('dashboard')} className="mt-4 inline-flex rounded-xl bg-[#0E3B2E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#124B3A]">{t('Back to my properties')}</Link>
                    </section>
                ) : (
                    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6">
                        <h2 className="font-[Sora] text-lg font-bold text-gray-900">{t('How do you pay?')}</h2>
                        {credits > 0 && property.rooms > 0 && (
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                                <p className="flex items-center gap-2 text-sm text-emerald-950"><Gift size={17} className="text-emerald-700" aria-hidden="true" />{t(credits === 1 ? 'You have 1 free listing.' : 'You have :count free listings.', { count: credits })}</p>
                                <button type="button" disabled={publishing} onClick={() => { setPublishing(true); router.post(route('advertising.publish', property.id), {}, { onSuccess: () => router.visit(route('dashboard')), onFinish: () => setPublishing(false) }); }}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                                    {publishing ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Rocket size={15} aria-hidden="true" />}{t('Use a free listing instead')}
                                </button>
                            </div>
                        )}
                        <div role="tablist" aria-label={t('How do you pay?')} className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 text-xs font-semibold sm:text-sm">
                            {[['momopay', t('MoMo Pay')], ['bank_transfer', t('Bank transfer')], ['cheque', t('Cheque')]].map(([value, label]) => (
                                <button key={value} type="button" role="tab" aria-selected={method === value} onClick={() => setMethod(value)}
                                    className={`rounded-lg px-2 py-2 transition ${method === value ? 'bg-white text-[#0E3B2E] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>{label}</button>
                            ))}
                        </div>
                        <div className="mt-4">
                            {method === 'momopay'
                                ? <MomoPayForm plan={{ property_id: property.id }} total={price} money={money} momoPay={momoPay} defaultPhone={phone}
                                    submitRoute="advertising.purchases.momopay" amountHelp={t(':name on the homepage for :days days.', { name: property.name, days: listingDays })} />
                                : <TransferPay plan={{ property_id: property.id }} method={method} total={price} money={money} bank={bank} submitRoute="advertising.purchases.transfer" />}
                        </div>
                        <p className="mt-4 flex items-start gap-2 text-xs text-gray-600"><CheckCircle2 size={14} className="mt-0.5 flex-none text-emerald-700" aria-hidden="true" />{t('ITUZE checks the payment, usually within one working day. You are told by SMS and email, and the property goes on the homepage at once.')}</p>
                    </section>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
