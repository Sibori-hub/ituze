import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import useFloorLabel from '@/hooks/useFloorLabel';
import { useTranslation } from '@/localization';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Building2, DoorOpen, FileText, KeyRound, Lock, Mail, Phone, Receipt, Smartphone, TrendingUp, Users, Wallet } from 'lucide-react';
import { useState } from 'react';

const localeFor = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';
const STATE_STYLE = {
    active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    expiring: 'bg-sky-50 text-sky-800 ring-sky-200',
    grace: 'bg-amber-50 text-amber-900 ring-amber-200',
    paused: 'bg-red-50 text-red-800 ring-red-200',
    unpaid: 'bg-amber-50 text-amber-900 ring-amber-200',
    free: 'bg-gray-100 text-gray-700 ring-gray-200',
};
const STATE_LABEL = { active: 'Paid', expiring: 'Ends soon', grace: 'Overdue (grace)', paused: 'Paused', unpaid: 'Not paid yet', free: 'Free' };
const UNIT_STYLE = { occupied: 'bg-emerald-50 text-emerald-800', available: 'bg-sky-50 text-sky-800', reserved: 'bg-amber-50 text-amber-900', maintenance: 'bg-gray-100 text-gray-700' };
const METHOD_LABEL = { momo_pay: 'MoMo Pay', mobile_money: 'Mobile money', bank_transfer: 'Bank transfer', cheque: 'Cheque', cash: 'Cash', other: 'Other' };

