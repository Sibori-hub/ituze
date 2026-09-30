import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/localization';
import PaymentReceiptButton from '@/Components/PaymentReceiptButton';

const localeForLanguage = language => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';

const formatDate = (value, language) => {
    if (!value) return '—';
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat(localeForLanguage(language), {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        }).format(date);
};

export default function PaymentsIndex({ payments, reportTotals = {}, filters = {}, vatRate = 18 }) {
    const { t, language } = useTranslation();
    const locale = localeForLanguage(language);
    const [search, setSearch] = useState(filters.search || '');
    const firstRender = useRef(true);
    const formatMoney = value => `${Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RWF`;

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return undefined;
        }

        const timeout = setTimeout(() => {
            router.get(route('payments.index'), { search }, { preserveState: true, replace: true });
        }, 350);

        return () => clearTimeout(timeout);
    }, [search]);

    return (
        <AuthenticatedLayout header="Payments">
            <Head title="Payments" />
            <section className="overflow-hidden rounded-3xl border border-emerald-950/10 bg-white shadow-xl shadow-emerald-950/5">
                <header className="bg-gradient-to-br from-[#0E3B2E] via-[#124a39] to-[#1f6650] p-6 text-white sm:p-8">
                    <div className="flex items-center gap-4">
                        <img src="/images/logo.png" alt="Ituze-Qra Ltd" className="h-16 w-16 rounded-2xl bg-white p-1 object-contain shadow-lg" />
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">{t('Ituze-Qra Ltd')}</p>
                            <h1 className="mt-1 font-[Sora] text-xl font-bold sm:text-2xl">{t('Payments')}</h1>
                            <p className="mt-1 text-sm text-emerald-100">{t('Each recorded payment has one receipt, even when it covers several rent periods.')}</p>
                        </div>
                    </div>
                </header>

                <div className="grid gap-3 border-b border-gray-100 bg-emerald-50/60 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
                    {[
                        ['Total payments received', reportTotals.paid, 'text-gray-900'],
                        ['Taxable rent before VAT', reportTotals.taxable_rent, 'text-gray-900'],
                        [t('VAT calculated on rent received (:rate%)', { rate: Number(vatRate).toFixed(2) }), reportTotals.vat_collected, 'text-blue-800'],
                        ['Remaining balance (deposit credit)', reportTotals.deposit_credit, 'text-emerald-800'],
                    ].map(([label, amount, color]) => (
                        <div key={label} className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm transition-shadow hover:shadow-md">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t(label)}</p>
                            <p className={`mt-2 font-[Sora] text-xl font-bold ${color}`}>{formatMoney(amount)}</p>
                        </div>
                    ))}
                </div>

                {reportTotals.vat_unrecorded_payments > 0 && (
                    <p className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
                        {t(':count older rent payments do not have a saved VAT breakdown and are excluded from the VAT totals.', { count: reportTotals.vat_unrecorded_payments })}
                    </p>
                )}
                <p className="border-b border-gray-100 bg-gray-50 px-5 py-3 text-xs text-gray-600">
                    {t('VAT is calculated at the configured Rwanda rate on the recorded rent amount and shown separately. The recorded payment amount is unchanged. Confirm tax applicability and registration with the Rwanda Revenue Authority; this management report is not a VAT invoice or tax return.')}
                </p>

                <div className="flex flex-col gap-4 border-b border-gray-100 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div>
                        <h2 className="font-[Sora] text-lg font-semibold text-gray-900">{t('Payment history')}</h2>
                        <p className="mt-1 text-sm text-gray-500">{t('Each row shows one payment and its receipt.')}</p>
                    </div>
                    <label className="relative block w-full sm:max-w-md">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                            placeholder={t('Search tenant, agreement, receipt, reference...')}
                            aria-label={t('Search payments')}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-3 text-sm transition focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                        />
                    </label>
                </div>

                {payments.data.length ? (
                    <div className="space-y-3 bg-gray-50/70 p-4 sm:p-6">
                        {payments.data.map(payment => (
                            <article key={payment.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md sm:p-5">
                                <div className="flex flex-col gap-4 border-b border-gray-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[#0E3B2E]">
                                                {payment.period_labels?.length ? payment.period_labels.length === 1 ? t(payment.charge.charge_type) : t(':count rent periods', { count: payment.period_labels.length }) : t(payment.charge.charge_type)}
                                            </span>
                                            <span className="text-xs text-gray-500">{formatDate(payment.paid_at, language)}</span>
                                        </div>
                                        <p className="mt-3 font-semibold text-[#0E3B2E]">{payment.agreement.reference || t('Agreement reference not available')}</p>
                                        <p className="mt-1 font-medium text-gray-900">{payment.tenant.name}</p>
                                        <p className="mt-1 text-sm text-gray-500">{payment.property.name} · {t('Unit')} {payment.unit.unit_number}</p>
                                    </div>
                                    <div className="sm:min-w-52 sm:text-right">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Amount received')}</p>
                                        <p className="mt-1 font-[Sora] text-2xl font-bold text-gray-900">{formatMoney(payment.amount)}</p>
                                    </div>
                                </div>

                                <div className="grid gap-4 py-4 sm:grid-cols-2 xl:grid-cols-4">
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('Periods covered')}</p>
                                        <p className="mt-1 text-sm font-medium leading-5 text-gray-800">{payment.period_labels?.length ? payment.period_labels.join(', ') : t(payment.charge.charge_type)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('Payment method / reference')}</p>
                                        <p className="mt-1 text-sm font-medium text-gray-800">{t(payment.method.replace(/_/g, ' ').replace(/^./, character => character.toUpperCase()))}</p>
                                        <p className="mt-1 break-all text-xs text-gray-500">{payment.reference || t('No transaction reference recorded')}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('VAT at :rate% of amount', { rate: Number(vatRate).toFixed(2) })}</p>
                                        <p className="mt-1 text-sm font-semibold text-blue-800">
                                            {['rent', 'combined'].includes(payment.charge.charge_type) ? payment.vat_amount === null ? t('Not recorded') : formatMoney(payment.vat_amount) : '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('App receipt number')}</p>
                                        <p className="mt-1 break-all text-sm font-semibold text-[#0E3B2E]">{payment.receipt_number || t('Receipt pending')}</p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                                        <p className="text-gray-500">{t('Agreement total paid')}: <span className="font-semibold text-gray-800">{formatMoney(payment.agreement.total_paid)}</span></p>
                                        <p className="text-gray-500">{t('Remaining balance (deposit credit)')}: <span className="font-semibold text-emerald-800">{formatMoney(payment.agreement.deposit_credit)}</span></p>
                                    </div>
                                    <PaymentReceiptButton payment={payment} payments={payment.allocations} charge={payment.charge} tenant={payment.tenant} property={payment.property} unit={payment.unit} agreement={payment.agreement} />
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <h2 className="font-semibold text-gray-900">{t(search ? 'No payments match your search.' : 'No payments recorded yet.')}</h2>
                        <p className="mt-1 text-sm text-gray-500">{t(search ? 'Try searching by tenant, agreement ID, receipt number, or transaction reference.' : 'Recorded payments and receipts will appear here.')}</p>
                    </div>
                )}

                {payments.links?.length > 3 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 p-4">
                        <p className="text-xs text-gray-500">{t('Showing :from to :to of :total payments', { from: payments.from, to: payments.to, total: payments.total })}</p>
                        <div className="flex flex-wrap gap-2">
                            {payments.links.map((link, index) => (
                                <Link
                                    key={index}
                                    href={link.url || '#'}
                                    preserveState
                                    className={`rounded-lg px-3 py-1.5 text-sm ${link.active ? 'bg-[#0E3B2E] text-white' : 'bg-gray-50 text-gray-600'} ${!link.url ? 'pointer-events-none opacity-40' : ''}`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </section>
        </AuthenticatedLayout>
    );
}
