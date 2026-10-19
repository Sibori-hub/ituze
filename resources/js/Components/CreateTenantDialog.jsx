import RwandaFlag from '@/Components/RwandaFlag';
import TenantLocationFields from '@/Components/TenantLocationFields';
import usePresence from '@/hooks/usePresence';
import { formatPhone, getNetwork, RWANDA_MOBILE_REGEX, toLocalDigits } from '@/lib/rwanda';
import { useTranslation } from '@/localization';
import { AlertCircle, Building2, CheckCircle2, Circle, CreditCard, IdCard, Loader2, Mail, MapPin, Phone, User, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const fieldClass = (invalid) => `mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:outline-none focus:ring-2 ${invalid ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-300 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]/15'}`;
const iconFieldClass = (invalid) => `${fieldClass(invalid)} pl-10`;

/**
 * "Create tenant" popup. Same fields and rules as before, laid out in clear
 * sections: who the tenant is, their identity, how to reach them, and where
 * they live.
 */
export default function CreateTenantDialog({ open, form, onSubmit, onClose }) {
    const { t } = useTranslation();
    const { mounted, closing } = usePresence(open);
    const { data, setData, errors, processing } = form;
    const isCompany = data.type === 'company';
    const isNationalId = data.identity_type === 'national_id';
    const phoneDigits = toLocalDigits(data.phone);
    const phoneValid = RWANDA_MOBILE_REGEX.test(phoneDigits);

    // Checked in the browser as the user goes, mirroring the server rules.
    const [touched, setTouched] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const touch = (field) => setTouched(current => ({ ...current, [field]: true }));
    useEffect(() => {
        if (open) {
            setTouched({});
            setSubmitted(false);
        }
    }, [open]);

    const filled = (value) => String(value ?? '').trim() !== '';
    const clientErrors = {};
    if (isCompany) {
        if (!filled(data.company_name)) clientErrors.company_name = t('Enter the company name.');
        if (!filled(data.tax_identification_number)) clientErrors.tax_identification_number = t('Enter the company TIN.');
        if (!filled(data.contact_person)) clientErrors.contact_person = t('Enter the representative’s full name.');
    } else {
        if (!filled(data.first_name)) clientErrors.first_name = t('Enter the first name.');
        if (!filled(data.last_name)) clientErrors.last_name = t('Enter the last name.');
    }
    if (isNationalId ? !/^\d{16}$/.test(data.identity_number) : !filled(data.identity_number)) {
        clientErrors.identity_number = isNationalId ? t('The National ID number has 16 digits.') : t('Enter the passport number.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim())) clientErrors.email = t('Enter a valid email address.');
    if (!phoneValid) clientErrors.phone = t('Enter 10 digits starting with 078, 079, 072, or 073.');
    if (!data.province_id) clientErrors.province_id = t('Choose the province.');
    if (!data.district_id) clientErrors.district_id = t('Choose the district.');
    if (!data.sector_id) clientErrors.sector_id = t('Choose the sector.');

    const shownError = (field) => errors[field] || ((touched[field] || submitted) ? clientErrors[field] : undefined);
    const sectionFields = {
        who: isCompany ? ['company_name', 'tax_identification_number', 'contact_person'] : ['first_name', 'last_name'],
        identity: ['identity_number'],
        contact: ['email', 'phone'],
        location: ['province_id', 'district_id', 'sector_id'],
    };
    const done = Object.fromEntries(Object.entries(sectionFields).map(([key, fields]) => [key, fields.every(field => !clientErrors[field] && !errors[field])]));
    const doneCount = Object.values(done).filter(Boolean).length;

    const handleSubmit = (event) => {
        event.preventDefault();
        setSubmitted(true);
        const firstMissing = Object.entries(sectionFields).find(([key]) => !done[key]);
        if (firstMissing) {
            document.getElementById(`tenant-section-${firstMissing[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        onSubmit(event);
    };
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => event.key === 'Escape' && !processing && onClose();
        document.addEventListener('keydown', onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
        };
    }, [open, processing, onClose]);

    if (!mounted) return null;

    const errorText = (field) => shownError(field) && (
        <span className="mt-1 flex items-center gap-1 text-xs font-normal text-red-600"><AlertCircle size={12} aria-hidden="true" />{shownError(field)}</span>
    );
    const otherErrors = Object.entries(errors).filter(([field]) => !['first_name', 'last_name', 'company_name', 'tax_identification_number', 'contact_person', 'identity_number', 'email', 'phone', 'province_id', 'district_id', 'sector_id'].includes(field));

    return createPortal(
        <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6 ${closing ? 'pointer-events-none animate-fade-out' : 'animate-fade-in'}`}>
            <form
                onSubmit={handleSubmit}
                noValidate
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-tenant-title"
                className={`flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ${closing ? 'animate-pop-out' : 'animate-pop-in'}`}
            >
                {/* Header */}
                <div className="relative border-b border-gray-100 bg-gradient-to-br from-[#0E3B2E]/[0.06] via-white to-amber-50/60 px-6 pb-5 pt-6">
                    <div className="flex items-start gap-4">
                        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#0E3B2E] text-white shadow-md shadow-[#0E3B2E]/20">
                            <UserPlus size={22} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 pr-8">
                            <h2 id="create-tenant-title" className="font-[Sora] text-xl font-bold text-gray-900">{t('Create tenant')}</h2>
                            <p className="mt-1 text-sm text-gray-600">{t('Identity and contact details are required for all tenants.')}</p>
                        </div>
                    </div>
                    <div className="mt-4" aria-live="polite">
                        <div className="flex items-center justify-between text-xs font-medium text-gray-600">
                            <span>{t(':done of :total sections complete', { done: doneCount, total: 4 })}</span>
                            {doneCount === 4 && <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 size={13} aria-hidden="true" />{t('Ready to save')}</span>}
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={doneCount} aria-label={t('Form progress')}>
                            <div className="h-full rounded-full bg-gradient-to-r from-[#0E3B2E] to-green-500 transition-all duration-500" style={{ width: `${(doneCount / 4) * 100}%` }} />
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label={t('Close')}
                        className="absolute right-4 top-4 rounded-xl p-2 text-gray-500 transition-colors hover:bg-white hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]/40">
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
                    {/* Tenant type */}
                    <fieldset>
                        <legend className="text-sm font-semibold text-gray-900">{t('Type')}</legend>
                        <div className="mt-2 grid grid-cols-2 gap-3">
                            {[
                                { value: 'individual', label: t('Individual'), icon: User },
                                { value: 'company', label: t('Company'), icon: Building2 },
                            ].map(({ value, label, icon: Icon }) => {
                                const selected = data.type === value;
                                return (
                                    <label key={value}
                                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all focus-within:ring-2 focus-within:ring-[#0E3B2E]/30 ${selected ? 'border-[#0E3B2E] bg-[#0E3B2E]/[0.05] shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                        <input type="radio" name="tenant-type" value={value} checked={selected} onChange={() => setData('type', value)} className="sr-only" />
                                        <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${selected ? 'bg-[#0E3B2E] text-white' : 'bg-gray-100 text-gray-500'}`}>
                                            <Icon size={18} aria-hidden="true" />
                                        </span>
                                        <span className={`text-sm font-semibold ${selected ? 'text-[#0E3B2E]' : 'text-gray-700'}`}>{label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>

                    {/* Who */}
                    <Section id="who" done={done.who} icon={isCompany ? Building2 : User} title={isCompany ? t('Company details') : t('Full name')}>
                        {!isCompany ? (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="text-sm font-medium text-gray-800">{t('First name')}
                                    <input required value={data.first_name} onChange={event => setData('first_name', event.target.value)} autoComplete="given-name" onBlur={() => touch('first_name')} className={fieldClass(shownError('first_name'))} />
                                    {errorText('first_name')}
                                </label>
                                <label className="text-sm font-medium text-gray-800">{t('Last name')}
                                    <input required value={data.last_name} onChange={event => setData('last_name', event.target.value)} autoComplete="family-name" onBlur={() => touch('last_name')} className={fieldClass(shownError('last_name'))} />
                                    {errorText('last_name')}
                                </label>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="text-sm font-medium text-gray-800 sm:col-span-2">{t('Company name')}
                                    <input required value={data.company_name} onChange={event => setData('company_name', event.target.value)} autoComplete="organization" onBlur={() => touch('company_name')} className={fieldClass(shownError('company_name'))} />
                                    {errorText('company_name')}
                                </label>
                                <label className="text-sm font-medium text-gray-800">{t('Company TIN')}
                                    <input required value={data.tax_identification_number} onChange={event => setData('tax_identification_number', event.target.value)} onBlur={() => touch('tax_identification_number')} className={fieldClass(shownError('tax_identification_number'))} />
                                    {errorText('tax_identification_number')}
                                </label>
                                <label className="text-sm font-medium text-gray-800">{t('Representative full name')}
                                    <input required value={data.contact_person} onChange={event => setData('contact_person', event.target.value)} onBlur={() => touch('contact_person')} className={fieldClass(shownError('contact_person'))} />
                                    {errorText('contact_person')}
                                </label>
                            </div>
                        )}
                    </Section>

                    {/* Identity */}
                    <Section id="identity" done={done.identity} icon={IdCard} title={t('Identity')}>
                        <fieldset>
                            <legend className="sr-only">{t('Identity type')}</legend>
                            <div className="inline-flex rounded-xl bg-gray-100 p-1">
                                {[
                                    { value: 'national_id', label: t('National ID'), icon: IdCard },
                                    { value: 'passport', label: t('Passport'), icon: CreditCard },
                                ].map(({ value, label, icon: Icon }) => {
                                    const selected = data.identity_type === value;
                                    return (
                                        <label key={value}
                                            className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all focus-within:ring-2 focus-within:ring-[#0E3B2E]/30 ${selected ? 'bg-white text-[#0E3B2E] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                                            <input type="radio" name="identity-type" value={value} checked={selected} onChange={() => setData('identity_type', value)} className="sr-only" />
                                            <Icon size={15} aria-hidden="true" />{label}
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>
                        <label className="mt-4 block text-sm font-medium text-gray-800">
                            <span className="flex items-center justify-between gap-2">
                                {t(isNationalId ? 'National ID number' : 'Passport number')}
                                {isNationalId && (
                                    <span className={`text-xs font-normal ${data.identity_number.length === 16 ? 'text-green-700' : 'text-gray-500'}`}>{data.identity_number.length}/16</span>
                                )}
                            </span>
                            <input required value={data.identity_number} maxLength={isNationalId ? 16 : 100} inputMode={isNationalId ? 'numeric' : 'text'} pattern={isNationalId ? '[0-9]{16}' : undefined}
                                onChange={event => setData('identity_number', isNationalId ? event.target.value.replace(/\D/g, '').slice(0, 16) : event.target.value)}
                                onBlur={() => touch('identity_number')} className={`${fieldClass(shownError('identity_number'))} font-mono tracking-wider`} />
                            {errorText('identity_number')}
                        </label>
                    </Section>

                    {/* Contact */}
                    <Section id="contact" done={done.contact} icon={Phone} title={t('Contact')}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="text-sm font-medium text-gray-800">{t('Email')}
                                <span className="relative block">
                                    <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-gray-400" aria-hidden="true" />
                                    <input required type="email" value={data.email} onChange={event => setData('email', event.target.value)} autoComplete="email" onBlur={() => touch('email')} className={iconFieldClass(shownError('email'))} />
                                </span>
                                {errorText('email')}
                            </label>
                            <div className="text-sm font-medium text-gray-800">
                                <label htmlFor="tenant-phone">{t('Phone')}</label>
                                {/* Shown as +250 788 123 456 like sign-up; still sent as 0788123456. */}
                                <div className={`mt-1.5 flex items-stretch overflow-hidden rounded-xl border bg-white shadow-sm transition focus-within:ring-2 ${
                                    shownError('phone') || (phoneDigits !== '' && !phoneValid)
                                        ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-500/20'
                                        : 'border-gray-300 focus-within:border-[#0E3B2E] focus-within:ring-[#0E3B2E]/15'
                                }`}>
                                    <span className="flex select-none items-center gap-2 border-r border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700">
                                        <RwandaFlag className="h-[15px] w-[22px]" />
                                        +250
                                    </span>
                                    <input
                                        id="tenant-phone"
                                        required
                                        type="tel"
                                        inputMode="numeric"
                                        value={formatPhone(phoneDigits)}
                                        placeholder="788 123 456"
                                        autoComplete="tel-national"
                                        onChange={event => {
                                            const digits = toLocalDigits(event.target.value);
                                            setData('phone', digits ? `0${digits}` : '');
                                        }}
                                        onBlur={() => touch('phone')}
                                        aria-invalid={shownError('phone') || (phoneDigits !== '' && !phoneValid) ? 'true' : undefined}
                                        aria-describedby="tenant-phone-help"
                                        className="w-full min-w-0 border-0 bg-transparent px-3 py-2.5 text-sm tracking-wide text-gray-900 placeholder:tracking-normal placeholder:text-gray-400 focus:ring-0"
                                    />
                                </div>
                                <span id="tenant-phone-help" className={`mt-1 block text-xs font-normal ${phoneDigits !== '' && !phoneValid ? 'text-red-600' : phoneValid ? 'text-green-700' : 'text-gray-500'}`}>
                                    {phoneValid
                                        ? t(':network number', { network: getNetwork(phoneDigits) })
                                        : t('Enter 10 digits starting with 078, 079, 072, or 073.')}
                                </span>
                                {errors.phone && errorText('phone')}
                            </div>
                        </div>
                    </Section>

                    {/* Location */}
                    <Section id="location" done={done.location} icon={MapPin} title={t('Location')}>
                        <TenantLocationFields
                            data={data}
                            setData={setData}
                            errors={{ province_id: shownError('province_id'), district_id: shownError('district_id'), sector_id: shownError('sector_id') }}
                            t={t}
                            className="grid gap-4 sm:grid-cols-3"
                            selectClassName={fieldClass(false)}
                        />
                    </Section>

                    {otherErrors.length > 0 && (
                        <p role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                            <AlertCircle size={16} className="mt-0.5 flex-none" aria-hidden="true" />{otherErrors[0][1]}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 border-t border-gray-100 bg-gray-50/70 px-6 py-4">
                    <button type="button" onClick={onClose} disabled={processing}
                        className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 sm:flex-none sm:px-6">
                        {t('Cancel')}
                    </button>
                    <button disabled={processing}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#124B3A] disabled:opacity-60 sm:ml-auto sm:flex-none">
                        {processing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
                        {processing ? t('Saving…') : t('Create tenant')}
                    </button>
                </div>
            </form>
        </div>,
        document.body,
    );
}

function Section({ id, done = false, icon: Icon, title, children }) {
    const { t } = useTranslation();

    return (
        <section id={`tenant-section-${id}`} className={`scroll-mt-4 rounded-2xl border p-4 transition-colors duration-300 sm:p-5 ${done ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white'}`}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors duration-300 ${done ? 'bg-green-600 text-white' : 'bg-[#0E3B2E]/10 text-[#0E3B2E]'}`}><Icon size={15} aria-hidden="true" /></span>
                {title}
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium">
                    {done
                        ? <span className="inline-flex animate-pop-in items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-green-800"><CheckCircle2 size={14} aria-hidden="true" />{t('Done')}</span>
                        : <span className="inline-flex items-center gap-1 text-gray-400"><Circle size={14} aria-hidden="true" /><span className="sr-only">{t('not complete')}</span></span>}
                </span>
            </h3>
            {children}
        </section>
    );
}
