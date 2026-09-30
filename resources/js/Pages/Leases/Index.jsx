import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { ArrowDownToLine, CheckCircle2, Clock3, FileText } from 'lucide-react';
import { useTranslation } from '@/localization';

const termStyles = {
    Active: 'bg-emerald-50 text-emerald-700',
    'Expiring soon': 'bg-amber-50 text-amber-700',
    Scheduled: 'bg-blue-50 text-blue-700',
    Ended: 'bg-gray-100 text-gray-600',
    Expired: 'bg-red-50 text-red-700',
    Cancelled: 'bg-gray-100 text-gray-500',
    Ongoing: 'bg-emerald-50 text-emerald-700',
};

const paymentStyles = {
    Paid: 'bg-emerald-50 text-emerald-700',
    'Partially paid': 'bg-amber-50 text-amber-700',
    Overdue: 'bg-red-50 text-red-700',
    Due: 'bg-amber-50 text-amber-700',
    'Up to date': 'bg-blue-50 text-blue-700',
};

const localeForLanguage = (language) => ({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW';

const formatDate = (value, dateOnly = false, language = 'en') => {
    if (!value) return '—';
    const normalized = dateOnly ? `${String(value).slice(0, 10)}T00:00:00` : value;
    const date = new Date(normalized);

    return Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat(localeForLanguage(language), { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

export default function LeasesIndex({ leases }) {
    const { t, language } = useTranslation();

    return (
        <AuthenticatedLayout header="Leases">
            <Head title="Leases" />
            <div className="mb-6">
                <h1 className="font-[Sora] text-2xl font-bold text-gray-900">{t('Lease documents')}</h1>
                <p className="mt-1 text-sm text-gray-500">{t('Signed agreements and renewals attached to your tenancies.')}</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                {leases.data.length ? (
                    <div className="divide-y divide-gray-100">
                        {leases.data.map(lease => {
                            const tenancy = lease.tenancy;
                            const property = tenancy?.unit?.property;
                            const unit = tenancy?.unit;
                            const downloadUrl = property && unit && tenancy
                                ? route('properties.units.tenancy.leases.download', [property.id, unit.id, tenancy.id, lease.id])
                                : null;

                            return (
                                <article key={lease.id} className="grid min-w-0 gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_auto] xl:items-center">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0E3B2E]/5"><FileText size={18} className="text-[#0E3B2E]" /></div>
                                        <div className="min-w-0">
                                            <p className="break-words font-semibold text-gray-900">{lease.original_name}</p>
                                            <p className="mt-1 break-words text-xs text-gray-500">{t('Reference')}: {lease.reference_number || '—'} · {t('Payment method')}: {t(({ cash: 'Cash', mobile_money: 'Mobile money', bank_transfer: 'Bank transfer', other: 'Other' })[lease.payment_method] || 'Unknown')}</p>
                                            {lease.payment_reference && <p className="mt-1 break-words text-xs text-gray-500">{t('Payment reference')}: {lease.payment_reference}</p>}
                                            {lease.notes && <p className="mt-1 whitespace-pre-line break-words text-xs text-gray-500">{lease.notes}</p>}
                                            <p className="mt-1 text-xs text-gray-400">{t('Uploaded')} {formatDate(lease.created_at, false, language)}</p>
                                        </div>
                                    </div>
                                    <div className="grid min-w-0 grid-cols-2 gap-3 xl:block">
                                        <div>                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('Tenant')}</p><p className="mt-1 break-words text-sm font-medium text-gray-800">{tenancy?.tenant?.name || '—'}</p></div>
                                        <div className="xl:mt-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('Property / unit')}</p><p className="mt-1 break-words text-sm text-gray-700">{property?.name || '—'}{unit?.unit_number ? ` · ${t('Unit')} ${unit.unit_number}` : ''}</p></div>
                                    </div>
                                    <div className="min-w-0 rounded-xl bg-gray-50 p-3 xl:bg-transparent xl:p-0">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('Lease term')}</p>
                                        <span className={`mt-1 inline-flex max-w-full rounded-full px-2.5 py-1 text-xs font-semibold ${termStyles[lease.term_status] || 'bg-gray-100 text-gray-600'}`}>{t(lease.term_status || 'Unknown')}</span>
                                        <p className="mt-1 break-words text-sm font-medium text-gray-700">{lease.countdown_label || '—'}</p>
                                        <p className="mt-1 text-xs text-gray-500">{formatDate(tenancy?.start_date, true, language)} – {tenancy?.end_date ? formatDate(tenancy.end_date, true, language) : t('Ongoing')}</p>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t('Payments due to date')}</p>
                                        <span className={`mt-1 inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${paymentStyles[lease.payment_status] || 'bg-gray-100 text-gray-600'}`}>
                                            {lease.payment_status === 'Paid' ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
                                            {t(lease.payment_status || 'Unknown')}
                                        </span>
                                        {Number(lease.payment_balance) > 0 && <p className="mt-1 text-xs font-medium text-gray-600">{Number(lease.payment_balance).toLocaleString()} RWF outstanding</p>}
                                        {Number(lease.payment_balance) > 0 && (
                                            <div className="mt-1 space-y-0.5 text-[11px] text-gray-500">
                                                {Number(lease.rent_due_balance) > 0 && <p>{t('Rent due')}: {Number(lease.rent_due_balance).toLocaleString()} RWF</p>}
                                                {Number(lease.deposit_due_balance) > 0 && <p>{t('Deposit due')}: {Number(lease.deposit_due_balance).toLocaleString()} RWF</p>}
                                                {Number(lease.damage_due_balance) > 0 && <p>{t('Damage charge due')}: {Number(lease.damage_due_balance).toLocaleString()} RWF</p>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 xl:border-0 xl:pt-0">
                                        {downloadUrl ? <a href={downloadUrl} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0E3B2E]/5 px-3 py-2.5 text-xs font-semibold text-[#0E3B2E] hover:bg-[#0E3B2E]/10"><ArrowDownToLine size={14} />{t('Download')}</a> : <span className="text-xs text-gray-400">{t('Unavailable')}</span>}
                                        {property && unit && <Link href={route('properties.units.show', [property.id, unit.id])} className="rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-medium text-gray-600 hover:border-[#0E3B2E]/30 hover:text-[#0E3B2E]">{t('Manage tenancy')}</Link>}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <FileText size={36} className="mx-auto text-gray-300" />
                        <h2 className="mt-3 font-semibold text-gray-900">{t('No lease documents yet')}</h2>
                        <p className="mt-1 text-sm text-gray-500">{t('Upload signed agreements from a unit’s tenancy section.')}</p>
                        <Link href={route('properties.index')} className="mt-4 inline-flex text-sm font-semibold text-[#0E3B2E] hover:underline">{t('Browse properties')}</Link>
                    </div>
                )}
                {leases.links?.length > 3 && (
                    <div className="flex flex-wrap gap-2 border-t border-gray-100 p-4">
                        {leases.links.map((link, index) => (
                            <Link key={index} href={link.url || '#'} className={`rounded-lg px-3 py-1.5 text-sm ${link.active ? 'bg-[#0E3B2E] text-white' : 'bg-gray-50 text-gray-600'} ${!link.url ? 'pointer-events-none opacity-40' : ''}`} dangerouslySetInnerHTML={{ __html: link.label }} />
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
