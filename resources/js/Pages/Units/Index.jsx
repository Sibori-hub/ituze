import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import useCanEdit from '@/hooks/useCanEdit';
import ManagerRunsNote from '@/Components/ManagerRunsNote';
import useCanBuild from '@/hooks/useCanBuild';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { Search, Plus, DoorOpen, Edit, Trash2, ArrowLeft, Home } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/localization';
import TenantLocationFields from '@/Components/TenantLocationFields';
import LeaseNoteField from '@/Components/LeaseNoteField';
import LeaseRecordFields from '@/Components/LeaseRecordFields';
import { countRentPeriods } from '@/utils/rentPeriodCalculator';
import { isApartmentUnit } from '@/utils/unitType';
import { BUSINESS_USES } from '@/Components/AssignUnitForm';

const statusStyles = {
    available: 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 ring-1 ring-green-600/10',
    occupied: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-blue-600/10',
    maintenance: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-600/10',
    reserved: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-1 ring-purple-600/10',
    inactive: 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 ring-1 ring-gray-500/10',
};

export default function UnitsIndex({ property, units, unitTypes, filters, tenants = [] }) {
    const { t, language } = useTranslation();
    const canEdit = useCanEdit();
    const canBuild = useCanBuild();
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || '');
    const [unitToDelete, setUnitToDelete] = useState(null);
    const [unitToAssign, setUnitToAssign] = useState(null);
    const [showTenantForm, setShowTenantForm] = useState(false);
    const assignmentForm = useForm({ business_use: '', tenant_type: 'individual', first_name: '', last_name: '', company_name: '', tax_identification_number: '', contact_person: '', email: '', phone: '', province_id: '', district_id: '', sector_id: '', identity_type: 'national_id', identity_number: '', start_date: '', end_date: '', check_in_time: '14:00', check_out_time: '11:00', monthly_rent: '', rent_frequency: 'monthly', deposit_amount: '', lease: null, lease_notes: '', payment_method: '', payment_reference: '' });
    const tenantForm = useForm({ type: 'individual', first_name: '', last_name: '', identity_type: 'national_id', identity_number: '', company_name: '', tax_identification_number: '', contact_person: '', email: '', phone: '', province_id: '', district_id: '', sector_id: '' });
    const isFirstRender = useRef(true);
    const rentPeriods = countRentPeriods(assignmentForm.data.start_date, assignmentForm.data.end_date, assignmentForm.data.rent_frequency);
    const apartmentStay = isApartmentUnit(unitToAssign);
    const dailyStay = apartmentStay && assignmentForm.data.rent_frequency === 'daily';
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
            rent_frequency: isApartmentUnit(unit) && unit.rent_frequency === 'daily' ? 'daily' : 'monthly',
            monthly_rent: unit.rent_amount || '',
            check_in_time: '14:00',
            check_out_time: '11:00',
        });
    };

    const assignTenant = (e) => {
        e.preventDefault();
        // Check-in and check-out times belong to nightly stays only.
        assignmentForm.transform(({ check_in_time, check_out_time, ...values }) => ({
            ...values,
            ...(dailyStay ? { check_in_time, check_out_time } : {}),
        }));
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
        <AuthenticatedLayout header={t(':property - Rooms', { property: property.name })}>
            <Head title={t(':property - Rooms', { property: property.name })} />
            <ManagerRunsNote className="mb-4" />

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        href={route('properties.show', property)}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-slate-300 transition-colors hover:text-[#0E3B2E] dark:hover:text-emerald-200"
                    >
                        <ArrowLeft size={16} />
                        {t('Back to Property')}
                    </Link>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowTenantForm(true)}
                        className="rounded-xl border border-[#0E3B2E] dark:border-emerald-500 px-4 py-2.5 text-sm font-medium text-[#0E3B2E] dark:text-emerald-300 transition-colors hover:bg-[#0E3B2E]/5"
                    >
                        {t('New Tenant')}
                    </button>
                    <div className="relative flex-1 max-w-xs">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('Search rooms...')}
                            className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40 py-2.5 pl-9 pr-3 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#0E3B2E]/15"
                        />
                    </div>

                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40 py-2.5 px-3 text-sm text-gray-600 dark:text-slate-300 transition-all focus:border-[#0E3B2E] focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#0E3B2E]/15"
                    >
                        <option value="">{t('All Status')}</option>
                        <option value="available">{t('Available')}</option>
                        <option value="occupied">{t('Occupied')}</option>
                        <option value="maintenance">{t('Maintenance')}</option>
                        <option value="reserved">{t('Reserved')}</option>
                        <option value="inactive">{t('Inactive')}</option>
                    </select>

                    {canBuild && <Link
                        href={route('properties.units.create', property)}
                        className="flex items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0a2e23]"
                    >
                        <Plus size={15} />
                        {t('Add room')}
                    </Link>}
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                {units.data.length === 0 ? (
                    <div className="p-12 text-center">
                        <DoorOpen size={48} className="mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">{t('No rooms found')}</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                            {t(search || status ? 'Try adjusting your search filters' : 'Get started by adding your first unit to this property')}
                        </p>
                        {!search && !status && canBuild && (
                            <Link
                                href={route('properties.units.create', property)}
                                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0a2e23]"
                            >
                                <Plus size={15} />
                                {t('Add room')}
                            </Link>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500">
                                        <th className="px-5 py-3 font-semibold">{t('Room')}</th>
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
                                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0E3B2E]/10 dark:bg-emerald-400/15 text-xs font-semibold text-[#0E3B2E] dark:text-emerald-300">
                                                            <Home size={16} />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium text-gray-800 dark:text-slate-100">
                                                            {unit.unit_number}
                                                        </p>
                                                        {unit.description && (
                                                            <p className="text-xs text-gray-400 dark:text-slate-500">
                                                                {unit.description.substring(0, 30)}...
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-600 dark:text-slate-300">
                                                {unit.unit_type?.name || '—'}
                                                {isApartmentUnit(unit) && (
                                                    <span className="mt-1 block text-xs text-gray-400 dark:text-slate-500">
                                                        {t(':bedrooms bedrooms · :bathrooms bathrooms', {
                                                            bedrooms: unit.bedrooms ?? '—',
                                                            bathrooms: unit.bathrooms ?? '—',
                                                        })}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-600 dark:text-slate-300">
                                                <div className="flex items-center gap-1">
                                                    <span className="font-medium">
                                                        {Number(unit.rent_amount).toLocaleString()} RWF
                                                    </span>
                                                    <span className="text-xs text-gray-400 dark:text-slate-500">{unit.rent_frequency === 'daily' ? `/${t('night')}` : `/${t('month')}`}</span>
                                                    {unit.size_sqm != null && unit.size_sqm !== '' && (
                                                        <span className="text-xs text-gray-400 dark:text-slate-500">
                                                            {' '}· {Number(unit.size_sqm).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-600 dark:text-slate-300">
                                                {unit.size_sqm != null && unit.size_sqm !== '' ? (
                                                    <span>
                                                        {Number(unit.size_sqm).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 dark:text-slate-500 text-xs">N/A</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusStyles[unit.status]}`}>
                                                    {t(unit.status)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-600 dark:text-slate-300">
                                                {unit.active_tenancy?.tenant?.name || <span className="text-gray-400 dark:text-slate-500">—</span>}
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                {(canEdit || canBuild) && <div className="flex items-center justify-end gap-2">
                                                    {canEdit && (unit.status === 'available' || (isApartmentUnit(unit) && ['reserved', 'occupied'].includes(unit.status))) && (
                                                        <button onClick={() => openAssignment(unit)} className="rounded-lg bg-[#0E3B2E]/10 dark:bg-emerald-400/15 px-2.5 py-1.5 text-xs font-medium text-[#0E3B2E] dark:text-emerald-300 hover:bg-[#0E3B2E]/20">
                                                            {t('Assign tenant')}
                                                        </button>
                                                    )}
                                                    {canBuild && <>
                                                    <Link
                                                        href={route('properties.units.edit', [property, unit])}
                                                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-100 dark:hover:bg-slate-800"
                                                    >
                                                        <Edit size={14} />
                                                    </Link>
                                                    <button
                                                        onClick={() => setUnitToDelete(unit)}
                                                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                    </>}
                                                </div>}

                                                {unitToAssign && (
                                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                                                        <form onSubmit={assignTenant} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl">
                                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('Create tenancy for :unit', { unit: unitToAssign.unit_number })}</h3>
                                                            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t('Tenant identity, contact information, signed lease, and rent terms are required.')}</p>
                                                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200 sm:col-span-2">{t('What will the client use it for?')} *
                                                                    <input required value={assignmentForm.data.business_use} onChange={e => assignmentForm.setData('business_use', e.target.value)} list="business-uses-index" maxLength={120} placeholder={t('e.g. Office, Salon, Warehouse')} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" />
                                                                    <datalist id="business-uses-index">{BUSINESS_USES.map(use => <option key={use} value={t(use)} />)}</datalist>
                                                                    {assignmentForm.errors.business_use && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{assignmentForm.errors.business_use}</span>}
                                                                </label>
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Tenant type')}<select value={assignmentForm.data.tenant_type} onChange={e => assignmentForm.setData('tenant_type', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700"><option value="individual">{t('Individual')}</option><option value="company">{t('Company')}</option></select></label>
                                                                {assignmentForm.data.tenant_type === 'individual' ? <>
                                                                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('First name')}<input required value={assignmentForm.data.first_name} onChange={e => assignmentForm.setData('first_name', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Last name')}<input required value={assignmentForm.data.last_name} onChange={e => assignmentForm.setData('last_name', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                </> : <>
                                                                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Company name')}<input required value={assignmentForm.data.company_name} onChange={e => assignmentForm.setData('company_name', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Company TIN')}<input required value={assignmentForm.data.tax_identification_number} onChange={e => assignmentForm.setData('tax_identification_number', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Representative full name')}<input required value={assignmentForm.data.contact_person} onChange={e => assignmentForm.setData('contact_person', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                </>}
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Identity type')}<select value={assignmentForm.data.identity_type} onChange={e => assignmentForm.setData('identity_type', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700"><option value="national_id">{t('National ID')}</option><option value="passport">{t('Passport')}</option></select></label>
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{assignmentForm.data.tenant_type === 'company' ? t(assignmentForm.data.identity_type === 'national_id' ? 'Representative national ID number' : 'Representative passport number') : t(assignmentForm.data.identity_type === 'national_id' ? 'National ID number' : 'Passport number')}<input required value={assignmentForm.data.identity_number} maxLength={assignmentForm.data.identity_type === 'national_id' ? 16 : 100} inputMode={assignmentForm.data.identity_type === 'national_id' ? 'numeric' : 'text'} pattern={assignmentForm.data.identity_type === 'national_id' ? '[0-9]{16}' : undefined} onChange={e => assignmentForm.setData('identity_number', assignmentForm.data.identity_type === 'national_id' ? e.target.value.replace(/\D/g, '').slice(0, 16) : e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Email')}<input required type="email" value={assignmentForm.data.email} onChange={e => assignmentForm.setData('email', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Phone')}<input required type="tel" value={assignmentForm.data.phone} maxLength={10} inputMode="numeric" pattern="(078|079|072|073)[0-9]{7}" onChange={e => assignmentForm.setData('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /><span className="mt-1 block text-xs font-normal text-gray-500 dark:text-slate-400">{t('Enter 10 digits starting with 078, 079, 072, or 073.')}</span></label>
                                                                <TenantLocationFields data={assignmentForm.data} setData={assignmentForm.setData} errors={assignmentForm.errors} t={t} />
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t(dailyStay ? 'Check-in date' : 'Tenancy start date')}<input type="date" required value={assignmentForm.data.start_date} onChange={e => assignmentForm.setData('start_date', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t(dailyStay ? 'Check-out date' : 'Tenancy end date')}<input type="date" required min={assignmentForm.data.start_date || undefined} value={assignmentForm.data.end_date} onChange={e => assignmentForm.setData('end_date', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                {dailyStay && <>
                                                                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Check-in time')}<input type="time" required value={assignmentForm.data.check_in_time} onChange={e => assignmentForm.setData('check_in_time', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /><span className="mt-1 block text-xs font-normal text-gray-500 dark:text-slate-400">{t('Standard check-in time is 14:00.')}</span></label>
                                                                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Check-out time')}<input type="time" required value={assignmentForm.data.check_out_time} onChange={e => assignmentForm.setData('check_out_time', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /><span className="mt-1 block text-xs font-normal text-gray-500 dark:text-slate-400">{t('Standard check-out time is 11:00.')}</span></label>
                                                                </>}
                                                                {apartmentStay ? <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Rent frequency')}<select value={assignmentForm.data.rent_frequency} onChange={e => assignmentForm.setData('rent_frequency', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700"><option value="daily">{t('Daily')}</option><option value="monthly">{t('Monthly')}</option></select></label> : <div className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Rent frequency')}<p className="mt-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 px-3 py-2.5 text-sm">{t('Monthly')}</p></div>}
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t(dailyStay ? 'Nightly rate (RWF)' : 'Monthly rent (RWF)')}<input type="number" min="0.01" step="0.01" required value={assignmentForm.data.monthly_rent} onChange={e => assignmentForm.setData('monthly_rent', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t(dailyStay ? 'Number of nights' : 'Number of rent periods')}<input type="number" disabled value={rentPeriods || ''} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300" /></label>
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Total rent for stay (RWF)')}<input type="text" disabled value={totalRent === '' ? '' : Number(totalRent).toLocaleString(({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300" /><span className="mt-1 block text-xs font-normal text-gray-500 dark:text-slate-400">{t(dailyStay ? 'Rent is charged per night; check-out day is not billed.' : 'The security deposit is separate from rent.')}</span></label>
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Security deposit (RWF)')}<input type="number" min="0" step="0.01" value={assignmentForm.data.deposit_amount} onChange={e => assignmentForm.setData('deposit_amount', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                <LeaseRecordFields
                                                                    paymentMethod={assignmentForm.data.payment_method}
                                                                    onPaymentMethodChange={value => assignmentForm.setData('payment_method', value)}
                                                                    paymentReference={assignmentForm.data.payment_reference}
                                                                    onPaymentReferenceChange={value => assignmentForm.setData('payment_reference', value)}
                                                                    errors={assignmentForm.errors}
                                                                    isDepositPayment
                                                                />
                                                                <LeaseNoteField
                                                                    value={assignmentForm.data.lease_notes}
                                                                    onChange={value => assignmentForm.setData('lease_notes', value)}
                                                                    routeName="properties.units.tenancy.lease-notes.generate"
                                                                    routeParams={[property.id, unitToAssign.id]}
                                                                    payload={{
                                                                        start_date: assignmentForm.data.start_date,
                                                                        end_date: assignmentForm.data.end_date,
                                                                        check_in_time: dailyStay ? assignmentForm.data.check_in_time : null,
                                                                        check_out_time: dailyStay ? assignmentForm.data.check_out_time : null,
                                                                        monthly_rent: assignmentForm.data.monthly_rent,
                                                                        rent_frequency: assignmentForm.data.rent_frequency,
                                                                        deposit_amount: assignmentForm.data.deposit_amount,
                                                                    }}
                                                                    disabled={!assignmentForm.data.start_date || !assignmentForm.data.end_date || !assignmentForm.data.monthly_rent}
                                                                />
                                                                <label className="sm:col-span-2 text-sm font-medium text-gray-700 dark:text-slate-200">{t('Signed lease (PDF, DOC, DOCX, JPG or PNG)')}<input type="file" required accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => assignmentForm.setData('lease', e.target.files[0])} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" />{assignmentForm.errors.lease && <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{assignmentForm.errors.lease}</span>}</label>
                                                            </div>
                                                            {Object.values(assignmentForm.errors).length > 0 && <p className="mt-4 rounded-xl bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{Object.values(assignmentForm.errors)[0]}</p>}
                                                            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setUnitToAssign(null)} className="rounded-xl px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800">{t('Cancel')}</button><button disabled={assignmentForm.processing} className="rounded-xl bg-[#0E3B2E] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{assignmentForm.processing ? t('Saving…') : t('Create tenancy')}</button></div>
                                                        </form>
                                                    </div>
                                                )}

                                                {showTenantForm && (
                                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                                                        <form onSubmit={createTenant} className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl">
                                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('Create tenant')}</h3>
                                                            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Type')}<select value={tenantForm.data.type} onChange={e => tenantForm.setData('type', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700"><option value="individual">{t('Individual')}</option><option value="company">{t('Company')}</option></select></label>
                                                                {tenantForm.data.type === 'individual' ? <>
                                                                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('First name')}<input required value={tenantForm.data.first_name} onChange={e => tenantForm.setData('first_name', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Last name')}<input required value={tenantForm.data.last_name} onChange={e => tenantForm.setData('last_name', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                </> : <>
                                                                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Company name')}<input required value={tenantForm.data.company_name} onChange={e => tenantForm.setData('company_name', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Company TIN')}<input required value={tenantForm.data.tax_identification_number} onChange={e => tenantForm.setData('tax_identification_number', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Representative full name')}<input required value={tenantForm.data.contact_person} onChange={e => tenantForm.setData('contact_person', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                </>}
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Identity type')}<select value={tenantForm.data.identity_type} onChange={e => tenantForm.setData('identity_type', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700"><option value="national_id">{t('National ID')}</option><option value="passport">{t('Passport')}</option></select></label>
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t(tenantForm.data.identity_type === 'national_id' ? 'National ID number' : 'Passport number')}<input required value={tenantForm.data.identity_number} maxLength={tenantForm.data.identity_type === 'national_id' ? 16 : 100} inputMode={tenantForm.data.identity_type === 'national_id' ? 'numeric' : 'text'} pattern={tenantForm.data.identity_type === 'national_id' ? '[0-9]{16}' : undefined} onChange={e => tenantForm.setData('identity_number', tenantForm.data.identity_type === 'national_id' ? e.target.value.replace(/\D/g, '').slice(0, 16) : e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Email')}<input required type="email" value={tenantForm.data.email} onChange={e => tenantForm.setData('email', e.target.value)} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /></label>
                                                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('Phone')}<input required type="tel" value={tenantForm.data.phone} maxLength={10} inputMode="numeric" pattern="(078|079|072|073)[0-9]{7}" onChange={e => tenantForm.setData('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} className="mt-1 w-full rounded-xl border-gray-200 dark:border-slate-700" /><span className="mt-1 block text-xs font-normal text-gray-500 dark:text-slate-400">{t('Enter 10 digits starting with 078, 079, 072, or 073.')}</span></label>
                                                                <TenantLocationFields data={tenantForm.data} setData={tenantForm.setData} errors={tenantForm.errors} t={t} />
                                                            </div>
                                                            {Object.values(tenantForm.errors).length > 0 && <p className="mt-4 text-sm text-red-700 dark:text-red-300">{Object.values(tenantForm.errors)[0]}</p>}
                                                            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setShowTenantForm(false)} className="rounded-xl px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800">{t('Cancel')}</button><button disabled={tenantForm.processing} className="rounded-xl bg-[#0E3B2E] px-4 py-2 text-sm font-medium text-white">{t('Create tenant')}</button></div>
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
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/40 p-4">
                                <p className="text-xs text-gray-400 dark:text-slate-500">
                                    {t('Showing :from to :to of :total rooms', { from: units.from, to: units.to, total: units.total })}
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
                                                    ? 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
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
                    <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('Delete room')}</h3>
                        <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                            {t('Are you sure you want to delete room :unit? This action cannot be undone.', { unit: unitToDelete.unit_number })}
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setUnitToDelete(null)}
                                className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-100 dark:hover:bg-slate-800"
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