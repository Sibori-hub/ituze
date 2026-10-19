import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import ManageLeaseDialog from '@/Components/ManageLeaseDialog';
import SortHeader from '@/Components/SortHeader';
import { useTranslation } from '@/localization';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle, ArrowDownToLine, CalendarClock, CheckCircle2, Clock3, FileText, Hourglass, RefreshCcw, Search, Settings2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const TABS = [
    { key: 'all', label: 'All leases', icon: FileText, tone: 'text-gray-700' },
    { key: 'active', label: 'Active', icon: CheckCircle2, tone: 'text-green-700' },
    { key: 'ending_soon', label: 'Ending soon', icon: Hourglass, tone: 'text-amber-700' },
    { key: 'expired', label: 'Expired', icon: AlertTriangle, tone: 'text-red-700' },
    { key: 'scheduled', label: 'Starting soon', icon: CalendarClock, tone: 'text-blue-700' },
    { key: 'ended', label: 'Ended', icon: Clock3, tone: 'text-gray-500' },
];

const TERM = {
    Active: { badge: 'bg-green-50 text-green-800 ring-green-600/20', bar: 'bg-green-500', edge: 'border-l-green-500' },
    Ongoing: { badge: 'bg-green-50 text-green-800 ring-green-600/20', bar: 'bg-green-500', edge: 'border-l-green-500' },
    Renewed: { badge: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20', bar: 'bg-emerald-500', edge: 'border-l-emerald-500' },
    'Expiring soon': { badge: 'bg-amber-50 text-amber-900 ring-amber-600/25', bar: 'bg-amber-500', edge: 'border-l-amber-500' },
    Expired: { badge: 'bg-red-50 text-red-800 ring-red-600/20', bar: 'bg-red-500', edge: 'border-l-red-500' },
    Scheduled: { badge: 'bg-blue-50 text-blue-800 ring-blue-600/20', bar: 'bg-blue-500', edge: 'border-l-blue-500' },
    Ended: { badge: 'bg-gray-100 text-gray-700 ring-gray-500/20', bar: 'bg-gray-400', edge: 'border-l-gray-300' },
    Cancelled: { badge: 'bg-gray-100 text-gray-600 ring-gray-500/20', bar: 'bg-gray-300', edge: 'border-l-gray-300' },
};

const PAYMENT = {
    Paid: 'text-green-800 bg-green-50',
    'Up to date': 'text-blue-800 bg-blue-50',
    'Partially paid': 'text-amber-900 bg-amber-50',
    Due: 'text-amber-900 bg-amber-50',
    Overdue: 'text-red-800 bg-red-50',
};

const METHOD = { cash: 'Cash', mobile_money: 'Mobile money', bank_transfer: 'Bank transfer', cheque: 'Cheque', other: 'Other' };

export default function LeasesIndex({ leases, isAdmin = false, canManage = false, owners = [], counts = {}, endingSoonDays = 60, filters = {} }) {
    const { t, language } = useTranslation();
    const locale = ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';
    const dateLabel = (value) => {
        if (!value) return '—';
        const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
        return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
    };
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 2 })} RWF`;

    const [search, setSearch] = useState(filters.search || '');
    const [managing, setManaging] = useState(null);
    const first = useRef(true);
    const status = filters.status || 'all';

    const visit = (params) => router.get(route('leases.index'), {
        owner_id: filters.owner_id || undefined,
        status: status === 'all' ? undefined : status,
        search: search || undefined,
        sort: filters.sort && filters.sort !== 'end_date' ? filters.sort : undefined,
        direction: filters.direction && filters.direction !== 'asc' ? filters.direction : undefined,
        per_page: filters.per_page && Number(filters.per_page) !== 25 ? filters.per_page : undefined,
        ...params,
    }, { preserveState: true, preserveScroll: true, replace: true });

    useEffect(() => {
        if (first.current) { first.current = false; return undefined; }
        const timer = setTimeout(() => visit({ search: search || undefined }), 350);
        return () => clearTimeout(timer);
    }, [search]);

    // Keep the open dialog in step with fresh data (e.g. after a renewal the lease leaves this tab).
    useEffect(() => {
        if (managing && !leases.data.some(lease => lease.id === managing.id)) setManaging(null);
    }, [leases.data]);

    const needsAction = (counts.expired || 0) + (counts.ending_soon || 0);
    const sortBy = (column) => visit({
        sort: column,
        direction: filters.sort === column && filters.direction === 'asc' ? 'desc' : 'asc',
        page: undefined,
    });

    return (
        <AuthenticatedLayout header="Leases">
            <Head title={t('Leases')} />

            <div className="mx-auto max-w-7xl space-y-6">
                {/* Hero */}
                <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
                    <div className="flex flex-col gap-5 bg-gradient-to-br from-[#0E3B2E]/[0.07] via-white to-amber-50/70 p-6 sm:flex-row sm:items-end sm:justify-between">
                        <div className="flex items-start gap-4">
                            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#0E3B2E] text-white shadow-md shadow-[#0E3B2E]/20"><FileText size={22} aria-hidden="true" /></span>
                            <div>
                                <h1 className="font-[Sora] text-2xl font-bold text-gray-900">{t('Lease documents')}</h1>
                                <p className="mt-1 text-sm text-gray-600">{t('Signed agreements and renewals attached to your tenancies.')}</p>
                                {needsAction > 0 && (
                                    <button type="button" onClick={() => visit({ status: counts.expired ? 'expired' : 'ending_soon' })}
                                        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200">
                                        <AlertTriangle size={13} aria-hidden="true" />
                                        {t(':count leases need attention', { count: needsAction })}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            {isAdmin && (
                                <select value={filters.owner_id || ''} onChange={e => visit({ owner_id: e.target.value || undefined })} aria-label={t('Filter by owner')}
                                    className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-[#0E3B2E] focus:ring-2 focus:ring-[#0E3B2E]/15">
                                    <option value="">{t('All owners')}</option>
                                    {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
                                </select>
                            )}
                            <div className="relative sm:w-72">
                                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                                <label htmlFor="lease-search" className="sr-only">{t('Search leases')}</label>
                                <input id="lease-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Tenant, building, room or reference')}
                                    className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-[#0E3B2E] focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/15" />
                            </div>
                        </div>
                    </div>

                    {/* Status tabs */}
                    <nav aria-label={t('Lease status')} className="grid grid-cols-2 gap-px border-t border-gray-100 bg-gray-100 sm:grid-cols-3 lg:grid-cols-6">
                        {TABS.map(({ key, label, icon: Icon, tone }) => {
                            const active = status === key;
                            return (
                                <button key={key} type="button" onClick={() => visit({ status: key === 'all' ? undefined : key })} aria-current={active ? 'page' : undefined}
                                    className={`flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${active ? 'bg-[#0E3B2E] text-white' : 'bg-white hover:bg-gray-50'}`}>
                                    <Icon size={18} aria-hidden="true" className={active ? 'text-white' : tone} />
                                    <span className="min-w-0">
                                        <span className={`block font-[Sora] text-lg font-bold leading-none ${active ? 'text-white' : 'text-gray-900'}`}>{counts[key] ?? 0}</span>
                                        <span className={`mt-1 block truncate text-xs font-medium ${active ? 'text-white/80' : 'text-gray-600'}`}>
                                            {key === 'ending_soon' ? t('Ending in :days days', { days: endingSoonDays }) : t(label)}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </nav>
                </section>

                {/* Leases table */}
                <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" aria-label={t('Leases')}>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
                        <p className="text-sm text-gray-600" aria-live="polite">
                            {leases.total
                                ? t('Showing :from–:to of :total leases', { from: leases.from, to: leases.to, total: leases.total })
                                : t('No leases here')}
                        </p>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                            {t('Rows per page')}
                            <select value={filters.per_page || 25} onChange={e => visit({ per_page: e.target.value, page: undefined })}
                                className="rounded-lg border border-gray-300 bg-white py-1.5 pl-2.5 pr-8 text-xs focus:border-[#0E3B2E] focus:ring-2 focus:ring-[#0E3B2E]/15">
                                {[15, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                            </select>
                        </label>
                    </div>

                    {leases.data.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                                <thead className="whitespace-nowrap bg-gray-50 text-[11px] uppercase tracking-wide text-gray-600">
                                    <tr>
                                        <SortHeader column="tenant" label={t('Tenant')} filters={filters} onSort={sortBy} />
                                        <th scope="col" className="px-3 py-3 font-semibold">{t('Building / room')}</th>
                                        <SortHeader column="end_date" label={t('Lease term')} filters={filters} onSort={sortBy} />
                                        <th scope="col" className="px-3 py-3 font-semibold">{t('Status / payments')}</th>
                                        <SortHeader column="rent" label={t('Monthly rent')} filters={filters} onSort={sortBy} align="right" />
                                        <th scope="col" className="px-3 py-3 font-semibold">{t('Document')}</th>
                                        <th scope="col" className="px-3 py-3 text-right font-semibold"><span className="sr-only">{t('Actions')}</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {leases.data.map(lease => {
                                        const tenancy = lease.tenancy;
                                        const unit = tenancy?.unit;
                                        const property = unit?.property;
                                        const look = TERM[lease.term_status] || TERM.Ended;
                                        const downloadUrl = property && unit && tenancy
                                            ? route('properties.units.tenancy.leases.download', [property.id, unit.id, tenancy.id, lease.id])
                                            : null;
                                        const progress = lease.progress_percent ?? null;
                                        const expired = lease.term_status === 'Expired';

                                        return (
                                            <tr key={lease.id} className={`align-middle transition-colors hover:bg-gray-50 ${expired ? 'bg-red-50/40' : ''}`}>
                                                <td className={`border-l-4 px-3 py-3 ${look.edge}`}>
                                                    <p className="max-w-[10rem] truncate font-semibold text-gray-900">{tenancy?.tenant?.name || '—'}</p>
                                                    <p className="text-xs text-gray-500">{tenancy?.tenant?.phone || ''}</p>
                                                </td>
                                                <td className="px-3 py-3">
                                                    {property && unit ? (
                                                        <Link href={route('properties.units.show', [property.id, unit.id])} className="block max-w-[10rem] truncate text-gray-800 hover:text-[#0E3B2E] hover:underline">{property.name}</Link>
                                                    ) : <p className="text-gray-800">—</p>}
                                                    <p className="max-w-[10rem] truncate whitespace-nowrap text-xs text-gray-500">
                                                        {unit?.unit_number ? t('Room :number', { number: unit.unit_number }) : ''}
                                                        {unit?.unit_type?.name && ` · ${unit.unit_type.name}`}
                                                    </p>
                                                </td>
                                                <td className="w-40 px-3 py-3">
                                                    <p className="text-xs leading-snug text-gray-600">{dateLabel(tenancy?.start_date)} → {tenancy?.end_date ? dateLabel(tenancy.end_date) : t('Ongoing')}</p>
                                                    <p className={`mt-0.5 text-xs font-semibold ${expired ? 'text-red-700' : 'text-gray-800'}`}>{lease.countdown_label}</p>
                                                    {progress !== null && (
                                                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={t('Lease time used')}>
                                                            <div className={`h-full rounded-full ${look.bar}`} style={{ width: `${Math.min(100, progress)}%` }} />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${look.badge}`} title={expired ? t('Expired – action needed') : undefined}>
                                                        {expired && <AlertTriangle size={12} aria-hidden="true" />}
                                                        {t(expired ? 'Expired' : lease.term_status === 'Expiring soon' ? 'Ending soon' : lease.term_status)}
                                                        {expired && <span className="sr-only"> – {t('action needed')}</span>}
                                                    </span>
                                                    <p className={`mt-1 whitespace-nowrap text-xs font-medium ${Number(lease.payment_balance) > 0 ? 'text-red-700' : 'text-gray-500'}`}>
                                                        {Number(lease.payment_balance) > 0 ? t(':amount outstanding', { amount: money(lease.payment_balance) }) : t(lease.payment_status)}
                                                    </p>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-3 text-right">
                                                    <p className="font-semibold text-gray-900">{money(tenancy?.monthly_rent)}</p>
                                                    <p className="text-xs text-gray-500">{t('Deposit')} {money(tenancy?.deposit_amount)}</p>
                                                </td>
                                                <td className="px-3 py-3">
                                                    {downloadUrl ? (
                                                        <a href={downloadUrl} className="group inline-flex max-w-[9rem] items-center gap-1.5 text-xs" aria-label={t('Download :file', { file: lease.original_name })}>
                                                            <ArrowDownToLine size={14} className="flex-none text-[#0E3B2E]" aria-hidden="true" />
                                                            <span className="min-w-0" title={`${t(METHOD[lease.payment_method] || 'Unknown')}${lease.payment_reference ? ` · ${lease.payment_reference}` : ''}`}>
                                                                <span className="block truncate font-medium text-gray-800 group-hover:text-[#0E3B2E] group-hover:underline">{lease.reference_number || lease.original_name}</span>
                                                            </span>
                                                        </a>
                                                    ) : <span className="text-xs text-gray-400">—</span>}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {canManage && lease.can_renew && (
                                                            <button type="button" onClick={() => setManaging(lease)}
                                                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors ${expired ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0E3B2E] hover:bg-[#124B3A]'}`}>
                                                                {lease.term_status === 'Active' ? <Settings2 size={13} aria-hidden="true" /> : <RefreshCcw size={13} aria-hidden="true" />}
                                                                {t('Manage lease')}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-12 text-center">
                            <FileText size={40} className="mx-auto text-gray-300" aria-hidden="true" />
                            <h2 className="mt-3 font-semibold text-gray-900">{status === 'all' && !search ? t('No lease documents yet') : t('No leases here')}</h2>
                            <p className="mt-1 text-sm text-gray-600">{status === 'all' && !search ? t('Assign a tenant to a room to create the first lease.') : t('Try another tab or search.')}</p>
                            {status === 'all' && !search && <Link href={route('tenants.index')} className="mt-4 inline-flex text-sm font-semibold text-[#0E3B2E] hover:underline">{t('Go to tenants')}</Link>}
                        </div>
                    )}

                    {leases.last_page > 1 && (
                        <nav aria-label={t('Pages')} className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 sm:px-5">
                            <p className="text-xs text-gray-500">{t('Page :page of :pages', { page: leases.current_page, pages: leases.last_page })}</p>
                            <div className="flex flex-wrap gap-1">
                                {leases.links.map((link, index) => (
                                    <Link key={index} href={link.url || '#'} preserveScroll preserveState
                                        className={`min-w-[2.25rem] rounded-lg px-3 py-1.5 text-center text-sm ${link.active ? 'bg-[#0E3B2E] font-semibold text-white' : 'text-gray-700 hover:bg-gray-100'} ${!link.url ? 'pointer-events-none opacity-40' : ''}`}
                                        dangerouslySetInnerHTML={{ __html: link.label }} />
                                ))}
                            </div>
                        </nav>
                    )}
                </section>
            </div>

            <ManageLeaseDialog lease={managing} onClose={() => setManaging(null)} />
        </AuthenticatedLayout>
    );
}
