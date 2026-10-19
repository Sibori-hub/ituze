import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import BrandLockup from '@/Components/BrandLockup';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import {
    AlertTriangle, ArrowUpRight, BarChart3, Building2, CalendarRange, CheckCircle2, Download, DoorOpen, FileText,
    HandCoins, Mail, Percent, Phone, Printer, Receipt, ShieldCheck, TrendingUp, UserRound, Users, Wallet,
} from 'lucide-react';
import { useTranslation } from '@/localization';

const TABS = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'arrears', label: 'Arrears', icon: AlertTriangle },
    { key: 'owners', label: 'Owner statements', icon: FileText },
    { key: 'occupancy', label: 'Occupancy', icon: DoorOpen },
];

const PRESETS = [
    ['this_month', 'This month'],
    ['last_month', 'Last month'],
    ['this_quarter', 'This quarter'],
    ['this_year', 'This year'],
    ['last_12_months', 'Last 12 months'],
    ['custom', 'Custom dates'],
];

const localeFor = language => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';

function printSection() {
    const cleanup = () => { delete document.body.dataset.printTarget; };
    document.body.dataset.printTarget = 'report-print';
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
}

function StatCard({ icon: Icon, label, value, note, tone = 'emerald', href }) {
    const tones = {
        emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
        amber: 'bg-amber-50 text-amber-800 ring-amber-100',
        blue: 'bg-sky-50 text-sky-800 ring-sky-100',
        violet: 'bg-violet-50 text-violet-800 ring-violet-100',
        red: 'bg-red-50 text-red-700 ring-red-100',
    };
    const body = (
        <>
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</p>
                <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ring-1 ${tones[tone]}`} aria-hidden="true"><Icon size={17} /></span>
            </div>
            <p className="mt-3 break-words font-[Sora] text-xl font-bold tabular-nums text-gray-900 sm:text-2xl">{value}</p>
            {note && <p className="mt-1 text-xs leading-relaxed text-gray-600">{note}</p>}
        </>
    );

    return href ? (
        <Link href={href} className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#0E3B2E]/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]/40">{body}</Link>
    ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">{body}</div>
    );
}

export default function ReportsIndex({
    summary, properties = [], vatRate = 18, isAdmin = false, owners = [], filters = {},
    overview = null, arrears = null, statements = null,
}) {
    const { t, language } = useTranslation();
    const locale = localeFor(language);
    const tab = filters.tab || 'overview';
    const money = value => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    const formatDate = value => value
        ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`))
        : '—';
    const monthLabel = (value, style = 'short') => new Intl.DateTimeFormat(locale, { month: style, ...(style === 'long' ? { year: 'numeric' } : {}) }).format(new Date(`${value}-01T12:00:00`));
    const periodLabel = `${formatDate(filters.from)} – ${formatDate(filters.to)}`;

    const [custom, setCustom] = useState({ from: filters.from || '', to: filters.to || '' });
    const baseParams = {
        owner_id: filters.owner_id || undefined,
        period: filters.period && filters.period !== 'this_month' ? filters.period : undefined,
        from: filters.period === 'custom' ? filters.from : undefined,
        to: filters.period === 'custom' ? filters.to : undefined,
        tab: tab !== 'overview' ? tab : undefined,
    };
    const visit = changes => router.get(route('reports.index'), { ...baseParams, ...changes }, { preserveScroll: true, preserveState: true, replace: true });
    const exportHref = route('reports.export', Object.fromEntries(Object.entries({ ...baseParams, tab }).filter(([, value]) => value !== undefined)));
    const usesPeriod = tab === 'overview' || tab === 'owners';

    return (
        <AuthenticatedLayout header="Reports">
            <Head title={t('Reports')} />

            {/* Heading and filters */}
            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-white via-white to-emerald-50/60 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-5 p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#0E3B2E] text-white shadow-sm" aria-hidden="true"><TrendingUp size={22} /></span>
                        <div>
                            <h1 className="font-[Sora] text-2xl font-bold text-gray-900">{t('Reports')}</h1>
                            <p className="mt-1 max-w-xl text-sm text-gray-600">{t('Money received, who owes, owner payouts and occupancy — for the period you choose.')}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <a href={exportHref} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-[#0E3B2E]/30 hover:bg-emerald-50">
                            <Download size={16} aria-hidden="true" /> {t('Export to Excel')}
                        </a>
                        <button type="button" onClick={printSection} className="inline-flex items-center gap-2 rounded-xl bg-[#0E3B2E] px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#145240]">
                            <Printer size={16} aria-hidden="true" /> {t('Print / PDF')}
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-end gap-3 border-t border-gray-200 bg-white/70 px-5 py-4 sm:px-6">
                    {isAdmin && (
                        <label className="flex min-w-52 flex-col gap-1 text-xs font-semibold text-gray-700">
                            {t('Owner')}
                            <select
                                value={filters.owner_id || ''}
                                onChange={event => visit({ owner_id: event.target.value || undefined })}
                                className="rounded-xl border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-900 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]/20"
                            >
                                <option value="">{t('All owners · platform-wide')}</option>
                                {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
                            </select>
                        </label>
                    )}
                    {usesPeriod && (
                        <>
                            <label className="flex min-w-44 flex-col gap-1 text-xs font-semibold text-gray-700">
                                {t('Period')}
                                <select
                                    value={filters.period || 'this_month'}
                                    onChange={event => event.target.value === 'custom'
                                        ? visit({ period: 'custom', from: custom.from || filters.from, to: custom.to || filters.to })
                                        : visit({ period: event.target.value === 'this_month' ? undefined : event.target.value, from: undefined, to: undefined })}
                                    className="rounded-xl border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-900 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]/20"
                                >
                                    {PRESETS.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
                                </select>
                            </label>
                            {filters.period === 'custom' && (
                                <form
                                    className="flex flex-wrap items-end gap-2"
                                    onSubmit={event => { event.preventDefault(); visit({ period: 'custom', from: custom.from, to: custom.to }); }}
                                >
                                    <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
                                        {t('From')}
                                        <input type="date" required value={custom.from} onChange={event => setCustom(current => ({ ...current, from: event.target.value }))} className="rounded-xl border-gray-300 py-2 text-sm focus:border-[#0E3B2E] focus:ring-[#0E3B2E]/20" />
                                    </label>
                                    <label className="flex flex-col gap-1 text-xs font-semibold text-gray-700">
                                        {t('To')}
                                        <input type="date" required min={custom.from || undefined} value={custom.to} onChange={event => setCustom(current => ({ ...current, to: event.target.value }))} className="rounded-xl border-gray-300 py-2 text-sm focus:border-[#0E3B2E] focus:ring-[#0E3B2E]/20" />
                                    </label>
                                    <button className="rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#145240]">{t('Apply')}</button>
                                </form>
                            )}
                            <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100">
                                <CalendarRange size={14} aria-hidden="true" /> {periodLabel}
                            </p>
                        </>
                    )}
                    {!usesPeriod && (
                        <p className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">
                            <CalendarRange size={14} aria-hidden="true" /> {t('As of today')}
                        </p>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <nav aria-label={t('Report sections')} className="mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm">
                {TABS.map(({ key, label, icon: Icon }) => (
                    <Link
                        key={key}
                        href={route('reports.index', { ...baseParams, tab: key === 'overview' ? undefined : key })}
                        preserveScroll
                        aria-current={tab === key ? 'page' : undefined}
                        className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === key ? 'bg-[#0E3B2E] text-white shadow-sm' : 'text-gray-700 hover:bg-emerald-50 hover:text-[#0E3B2E]'}`}
                    >
                        <Icon size={16} aria-hidden="true" /> {t(label)}
                        {key === 'arrears' && Number(summary?.past_due_charges) > 0 && <span className={`h-2 w-2 rounded-full ${tab === key ? 'bg-amber-300' : 'bg-red-500'}`} aria-label={t('Money overdue')} />}
                    </Link>
                ))}
            </nav>

            <div id="report-print" className="mt-5">
                <div className="print-only mb-4 hidden border-b-2 border-[#0E3B2E] pb-3">
                    <BrandLockup logoClassName="h-14 w-14" nameClassName="text-xs font-bold text-[#0E3B2E]" subtitleClassName="text-[8px] text-[#0E3B2E]/70" />
                    <p className="mt-2 text-lg font-bold">{t(TABS.find(item => item.key === tab)?.label || 'Reports')}{usesPeriod ? ` · ${periodLabel}` : ''}</p>
                </div>
                {tab === 'overview' && overview && <OverviewTab {...{ overview, summary, money, monthLabel, t, vatRate, baseParams }} />}
                {tab === 'arrears' && arrears && <ArrearsTab {...{ arrears, money, formatDate, t }} />}
                {tab === 'owners' && statements && <OwnersTab {...{ statements, money, formatDate, t, isAdmin, filters, visit, periodLabel }} />}
                {tab === 'occupancy' && <OccupancyTab {...{ properties, summary, money, t }} />}
            </div>
        </AuthenticatedLayout>
    );
}

function OverviewTab({ overview, summary, money, monthLabel, t, vatRate, baseParams }) {
    const rate = overview.collection_rate;
    const max = Math.max(1, ...overview.months.flatMap(month => [month.expected, month.collected]));
    const short = value => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${Math.round(value / 1000)}k` : `${Math.round(value)}`;

    return (
        <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={Wallet} label={t('Rent collected')} value={money(overview.rent_collected)} note={t('Income in this period')} />
                <StatCard icon={ShieldCheck} label={t('Security deposits received')} value={money(overview.deposits_received)} note={t('Held for tenants — not income')} tone="violet" />
                <StatCard icon={HandCoins} label={t('Q.R.A commission')} value={money(overview.commission)} note={t('On rent from managed owners')} tone="amber" />
                <StatCard icon={Receipt} label={t('VAT on rent (:rate%)', { rate: Number(vatRate) })} value={money(overview.vat)} note={t('For the RRA declaration')} tone="blue" />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{t('Collection rate')}</p>
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100" aria-hidden="true"><Percent size={17} /></span>
                    </div>
                    <p className="mt-3 font-[Sora] text-3xl font-bold text-gray-900">{rate === null ? '—' : `${rate}%`}</p>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rate ?? 0} aria-label={t('Collection rate')}>
                        <div className={`h-full rounded-full ${rate >= 90 ? 'bg-emerald-600' : rate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${rate ?? 0}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                        {rate === null
                            ? t('No rent fell due in this period.')
                            : t(':paid paid of :expected due in this period', { paid: money(overview.rent_paid_of_expected), expected: money(overview.rent_expected) })}
                    </p>
                </div>
                <StatCard
                    icon={AlertTriangle}
                    label={t('Overdue today')}
                    value={money(overview.arrears)}
                    note={Number(overview.arrears) > 0 ? t('See who owes in the Arrears tab') : t('Nobody is late with rent')}
                    tone={Number(overview.arrears) > 0 ? 'red' : 'emerald'}
                    href={route('reports.index', { ...baseParams, tab: 'arrears', period: undefined, from: undefined, to: undefined })}
                />
                <StatCard
                    icon={Building2}
                    label={t('Occupancy')}
                    value={`${summary.occupancy_rate}%`}
                    note={t(':occupied of :total rooms rented · empty rooms: :rent/month', { occupied: summary.occupied_units, total: summary.units, rent: money(summary.vacant_rent) })}
                    tone="blue"
                />
            </div>

            <section aria-labelledby="cashflow-title" className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
                    <div>
                        <h2 id="cashflow-title" className="font-[Sora] text-lg font-bold text-gray-900">{t('Rent due vs collected')}</h2>
                        <p className="mt-0.5 text-sm text-gray-600">{t('12 months ending with the chosen period')}</p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs font-medium text-gray-700">
                        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-200 ring-1 ring-emerald-400" />{t('Rent due')}</span>
                        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#0E3B2E]" />{t('Rent collected')}</span>
                    </div>
                </div>
                <div className="overflow-x-auto px-3 pb-4 pt-5 sm:px-6">
                    <svg viewBox="0 0 960 260" role="img" aria-label={t('Rent due vs collected')} className="h-60 w-full min-w-[640px]">
                        {[0, 0.25, 0.5, 0.75, 1].map(step => (
                            <g key={step}>
                                <line x1="56" x2="950" y1={220 - step * 190} y2={220 - step * 190} stroke="#e5e7eb" strokeDasharray={step ? '4 5' : undefined} />
                                <text x="48" y={224 - step * 190} textAnchor="end" fontSize="10" fill="#6b7280">{short(max * step)}</text>
                            </g>
                        ))}
                        {overview.months.map((month, index) => {
                            const x = 70 + index * 74;
                            const due = (month.expected / max) * 190;
                            const got = (month.collected / max) * 190;

                            return (
                                <g key={month.month}>
                                    <rect x={x} y={220 - due} width="26" height={due} rx="5" fill="#a7f3d0" stroke="#34d399">
                                        <title>{`${monthLabel(month.month, 'long')} — ${t('Rent due')}: ${money(month.expected)}`}</title>
                                    </rect>
                                    <rect x={x + 30} y={220 - got} width="26" height={got} rx="5" fill="#0E3B2E">
                                        <title>{`${monthLabel(month.month, 'long')} — ${t('Rent collected')}: ${money(month.collected)}`}</title>
                                    </rect>
                                    <text x={x + 28} y="242" textAnchor="middle" fontSize="11" fill="#4b5563">{monthLabel(month.month)}</text>
                                </g>
                            );
                        })}
                    </svg>
                </div>
                <dl className="grid gap-px border-t border-gray-100 bg-gray-100 sm:grid-cols-3">
                    {[
                        [t('Total received in period'), money(overview.total_received), t('Rent, deposits and other charges')],
                        [t('Deposits held now'), money(summary.deposits_held), t('To refund at move-out, less damages')],
                        [t('Other charges collected'), money(overview.other_collected), t('Damage and other charges')],
                    ].map(([label, value, note]) => (
                        <div key={label} className="bg-white px-5 py-4">
                            <dt className="text-xs font-semibold text-gray-600">{label}</dt>
                            <dd className="mt-1 font-[Sora] text-lg font-bold text-gray-900">{value}</dd>
                            <dd className="text-xs text-gray-500">{note}</dd>
                        </div>
                    ))}
                </dl>
            </section>

        </div>
    );
}

function ArrearsTab({ arrears, money, formatDate, t }) {
    const { rows, totals } = arrears;
    const buckets = [
        ['d30', t('1–30 days'), 'bg-amber-50 text-amber-900 ring-amber-200'],
        ['d60', t('31–60 days'), 'bg-orange-50 text-orange-900 ring-orange-200'],
        ['d90', t('61–90 days'), 'bg-red-50 text-red-800 ring-red-200'],
        ['over90', t('Over 90 days'), 'bg-red-100 text-red-900 ring-red-300'],
    ];

    if (!rows.length) {
        return (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-10 text-center">
                <CheckCircle2 size={36} className="mx-auto text-emerald-700" aria-hidden="true" />
                <p className="mt-3 font-[Sora] text-lg font-bold text-gray-900">{t('Nobody owes money today')}</p>
                <p className="mt-1 text-sm text-gray-600">{t('All rent and damage charges that fell due have been paid.')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-2xl bg-[#0E3B2E] p-5 text-white shadow-sm lg:col-span-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">{t('Total overdue')}</p>
                    <p className="mt-2 font-[Sora] text-2xl font-bold">{money(totals.total)}</p>
                    <p className="mt-1 text-xs text-emerald-100">{t(':count tenants late', { count: totals.tenants })}</p>
                </div>
                {buckets.map(([key, label, tone]) => (
                    <div key={key} className={`rounded-2xl p-5 ring-1 ${tone}`}>
                        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
                        <p className="mt-2 font-[Sora] text-xl font-bold tabular-nums">{money(totals[key])}</p>
                    </div>
                ))}
            </div>

            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-left text-sm">
                        <caption className="sr-only">{t('Tenants with overdue money')}</caption>
                        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                            <tr>
                                <th scope="col" className="px-4 py-3 font-semibold">{t('Tenant')}</th>
                                <th scope="col" className="px-4 py-3 font-semibold">{t('Property / room')}</th>
                                <th scope="col" className="px-4 py-3 font-semibold">{t('Late since')}</th>
                                {buckets.map(([key, label]) => <th key={key} scope="col" className="px-3 py-3 text-right font-semibold">{label}</th>)}
                                <th scope="col" className="px-4 py-3 text-right font-semibold">{t('Total owed')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.map(row => (
                                <tr key={row.tenancy_id} className="align-top hover:bg-gray-50/70">
                                    <td className="px-4 py-3">
                                        <Link href={route('tenants.show', row.tenant.id)} className="font-semibold text-gray-900 hover:text-[#0E3B2E] hover:underline">{row.tenant.name}</Link>
                                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                                            {row.tenant.phone && <a href={`tel:${row.tenant.phone}`} className="inline-flex items-center gap-1 hover:text-[#0E3B2E]"><Phone size={12} aria-hidden="true" />{row.tenant.phone}</a>}
                                            {row.tenant.email && <a href={`mailto:${row.tenant.email}`} className="inline-flex items-center gap-1 hover:text-[#0E3B2E]"><Mail size={12} aria-hidden="true" />{row.tenant.email}</a>}
                                        </div>
                                        {row.tenancy_status !== 'active' && <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">{t('Moved out')}</span>}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                        <Link href={route('properties.units.show', [row.property.id, row.unit.id])} className="hover:text-[#0E3B2E] hover:underline">{row.property.name} · {t('Room :number', { number: row.unit.unit_number })}</Link>
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-gray-800">{formatDate(row.oldest_due)}</p>
                                        <p className={`mt-0.5 text-xs font-semibold ${row.days_late > 60 ? 'text-red-700' : 'text-amber-800'}`}>{t(':days days late', { days: row.days_late })}</p>
                                    </td>
                                    {buckets.map(([key]) => (
                                        <td key={key} className={`px-3 py-3 text-right tabular-nums ${Number(row.buckets[key]) > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{Number(row.buckets[key]) > 0 ? money(row.buckets[key]) : '—'}</td>
                                    ))}
                                    <td className="px-4 py-3 text-right font-[Sora] font-bold tabular-nums text-red-700">{money(row.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

function OwnersTab({ statements, money, formatDate, t, isAdmin, filters, visit, periodLabel }) {
    const { rows, totals, lines } = statements;
    const single = lines !== null && rows.length === 1;

    if (!rows.length) {
        return <p className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-600">{t('No owners with properties yet.')}</p>;
    }

    if (single) {
        const row = rows[0];

        return (
            <div className="space-y-4">
                {isAdmin && filters.owner_id && (
                    <button type="button" onClick={() => visit({ owner_id: undefined })} className="screen-only text-sm font-semibold text-[#0E3B2E] hover:underline">← {t('All owners')}</button>
                )}
                <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-white p-5 sm:p-6">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">{t('Owner statement')}</p>
                            <h2 className="mt-1 font-[Sora] text-xl font-bold text-gray-900">{row.owner.name}</h2>
                            <p className="mt-1 text-sm text-gray-600">{[row.owner.email, row.owner.phone].filter(Boolean).join(' · ')}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Period')}</p>
                            <p className="mt-1 font-semibold text-gray-900">{periodLabel}</p>
                            <p className="mt-1 text-xs text-gray-600">{t(row.properties === 1 ? '1 property' : ':count properties', { count: row.properties })}{row.owner.managed ? ` · ${t('Managed by Q.R.A (:rate%)', { rate: Number(row.commission_rate) })}` : ''}</p>
                        </div>
                    </header>

                    <dl className="grid gap-px bg-gray-200 sm:grid-cols-3">
                        {[
                            [t('Rent collected'), row.rent_collected, 'text-gray-900'],
                            [t('Q.R.A commission'), row.commission, 'text-amber-800'],
                            [t('Payout to owner'), row.payout, 'text-emerald-800'],
                        ].map(([label, value, tone]) => (
                            <div key={label} className="bg-white px-5 py-4">
                                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</dt>
                                <dd className={`mt-1 font-[Sora] text-2xl font-bold tabular-nums ${tone}`}>{money(value)}</dd>
                            </div>
                        ))}
                    </dl>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-sm">
                            <caption className="sr-only">{t('Rent payments in this period')}</caption>
                            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                                <tr>
                                    <th scope="col" className="px-4 py-3 font-semibold">{t('Date paid')}</th>
                                    <th scope="col" className="px-4 py-3 font-semibold">{t('Tenant')}</th>
                                    <th scope="col" className="px-4 py-3 font-semibold">{t('Property / room')}</th>
                                    <th scope="col" className="px-4 py-3 font-semibold">{t('Months covered')}</th>
                                    <th scope="col" className="px-4 py-3 text-right font-semibold">{t('Amount')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {lines.length ? lines.map(line => (
                                    <tr key={line.id}>
                                        <td className="px-4 py-3">
                                            <p className="text-gray-900">{formatDate(line.paid_at)}</p>
                                            {line.receipt_number && <p className="font-mono text-[11px] text-gray-500">{line.receipt_number}</p>}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-900">{line.tenant}</td>
                                        <td className="px-4 py-3 text-gray-700">{line.property} · {t('Room :number', { number: line.unit })}</td>
                                        <td className="px-4 py-3 text-gray-700">
                                            {t(line.months === 1 ? '1 month' : ':count months', { count: line.months })}
                                            {line.period_start && <span className="block text-xs text-gray-500">{formatDate(line.period_start)} – {formatDate(line.period_end)}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">{money(line.amount)}</td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-600">{t('No rent was received in this period.')}</td></tr>
                                )}
                            </tbody>
                            {lines.length > 0 && (
                                <tfoot className="border-t-2 border-gray-200 bg-gray-50 text-sm">
                                    <tr><th scope="row" colSpan={4} className="px-4 py-2 text-right font-semibold text-gray-700">{t('Rent collected')}</th><td className="px-4 py-2 text-right font-semibold tabular-nums">{money(row.rent_collected)}</td></tr>
                                    {row.owner.managed && <tr><th scope="row" colSpan={4} className="px-4 py-2 text-right font-semibold text-amber-800">{t('Less Q.R.A commission (:rate%)', { rate: Number(row.commission_rate) })}</th><td className="px-4 py-2 text-right font-semibold tabular-nums text-amber-800">− {money(row.commission)}</td></tr>}
                                    <tr><th scope="row" colSpan={4} className="px-4 py-2 text-right font-bold text-gray-900">{t('Payout to owner')}</th><td className="px-4 py-2 text-right font-[Sora] text-base font-bold tabular-nums text-emerald-800">{money(row.payout)}</td></tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                    <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-600">
                        {t('Security deposits received (:amount) are held for tenants and are not part of the payout.', { amount: money(row.deposits_received) })}
                    </p>
                </article>
            </div>
        );
    }

    return (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="grid gap-px border-b border-gray-200 bg-gray-200 sm:grid-cols-3">
                {[
                    [t('Rent collected'), totals.rent_collected, 'text-gray-900'],
                    [t('Q.R.A commission'), totals.commission, 'text-amber-800'],
                    [t('Payouts to owners'), totals.payout, 'text-emerald-800'],
                ].map(([label, value, tone]) => (
                    <div key={label} className="bg-white px-5 py-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</p>
                        <p className={`mt-1 font-[Sora] text-xl font-bold tabular-nums ${tone}`}>{money(value)}</p>
                    </div>
                ))}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                    <caption className="sr-only">{t('Owner statements')}</caption>
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                        <tr>
                            <th scope="col" className="px-4 py-3 font-semibold">{t('Owner')}</th>
                            <th scope="col" className="px-4 py-3 text-right font-semibold">{t('Rent collected')}</th>
                            <th scope="col" className="px-4 py-3 text-right font-semibold">{t('Q.R.A commission')}</th>
                            <th scope="col" className="px-4 py-3 text-right font-semibold">{t('Payout to owner')}</th>
                            <th scope="col" className="px-4 py-3 text-right font-semibold">{t('Deposits held')}</th>
                            <th scope="col" className="screen-only px-4 py-3"><span className="sr-only">{t('Actions')}</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {rows.map(row => (
                            <tr key={row.owner.id} className="hover:bg-gray-50/70">
                                <td className="px-4 py-3">
                                    <p className="flex items-center gap-2 font-semibold text-gray-900"><UserRound size={15} className="text-gray-400" aria-hidden="true" />{row.owner.name}</p>
                                    <p className="mt-0.5 text-xs text-gray-600">
                                        {t(row.properties === 1 ? '1 property' : ':count properties', { count: row.properties })}
                                        {row.owner.managed
                                            ? <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-900 ring-1 ring-amber-200">{t('Managed · :rate%', { rate: Number(row.commission_rate) })}</span>
                                            : <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">{t('Self-managed')}</span>}
                                    </p>
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">{money(row.rent_collected)}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-amber-800">{row.owner.managed ? money(row.commission) : '—'}</td>
                                <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-800">{money(row.payout)}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-violet-800">{money(row.deposits_received)}</td>
                                <td className="screen-only px-4 py-3 text-right">
                                    <button type="button" onClick={() => visit({ owner_id: row.owner.id })} className="inline-flex items-center gap-1.5 rounded-lg border border-[#0E3B2E]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#0E3B2E] hover:bg-emerald-50">
                                        <FileText size={13} aria-hidden="true" /> {t('Statement')}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function OccupancyTab({ properties, summary, money, t }) {
    return (
        <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={Building2} label={t('Properties')} value={summary.properties} />
                <StatCard icon={DoorOpen} label={t('Rooms')} value={summary.units} note={t(':count rented', { count: summary.occupied_units })} />
                <StatCard icon={Percent} label={t('Occupancy')} value={`${summary.occupancy_rate}%`} tone="blue" />
                <StatCard icon={Users} label={t('Monthly rent of empty rooms')} value={money(summary.vacant_rent)} note={t('Income you could add by renting them')} tone="amber" />
            </div>
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                    <h2 className="font-[Sora] font-semibold text-gray-900">{t('Occupancy by property')}</h2>
                    <Link href={route('properties.index')} className="screen-only inline-flex items-center gap-1 text-sm font-semibold text-[#0E3B2E] hover:underline">{t('Manage properties')} <ArrowUpRight size={15} aria-hidden="true" /></Link>
                </div>
                {properties.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-sm">
                            <caption className="sr-only">{t('Occupancy by property')}</caption>
                            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                                <tr>
                                    <th scope="col" className="px-5 py-3 font-semibold">{t('Property')}</th>
                                    <th scope="col" className="px-5 py-3 font-semibold">{t('Rooms rented')}</th>
                                    <th scope="col" className="px-5 py-3 font-semibold">{t('Occupancy')}</th>
                                    <th scope="col" className="px-5 py-3 text-right font-semibold">{t('Empty rooms · rent/month')}</th>
                                    <th scope="col" className="px-5 py-3 font-semibold">{t('Current tenants')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {properties.map(property => (
                                    <tr key={property.id} className="align-top hover:bg-gray-50/70">
                                        <td className="px-5 py-4"><Link href={route('properties.show', property.id)} className="font-semibold text-gray-900 hover:text-[#0E3B2E] hover:underline">{property.name}</Link></td>
                                        <td className="px-5 py-4 tabular-nums text-gray-800">{property.occupied_units_count} / {property.units_count}</td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#0E3B2E]" style={{ width: `${property.occupancy_rate}%` }} /></div>
                                                <span className="text-xs font-semibold text-gray-800">{property.occupancy_rate}%</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-right tabular-nums">
                                            <span className="text-gray-900">{property.available_units_count}</span>
                                            {Number(property.vacant_rent) > 0 && <span className="block text-xs text-amber-800">{money(property.vacant_rent)}</span>}
                                        </td>
                                        <td className="px-5 py-4 text-xs text-gray-700">{property.active_tenants.length ? property.active_tenants.map(record => `${record.tenant} · ${record.unit}`).join(', ') : t('No active tenants')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <p className="p-8 text-center text-sm text-gray-600">{t('Add a property to start seeing portfolio reports.')}</p>}
            </section>
        </div>
    );
}
