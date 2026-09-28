import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { AlertCircle, ArrowUpRight, Building2, CalendarClock, CheckCircle2, CreditCard, DoorOpen, FileText, Percent, Wallet } from 'lucide-react';
import { useTranslation } from '@/localization';

const cards = [
    { key: 'properties', label: 'Properties', icon: Building2, format: value => value },
    { key: 'units', label: 'Total units', icon: DoorOpen, format: value => value },
    { key: 'occupancy_rate', label: 'Occupancy rate', icon: Percent, format: value => `${value}%` },
    { key: 'active_leases', label: 'Active leases', icon: FileText, format: value => value },
    { key: 'expiring_leases', label: 'Expiring in 30 days', icon: CalendarClock, format: value => value },
    { key: 'collected_this_month', label: 'Collected this month', icon: CreditCard, format: value => `${Number(value).toLocaleString()} RWF` },
    { key: 'outstanding_balance', label: 'Outstanding balance', icon: Wallet, format: value => `${Number(value).toLocaleString()} RWF` },
    { key: 'overdue_balance', label: 'Overdue balance', icon: AlertCircle, format: value => `${Number(value).toLocaleString()} RWF` },
];

export default function ReportsIndex({ summary, properties }) {
    const { t } = useTranslation();

    return (
        <AuthenticatedLayout header="Reports">
            <Head title="Reports" />
            <div className="mb-6">
                <h1 className="font-[Sora] text-2xl font-bold text-gray-900">{t('Portfolio reports')}</h1>
                <p className="mt-1 text-sm text-gray-500">{t('A current overview of occupancy, leases, charges, and money received.')}</p>
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
