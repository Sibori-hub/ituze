import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import PaymentReceiptButton from '@/Components/PaymentReceiptButton';
import SortHeader from '@/Components/SortHeader';
import { useTranslation } from '@/localization';
import { Head, Link, router } from '@inertiajs/react';
import { Banknote, CreditCard, HandCoins, Info, Receipt, Search, ShieldCheck, Wallet } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const TYPES = [
    { key: 'all', label: 'All payments' },
    { key: 'rent', label: 'Rent' },
    { key: 'deposit', label: 'Deposits' },
];

const METHODS = { bank_transfer: 'Bank transfer', mobile_money: 'Mobile money', cheque: 'Cheque', cash: 'Cash', other: 'Other' };

const TYPE_BADGE = {
    rent: 'bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300 ring-green-600/20',
    deposit: 'bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-300 ring-amber-600/25',
    damage: 'bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 ring-red-600/20',
    combined: 'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 ring-blue-600/20',
};

export default function PaymentsIndex({ payments, reportTotals = {}, filters = {}, vatRate = 18, isAdmin = false, owners = [] }) {
    const { t, language } = useTranslation();
    const locale = ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 2 })} RWF`;
    const dateTime = (value) => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? { day: '—', time: '' } : {
            day: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date),
            time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date),
        };
    };

    const [search, setSearch] = useState(filters.search || '');
    const first = useRef(true);
    const type = filters.type || 'all';

    const visit = (params) => router.get(route('payments.index'), {
        owner_id: filters.owner_id || undefined,
        search: search || undefined,
        type: type === 'all' ? undefined : type,
        method: filters.method || undefined,
        sort: filters.sort && filters.sort !== 'date' ? filters.sort : undefined,
        direction: filters.direction && filters.direction !== 'desc' ? filters.direction : undefined,
        per_page: filters.per_page && Number(filters.per_page) !== 25 ? filters.per_page : undefined,
        ...params,
    }, { preserveState: true, preserveScroll: true, replace: true });

    useEffect(() => {
        if (first.current) { first.current = false; return undefined; }
        const timer = setTimeout(() => visit({ search: search || undefined, page: undefined }), 350);
        return () => clearTimeout(timer);
    }, [search]);

    // Newest / largest first on the first click, then reverse.
    const sortBy = (column) => visit({
        sort: column,
        direction: (filters.sort || 'date') === column && (filters.direction || 'desc') === 'desc' ? 'asc' : 'desc',
        page: undefined,
    });

    const cards = [
        { label: 'Total payments received', hint: 'Rent and deposits together', value: reportTotals.paid, icon: Wallet, tone: 'bg-[#0E3B2E] text-white', iconTone: 'bg-white/15 text-white', strong: true },
        { label: 'Security deposits received', hint: t('Still held (refundable): :amount', { amount: money(reportTotals.deposit_credit) }), value: reportTotals.deposits_received, icon: ShieldCheck, tone: 'bg-white dark:bg-slate-900', iconTone: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300' },
        { label: 'Rent received', hint: 'Rent periods paid by tenants', value: reportTotals.rent_received, icon: Banknote, tone: 'bg-white dark:bg-slate-900', iconTone: 'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300' },
        { label: t('VAT on rent (:rate%)', { rate: Number(vatRate) }), hint: 'Calculated on the rent received', value: reportTotals.vat_collected, icon: Receipt, tone: 'bg-white dark:bg-slate-900', iconTone: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300' },
    ];

    return (
        <AuthenticatedLayout header="Payments">
            <Head title={t('Payments')} />

            <div className="mx-auto max-w-7xl space-y-6">
                {/* Header */}
                <section className="overflow-hidden rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                    <div className="flex flex-col gap-5 bg-gradient-to-br from-[#0E3B2E]/[0.07] via-white dark:via-slate-900 to-amber-50/70 p-6 sm:flex-row sm:items-end sm:justify-between">
                        <div className="flex items-start gap-4">
                            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#0E3B2E] text-white shadow-md shadow-[#0E3B2E]/20"><CreditCard size={22} aria-hidden="true" /></span>
                            <div>
                                <h1 className="font-[Sora] text-2xl font-bold text-gray-900 dark:text-slate-100">{t('Payments')}</h1>
                                <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{t('Each recorded payment has one receipt, even when it covers several rent periods.')}</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            {isAdmin && (
                                <select value={filters.owner_id || ''} onChange={e => visit({ owner_id: e.target.value || undefined, page: undefined })} aria-label={t('Filter by owner')}
                                    className="rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-800 dark:text-slate-100 focus:border-[#0E3B2E] focus:ring-2 focus:ring-[#0E3B2E]/15">
                                    <option value="">{t('All owners')}</option>
                                    {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
                                </select>
                            )}
                            <div className="relative sm:w-72">
                                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" aria-hidden="true" />
                                <label htmlFor="payment-search" className="sr-only">{t('Search payments')}</label>
                                <input id="payment-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Tenant, receipt, reference, room…')}
                                    className="w-full rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 py-2.5 pl-9 pr-3 text-sm focus:border-[#0E3B2E] focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/15" />
                            </div>
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="grid gap-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
                        {cards.map(({ label, hint, value, icon: Icon, tone, iconTone, strong }) => (
                            <div key={label} className={`rounded-2xl border border-gray-200/70 dark:border-slate-700/70 p-4 shadow-sm ${tone}`}>
                                <div className="flex items-center gap-2.5">
                                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconTone}`}><Icon size={18} aria-hidden="true" /></span>
                                    <p className={`text-xs font-semibold uppercase tracking-wide ${strong ? 'text-white/80' : 'text-gray-600 dark:text-slate-300'}`}>{t(label)}</p>
                                </div>
                                <p className={`mt-3 font-[Sora] text-2xl font-bold ${strong ? 'text-white' : 'text-gray-900 dark:text-slate-100'}`}>{money(value)}</p>
                                <p className={`mt-1 text-xs ${strong ? 'text-white/70' : 'text-gray-500 dark:text-slate-400'}`}>{t(hint)}</p>
                            </div>
                        ))}
                    </div>
                    {Number(reportTotals.managed_rent) > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-amber-200 dark:border-amber-500/30 bg-gradient-to-r from-amber-50 dark:from-amber-500/10 via-amber-50/60 to-white dark:to-slate-900 px-5 py-4">
                            <div className="flex items-center gap-3">
                                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-[#D9A441] text-[#0E3B2E] dark:text-emerald-300 shadow-sm"><HandCoins size={20} aria-hidden="true" /></span>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-300">{t('Q.R.A commission')}</p>
                                    <p className="font-[Sora] text-2xl font-bold text-gray-900 dark:text-slate-100">{money(reportTotals.commission)}</p>
                                </div>
                            </div>
                            <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                                <div>
                                    <dt className="text-xs text-gray-600 dark:text-slate-300">{t('Rent collected for managed owners')}</dt>
                                    <dd className="font-semibold text-gray-900 dark:text-slate-100">{money(reportTotals.managed_rent)}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-gray-600 dark:text-slate-300">{t('Owners’ share to pay out')}</dt>
                                    <dd className="font-semibold text-gray-900 dark:text-slate-100">{money(reportTotals.owner_payout)}</dd>
                                </div>
                                <div className="max-w-xs text-xs text-gray-600 dark:text-slate-300">
                                    {t('Each managed owner’s rate (10% by default) on rent actually collected. Deposits are not commissioned.')}
                                    {' '}<Link href={route('reports.index')} className="font-semibold text-[#0E3B2E] dark:text-emerald-300 underline underline-offset-2">{t('Monthly report')}</Link>
                                </div>
                            </dl>
                        </div>
                    )}
                    <p className="flex items-start gap-2 border-t border-gray-100 dark:border-slate-800 px-5 py-3 text-xs text-gray-600 dark:text-slate-300">
                        <Info size={14} className="mt-0.5 flex-none text-gray-400 dark:text-slate-500" aria-hidden="true" />
                        {t('VAT is calculated at the configured Rwanda rate on the recorded rent amount and shown separately. The recorded payment amount is unchanged. Confirm tax applicability and registration with the Rwanda Revenue Authority; this management report is not a VAT invoice or tax return.')}
                    </p>
                </section>

                {/* History */}
                <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm" aria-labelledby="payment-history-title">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 px-4 py-3 sm:px-5">
                        <div className="flex flex-wrap items-center gap-3">
                            <h2 id="payment-history-title" className="font-[Sora] text-base font-semibold text-gray-900 dark:text-slate-100">{t('Payment history')}</h2>
                            <div className="inline-flex rounded-xl bg-gray-100 dark:bg-slate-800 p-1" role="tablist" aria-label={t('Payment type')}>
                                {TYPES.map(({ key, label }) => (
                                    <button key={key} type="button" role="tab" aria-selected={type === key} onClick={() => visit({ type: key === 'all' ? undefined : key, page: undefined })}
                                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${type === key ? 'bg-white dark:bg-slate-900 text-[#0E3B2E] dark:text-emerald-300 shadow-sm' : 'text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white'}`}>
                                        {t(label)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select value={filters.method || ''} onChange={e => visit({ method: e.target.value || undefined, page: undefined })} aria-label={t('Payment method')}
                                className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 py-1.5 pl-2.5 pr-8 text-xs focus:border-[#0E3B2E] focus:ring-2 focus:ring-[#0E3B2E]/15">
                                <option value="">{t('All methods')}</option>
                                {Object.entries(METHODS).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
                            </select>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-slate-300">
                                {t('Rows per page')}
                                <select value={filters.per_page || 25} onChange={e => visit({ per_page: e.target.value, page: undefined })}
                                    className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 py-1.5 pl-2.5 pr-8 text-xs focus:border-[#0E3B2E] focus:ring-2 focus:ring-[#0E3B2E]/15">
                                    {[15, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                                </select>
                            </label>
                        </div>
                    </div>

                    {payments.data.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                                <thead className="whitespace-nowrap bg-gray-50 dark:bg-slate-800/60 text-[11px] uppercase tracking-wide text-gray-600 dark:text-slate-300">
                                    <tr>
                                        <SortHeader column="date" label={t('Date')} filters={{ sort: filters.sort, direction: filters.direction || 'desc' }} onSort={sortBy} defaultSort="date" />
                                        <th scope="col" className="px-3 py-3 font-semibold">{t('Tenant / room')}</th>
                                        <th scope="col" className="px-3 py-3 font-semibold">{t('Type')}</th>
                                        <th scope="col" className="px-3 py-3 font-semibold">{t('Method / reference')}</th>
                                        <SortHeader column="amount" label={t('Amount')} filters={{ sort: filters.sort, direction: filters.direction || 'desc' }} onSort={sortBy} defaultSort="date" align="right" />
                                        <th scope="col" className="px-3 py-3 text-right font-semibold"><span className="sr-only">{t('Receipt')}</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {payments.data.map(payment => {
                                        const when = dateTime(payment.paid_at);
                                        const chargeType = payment.charge?.charge_type || 'rent';
                                        const periods = payment.period_labels || [];
                                        const typeLabel = chargeType === 'deposit' ? 'Security deposit'
                                            : chargeType === 'combined' ? 'Rent and deposit'
                                                : chargeType === 'damage' ? 'Damage charge' : 'Rent';

                                        return (
                                            <tr key={payment.id} className="align-middle transition-colors hover:bg-gray-50 dark:hover:bg-slate-800">
                                                <td className="whitespace-nowrap px-3 py-3">
                                                    <p className="font-medium text-gray-900 dark:text-slate-100">{when.day} <span className="text-xs font-normal text-gray-500 dark:text-slate-400">{when.time}</span></p>
                                                    <p className="font-mono text-xs font-semibold text-[#0E3B2E] dark:text-emerald-300">{payment.receipt_number || t('Receipt pending')}</p>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <p className="max-w-[13rem] truncate font-semibold text-gray-900 dark:text-slate-100">{payment.tenant?.name}</p>
                                                    <p className="max-w-[13rem] truncate text-xs text-gray-500 dark:text-slate-400">{payment.property?.name} · {t('Room :number', { number: payment.unit?.unit_number })}</p>
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${TYPE_BADGE[chargeType] || TYPE_BADGE.rent}`}>{t(typeLabel)}</span>
                                                    {chargeType !== 'deposit' && periods.length > 0 && (
                                                        <p className="mt-1 max-w-[12rem] truncate text-xs text-gray-500 dark:text-slate-400" title={periods.join(', ')}>
                                                            {periods.length === 1 ? periods[0] : t(':count rent periods', { count: periods.length })}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <p className="whitespace-nowrap text-gray-800 dark:text-slate-100">{t(METHODS[payment.method] || 'Other')}</p>
                                                    <p className="max-w-[10rem] truncate font-mono text-xs text-gray-500 dark:text-slate-400" title={payment.reference || ''}>{payment.reference || t('No reference')}</p>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-3 text-right">
                                                    <p className="font-[Sora] font-bold text-gray-900 dark:text-slate-100">{money(payment.amount)}</p>
                                                    {['rent', 'combined'].includes(chargeType) && payment.vat_amount !== null && (
                                                        <p className="text-xs text-blue-800 dark:text-blue-300">{t('VAT :amount', { amount: money(payment.vat_amount) })}</p>
                                                    )}
                                                    {payment.commission !== null && payment.commission !== undefined && (
                                                        <p className="text-xs font-medium text-amber-800 dark:text-amber-300" title={t('Owner’s share: :amount', { amount: money(payment.owner_share) })}>
                                                            {t('Commission :amount (:rate%)', { amount: money(payment.commission), rate: Number(payment.commission_rate) })}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-3 text-right">
                                                    <PaymentReceiptButton payment={payment} payments={payment.allocations} charge={payment.charge} tenant={payment.tenant} property={payment.property} unit={payment.unit} agreement={payment.agreement} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-12 text-center">
                            <CreditCard size={40} className="mx-auto text-gray-300" aria-hidden="true" />
                            <h2 className="mt-3 font-semibold text-gray-900 dark:text-slate-100">{t(search || type !== 'all' || filters.method ? 'No payments match your search.' : 'No payments recorded yet.')}</h2>
                            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{t(search ? 'Try searching by tenant, agreement ID, receipt number, or transaction reference.' : 'Recorded payments and receipts will appear here.')}</p>
                        </div>
                    )}

                    {payments.total > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 dark:border-slate-800 px-4 py-3 sm:px-5">
                            <p className="text-xs text-gray-600 dark:text-slate-300" aria-live="polite">{t('Showing :from–:to of :total payments', { from: payments.from, to: payments.to, total: payments.total })}</p>
                            {payments.last_page > 1 && (
                                <nav aria-label={t('Pages')} className="flex flex-wrap gap-1">
                                    {payments.links.map((link, index) => (
                                        <Link key={index} href={link.url || '#'} preserveScroll preserveState
                                            className={`min-w-[2.25rem] rounded-lg px-3 py-1.5 text-center text-sm ${link.active ? 'bg-[#0E3B2E] font-semibold text-white' : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800'} ${!link.url ? 'pointer-events-none opacity-40' : ''}`}
                                            dangerouslySetInnerHTML={{ __html: link.label }} />
                                    ))}
                                </nav>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