/** Admin only, read only: everything one self-registered owner does on ITUZE. */
export default function AdminOwnerShow({ owner, managers = [], summary = {}, properties = [], units = [], tenants = [], rentals = [], payments = [], subscriptions = [] }) {
    const { t, language } = useTranslation();
    const floorLabel = useFloorLabel();
    const locale = localeFor(language);
    const money = (value) => `${Number(value || 0).toLocaleString(locale, { maximumFractionDigits: 0 })} RWF`;
    const date = (value) => (value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—');
    const dateTime = (value) => (value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '—');
    const tabs = [
        ['buildings', t('Buildings'), properties.length],
        ['units', t('Units'), units.length],
        ['tenants', t('Tenants'), tenants.length],
        ['rentals', t('Rentals'), rentals.length],
        ['payments', t('Rent payments'), payments.length],
        ['subscription', t('Subscription'), subscriptions.length],
    ];
    const [tab, setTab] = useState('buildings');

    const cards = [
        ['Buildings', summary.properties, Building2],
        ['Units', `${summary.occupied}/${summary.units} ${t('occupied')}`, DoorOpen],
        ['Tenants', summary.tenants, Users],
        ['Active rentals', summary.active_rentals, KeyRound],
        ['Rent this month', money(summary.rent_this_month), TrendingUp, t('Deposits: :amount', { amount: money(summary.deposits_this_month) })],
        ['Rent since joining', money(summary.rent_all_time), Receipt],
        ['Paid to QRA', money(summary.subscription_paid), Wallet],
    ];

    return (
        <AuthenticatedLayout header="Owners">
            <Head title={`${t('Owner')} · ${owner.name}`} />
            <div className="mx-auto max-w-7xl space-y-5">
                <Link href={route('admin.owners')} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#0E3B2E]"><ArrowLeft size={16} aria-hidden="true" />{t('All owners')}</Link>

                <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6">
                    <div className="flex flex-wrap items-start gap-4">
                        <span className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-[#0E3B2E] text-xl font-bold text-white" aria-hidden="true">{owner.name?.charAt(0)}</span>
                        <div className="min-w-0 flex-1">
                            <h1 className="font-[Sora] text-2xl font-bold text-gray-900">{owner.name}</h1>
                            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                                <span className="inline-flex items-center gap-1.5"><Mail size={14} aria-hidden="true" />{owner.email}</span>
                                <span className="inline-flex items-center gap-1.5"><Phone size={14} aria-hidden="true" />{owner.phone || '—'}</span>
                                <span>{t('Joined :date', { date: date(owner.joined) })}</span>
                                <span>{t(owner.disabled ? 'Disabled' : owner.status === 'approved' ? 'Approved' : owner.status === 'pending' ? 'Pending' : 'Rejected')}</span>
                            </p>
                            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                                <span>{owner.identity_document_type === 'passport' ? t('Passport') : t('National ID')}: <span className="font-mono">{owner.national_id || '—'}</span></span>
                                {owner.has_identity_document && <a href={route('admin.approvals.identity-document', owner.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#0E3B2E] underline underline-offset-2"><FileText size={14} aria-hidden="true" />{t('View ID document')}</a>}
                                <span className="inline-flex items-center gap-1.5"><Smartphone size={14} aria-hidden="true" />{t('MoMo Pay')}: {owner.momo_pay_code ? `${owner.momo_pay_code} (${owner.momo_pay_name})` : t('Not added yet')}</span>
                            </p>
                            {managers.length > 0 && (
                                <p className="mt-1 text-sm text-gray-600">{t('Managers')}: {managers.map((manager) => `${manager.name} (${manager.phone || manager.email})`).join(', ')}</p>
                            )}
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700"><Lock size={12} aria-hidden="true" />{t('Admin only · read only')}</span>
                    </div>
                </section>

                <section aria-label={t('Summary')} className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                    {cards.map(([label, value, Icon, note]) => (
                        <div key={label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04]">
                            <Icon size={18} className="text-[#0E3B2E]" aria-hidden="true" />
                            <p className="mt-2 text-base font-bold text-gray-900">{value ?? 0}</p>
                            <p className="text-xs text-gray-600">{t(label)}</p>
                            {note && <p className="mt-0.5 text-[11px] text-gray-500">{note}</p>}
                        </div>
                    ))}
                </section>

                <section className="rounded-3xl bg-white shadow-sm ring-1 ring-black/[0.04]">
                    <div role="tablist" aria-label={t('Owner data')} className="flex gap-1 overflow-x-auto border-b border-gray-100 px-3 pt-3">
                        {tabs.map(([key, label, count]) => (
                            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                                className={`whitespace-nowrap rounded-t-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]/30 ${tab === key ? 'border-b-2 border-[#0E3B2E] text-[#0E3B2E]' : 'text-gray-600 hover:text-gray-900'}`}>
                                {label} <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{count}</span>
                            </button>
                        ))}
                    </div>
                    <div role="tabpanel" className="overflow-x-auto p-4 sm:p-5">
                        {tab === 'buildings' && (
                            <Table empty={t('No building yet.')} head={[t('Building'), t('Address'), t('Floors'), t('Units'), t('Subscription'), t('Paid until'), t('Created')]}
                                rows={properties.map((property) => [
                                    <Link key="n" href={route('properties.show', property.id)} className="font-semibold text-[#0E3B2E] underline-offset-2 hover:underline">{property.name}</Link>,
                                    property.address, property.floors ?? '—', property.units,
                                    <span key="s" className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATE_STYLE[property.state]}`}>{t(STATE_LABEL[property.state] || property.state)}</span>,
                                    date(property.paid_until), date(property.created_at),
                                ])} />
                        )}
                        {tab === 'units' && (
                            <Table empty={t('No unit yet.')} head={[t('Building'), t('Floor'), t('Unit'), t('Size'), t('Rent / month'), t('Status'), t('Tenant'), t('Used as')]}
                                rows={units.map((unit) => [
                                    unit.property, floorLabel(unit.floor ?? 0),
                                    <Link key="u" href={route('properties.units.show', [unit.property_id, unit.id])} className="font-semibold text-[#0E3B2E] underline-offset-2 hover:underline">{unit.number}</Link>,
                                    unit.size ? `${Number(unit.size).toLocaleString(locale)} m²` : '—', money(unit.rent),
                                    <span key="s" className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${UNIT_STYLE[unit.status] || UNIT_STYLE.maintenance}`}>{t(unit.status.charAt(0).toUpperCase() + unit.status.slice(1))}</span>,
                                    unit.tenant || '—', unit.business_use || '—',
                                ])} />
                        )}
                        {tab === 'tenants' && (
                            <Table empty={t('No tenant yet.')} head={[t('Tenant'), t('Phone'), t('Email'), t('Active rentals'), t('ID document'), t('Added')]}
                                rows={tenants.map((tenant) => [
                                    <Link key="n" href={route('tenants.show', tenant.id)} className="flex items-center gap-2 font-semibold text-[#0E3B2E] underline-offset-2 hover:underline">
                                        {tenant.photo_url ? <img src={tenant.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-600" aria-hidden="true">{tenant.name?.charAt(0)}</span>}
                                        {tenant.name}
                                    </Link>,
                                    tenant.phone || '—', tenant.email || '—', tenant.active_rentals,
                                    tenant.identity_document_url ? <a key="d" href={tenant.identity_document_url} target="_blank" rel="noreferrer" className="font-semibold text-[#0E3B2E] underline underline-offset-2">{t('View')}</a> : t('Not added yet'),
                                    date(tenant.created_at),
                                ])} />
                        )}
                        {tab === 'rentals' && (
                            <Table empty={t('No rental yet.')} head={[t('Building'), t('Unit'), t('Tenant'), t('Used as'), t('Start'), t('End'), t('Rent / month'), t('Status')]}
                                rows={rentals.map((rental) => [
                                    rental.property, `${rental.unit} · ${floorLabel(rental.floor ?? 0)}`,
                                    <Link key="t" href={route('tenants.show', rental.tenant_id)} className="font-semibold text-[#0E3B2E] underline-offset-2 hover:underline">{rental.tenant}</Link>,
                                    rental.business_use || '—', date(rental.start), date(rental.end), money(rental.rent), t(rental.status.charAt(0).toUpperCase() + rental.status.slice(1)),
                                ])} />
                        )}
                        {tab === 'payments' && (
                            <Table empty={t('No rent payment yet.')} head={[t('Date'), t('Building · unit'), t('Tenant'), t('Type'), t('Amount'), t('Method'), t('Transaction ID'), t('Paid by'), t('Proof')]}
                                rows={payments.map((payment) => [
                                    dateTime(payment.paid_at), `${payment.property} · ${payment.unit}`, payment.tenant,
                                    t(payment.type === 'deposit' ? 'Deposit' : 'Rent'), money(payment.amount), t(METHOD_LABEL[payment.method] || payment.method),
                                    <span key="r" className="font-mono">{payment.reference || '—'}</span>,
                                    payment.payer_name ? `${payment.payer_name}${payment.payer_phone ? ` · ${payment.payer_phone}` : ''}` : '—',
                                    payment.proof_url ? <a key="p" href={payment.proof_url} target="_blank" rel="noreferrer" className="font-semibold text-[#0E3B2E] underline underline-offset-2">{t('View')}</a> : '—',
                                ])} />
                        )}
                        {tab === 'subscription' && (
                            <Table empty={t('No subscription payment yet.')} head={[t('Date'), t('Building'), t('Months'), t('Amount'), t('Method'), t('Reference'), t('Status')]}
                                rows={subscriptions.map((payment) => [
                                    date(payment.created_at), payment.property || '—', payment.months, money(payment.amount), t(METHOD_LABEL[payment.method] || payment.method),
                                    <span key="r" className="font-mono">{payment.reference || '—'}</span>, t(payment.status.charAt(0).toUpperCase() + payment.status.slice(1)),
                                ])} />
                        )}
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}

function Table({ head, rows, empty }) {
    if (rows.length === 0) return <p className="py-8 text-center text-sm text-gray-600">{empty}</p>;

    return (
        <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                    {head.map((label) => <th key={label} scope="col" className="px-3 py-2 font-semibold">{label}</th>)}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
                {rows.map((cells, index) => (
                    <tr key={index} className="align-top hover:bg-gray-50/70">
                        {cells.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2.5 text-gray-800">{cell}</td>)}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
