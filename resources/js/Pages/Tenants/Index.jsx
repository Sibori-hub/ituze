import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Building2, Search, Users, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/localization';
import TenantLocationFields from '@/Components/TenantLocationFields';

export default function TenantsIndex({ tenants, filters }) {
    const { t } = useTranslation();
    const [search, setSearch] = useState(filters.search || '');
    const first = useRef(true);
    const [showCreate, setShowCreate] = useState(false);
    const form = useForm({
        type: 'individual',
        first_name: '',
        last_name: '',
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
            router.get(route('tenants.index'), { search }, { preserveState: true, replace: true });
        }, 350);
        return () => clearTimeout(timeout);
    }, [search]);

    const createTenant = (event) => {
        event.preventDefault();
        form.post(route('tenants.store'), {
            preserveScroll: true,
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
                    <h1 className="font-[Sora] text-2xl font-bold text-gray-900">{t('Tenants')}</h1>
                    <p className="mt-1 text-sm text-gray-500">{t('Manage the people and businesses occupying your units.')}</p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                    <div className="relative w-full sm:w-72">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Search tenants...')} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-[#0E3B2E] focus:ring-2 focus:ring-[#0E3B2E]/15" />
                    </div>
                    <button onClick={() => setShowCreate(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0a2e23]">
                        <Plus size={16} />{t('Create tenant')}
                    </button>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                {tenants.data.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[850px] text-left text-sm">
                            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                <tr>
                                    <th className="px-5 py-3 font-semibold">{t('Tenant')}</th>
                                    <th className="px-5 py-3 font-semibold">{t('Identity')}</th>
                                    <th className="px-5 py-3 font-semibold">{t('Contact')}</th>
                                    <th className="px-5 py-3 font-semibold">{t('Active units')}</th>
                                    <th className="px-5 py-3 font-semibold">{t('Property')}</th>
                                    <th className="px-5 py-3 font-semibold">{t('Action')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {tenants.data.map(tenant => (
                                    <tr key={tenant.id} className="transition hover:bg-gray-50/70">
                                        <td className="px-5 py-4">
                                            <Link href={route('tenants.show', tenant.id)} className="font-semibold text-gray-900 hover:text-[#0E3B2E] hover:underline">{tenant.name}</Link>
                                            <p className="mt-1 text-xs capitalize text-gray-500">{t(tenant.type)}</p>
                                            {tenant.type === 'company' && tenant.contact_person && <p className="mt-1 text-xs text-gray-500">{t('Representative')}: {tenant.contact_person}</p>}
                                        </td>
                                        <td className="px-5 py-4 text-gray-700">
                                            <p>{tenant.identity_type === 'passport' ? t('Passport') : t('ID')}: {tenant.identity_number || tenant.national_id || '—'}</p>
                                            {tenant.type === 'company' && tenant.tax_identification_number && <p className="mt-1 text-xs text-gray-500">TIN: {tenant.tax_identification_number}</p>}
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="text-gray-700">{tenant.phone || '—'}</p>
                                            <p className="mt-1 text-xs text-gray-500">{tenant.email || t('No email')}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="inline-flex items-center gap-1.5 text-gray-700"><Building2 size={15} className="text-[#0E3B2E]" />{tenant.active_tenancies_count}</span>
                                        </td>
                                        <td className="px-5 py-4 text-gray-600">{tenant.active_tenancies?.[0]?.unit?.property?.name || '—'}</td>
                                        <td className="px-5 py-4"><Link href={route('tenants.show', tenant.id)} className="whitespace-nowrap rounded-lg bg-[#0E3B2E]/5 px-3 py-2 text-xs font-semibold text-[#0E3B2E] hover:bg-[#0E3B2E]/10">{t('View & assign')}</Link></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-14 text-center">
                        <Users size={44} className="mx-auto text-gray-300" />
                        <h3 className="mt-4 font-semibold text-gray-900">{t('No tenants found')}</h3>
                        <p className="mt-1 text-sm text-gray-500">{t(search ? 'Try a different search.' : 'Tenants will appear here when assigned to a unit.')}</p>
                    </div>
                )}
                {tenants.links?.length > 3 && (
                    <div className="flex flex-wrap gap-2 border-t border-gray-100 p-4">
                        {tenants.links.map((link, index) => (
                            <Link key={index} href={link.url || '#'} className={`rounded-lg px-3 py-1.5 text-sm ${link.active ? 'bg-[#0E3B2E] text-white' : 'bg-gray-50 text-gray-600'} ${!link.url ? 'pointer-events-none opacity-40' : ''}`} dangerouslySetInnerHTML={{ __html: link.label }} />
                        ))}
                    </div>
                )}
            </div>

            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <form onSubmit={createTenant} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-5 flex items-center justify-between">
                            <div><h2 className="text-lg font-semibold text-gray-900">{t('Create tenant')}</h2><p className="mt-1 text-sm text-gray-500">{t('Identity and contact details are required for all tenants.')}</p></div>
                            <button type="button" onClick={() => setShowCreate(false)} aria-label="Close"><X size={20} /></button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="text-sm font-medium text-gray-700">{t('Type')}
                                <select value={form.data.type} onChange={event => form.setData('type', event.target.value)} className="mt-1 w-full rounded-xl border-gray-200"><option value="individual">{t('Individual')}</option><option value="company">{t('Company')}</option></select>
                            </label>
                            {form.data.type === 'individual' ? <>
                                <label className="text-sm font-medium text-gray-700">{t('First name')}<input required value={form.data.first_name} onChange={event => form.setData('first_name', event.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                <label className="text-sm font-medium text-gray-700">{t('Last name')}<input required value={form.data.last_name} onChange={event => form.setData('last_name', event.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                            </> : <>
                                <label className="text-sm font-medium text-gray-700">{t('Company name')}<input required value={form.data.company_name} onChange={event => form.setData('company_name', event.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                <label className="text-sm font-medium text-gray-700">{t('Company TIN')}<input required value={form.data.tax_identification_number} onChange={event => form.setData('tax_identification_number', event.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                <label className="text-sm font-medium text-gray-700">{t('Representative full name')}<input required value={form.data.contact_person} onChange={event => form.setData('contact_person', event.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                            </>}
                            <label className="text-sm font-medium text-gray-700">{t('Identity type')}
                                <select value={form.data.identity_type} onChange={event => form.setData('identity_type', event.target.value)} className="mt-1 w-full rounded-xl border-gray-200"><option value="national_id">{t('National ID')}</option><option value="passport">{t('Passport')}</option></select>
                            </label>
                            <label className="text-sm font-medium text-gray-700">{t(form.data.identity_type === 'national_id' ? 'National ID number' : 'Passport number')}<input required value={form.data.identity_number} maxLength={form.data.identity_type === 'national_id' ? 16 : 100} inputMode={form.data.identity_type === 'national_id' ? 'numeric' : 'text'} pattern={form.data.identity_type === 'national_id' ? '[0-9]{16}' : undefined} onChange={event => form.setData('identity_number', form.data.identity_type === 'national_id' ? event.target.value.replace(/\D/g, '').slice(0, 16) : event.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                            <label className="text-sm font-medium text-gray-700">{t('Email')}<input required type="email" value={form.data.email} onChange={event => form.setData('email', event.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                            <label className="text-sm font-medium text-gray-700">{t('Phone')}<input required type="tel" value={form.data.phone} maxLength={10} inputMode="numeric" pattern="(078|072|073)[0-9]{7}" onChange={event => form.setData('phone', event.target.value.replace(/\D/g, '').slice(0, 10))} className="mt-1 w-full rounded-xl border-gray-200" /><span className="mt-1 block text-xs font-normal text-gray-500">{t('Enter 10 digits starting with 078, 072, or 073.')}</span></label>
                            <TenantLocationFields data={form.data} setData={form.setData} errors={form.errors} t={t} />
                        </div>
                        {Object.values(form.errors).length > 0 && <p className="mt-4 text-sm text-red-700">{Object.values(form.errors)[0]}</p>}
                        <div className="mt-6 flex justify-end gap-2">
                            <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2 text-sm text-gray-600">{t('Cancel')}</button>
                            <button disabled={form.processing} className="rounded-xl bg-[#0E3B2E] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{form.processing ? t('Saving…') : t('Create tenant')}</button>
                        </div>
                    </form>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
