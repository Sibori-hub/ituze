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
    const combinedPayments = payments.data.reduce((groups, payment) => {
        const key = `${payment.agreement.reference || payment.tenant.name}|${payment.charge.charge_type}|${payment.reference || ''}|${String(payment.paid_at).slice(0, 10)}`;
        groups[key] = [...(groups[key] || []), payment];
        return groups;
    }, {});

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
                            <p className="mt-1 text-sm text-emerald-100">{t('Search individual payments and print a receipt for each payment.')}</p>
                        </div>
                    </div>
                </header>

                <div className="grid gap-3 border-b border-gray-100 bg-emerald-50/60 p-5 sm:grid-cols-3 sm:p-6">
                    {[
                        ['Total payments received', reportTotals.paid, 'text-gray-900'],
                        ['Taxable rent before VAT', reportTotals.taxable_rent, 'text-gray-900'],
                        [t('VAT calculated on rent received (:rate%)', { rate: Number(vatRate).toFixed(2) }), reportTotals.vat_collected, 'text-blue-800'],
                        ['Remaining balance (deposit credit)', reportTotals.deposit_credit, 'text-emerald-800'],
                    ].map(([label, amount, color]) => (
                        <div key={label} className="rounded-2xl border border-white bg-white/90 p-4 shadow-sm">
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

                <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="font-[Sora] font-semibold text-gray-900">{t('Payment transactions')}</h2>
                        <p className="mt-1 text-xs text-gray-500">{t('Each row is one separately recorded payment.')}</p>
                    </div>
                    <label className="relative block w-full sm:max-w-sm">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                            placeholder={t('Search tenant, agreement, receipt, reference...')}
                            aria-label={t('Search payments')}
                            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-[#0E3B2E] focus:ring-2 focus:ring-[#0E3B2E]/15"
                        />
                    </label>
                </div>

                {payments.data.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1350px] text-left text-sm">
                            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">{t('Agreement / tenant')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('Payment date')}</th>
                                    <th className="px-4 py-3 text-right font-semibold">{t('Amount received')}</th>
                                    <th className="px-4 py-3 text-right font-semibold">{t('VAT at :rate% of amount', { rate: Number(vatRate).toFixed(2) })}</th>
                                    <th className="px-4 py-3 font-semibold">{t('Payment method / reference')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('App receipt number')}</th>
                                    <th className="px-4 py-3 text-right font-semibold">{t('Agreement total paid')}</th>
                                    <th className="px-4 py-3 text-right font-semibold">{t('Remaining balance (deposit credit)')}</th>
                                    <th className="px-4 py-3 text-right font-semibold">{t('Days remaining')}</th>
                                    <th className="px-4 py-3 font-semibold">{t('Receipt')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {payments.data.map(payment => {
                                    const groupKey = `${payment.agreement.reference || payment.tenant.name}|${payment.charge.charge_type}|${payment.reference || ''}|${String(payment.paid_at).slice(0, 10)}`;
                                    const groupedPayments = combinedPayments[groupKey];
                                    const isGroupFirst = groupedPayments[0].id === payment.id;

                                    return (
                                    <tr key={payment.id} className="align-top hover:bg-emerald-50/30">
                                        <td className="px-4 py-4">
                                            <p className="font-semibold text-[#0E3B2E]">{payment.agreement.reference || t('Agreement reference not available')}</p>
                                            <p className="mt-1 font-medium text-gray-900">{payment.tenant.name}</p>
                                            <p className="mt-1 text-xs text-gray-500">{payment.property.name} · {t('Unit')} {payment.unit.unit_number}</p>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-4 text-gray-700">{formatDate(payment.paid_at, language)}</td>
                                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-gray-900">{formatMoney(payment.amount)}</td>
                                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-blue-800">{payment.charge.charge_type === 'rent' ? payment.vat_amount === null ? t('Not recorded') : formatMoney(payment.vat_amount) : '—'}</td>
                                        <td className="max-w-56 px-4 py-4">
                                            <p className="font-medium text-gray-800">{t(payment.method.replace(/_/g, ' ').replace(/^./, character => character.toUpperCase()))}</p>
                                            <p className="mt-1 break-all text-xs text-gray-500">{t('External transaction reference')}: {payment.reference || t('No transaction reference recorded')}</p>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-4 font-medium text-[#0E3B2E]">{payment.receipt_number || t('Receipt pending')}</td>
                                        <td className="whitespace-nowrap px-4 py-4 text-right text-gray-700">{formatMoney(payment.agreement.total_paid)}</td>
                                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-emerald-800">{formatMoney(payment.agreement.deposit_credit)}</td>
                                        <td className="whitespace-nowrap px-4 py-4 text-right text-gray-700">{payment.agreement.days_remaining ?? '—'}</td>
                                        <td className="px-4 py-4">
                                            {isGroupFirst && <PaymentReceiptButton payment={payment} payments={groupedPayments} charge={payment.charge} tenant={payment.tenant} property={payment.property} unit={payment.unit} agreement={payment.agreement} />}
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <h2 className="font-semibold text-gray-900">{t(search ? 'No payments match your search.' : 'No payments recorded yet.')}</h2>
                        <p className="mt-1 text-sm text-gray-500">{t(search ? 'Try searching by tenant, agreement ID, receipt number, or transaction reference.' : 'Recorded rent and deposit payments will appear here as individual rows.')}</p>
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
