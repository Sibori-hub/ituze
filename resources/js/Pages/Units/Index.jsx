import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Search, Plus, DoorOpen, Edit, Trash2, ArrowLeft, DollarSign, Home } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/localization';
import TenantLocationFields from '@/Components/TenantLocationFields';
import { countRentPeriods } from '@/utils/rentPeriodCalculator';

const statusStyles = {
    available: 'bg-green-50 text-green-700 ring-1 ring-green-600/10',
    occupied: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/10',
    maintenance: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10',
    reserved: 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/10',
    inactive: 'bg-gray-100 text-gray-600 ring-1 ring-gray-500/10',
};

export default function UnitsIndex({ property, units, unitTypes, filters, tenants = [] }) {
    const { t, language } = useTranslation();
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');
    const [unitToDelete, setUnitToDelete] = useState(null);
    const [unitToAssign, setUnitToAssign] = useState(null);
    const [showTenantForm, setShowTenantForm] = useState(false);
    const assignmentForm = useForm({ tenant_type: 'individual', first_name: '', last_name: '', company_name: '', tax_identification_number: '', contact_person: '', email: '', phone: '', province_id: '', district_id: '', sector_id: '', identity_type: 'national_id', identity_number: '', start_date: '', end_date: '', monthly_rent: '', rent_frequency: 'monthly', deposit_amount: '', lease: null, notes: '' });
    const tenantForm = useForm({ type: 'individual', first_name: '', last_name: '', identity_type: 'national_id', identity_number: '', company_name: '', tax_identification_number: '', contact_person: '', email: '', phone: '', province_id: '', district_id: '', sector_id: '' });
    const isFirstRender = useRef(true);
    const rentPeriods = countRentPeriods(assignmentForm.data.start_date, assignmentForm.data.end_date, assignmentForm.data.rent_frequency);
    const totalRent = rentPeriods > 0 && Number(assignmentForm.data.monthly_rent) > 0
        ? rentPeriods * Number(assignmentForm.data.monthly_rent)
        : '';

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const timeout = setTimeout(() => {
            router.get(route('properties.units.index', property), { search, status }, { preserveState: true, replace: true });
        }, 400);
        return () => clearTimeout(timeout);
    }, [search, status]);

    const confirmDelete = () => {
        if (!unitToDelete) return;
        router.delete(route('properties.units.destroy', [property, unitToDelete]), {
            onSuccess: () => setUnitToDelete(null),
        });
    };

    const openAssignment = (unit) => {
        setUnitToAssign(unit);
        assignmentForm.setData({
            ...assignmentForm.data,
            monthly_rent: unit.rent_amount || '',
            rent_frequency: unit.rent_frequency || 'monthly',
        });
    };

    const assignTenant = (e) => {
        e.preventDefault();
        assignmentForm.post(route('properties.units.tenancy.store', [property, unitToAssign]), {
            forceFormData: true,
            onSuccess: () => { setUnitToAssign(null); assignmentForm.reset(); },
        });
    };

    const createTenant = (e) => {
        e.preventDefault();
        tenantForm.post(route('properties.tenants.store', property), {
            preserveScroll: true,
            onSuccess: () => { setShowTenantForm(false); tenantForm.reset(); },
        });
    };

    return (
        <AuthenticatedLayout header={t(':property - Units', { property: property.name })}>
            <Head title={t(':property - Units', { property: property.name })} />

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        href={route('properties.show', property)}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-[#0E3B2E]"
                    >
                        <ArrowLeft size={16} />
                        {t('Back to Property')}
                    </Link>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowTenantForm(true)}
                        className="rounded-xl border border-[#0E3B2E] px-4 py-2.5 text-sm font-medium text-[#0E3B2E] transition-colors hover:bg-[#0E3B2E]/5"
                    >
                        {t('New Tenant')}
                    </button>
                    <div className="relative flex-1 max-w-xs">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('Search units...')}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pl-9 pr-3 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                        />
                    </div>

                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 px-3 text-sm text-gray-600 transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
                    >
                        <option value="">{t('All Status')}</option>
                        <option value="available">{t('Available')}</option>
                        <option value="occupied">{t('Occupied')}</option>
                        <option value="maintenance">{t('Maintenance')}</option>
                        <option value="reserved">{t('Reserved')}</option>
                        <option value="inactive">{t('Inactive')}</option>
                    </select>

                    <Link
                        href={route('properties.units.create', property)}
                        className="flex items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0a2e23]"
                    >
                        <Plus size={15} />
                        {t('Add Unit')}
                    </Link>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                {units.data.length === 0 ? (
                    <div className="p-12 text-center">
                        <DoorOpen size={48} className="mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900">{t('No units found')}</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            {t(search || status ? 'Try adjusting your search filters' : 'Get started by adding your first unit to this property')}
                        </p>
                        {!search && !status && (
                            <Link
                                href={route('properties.units.create', property)}
                                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0a2e23]"
                            >
                                <Plus size={15} />
                                {t('Add Unit')}
                            </Link>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/50 text-xs uppercase tracking-wide text-gray-400">
                                        <th className="px-5 py-3 font-semibold">{t('Unit')}</th>
                                        <th className="px-5 py-3 font-semibold">{t('Type')}</th>
                                        <th className="px-5 py-3 font-semibold">{t('Rent')}</th>
                                        <th className="px-5 py-3 font-semibold">{t('Size')}</th>
                                        <th className="px-5 py-3 font-semibold">{t('Status')}</th>
                                        <th className="px-5 py-3 font-semibold">{t('Tenant')}</th>
                                        <th className="px-5 py-3 font-semibold text-right">{t('Actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {units.data.map((unit) => (
                                        <tr
                                            key={unit.id}
                                            className="border-b border-gray-50 transition-colors last:border-0 hover:bg-[#0E3B2E]/[0.02]"
                                        >
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    {unit.images?.length ? (
                                                        <img
                                                            src={/^https?:\/\//i.test(unit.images.find((image) => image.is_cover)?.image_path || unit.images[0].image_path)
                                                                ? unit.images.find((image) => image.is_cover)?.image_path || unit.images[0].image_path
                                                                : `/storage/${unit.images.find((image) => image.is_cover)?.image_path || unit.images[0].image_path}`}
                                                            alt=""
                                                            className="h-10 w-10 rounded-lg object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0E3B2E]/10 text-xs font-semibold text-[#0E3B2E]">
                                                            <Home size={16} />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium text-gray-800">
                                                            {unit.unit_number}
                                                        </p>
                                                        {unit.description && (
                                                            <p className="text-xs text-gray-400">
                                                                {unit.description.substring(0, 30)}...
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-600">
                                                {unit.unit_type?.name || '—'}
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-600">
                                                <div className="flex items-center gap-1">
                                                    <DollarSign size={14} className="text-gray-400" />
                                                    <span className="font-medium">
                                                        {Number(unit.rent_amount).toLocaleString()}
                                                    </span>
                                                    <span className="text-xs text-gray-400">/month</span>
                                                    {unit.size_sqm != null && unit.size_sqm !== '' && (
                                                        <span className="text-xs text-gray-400">
                                                            {' '}· {Number(unit.size_sqm).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-600">
                                                {unit.size_sqm != null && unit.size_sqm !== '' ? (
                                                    <span>
                                                        {Number(unit.size_sqm).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">N/A</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[unit.status]}`}>
                                                    {t(unit.status)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-600">
                                                {unit.active_tenancy?.tenant?.name || <span className="text-gray-400">—</span>}
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {unit.status === 'available' && (
                                                        <button onClick={() => openAssignment(unit)} className="rounded-lg bg-[#0E3B2E]/10 px-2.5 py-1.5 text-xs font-medium text-[#0E3B2E] hover:bg-[#0E3B2E]/20">
                                                            {t('Assign tenant')}
                                                        </button>
                                                    )}
                                                    <Link
                                                        href={route('properties.units.edit', [property, unit])}
                                                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                                                    >
                                                        <Edit size={14} />
                                                    </Link>
                                                    <button
                                                        onClick={() => setUnitToDelete(unit)}
                                                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>

                                                {unitToAssign && (
                                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                                                        <form onSubmit={assignTenant} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                                                            <h3 className="text-lg font-semibold text-gray-900">{t('Create tenancy for :unit', { unit: unitToAssign.unit_number })}</h3>
                                                            <p className="mt-1 text-sm text-gray-500">{t('Tenant identity, contact information, signed lease, and rent terms are required.')}</p>
                                                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                                                <label className="text-sm font-medium text-gray-700">{t('Tenant type')}<select value={assignmentForm.data.tenant_type} onChange={e => assignmentForm.setData('tenant_type', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200"><option value="individual">{t('Individual')}</option><option value="company">{t('Company')}</option></select></label>
                                                                {assignmentForm.data.tenant_type === 'individual' ? <>
                                                                    <label className="text-sm font-medium text-gray-700">{t('First name')}<input required value={assignmentForm.data.first_name} onChange={e => assignmentForm.setData('first_name', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                    <label className="text-sm font-medium text-gray-700">{t('Last name')}<input required value={assignmentForm.data.last_name} onChange={e => assignmentForm.setData('last_name', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                </> : <>
                                                                    <label className="text-sm font-medium text-gray-700">{t('Company name')}<input required value={assignmentForm.data.company_name} onChange={e => assignmentForm.setData('company_name', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                    <label className="text-sm font-medium text-gray-700">{t('Company TIN')}<input required value={assignmentForm.data.tax_identification_number} onChange={e => assignmentForm.setData('tax_identification_number', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                    <label className="text-sm font-medium text-gray-700">{t('Representative full name')}<input required value={assignmentForm.data.contact_person} onChange={e => assignmentForm.setData('contact_person', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                </>}
                                                                <label className="text-sm font-medium text-gray-700">{t('Identity type')}<select value={assignmentForm.data.identity_type} onChange={e => assignmentForm.setData('identity_type', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200"><option value="national_id">{t('National ID')}</option><option value="passport">{t('Passport')}</option></select></label>
                                                                <label className="text-sm font-medium text-gray-700">{assignmentForm.data.tenant_type === 'company' ? t(assignmentForm.data.identity_type === 'national_id' ? 'Representative national ID number' : 'Representative passport number') : t(assignmentForm.data.identity_type === 'national_id' ? 'National ID number' : 'Passport number')}<input required value={assignmentForm.data.identity_number} maxLength={assignmentForm.data.identity_type === 'national_id' ? 16 : 100} inputMode={assignmentForm.data.identity_type === 'national_id' ? 'numeric' : 'text'} pattern={assignmentForm.data.identity_type === 'national_id' ? '[0-9]{16}' : undefined} onChange={e => assignmentForm.setData('identity_number', assignmentForm.data.identity_type === 'national_id' ? e.target.value.replace(/\D/g, '').slice(0, 16) : e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                <label className="text-sm font-medium text-gray-700">{t('Email')}<input required type="email" value={assignmentForm.data.email} onChange={e => assignmentForm.setData('email', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                <label className="text-sm font-medium text-gray-700">{t('Phone')}<input required type="tel" value={assignmentForm.data.phone} maxLength={10} inputMode="numeric" pattern="(078|072|073)[0-9]{7}" onChange={e => assignmentForm.setData('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} className="mt-1 w-full rounded-xl border-gray-200" /><span className="mt-1 block text-xs font-normal text-gray-500">{t('Enter 10 digits starting with 078, 072, or 073.')}</span></label>
                                                                <TenantLocationFields data={assignmentForm.data} setData={assignmentForm.setData} errors={assignmentForm.errors} t={t} />
                                                                <label className="text-sm font-medium text-gray-700">{t('Tenancy start date')}<input type="date" required value={assignmentForm.data.start_date} onChange={e => assignmentForm.setData('start_date', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                <label className="text-sm font-medium text-gray-700">{t('Tenancy end date')}<input type="date" required value={assignmentForm.data.end_date} onChange={e => assignmentForm.setData('end_date', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                <label className="text-sm font-medium text-gray-700">{t('Rent frequency')}<select value={assignmentForm.data.rent_frequency} onChange={e => assignmentForm.setData('rent_frequency', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200"><option value="daily">{t('Daily')}</option><option value="weekly">{t('Weekly')}</option><option value="monthly">{t('Monthly')}</option><option value="quarterly">{t('Quarterly')}</option><option value="yearly">{t('Yearly')}</option></select></label>
                                                                <label className="text-sm font-medium text-gray-700">{t('Rent per period (RWF)')}<input type="number" min="0.01" step="0.01" required value={assignmentForm.data.monthly_rent} onChange={e => assignmentForm.setData('monthly_rent', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                <label className="text-sm font-medium text-gray-700">{t('Number of rent periods')}<input type="number" disabled value={rentPeriods || ''} className="mt-1 w-full rounded-xl border-gray-200 bg-gray-100 text-gray-600" /></label>
                                                                <label className="text-sm font-medium text-gray-700">{t('Total rent for lease (RWF)')}<input type="text" disabled value={totalRent === '' ? '' : Number(totalRent).toLocaleString(({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} className="mt-1 w-full rounded-xl border-gray-200 bg-gray-100 text-gray-600" /><span className="mt-1 block text-xs font-normal text-gray-500">{t('Each started rent period is charged in full. The security deposit is separate.')}</span></label>
                                                                <label className="text-sm font-medium text-gray-700">{t('Security deposit (RWF)')}<input type="number" min="0" step="0.01" value={assignmentForm.data.deposit_amount} onChange={e => assignmentForm.setData('deposit_amount', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                <label className="sm:col-span-2 text-sm font-medium text-gray-700">{t('Signed lease (PDF, DOC, DOCX, JPG or PNG)')}<input type="file" required accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => assignmentForm.setData('lease', e.target.files[0])} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                <label className="sm:col-span-2 text-sm font-medium text-gray-700">{t('Notes')}<textarea value={assignmentForm.data.notes} onChange={e => assignmentForm.setData('notes', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                            </div>
                                                            {Object.values(assignmentForm.errors).length > 0 && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{Object.values(assignmentForm.errors)[0]}</p>}
                                                            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setUnitToAssign(null)} className="rounded-xl px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">{t('Cancel')}</button><button disabled={assignmentForm.processing} className="rounded-xl bg-[#0E3B2E] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{assignmentForm.processing ? t('Saving…') : t('Create tenancy')}</button></div>
                                                        </form>
                                                    </div>
                                                )}

                                                {showTenantForm && (
                                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                                                        <form onSubmit={createTenant} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                                                            <h3 className="text-lg font-semibold text-gray-900">{t('Create tenant')}</h3>
                                                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                                                <label className="text-sm font-medium text-gray-700">{t('Type')}<select value={tenantForm.data.type} onChange={e => tenantForm.setData('type', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200"><option value="individual">{t('Individual')}</option><option value="company">{t('Company')}</option></select></label>
                                                                {tenantForm.data.type === 'individual' ? <>
                                                                    <label className="text-sm font-medium text-gray-700">{t('First name')}<input required value={tenantForm.data.first_name} onChange={e => tenantForm.setData('first_name', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                    <label className="text-sm font-medium text-gray-700">{t('Last name')}<input required value={tenantForm.data.last_name} onChange={e => tenantForm.setData('last_name', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                </> : <>
                                                                    <label className="text-sm font-medium text-gray-700">{t('Company name')}<input required value={tenantForm.data.company_name} onChange={e => tenantForm.setData('company_name', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                    <label className="text-sm font-medium text-gray-700">{t('Company TIN')}<input required value={tenantForm.data.tax_identification_number} onChange={e => tenantForm.setData('tax_identification_number', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                    <label className="text-sm font-medium text-gray-700">{t('Representative full name')}<input required value={tenantForm.data.contact_person} onChange={e => tenantForm.setData('contact_person', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                </>}
                                                                <label className="text-sm font-medium text-gray-700">{t('Identity type')}<select value={tenantForm.data.identity_type} onChange={e => tenantForm.setData('identity_type', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200"><option value="national_id">{t('National ID')}</option><option value="passport">{t('Passport')}</option></select></label>
                                                                <label className="text-sm font-medium text-gray-700">{t(tenantForm.data.identity_type === 'national_id' ? 'National ID number' : 'Passport number')}<input required value={tenantForm.data.identity_number} maxLength={tenantForm.data.identity_type === 'national_id' ? 16 : 100} inputMode={tenantForm.data.identity_type === 'national_id' ? 'numeric' : 'text'} pattern={tenantForm.data.identity_type === 'national_id' ? '[0-9]{16}' : undefined} onChange={e => tenantForm.setData('identity_number', tenantForm.data.identity_type === 'national_id' ? e.target.value.replace(/\D/g, '').slice(0, 16) : e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                <label className="text-sm font-medium text-gray-700">{t('Email')}<input required type="email" value={tenantForm.data.email} onChange={e => tenantForm.setData('email', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200" /></label>
                                                                <label className="text-sm font-medium text-gray-700">{t('Phone')}<input required type="tel" value={tenantForm.data.phone} maxLength={10} inputMode="numeric" pattern="(078|072|073)[0-9]{7}" onChange={e => tenantForm.setData('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} className="mt-1 w-full rounded-xl border-gray-200" /><span className="mt-1 block text-xs font-normal text-gray-500">{t('Enter 10 digits starting with 078, 072, or 073.')}</span></label>
                                                                <TenantLocationFields data={tenantForm.data} setData={tenantForm.setData} errors={tenantForm.errors} t={t} />
                                                            </div>
                                                            {Object.values(tenantForm.errors).length > 0 && <p className="mt-4 text-sm text-red-700">{Object.values(tenantForm.errors)[0]}</p>}
                                                            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setShowTenantForm(false)} className="rounded-xl px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">{t('Cancel')}</button><button disabled={tenantForm.processing} className="rounded-xl bg-[#0E3B2E] px-4 py-2 text-sm font-medium text-white">{t('Create tenant')}</button></div>
                                                        </form>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {units.links && units.links.length > 3 && (
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/30 p-4">
                                <p className="text-xs text-gray-400">
                                    {t('Showing :from to :to of :total units', { from: units.from, to: units.to, total: units.total })}
                                </p>
                                <div className="flex gap-1">
                                    {units.links.map((link, i) => (
                                        <Link
                                            key={i}
                                            href={link.url || '#'}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                                link.active
                                                    ? 'bg-[#0E3B2E] text-white'
                                                    : link.url
                                                    ? 'text-gray-600 hover:bg-gray-100'
                                                    : 'cursor-not-allowed text-gray-300'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {unitToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900">{t('Delete Unit')}</h3>
                        <p className="mt-2 text-sm text-gray-500">
                            {t('Are you sure you want to delete unit :unit? This action cannot be undone.', { unit: unitToDelete.unit_number })}
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setUnitToDelete(null)}
                                className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                            >
                                {t('Cancel')}
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
                            >
                                {t('Delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}