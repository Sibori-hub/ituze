import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { AlertCircle, ArrowUpRight, Building2, CalendarClock, CheckCircle2, CreditCard, DoorOpen, FileText, Percent, Printer, Wallet, TrendingUp } from 'lucide-react';
import { useTranslation } from '@/localization';

const cards = [
    { key: 'properties', label: 'Properties', icon: Building2, format: value => value },
    { key: 'units', label: 'Total units', icon: DoorOpen, format: value => value },
    { key: 'occupancy_rate', label: 'Occupancy rate', icon: Percent, format: value => `${value}%` },
    { key: 'active_leases', label: 'Active leases', icon: FileText, format: value => value },
    { key: 'expiring_leases', label: 'Expiring in 30 days', icon: CalendarClock, format: value => value },
    { key: 'collected_this_month', label: 'Collected this month', icon: CreditCard, format: value => `${Number(value).toLocaleString()} RWF` },
    { key: 'remaining_charges', label: 'Remaining rent / damage charges', icon: Wallet, format: value => `${Number(value).toLocaleString()} RWF` },
    { key: 'past_due_charges', label: 'Past-due rent / damage charges', icon: AlertCircle, format: value => `${Number(value).toLocaleString()} RWF` },
];

export default function ReportsIndex({ summary, properties, agreementReports = [], vatRate = 18, isAdmin = false, owners = [], filters = {} }) {
    const { t, language } = useTranslation();
    const locale = { en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' }[language] || 'en-RW';
    const formatMoney = value => `${Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RWF`;
    const reportTotals = agreementReports.reduce((totals, agreement) => ({
        paid: totals.paid + Number(agreement.total_paid || 0),
        vatCollected: totals.vatCollected + Number(agreement.vat_collected || 0),
        taxableRent: totals.taxableRent + Number(agreement.taxable_rent || 0),
        depositCredit: totals.depositCredit + Number(agreement.deposit_credit || 0),
    }), { paid: 0, vatCollected: 0, taxableRent: 0, depositCredit: 0 });
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    monthStart.setMonth(monthStart.getMonth() - 5);
    const financeChartMonths = Array.from({ length: 6 }, (_, index) => {
        const month = new Date(monthStart);
        month.setMonth(monthStart.getMonth() + index);
        const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;

        return {
            key,
            label: new Intl.DateTimeFormat(locale, { month: 'short' }).format(month),
            rent: 0,
            vat: 0,
        };
    });
    const financeMonthsByKey = new Map(financeChartMonths.map(month => [month.key, month]));

    agreementReports.forEach(agreement => {
        agreement.payment_records?.forEach(payment => {
            if (!payment.paid_at) return;

            const month = financeMonthsByKey.get(String(payment.paid_at).slice(0, 7));
            if (!month) return;

            if (payment.charge_type === 'rent') {
                month.rent += Number(payment.amount || 0);
            }
            month.vat += Number(payment.vat_amount || 0);
        });
    });

    const maxMonthlyFinanceAmount = Math.max(
        ...financeChartMonths.flatMap(month => [month.rent, month.vat]),
        1,
    );
    const sixMonthRentTotal = financeChartMonths.reduce((total, month) => total + month.rent, 0);
    const sixMonthVatTotal = financeChartMonths.reduce((total, month) => total + month.vat, 0);
    const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const chartGridValues = [0, 1, 2, 3, 4].map(step => maxMonthlyFinanceAmount * step / 4);
    const chartY = value => 220 - (value / maxMonthlyFinanceAmount) * 180;
    const formatChartValue = value => value >= 1000000
        ? `${(value / 1000000).toFixed(1)}M`
        : `${Math.round(value / 1000)}k`;
    const financeSummaryCards = [
        { label: 'Total payments received', amount: reportTotals.paid, note: 'Across all recorded payment types', icon: Wallet, color: 'emerald' },
        { label: 'Taxable rent before VAT', amount: reportTotals.taxableRent, note: 'Recorded rent payments', icon: CreditCard, color: 'blue' },
        { label: 'Total VAT payable', amount: reportTotals.vatCollected, note: `Calculated at ${Number(vatRate).toFixed(2)}% on recorded taxable payments`, icon: Percent, color: 'amber' },
        { label: 'Refundable deposit credit', amount: reportTotals.depositCredit, note: 'Deposit currently held', icon: Building2, color: 'violet' },
    ];
    const metricColors = {
        emerald: { icon: 'bg-emerald-50 text-emerald-700', accent: 'bg-emerald-500', amount: 'text-emerald-950' },
        blue: { icon: 'bg-blue-50 text-blue-700', accent: 'bg-blue-500', amount: 'text-slate-950' },
        amber: { icon: 'bg-amber-50 text-amber-700', accent: 'bg-amber-400', amount: 'text-amber-800' },
        violet: { icon: 'bg-violet-50 text-violet-700', accent: 'bg-violet-500', amount: 'text-violet-950' },
    };

    return (
        <AuthenticatedLayout header="Reports">
            <Head title="Reports" />
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">{t('Portfolio reports')}</p>
                    <h1 className="mt-1 font-[Sora] text-2xl font-bold text-gray-900 sm:text-3xl">{t('Finance at a glance')}</h1>
                    <p className="mt-1 text-sm text-gray-500">{t('A current overview of occupancy, leases, charges, and money received.')}</p>
                </div>
                {isAdmin ? (
                    <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                        {t('Report scope')}
                        <select
                            value={filters.owner_id || ''}
                            onChange={event => router.get(route('reports.index'), { owner_id: event.target.value || undefined }, { preserveState: true, preserveScroll: true, replace: true })}
                            className="min-w-56 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 shadow-sm focus:border-[#0E3B2E] focus:ring-2 focus:ring-[#0E3B2E]/15"
                        >
                            <option value="">{t('All owners · platform-wide')}</option>
                            {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
                        </select>
                    </label>
                ) : (
                    <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-2 text-xs font-medium text-gray-600 shadow-sm sm:inline-flex">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {t('Live portfolio summary')}
                    </div>
                )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map(({ key, label, icon: Icon, format }) => (
                    <div key={key} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#0E3B2E]"><Icon size={19} /></div>
                        <p className="mt-4 font-[Sora] text-2xl font-bold text-gray-900">{format(summary[key] ?? 0)}</p>
                        <p className="mt-1 text-sm text-gray-500">{t(label)}</p>
                    </div>
                ))}
            </div>
            <section id="agreement-finance-report" className="mt-7 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-900/5">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                            <TrendingUp size={19} />
                        </div>
                        <div>
                            <p className="font-[Sora] text-sm font-semibold text-gray-900">{t('Financial performance')}</p>
                            <p className="mt-0.5 text-xs text-gray-500">{t('Portfolio-wide payment and VAT summary')}</p>
                        </div>
                    </div>
                    <button type="button" onClick={() => {
                        const cleanup = () => { delete document.body.dataset.printTarget; };
                        document.body.dataset.printTarget = 'agreement-finance-report';
                        window.addEventListener('afterprint', cleanup, { once: true });
                        window.print();
                    }} className="screen-only inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-900">
                        <Printer size={16} /> {t('Print report')}
                    </button>
                </div>
                <div className="grid gap-3 bg-gradient-to-b from-slate-50 to-white p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
                    {financeSummaryCards.map(({ label, amount, note, icon: Icon, color }) => (
                        <div key={label} className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
                            <div className={`absolute inset-x-0 top-0 h-1 ${metricColors[color].accent}`} />
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-bold uppercase leading-5 tracking-wide text-slate-500">{t(label)}</p>
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${metricColors[color].icon}`}>
                                    <Icon size={17} />
                                </span>
                            </div>
                            <p className={`mt-4 break-words font-[Sora] text-xl font-bold tracking-tight sm:text-2xl ${metricColors[color].amount}`}>{formatMoney(amount)}</p>
                            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{label === 'Total VAT payable' ? t('Calculated at :rate% of recorded rent', { rate: Number(vatRate).toFixed(2) }) : t(note)}</p>
                        </div>
                    ))}
                </div>
                <div className="border-t border-slate-100 bg-slate-50/80 p-4 sm:p-6">
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">{t('Cash flow')}</p>
                                <h2 className="mt-1 font-[Sora] text-lg font-bold text-slate-900">{t('Monthly rent and VAT')}</h2>
                                <p className="mt-1 text-sm text-slate-500">{t('Recorded rent payments and their calculated VAT for the last six months.')}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 sm:gap-5">
                                <div className="rounded-xl bg-emerald-50 px-3 py-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">{t('Rent received · 6 months')}</p>
                                    <p className="mt-0.5 text-sm font-bold text-emerald-950">{formatMoney(sixMonthRentTotal)}</p>
                                </div>
                                <div className="rounded-xl bg-amber-50 px-3 py-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">{t('VAT payable · 6 months')}</p>
                                    <p className="mt-0.5 text-sm font-bold text-amber-950">{formatMoney(sixMonthVatTotal)}</p>
                                </div>
                            </div>
                        </div>
                        <div className="px-3 pb-3 pt-5 sm:px-6 sm:pb-5">
                            <div className="mb-4 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
                                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#0E3B2E]" />{t('Rent received')}</span>
                                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#D9A441]" />{t('VAT payable')}</span>
                                <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">{t('Last six months')}</span>
                            </div>
                            <div className="overflow-x-auto rounded-xl bg-gradient-to-b from-slate-50/80 to-white">
                            <svg
                                viewBox="0 0 760 280"
                                role="img"
                                aria-label={t('Monthly rent and VAT for the last six months')}
                                className="h-64 min-w-[560px] w-full"
                            >
                                {chartGridValues.map((value, index) => {
                                    const y = chartY(value);

                                    return (
                                        <g key={index}>
                                            <line x1="76" y1={y} x2="744" y2={y} stroke="#e2e8f0" strokeDasharray={index === 0 ? undefined : '4 5'} />
                                            <text x="64" y={y + 4} textAnchor="end" fill="#6b7280" fontSize="10">{formatChartValue(value)}</text>
                                        </g>
                                    );
                                })}
                                {financeChartMonths.map((month, index) => {
                                    const groupX = 112 + index * 104;
                                    const rentHeight = month.rent > 0 ? Math.max(3, (month.rent / maxMonthlyFinanceAmount) * 180) : 0;
                                    const vatHeight = month.vat > 0 ? Math.max(3, (month.vat / maxMonthlyFinanceAmount) * 180) : 0;
                                    const isCurrentMonth = month.key === currentMonthKey;

                                    return (
                                        <g key={month.key}>
                                            {isCurrentMonth && <rect x={groupX - 11} y="25" width="88" height="226" rx="12" fill="#f0fdf4" />}
                                            <rect x={groupX} y={220 - rentHeight} width="30" height={rentHeight} rx="7" fill="#0E3B2E">
                                                <title>{`${month.label}: ${t('Rent received')} ${formatMoney(month.rent)}`}</title>
                                            </rect>
                                            <rect x={groupX + 36} y={220 - vatHeight} width="30" height={vatHeight} rx="7" fill="#D9A441">
                                                <title>{`${month.label}: ${t('VAT payable')} ${formatMoney(month.vat)}`}</title>
                                            </rect>
                                            <text x={groupX + 33} y="250" textAnchor="middle" fill={isCurrentMonth ? '#0E3B2E' : '#64748b'} fontSize="11" fontWeight={isCurrentMonth ? '700' : '500'}>{month.label}</text>
                                        </g>
                                    );
                                })}
                            </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <section className="mt-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-6">
                    <div><h2 className="font-[Sora] font-semibold text-gray-900">{t('Property occupancy')}</h2><p className="mt-1 text-xs text-gray-500">{t(':occupied occupied of :total total units', { occupied: summary.occupied_units, total: summary.units })}</p></div>
                    <Link href={route('properties.index')} className="inline-flex items-center gap-1 text-sm font-medium text-[#0E3B2E] hover:underline">{t('Manage properties')} <ArrowUpRight size={15} /></Link>
                </div>
                {properties.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-sm">
                            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3 font-semibold">{t('Property')}</th><th className="px-5 py-3 font-semibold">{t('Units')}</th><th className="px-5 py-3 font-semibold">{t('Occupancy')}</th><th className="px-5 py-3 font-semibold">{t('Available')}</th><th className="px-5 py-3 font-semibold">{t('Current tenants')}</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {properties.map(property => (
                                    <tr key={property.id} className="align-top hover:bg-gray-50/70">
                                        <td className="px-5 py-4"><Link href={route('properties.show', property.id)} className="font-semibold text-gray-900 hover:text-[#0E3B2E] hover:underline">{property.name}</Link></td>
                                        <td className="px-5 py-4 text-gray-700">{property.occupied_units_count} / {property.units_count}</td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2"><div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#0E3B2E]" style={{ width: `${property.occupancy_rate}%` }} /></div><span className="text-xs font-semibold text-gray-700">{property.occupancy_rate}%</span></div>
                                        </td>
                                        <td className="px-5 py-4"><span className="inline-flex items-center gap-1 text-gray-700"><CheckCircle2 size={14} className="text-emerald-600" />{property.available_units_count}</span></td>
                                        <td className="px-5 py-4 text-xs text-gray-600">{property.active_tenants.length ? property.active_tenants.map(record => `${record.tenant} · ${record.unit}`).join(', ') : t('No active tenants')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <p className="p-8 text-center text-sm text-gray-500">{t('Add a property to start seeing portfolio reports.')}</p>}
            </section>
            <div className="mt-5 flex flex-wrap gap-3">
                <Link href={route('leases.index')} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#0E3B2E] hover:border-[#0E3B2E]/30">{t('Review lease documents')}</Link>
                <Link href={route('payments.index')} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#0E3B2E] hover:border-[#0E3B2E]/30">{t('Review payments')}</Link>
            </div>
        </AuthenticatedLayout>
    );
}
