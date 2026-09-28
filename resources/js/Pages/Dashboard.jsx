import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CompleteProfileModal from '@/Components/CompleteProfileModal';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Activity, ArrowUpRight, Building2, CalendarX, CheckCircle2,
    DoorOpen, Home, Mail, MessageSquare, Phone, Plus, Users,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/localization';

const cards = [
    { key: 'properties', label: 'Properties', icon: Building2, color: 'bg-emerald-50 text-emerald-700', route: 'properties.index' },
    { key: 'units', label: 'Total units', icon: DoorOpen, color: 'bg-blue-50 text-blue-700', route: 'properties.index' },
    { key: 'occupiedUnits', label: 'Occupied units', icon: Users, color: 'bg-violet-50 text-violet-700', route: 'tenants.index' },
    { key: 'availableUnits', label: 'Available units', icon: Home, color: 'bg-amber-50 text-amber-700', route: 'properties.index' },
];

const imageSource = (path) => {
    if (!path) return null;
    return /^https?:\/\//i.test(path) ? path : `/storage/${path}`;
};

const localeForLanguage = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';

const formatDate = (value, language) => {
    if (!value) return '—';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);

    return Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat(localeForLanguage(language), { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

export default function Dashboard({ summary, recentProperties = [], recentTenancies = [], recentInquiries = [] }) {
    const { auth } = usePage().props;
    const { t, language } = useTranslation();
    const user = auth.user;
    const [modalDismissed, setModalDismissed] = useState(false);
    const isAdmin = user.role === 'admin';
    const isExpired = !isAdmin && user.expires_at && new Date(user.expires_at) < new Date();

    if (isExpired) {
        return <AuthenticatedLayout header="Dashboard"><Head title={t('Dashboard')} /><div className="mx-auto max-w-lg rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50"><CalendarX size={30} className="text-red-500" /></div><h2 className="mt-4 font-[Sora] text-xl font-bold text-gray-800">{t('Your account has expired')}</h2><p className="mt-2 text-sm text-gray-500">{t('Your subscription ended on :date. Please contact support to renew access.', { date: formatDate(user.expires_at, language) })}</p></div></AuthenticatedLayout>;
    }
    if (!user.profile_completed && !modalDismissed) {
        return <AuthenticatedLayout header="Dashboard"><Head title={t('Dashboard')} /><CompleteProfileModal onDone={() => setModalDismissed(true)} /></AuthenticatedLayout>;
    }

    return (
        <AuthenticatedLayout header="Dashboard">
            <Head title={t('Dashboard')} />
            <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div><p className="text-sm font-medium text-[#D9A441]">{t('Overview')}</p><h1 className="mt-1 font-[Sora] text-2xl font-bold text-gray-900">{t('Good to see you, :name', { name: user.name?.split(' ')[0] })}</h1><p className="mt-1 text-sm text-gray-500">{t('Here’s what’s happening across your portfolio.')}</p></div>
                <Link href={route('properties.create')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0a2e23]"><Plus size={16} /> {t('Add property')}</Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map(({ key, label, icon: Icon, color, route: destination }) => (
                    <Link key={key} href={route(destination)} className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#0E3B2E]/20 hover:shadow-md">
                        <div className="flex items-center justify-between">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon size={19} /></div>
                            <ArrowUpRight size={17} className="text-gray-400 transition group-hover:text-[#0E3B2E]" />
                        </div>
                        <p className="mt-4 font-[Sora] text-2xl font-bold text-gray-900">{summary?.[key] ?? 0}</p>
                        <p className="mt-1 text-sm text-gray-500">{t(label)}</p>
                    </Link>
                ))}
            </div>

            <div id="portfolio-summary" className="mt-5 grid scroll-mt-20 gap-5 lg:grid-cols-3">
                <Link href={route('properties.index')} className="rounded-2xl bg-[#0E3B2E] p-6 text-white shadow-sm transition hover:bg-[#0b3328] lg:col-span-1">
                    <div className="flex items-center gap-2 text-white/70"><Activity size={17} /><span className="text-sm">{t('Portfolio occupancy')}</span></div>
                    <div className="mt-5 flex items-end gap-2"><span className="font-[Sora] text-4xl font-bold">{summary?.occupancyRate ?? 0}%</span><span className="mb-1 text-sm text-white/60">{t('occupied')}</span></div>
                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#D9A441]" style={{ width: `${summary?.occupancyRate ?? 0}%` }} /></div>
                    <p className="mt-3 text-xs text-white/60">{t(':available available · :maintenance under maintenance', { available: summary?.availableUnits ?? 0, maintenance: summary?.maintenanceUnits ?? 0 })}</p>
                </Link>
                <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
                    <div className="mb-4 flex items-center justify-between"><h2 className="font-[Sora] font-semibold text-gray-900">{t('Recent properties')}</h2><Link href={route('properties.index')} className="text-sm font-medium text-[#0E3B2E] hover:underline">{t('View all')}</Link></div>
                    {recentProperties.length ? <div className="grid gap-3 sm:grid-cols-2">{recentProperties.map(property => {
                        const coverPath = property.images?.find(img => img.is_cover)?.image_path || property.images?.[0]?.image_path;
                        return (
                            <Link key={property.id} href={route('properties.show', property.id)} className="flex items-center justify-between rounded-xl border border-gray-100 p-3 hover:border-[#D9A441]">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#0E3B2E]/5">
                                        {coverPath ? (
                                            <img
                                                src={imageSource(coverPath)}
                                                alt={property.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <Building2 size={17} className="text-[#0E3B2E]" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-gray-800">{property.name}</p>
                                        <p className="text-xs text-gray-500">{property.units_count ?? 0} units · {property.occupied_units_count ?? 0} occupied</p>
                                    </div>
                                </div>
                                <ArrowUpRight size={15} className="text-gray-400" />
                            </Link>
                        );
                    })}</div> : <div className="rounded-xl bg-gray-50 p-6 text-center"><p className="text-sm text-gray-500">{t('No properties yet.')}</p><Link href={route('properties.create')} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#0E3B2E]"><Plus size={14} /> {t('Add your first property')}</Link></div>}
                </div>
            </div>

            <section className="mt-5 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-6">
                    <div><h2 className="font-[Sora] font-semibold text-gray-900">{t('Tenants & active leases')}</h2><p className="mt-1 text-xs text-gray-500">{t('Current occupants, lease terms, and direct tenant records.')}</p></div>
                    <Link href={route('tenants.index')} className="text-sm font-medium text-[#0E3B2E] hover:underline">{t('Open tenant directory')}</Link>
                </div>
                {recentTenancies.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-sm">
                            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-6 py-3 font-semibold">{t('Tenant')}</th><th className="px-6 py-3 font-semibold">{t('Property / unit')}</th><th className="px-6 py-3 font-semibold">{t('Lease term')}</th><th className="px-6 py-3 font-semibold">{t('Rent')}</th><th className="px-6 py-3 font-semibold">{t('Status')}</th><th className="px-6 py-3 font-semibold">{t('Details')}</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentTenancies.map(tenancy => (
                                    <tr key={tenancy.id} className="transition hover:bg-gray-50/70">
                                        <td className="px-6 py-4"><Link href={route('tenants.show', tenancy.tenant?.id)} className="font-semibold text-gray-900 hover:text-[#0E3B2E] hover:underline">{tenancy.tenant?.name || t('Tenant')}</Link><p className="mt-1 text-xs text-gray-500">{tenancy.tenant?.phone || tenancy.tenant?.email || '—'}</p></td>
                                        <td className="px-6 py-4"><p className="font-medium text-gray-800">{tenancy.unit?.property?.name || t('Property')}</p><p className="mt-1 text-xs text-gray-500">{t('Unit')} {tenancy.unit?.unit_number || '—'}</p></td>
                                        <td className="px-6 py-4 text-xs text-gray-600">{formatDate(tenancy.start_date, language)} – {tenancy.end_date ? formatDate(tenancy.end_date, language) : t('Ongoing')}</td>
                                        <td className="px-6 py-4 font-medium text-gray-800">{Number(tenancy.monthly_rent || 0).toLocaleString()} RWF <span className="text-xs font-normal text-gray-500">/{tenancy.rent_frequency || 'monthly'}</span></td>
                                        <td className="px-6 py-4"><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={13} /> {t('Active')}</span></td>
                                        <td className="px-6 py-4"><Link href={route('properties.units.show', [tenancy.unit?.property_id, tenancy.unit?.id])} className="inline-flex items-center gap-1 font-medium text-[#0E3B2E] hover:underline">{t('Open unit')} <ArrowUpRight size={14} /></Link></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <p className="p-6 text-sm text-gray-500">{t('No active tenants yet. Add a lease from a unit or assign a tenant from the tenant directory.')}</p>}
            </section>
            <div id="visitor-inquiries" className="mt-5 scroll-mt-20 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="font-[Sora] font-semibold text-gray-900">{t('Visitor inquiries')}</h2>
                        <p className="mt-1 text-xs text-gray-500">{t('Contact the visitor, then mark the inquiry as read to allow a new inquiry for this property.')}</p>
                    </div>
                    <MessageSquare size={18} className="text-[#D9A441]" />
                </div>
                {recentInquiries.length ? (
                    <div className="divide-y divide-gray-100">
                        {recentInquiries.map((inquiry) => {
                            const replyText = `Hello ${inquiry.visitor_name}, regarding your inquiry about ${inquiry.property?.name}${inquiry.unit?.unit_number ? `, unit ${inquiry.unit.unit_number}` : ''}.`;

                            return (
                                <div key={inquiry.id} className="py-4 first:pt-0">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">{inquiry.visitor_name}</p>
                                            <p className="text-xs text-gray-500">{inquiry.property?.name} · Unit {inquiry.unit?.unit_number}</p>
                                        </div>
                                        <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-bold uppercase ${inquiry.status === 'read' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                            {t(inquiry.status === 'new' ? 'New' : inquiry.status)}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-sm text-gray-600">{inquiry.message}</p>
                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                                        <a href={`tel:${inquiry.visitor_phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 font-semibold text-gray-700 transition hover:border-[#0E3B2E] hover:bg-emerald-50"><Phone size={13} /> {t('Call')}</a>
                                        <a href={`sms:${inquiry.visitor_phone}?body=${encodeURIComponent(replyText)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 font-semibold text-gray-700 transition hover:border-[#0E3B2E] hover:bg-emerald-50"><MessageSquare size={13} /> {t('SMS visitor')}</a>
                                        {inquiry.visitor_email && <a href={`mailto:${inquiry.visitor_email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 font-semibold text-gray-700 transition hover:border-[#0E3B2E] hover:bg-emerald-50"><Mail size={13} /> {t('Email')}</a>}
                                    </div>
                                    {inquiry.status !== 'read' && (
                                        <button type="button" onClick={() => router.post(route('inquiries.read', inquiry.id), {}, { preserveScroll: true })} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#0E3B2E] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0a2e23]">
                                            <CheckCircle2 size={14} /> {t('Mark as read')}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : <p className="py-4 text-sm text-gray-500">{t('No visitor inquiries yet.')}</p>}
            </div>
        </AuthenticatedLayout>
    );
}
