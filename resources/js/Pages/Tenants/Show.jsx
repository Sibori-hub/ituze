import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import useCanEdit from '@/hooks/useCanEdit';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Building2, CalendarDays, Edit2, FileText, KeyRound, Mail, MapPin, Phone, UserRound, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/localization';
import TenantLocationFields from '@/Components/TenantLocationFields';
import { TenantDocumentPicker, TenantPhotoPicker } from '@/Components/TenantUploads';
import AssignUnitForm from '@/Components/AssignUnitForm';
import PaymentRecordDetails from '@/Components/PaymentRecordDetails';

const today = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const formatDate = (value, language) => {
    if (!value) return 'Ongoing';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);

    return Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat(({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

export default function TenantShow({ tenant, availableUnits }) {
    const { t, language } = useTranslation();
    const canEdit = useCanEdit();
    const [editing, setEditing] = useState(false);
    const nameParts = (tenant.name || '').trim().split(/\s+/);
    const profile = useForm({
        type: tenant.type,
        first_name: tenant.first_name || (tenant.type === 'individual' ? nameParts[0] || '' : ''),
        last_name: tenant.last_name || (tenant.type === 'individual' ? nameParts.slice(1).join(' ') : ''),
        gender: tenant.gender || '',
        marital_status: tenant.marital_status || '',
        photo: null,
        identity_document: null,
        company_name: tenant.company_name || (tenant.type === 'company' ? tenant.name : ''),
        tax_identification_number: tenant.tax_identification_number || '',
        contact_person: tenant.contact_person || '',
        identity_type: tenant.identity_type || 'national_id',
        identity_number: tenant.identity_number || tenant.national_id || '',
        email: tenant.email || '',
        phone: tenant.phone || '',
        province_id: tenant.province_id || '',
        district_id: tenant.district_id || '',
        sector_id: tenant.sector_id || '',
    });
    const updateTenant = (event) => {
        event.preventDefault();
        profile.transform((data) => ({ ...data, _method: 'put' }));
        profile.post(route('tenants.update', tenant.id), {
            preserveScroll: true,
            onSuccess: () => setEditing(false),
        });
    };

    return (
        <AuthenticatedLayout header="Tenant details">
            <Head title={`${t('Tenant')} · ${tenant.name}`} />
            <div className="mx-auto max-w-6xl space-y-6">
                <Link href={route('tenants.index')} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#0E3B2E]">
                    <ArrowLeft size={16} /> {t('Back to tenants')}
                </Link>

                <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <div className="flex flex-col gap-5 border-b border-gray-100 bg-gradient-to-r from-[#0E3B2E]/5 to-white p-6 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-center gap-4">
                            {tenant.photo_url ? (
                                <a href={tenant.photo_url} target="_blank" rel="noreferrer" className="flex-none rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0E3B2E]/25">
                                    <img src={tenant.photo_url} alt={t('Profile photo')} className="h-16 w-16 rounded-full object-cover ring-4 ring-white shadow-md" />
                                </a>
                            ) : (
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0E3B2E]/10 text-[#0E3B2E]">
                                    {tenant.type === 'company' ? <Building2 size={25} /> : <UserRound size={25} />}
                                </div>
                            )}
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="font-[Sora] text-2xl font-bold text-gray-900">{tenant.name}</h1>
                                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold uppercase text-gray-600">{t(tenant.type)}</span>
                                </div>
                                <p className="mt-1 text-sm text-gray-500">{t(tenant.type === 'company' ? 'Company tenant' : 'Individual tenant')}</p>
                            </div>
                        </div>
                        {canEdit && <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setEditing(!editing)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                                <Edit2 size={15} /> {editing ? t('Close editor') : t('Edit tenant details')}
                            </button>
                            <a href="#assign-unit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a2e23]">
                                <Building2 size={16} /> {t('Assign a unit')}
                            </a>
                        </div>}
                    </div>

                    {editing ? (
                        <form onSubmit={updateTenant} className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                            <label className="text-sm font-medium text-gray-700">{t('Tenant type')}
                                <select value={profile.data.type} onChange={event => profile.setData('type', event.target.value)} className="mt-1.5 w-full rounded-xl border-gray-200"><option value="individual">{t('Individual')}</option><option value="company">{t('Company')}</option></select>
                            </label>
                            {profile.data.type === 'individual' ? <>
                                <label className="text-sm font-medium text-gray-700">{t('First name')}<input required value={profile.data.first_name} onChange={event => profile.setData('first_name', event.target.value)} className="mt-1.5 w-full rounded-xl border-gray-200" /></label>
                                <label className="text-sm font-medium text-gray-700">{t('Last name')}<input required value={profile.data.last_name} onChange={event => profile.setData('last_name', event.target.value)} className="mt-1.5 w-full rounded-xl border-gray-200" /></label>
                                <label className="text-sm font-medium text-gray-700">{t('Gender')}
                                    <select value={profile.data.gender} onChange={event => profile.setData('gender', event.target.value)} className="mt-1.5 w-full rounded-xl border-gray-200"><option value="">—</option><option value="female">{t('Female')}</option><option value="male">{t('Male')}</option></select>
                                </label>
                                <label className="text-sm font-medium text-gray-700">{t('Marital status')}
                                    <select value={profile.data.marital_status} onChange={event => profile.setData('marital_status', event.target.value)} className="mt-1.5 w-full rounded-xl border-gray-200"><option value="">—</option>{['single', 'married', 'divorced', 'widowed'].map((status) => <option key={status} value={status}>{t(status.charAt(0).toUpperCase() + status.slice(1))}</option>)}</select>
                                </label>
                            </> : <>
                                <label className="text-sm font-medium text-gray-700">{t('Company name')}<input required value={profile.data.company_name} onChange={event => profile.setData('company_name', event.target.value)} className="mt-1.5 w-full rounded-xl border-gray-200" /></label>
                                <label className="text-sm font-medium text-gray-700">{t('Company TIN')}<input required value={profile.data.tax_identification_number} onChange={event => profile.setData('tax_identification_number', event.target.value)} className="mt-1.5 w-full rounded-xl border-gray-200" /></label>
                                <label className="text-sm font-medium text-gray-700">{t('Representative full name')}<input required value={profile.data.contact_person} onChange={event => profile.setData('contact_person', event.target.value)} className="mt-1.5 w-full rounded-xl border-gray-200" /></label>
                            </>}
                            <label className="text-sm font-medium text-gray-700">{t('Identity type')}
                                <select value={profile.data.identity_type} onChange={event => profile.setData('identity_type', event.target.value)} className="mt-1.5 w-full rounded-xl border-gray-200"><option value="national_id">{t('National ID')}</option><option value="passport">{t('Passport')}</option></select>
                            </label>
                            <label className="text-sm font-medium text-gray-700">{t(profile.data.identity_type === 'national_id' ? 'National ID number' : 'Passport number')}<input required value={profile.data.identity_number} maxLength={profile.data.identity_type === 'national_id' ? 16 : 100} inputMode={profile.data.identity_type === 'national_id' ? 'numeric' : 'text'} pattern={profile.data.identity_type === 'national_id' ? '[0-9]{16}' : undefined} onChange={event => profile.setData('identity_number', profile.data.identity_type === 'national_id' ? event.target.value.replace(/\D/g, '').slice(0, 16) : event.target.value)} className="mt-1.5 w-full rounded-xl border-gray-200" /></label>
                            <label className="text-sm font-medium text-gray-700">{t('Email')}<input type="email" required value={profile.data.email} onChange={event => profile.setData('email', event.target.value)} className="mt-1.5 w-full rounded-xl border-gray-200" /></label>
                            <label className="text-sm font-medium text-gray-700">{t('Phone')}<input required type="tel" value={profile.data.phone} maxLength={10} inputMode="numeric" pattern="(078|079|072|073)[0-9]{7}" onChange={event => profile.setData('phone', event.target.value.replace(/\D/g, '').slice(0, 10))} className="mt-1.5 w-full rounded-xl border-gray-200" /><span className="mt-1 block text-xs font-normal text-gray-500">{t('Enter 10 digits starting with 078, 079, 072, or 073.')}</span></label>
                            <TenantLocationFields data={profile.data} setData={profile.setData} errors={profile.errors} t={t} />
                            <div className="grid gap-5 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 sm:col-span-2 sm:grid-cols-[9rem_1fr] lg:col-span-3">
                                <TenantPhotoPicker id="edit-tenant-photo" file={profile.data.photo} onChange={(file) => profile.setData('photo', file)} error={profile.errors.photo} />
                                <div>
                                    <TenantDocumentPicker id="edit-tenant-identity-document"
                                        label={profile.data.identity_type === 'passport' ? t('Passport photo page') : t('Photo or scan of the ID card')}
                                        file={profile.data.identity_document} onChange={(file) => profile.setData('identity_document', file)} error={profile.errors.identity_document} />
                                    <p className="mt-2 text-xs text-gray-500">{t('Leave empty to keep the current files.')}</p>
                                </div>
                            </div>
                            {Object.values(profile.errors).length > 0 && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2 lg:col-span-3">{Object.values(profile.errors)[0]}</p>}
                            <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-3">
                                <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700">{t('Cancel')}</button>
                                <button disabled={profile.processing} className="rounded-xl bg-[#0E3B2E] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{profile.processing ? t('Saving…') : t('Save tenant details')}</button>
                            </div>
                        </form>
                    ) : (
                        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                            {tenant.type === 'individual' ? (
                                <>
                                    <Detail label={t('Full name')} value={[tenant.first_name, tenant.last_name].filter(Boolean).join(' ') || tenant.name} />
                                    <Detail label={t('Gender')} value={tenant.gender ? t(tenant.gender === 'female' ? 'Female' : 'Male') : t('Not added yet')} />
                                    <Detail label={t('Marital status')} value={tenant.marital_status ? t(tenant.marital_status.charAt(0).toUpperCase() + tenant.marital_status.slice(1)) : t('Not added yet')} />
                                </>
                            ) : (
                                <>
                                    <Detail label={t('Company name')} value={tenant.company_name || tenant.name} />
                                    <Detail label={t('Company TIN')} value={tenant.tax_identification_number} />
                                    <Detail label={t('Representative')} value={tenant.contact_person} />
                                </>
                            )}
                            <Detail label={t(tenant.identity_type === 'passport' ? 'Passport number' : 'National ID')} value={tenant.identity_number || tenant.national_id} />
                            <Detail label={t('ID document')} icon={<FileText size={15} />} value={tenant.identity_document_url
                                ? <a href={tenant.identity_document_url} target="_blank" rel="noreferrer" className="font-semibold text-[#0E3B2E] underline underline-offset-2">{t('View ID document')}</a>
                                : t('Not added yet')} />
                            <Detail label={t('Email')} value={tenant.email} icon={<Mail size={15} />} />
                            <Detail label={t('Phone')} value={tenant.phone} icon={<Phone size={15} />} />
                            <Detail label={t('Address')} value={tenant.address} icon={<MapPin size={15} />} />
                        </div>
                    )}
                </section>

                {canEdit && <section id="assign-unit" className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <div className="flex items-start gap-4 border-b border-gray-100 bg-gradient-to-br from-[#0E3B2E]/[0.06] via-white to-amber-50/60 p-6">
                        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#0E3B2E] text-white shadow-md shadow-[#0E3B2E]/20">
                            <KeyRound size={22} aria-hidden="true" />
                        </span>
                        <div>
                            <h2 className="font-[Sora] text-xl font-bold text-gray-900">{t('Assign this tenant to a unit')}</h2>
                            <p className="mt-1 text-sm text-gray-600">{t('Choose an available unit, confirm the lease terms, and upload the signed lease. The unit will be reserved for a future start date.')}</p>
                        </div>
                    </div>
                    {availableUnits.length ? (
                        <AssignUnitForm tenant={tenant} availableUnits={availableUnits} />
                    ) : (
                        <div className="p-8 text-center">
                            <Building2 className="mx-auto text-gray-300" size={36} />
                            <h3 className="mt-3 font-semibold text-gray-900">{t('No available units right now')}</h3>
                            <p className="mt-1 text-sm text-gray-500">{t('Create or make a unit available, then return here to assign it to :name.', { name: tenant.name })}</p>
                            <Link href={route('properties.index')} className="mt-4 inline-flex rounded-xl bg-[#0E3B2E] px-4 py-2 text-sm font-medium text-white">{t('View properties')}</Link>
                        </div>
                    )}
                </section>}

                <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <div className="border-b border-gray-100 p-6">
                        <h2 className="font-[Sora] text-lg font-semibold text-gray-900">{t('Unit and tenancy history')}</h2>
                        <p className="mt-1 text-sm text-gray-500">{t('Current, upcoming, and previous leases for this tenant.')}</p>
                    </div>
                    {tenant.tenancies?.length ? (
                        <div className="divide-y divide-gray-100">
                            {tenant.tenancies.map(tenancy => {
                                const charged = (tenancy.rent_charges || []).filter(charge => !charge.voided_at).reduce((sum, charge) => sum + Number(charge.amount), 0);
                                const paid = (tenancy.rent_charges || []).reduce((sum, charge) => sum + (charge.payments || []).reduce((total, payment) => total + Number(payment.amount), 0), 0);
                                const payments = (tenancy.rent_charges || []).flatMap(charge => (charge.payments || []).map(payment => ({ ...payment, charge_type: charge.charge_type })));
                                return (
                                    <div key={tenancy.id} className="flex flex-col gap-4 p-5">
                                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className="rounded-xl bg-emerald-50 p-2.5 text-[#0E3B2E]"><Building2 size={18} /></div>
                                            <div>
                                                <p className="font-semibold text-gray-900">{tenancy.unit?.property?.name} · {t('Unit')} {tenancy.unit?.unit_number}</p>
                                                <p className="mt-1 text-xs font-semibold text-[#0E3B2E]">{tenancy.leases?.[0]?.reference_number || t('Agreement reference not available')}</p>
                                                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                                                    <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{formatDate(tenancy.start_date, language)} – {formatDate(tenancy.actual_end_date || tenancy.end_date, language)}</span>
                                                    <span>{Number(tenancy.monthly_rent).toLocaleString(({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW')} RWF / {t((tenancy.rent_frequency || 'monthly').replace(/^./, (letter) => letter.toUpperCase()))}</span>
                                                </p>
                                                {tenancy.move_out_inspection && <p className="mt-1 text-xs text-gray-500">{t('Move-out deposit')}: {Number(tenancy.move_out_inspection.deposit_refunded).toLocaleString()} {t('refunded')} · {Number(tenancy.move_out_inspection.deposit_deducted).toLocaleString()} {t('deducted')}</p>}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-700">{t(tenancy.status.replace(/^./, (letter) => letter.toUpperCase()))}</span>
                                            <span className="inline-flex items-center gap-1 text-xs text-gray-600"><Wallet size={14} />{t('Collected')} {paid.toLocaleString(({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW')} / {charged.toLocaleString(({ en: 'en-RW', fr: 'fr-FR', rw: 'rw-RW' })[language] || 'en-RW')} RWF</span>
                                            {tenancy.unit && <Link href={route('properties.units.show', [tenancy.unit.property_id, tenancy.unit.id])} className="inline-flex items-center gap-1 text-sm font-medium text-[#0E3B2E] hover:underline"><FileText size={14} />{t('Open unit')}</Link>}
                                        </div>
                                      </div>
                                      {payments.length > 0 && (
                                        <details className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                            <summary className="cursor-pointer text-sm font-semibold text-gray-700">{t('Payment history')} ({payments.length})</summary>
                                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                {payments.map(payment => <PaymentRecordDetails key={payment.id} payment={payment} />)}
                                            </div>
                                        </details>
                                      )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-sm text-gray-500">{t('No unit has been assigned to this tenant yet. Use the assignment form above to get started.')}</div>
                    )}
                </section>
            </div>
        </AuthenticatedLayout>
    );
}

function Detail({ label, value, icon }) {
    return (
        <div className="min-w-0 rounded-xl border border-gray-100 p-4">
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{icon}{label}</dt>
            <dd className="mt-1 break-words text-sm font-medium text-gray-900">{value || '—'}</dd>
        </div>
    );
}
