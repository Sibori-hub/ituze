import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import useCanEdit from '@/hooks/useCanEdit';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Building2, Search, Users, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/localization';
import CreateTenantDialog from '@/Components/CreateTenantDialog';

export default function TenantsIndex({ tenants, filters = {}, isAdmin = false, owners = [] }) {
    const { t } = useTranslation();
    const canEdit = useCanEdit();
    const [search, setSearch] = useState(filters.search || '');
    const first = useRef(true);
    const [showCreate, setShowCreate] = useState(false);
    const form = useForm({
        type: 'individual',
        first_name: '',
        last_name: '',
        gender: '',
        marital_status: '',
        photo: null,
        identity_document: null,
        company_name: '',
        tax_identification_number: '',
        contact_person: '',
        identity_type: 'national_id',
        identity_number: '',
        email: '',
        phone: '',
        province_id: '',
        district_id: '',
        sector_id: '',
    });

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }

        const timeout = setTimeout(() => {
            router.get(route('tenants.index'), { search, owner_id: filters.owner_id || undefined }, { preserveState: true, replace: true });
        }, 350);
        return () => clearTimeout(timeout);
    }, [search]);

    const createTenant = (event) => {
        event.preventDefault();
        form.post(route('tenants.store'), {
            preserveScroll: true,
            // Keep the page (search, filters, list) as it is; only the popup closes.
            preserveState: true,
            onSuccess: () => {
                setShowCreate(false);
                form.reset();
            },
        });
    };

    return (
        <AuthenticatedLayout header="Tenants">
            <Head title="Tenants" />
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="font-[Sora] text-2xl font-bold text-gray-900 dark:text-slate-100">{t('Tenants')}</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t('Manage the people and businesses occupying your units.')}</p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                    {isAdmin && (
                        <select
                            value={filters.owner_id || ''}
                            onChange={event => router.get(route('tenants.index'), { search, owner_id: event.target.value || undefined }, { preserveState: true, replace: true })}
                            aria-label={t('Filter by owner')}
                            className="max-w-52 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:border-[#0E3B2E] focus:ring-2 focus:ring-[#0E3B2E]/15"
                        >
                            <option value="">{t('All owners')}</option>
                            {owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
                        </select>
                    )}
                    <div className="relative w-full sm:w-72">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                        <input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Search tenants...')} className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-9 pr-3 text-sm focus:border-[#0E3B2E] focus:ring-2 focus:ring-[#0E3B2E]/15" />
                    </div>
                    {canEdit && <button onClick={() => setShowCreate(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0a2e23]">
                        <Plus size={16} />{t('Create tenant')}
                    </button>}
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                {tenants.data.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[850px] text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                <tr>
                                    <th className="px-5 py-3 font-semibold">{t('Tenant')}</th>
                                    <th className="px-5 py-3 font-semibold">{t('Identity')}</th>
                                    <th className="px-5 py-3 font-semibold">{t('Contact')}</th>
                                    <th className="px-5 py-3 font-semibold">{t('Active units')}</th>
                                    <th className="px-5 py-3 font-semibold">{t('Property')}</th>
                                    <th className="px-5 py-3 font-semibold">{t('Action')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                {tenants.data.map(tenant => (
                                    <tr key={tenant.id} className="transition hover:bg-gray-50/70">
                                        <td className="px-5 py-4">
                                            <Link href={route('tenants.show', tenant.id)} className="font-semibold text-gray-900 dark:text-slate-100 hover:text-[#0E3B2E] dark:hover:text-emerald-200 hover:underline">{tenant.name}</Link>
                                            <p className="mt-1 text-xs capitalize text-gray-500 dark:text-slate-400">{t(tenant.type)}</p>
                                            {tenant.type === 'company' && tenant.contact_person && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t('Representative')}: {tenant.contact_person}</p>}
                                        </td>
                                        <td className="px-5 py-4 text-gray-700 dark:text-slate-200">
                                            <p>{tenant.identity_type === 'passport' ? t('Passport') : t('ID')}: {tenant.identity_number || tenant.national_id || '—'}</p>
                                            {tenant.type === 'company' && tenant.tax_identification_number && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">TIN: {tenant.tax_identification_number}</p>}
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="text-gray-700 dark:text-slate-200">{tenant.phone || '—'}</p>
                                            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{tenant.email || t('No email')}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-slate-200"><Building2 size={15} className="text-[#0E3B2E] dark:text-emerald-300" />{tenant.active_tenancies_count}</span>
                                        </td>
                                        <td className="px-5 py-4 text-gray-600 dark:text-slate-300">{tenant.active_tenancies?.[0]?.unit?.property?.name || '—'}</td>
                                        <td className="px-5 py-4"><Link href={route('tenants.show', tenant.id)} className="whitespace-nowrap rounded-lg bg-[#0E3B2E]/5 dark:bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-[#0E3B2E] dark:text-emerald-300 hover:bg-[#0E3B2E]/10">{t('View & assign')}</Link></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-14 text-center">
                        <Users size={44} className="mx-auto text-gray-300" />
                        <h3 className="mt-4 font-semibold text-gray-900 dark:text-slate-100">{t('No tenants found')}</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t(search ? 'Try a different search.' : 'Tenants will appear here when assigned to a unit.')}</p>
                    </div>
                )}
                {tenants.links?.length > 3 && (
                    <div className="flex flex-wrap gap-2 border-t border-gray-100 dark:border-slate-800 p-4">
                        {tenants.links.map((link, index) => (
                            <Link key={index} href={link.url || '#'} className={`rounded-lg px-3 py-1.5 text-sm ${link.active ? 'bg-[#0E3B2E] text-white' : 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-300'} ${!link.url ? 'pointer-events-none opacity-40' : ''}`} dangerouslySetInnerHTML={{ __html: link.label }} />
                        ))}
                    </div>
                )}
            </div>

            <CreateTenantDialog open={showCreate} form={form} onSubmit={createTenant} onClose={() => setShowCreate(false)} />
        </AuthenticatedLayout>
    );
}
