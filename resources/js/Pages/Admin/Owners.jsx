import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useTranslation } from '@/localization';
import { Head, Link, router } from '@inertiajs/react';
import { Building2, ChevronRight, DoorOpen, KeyRound, Lock, Search, TrendingUp, Users, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';

const localeFor = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';
const STATUS_STYLE = {
    approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    pending: 'bg-amber-50 text-amber-900 ring-amber-200',
    rejected: 'bg-red-50 text-red-800 ring-red-200',
    disabled: 'bg-gray-100 text-gray-700 ring-gray-200',
};
const STATUS_LABEL = { approved: 'Approved', pending: 'Pending', rejected: 'Rejected', disabled: 'Disabled' };

/** Admin only: every self-registered (SaaS) owner and what they do on ITUZE. */
export default function AdminOwners({ owners, filters = {}, totals = {} }) {
    const { t, language } = useTranslation();
    const locale = localeFor(language);
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    const date = (value) => (value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—');
    const [search, setSearch] = useState(filters.search || '');
    const visit = (changes) => router.get(route('admin.owners'), { ...filters, ...changes }, { preserveScroll: true, preserveState: true, replace: true });
    useEffect(() => {
        if (search === (filters.search || '')) return undefined;
        const timer = setTimeout(() => visit({ search: search || undefined, page: undefined }), 350);
        return () => clearTimeout(timer);
    }, [search]);

    const cards = [
        ['Self-registered owners', totals.owners, Users],
        ['Buildings', totals.properties, Building2],
        ['Units', totals.units, DoorOpen],
        ['Active rentals', totals.active_rentals, KeyRound],
        ['Rent they recorded this month', money(totals.rent_this_month), TrendingUp],
        ['Subscriptions paid to QRA', money(totals.subscription_paid), Wallet],
    ];

    return (
        <AuthenticatedLayout header="Owners">
            <Head title={t('Owners')} />
            <div className="mx-auto max-w-7xl space-y-5">
                <section className="flex flex-wrap items-start gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6">
                    <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#0E3B2E] text-white" aria-hidden="true"><Building2 size={22} /></span>
                    <div className="min-w-0 flex-1">
                        <h1 className="font-[Sora] text-2xl font-bold text-gray-900">{t('Self-registered owners')}</h1>
                        <p className="mt-1 text-sm text-gray-600">{t('Follow every owner who signed up and pays the subscription: buildings, units, tenants, rentals and payments.')}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700"><Lock size={12} aria-hidden="true" />{t('Admin only · read only')}</span>
                </section>

                <section aria-label={t('Summary')} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {cards.map(([label, value, Icon]) => (
                        <div key={label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04]">
                            <Icon size={18} className="text-[#0E3B2E]" aria-hidden="true" />
                            <p className="mt-2 text-lg font-bold text-gray-900">{value ?? 0}</p>
                            <p className="text-xs text-gray-600">{t(label)}</p>
                        </div>
                    ))}
                </section>

                <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <label className="relative flex-1">
                            <span className="sr-only">{t('Search owners')}</span>
                            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Name, email, phone or building')}
                                className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm focus:border-[#0E3B2E] focus:outline-none focus:ring-2 focus:ring-[#0E3B2E]/15" />
                        </label>
                        <label className="text-sm">
                            <span className="sr-only">{t('Status')}</span>
                            <select value={filters.status || 'all'} onChange={(event) => visit({ status: event.target.value, page: undefined })} className="rounded-xl border-gray-300 text-sm">
                                <option value="all">{t('All')}</option>
                                {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
                            </select>
                        </label>
                    </div>

                    <ul className="mt-4 divide-y divide-gray-100">
                        {owners.data.map((owner) => (
                            <li key={owner.id}>
                                <Link href={route('admin.owners.show', owner.id)} className="group flex flex-col gap-3 rounded-2xl px-2 py-4 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]/30 lg:flex-row lg:items-center">
                                    <div className="min-w-0 lg:w-72">
                                        <p className="flex flex-wrap items-center gap-2">
                                            <span className="truncate font-semibold text-gray-900">{owner.name}</span>
                                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_STYLE[owner.status] || STATUS_STYLE.disabled}`}>{t(STATUS_LABEL[owner.status] || owner.status)}</span>
                                        </p>
                                        <p className="truncate text-xs text-gray-600">{owner.email} · {owner.phone || '—'}</p>
                                        <p className="text-xs text-gray-500">{t('Joined :date', { date: date(owner.joined) })}</p>
                                    </div>
                                    <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3 xl:grid-cols-6">
                                        <Stat label={t('Buildings')} value={owner.properties} />
                                        <Stat label={t('Units')} value={`${owner.occupied}/${owner.units} ${t('occupied')}`} />
                                        <Stat label={t('Active rentals')} value={owner.active_rentals} />
                                        <Stat label={t('Managers')} value={owner.managers} />
                                        <Stat label={t('Rent this month')} value={money(owner.rent_this_month)} />
                                        <Stat label={t('Paid to QRA')} value={money(owner.subscription_paid)} />
                                    </dl>
                                    <ChevronRight size={18} className="hidden flex-none text-gray-400 transition group-hover:translate-x-0.5 lg:block" aria-hidden="true" />
                                </Link>
                            </li>
                        ))}
                        {owners.data.length === 0 && <li className="py-10 text-center text-sm text-gray-600">{t('No owner matches.')}</li>}
                    </ul>
                    {owners.last_page > 1 && (
                        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
                            <button type="button" disabled={!owners.prev_page_url} onClick={() => visit({ page: owners.current_page - 1 })} className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold disabled:opacity-40">{t('Previous')}</button>
                            <button type="button" disabled={!owners.next_page_url} onClick={() => visit({ page: owners.current_page + 1 })} className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold disabled:opacity-40">{t('Next')}</button>
                        </div>
                    )}
                </section>
            </div>
        </AuthenticatedLayout>
    );
}

function Stat({ label, value }) {
    return (
        <div className="min-w-0">
            <dt className="text-gray-500">{label}</dt>
            <dd className="truncate font-semibold text-gray-900">{value}</dd>
        </div>
    );
}
