import InputError from '@/Components/InputError';
import RwandaFlag from '@/Components/RwandaFlag';
import useAvailability from '@/hooks/useAvailability';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatNida, formatPhone, getNetwork, RWANDA_MOBILE_REGEX, toLocalDigits } from '@/lib/rwanda';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, BookUser, Building2, Camera, Check, IdCard, Info, Loader2, Mail, MapPin, Megaphone, Trash2, UploadCloud, User, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/localization';

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // matches max:2048 on the server

const ACCOUNT_TYPES = [
    { value: 'owner', label: 'Property Owner', description: 'Q.R.A manages their buildings, units, tenants and rent.', Icon: Building2 },
    { value: 'advertiser', label: 'Advertiser', description: 'A business whose adverts Q.R.A publishes on the platform.', Icon: Megaphone },
];

const fieldClass =
    'w-full rounded-xl border-gray-300 bg-white py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-[#0E3B2E] focus:ring-4 focus:ring-[#0E3B2E]/15 disabled:bg-gray-100';
const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-800';
const invalidClass = 'border-red-600 focus:border-red-600 focus:ring-red-100';

function Section({ number, title, hint, done, children }) {
    return (
        <section aria-labelledby={`section-${number}`} className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-3">
                <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        done ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-300'
                    }`}
                >
                    {done ? <Check size={16} strokeWidth={3} /> : number}
                </span>
                <div>
                    <h2 id={`section-${number}`} className="font-[Sora] text-base font-semibold text-gray-900">{title}</h2>
                    {hint && <p className="mt-0.5 text-sm text-gray-600">{hint}</p>}
                </div>
            </div>
            {children}
        </section>
    );
}

function Hint({ id, tone = 'muted', children }) {
    const tones = { muted: 'text-gray-600', error: 'text-red-700 font-medium', ok: 'text-emerald-800 font-medium' };
    return (
        <p id={id} className={`mt-1.5 text-sm ${tones[tone]}`} aria-live="polite">
            {children}
        </p>
    );
}

export default function CreateUser({ locations }) {
    const { t } = useTranslation();
    const provinces = locations?.provinces ?? [];
    const districts = locations?.districts ?? [];
    const sectors = locations?.sectors ?? [];

    const { data, setData, post, processing, errors, transform, clearErrors } = useForm({
        role: 'owner',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        identity_document_type: 'nida',
        national_id: '',
        sector_id: '',
        profile_photo: null,
    });

    const fileInput = useRef(null);
    const [preview, setPreview] = useState(null);
    const [photoError, setPhotoError] = useState('');
    const [province, setProvince] = useState('');
    const [district, setDistrict] = useState('');

    useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

    const availableDistricts = useMemo(() => districts.filter((d) => String(d.province_id) === province), [districts, province]);
    const availableSectors = useMemo(() => sectors.filter((s) => String(s.district_id) === district), [sectors, district]);

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
    const phoneValid = RWANDA_MOBILE_REGEX.test(data.phone);
    const emailStatus = useAvailability('email', data.email.toLowerCase(), emailValid);
    const phoneStatus = useAvailability('phone', `0${data.phone}`, phoneValid);
    const network = getNetwork(data.phone);

    const isPassport = data.identity_document_type === 'passport';
    const idValid = isPassport ? /^[A-Z0-9]{6,20}$/.test(data.national_id) : /^\d{16}$/.test(data.national_id);

    const contactDone =
        data.first_name.trim() !== '' && data.last_name.trim() !== '' &&
        emailValid && emailStatus !== 'taken' && emailStatus !== 'checking' &&
        phoneValid && phoneStatus !== 'taken' && phoneStatus !== 'checking';
    const locationDone = Boolean(data.sector_id);
    const photoDone = Boolean(data.profile_photo);
    const isFormValid = contactDone && idValid && locationDone && photoDone;

    const choosePhoto = (file) => {
        if (!file) return;
        // Some phones and gallery apps report no type; fall back to the extension (the server re-checks).
        const looksLikeImage = file.type ? file.type.startsWith('image/') : /\.(jpe?g|png|webp)$/i.test(file.name);
        if (!looksLikeImage) {
            setPhotoError(t('Please choose an image file (JPG, PNG or WEBP).'));
            return;
        }
        if (file.size > MAX_PHOTO_BYTES) {
            setPhotoError(t('This photo is :size MB. The maximum is 2 MB, so please choose a smaller one.', { size: (file.size / 1048576).toFixed(1) }));
            return;
        }
        setPhotoError('');
        clearErrors('profile_photo');
        setData('profile_photo', file);
        setPreview(URL.createObjectURL(file));
    };

    const submit = (e) => {
        e.preventDefault();
        if (!isFormValid || processing) return;
        transform((form) => ({ ...form, phone: `0${form.phone}` }));
        post(route('admin.users.store'), { forceFormData: true, preserveScroll: true });
    };

    return (
        <AuthenticatedLayout header="Add user">
            <Head title={t('Add a managed account')} />

            <div className="mx-auto max-w-3xl">
                <Link
                    href={route('admin.users')}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-[#0E3B2E] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E3B2E]"
                >
                    <ArrowLeft size={16} aria-hidden="true" />
                    {t('Back to users')}
                </Link>

                <div className="mt-2 flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-[#0E3B2E] ring-1 ring-emerald-200" aria-hidden="true">
                        <UserPlus size={22} />
                    </span>
                    <div>
                        <h1 className="font-[Sora] text-2xl font-bold text-gray-900">{t('Add a managed account')}</h1>
                        <p className="mt-1 text-sm leading-6 text-gray-700">{t('Register an owner or advertiser whose account Q.R.A manages for them.')}</p>
                    </div>
                </div>

                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950" role="note">
                    <Info size={18} className="mt-0.5 shrink-0 text-sky-700" aria-hidden="true" />
                    <ul className="list-disc space-y-0.5 pl-4">
                        <li>{t('The account is approved straight away. Owners get a one-year plan starting today.')}</li>
                        <li>{t('They do not sign in: Q.R.A manages everything from this admin panel.')}</li>
                        <li>{t('Their email and phone are used only to send them information and updates.')}</li>
                    </ul>
                </div>

                <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
                    <Section number={1} title={t('Account type')} done>
                        <fieldset>
                            <legend className="sr-only">{t('Account type')}</legend>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {ACCOUNT_TYPES.map(({ value, label, description, Icon }) => {
                                    const selected = data.role === value;
                                    return (
                                        <label
                                            key={value}
                                            className={`relative flex min-h-11 cursor-pointer gap-3 rounded-xl border-2 p-4 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#0E3B2E]/20 ${
                                                selected ? 'border-[#0E3B2E] bg-emerald-50/60' : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="role"
                                                value={value}
                                                checked={selected}
                                                onChange={() => setData('role', value)}
                                                className="sr-only"
                                            />
                                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-[#0E3B2E] text-white' : 'bg-gray-100 text-gray-600'}`} aria-hidden="true">
                                                <Icon size={19} />
                                            </span>
                                            <span className="pr-6">
                                                <span className="block text-sm font-semibold text-gray-900">{t(label)}</span>
                                                <span className="mt-0.5 block text-sm leading-5 text-gray-600">{t(description)}</span>
                                            </span>
                                            {selected && (
                                                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#0E3B2E] text-white" aria-hidden="true">
                                                    <Check size={12} strokeWidth={3} />
                                                </span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                            <InputError message={errors.role} className="mt-1" />
                        </fieldset>
                    </Section>

                    <Section number={2} title={t('Contact details')} hint={t('Used to send information and updates. Email and phone must not already be registered.')} done={contactDone}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="first_name" className={labelClass}>{t('First Name')}</label>
                                <div className="relative">
                                    <User size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                                    <input id="first_name" value={data.first_name} onChange={(e) => setData('first_name', e.target.value)} autoComplete="off" aria-invalid={Boolean(errors.first_name) || undefined} className={`${fieldClass} pl-10 pr-3 ${errors.first_name ? invalidClass : ''}`} />
                                </div>
                                <InputError message={errors.first_name} className="mt-1" />
                            </div>
                            <div>
                                <label htmlFor="last_name" className={labelClass}>{t('Last Name')}</label>
                                <div className="relative">
                                    <User size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                                    <input id="last_name" value={data.last_name} onChange={(e) => setData('last_name', e.target.value)} autoComplete="off" aria-invalid={Boolean(errors.last_name) || undefined} className={`${fieldClass} pl-10 pr-3 ${errors.last_name ? invalidClass : ''}`} />
                                </div>
                                <InputError message={errors.last_name} className="mt-1" />
                            </div>

                            <div className="sm:col-span-2">
                                <label htmlFor="email" className={labelClass}>{t('Email')}</label>
                                <div className="relative">
                                    <Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                                    <input
                                        id="email"
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value.trim())}
                                        autoComplete="off"
                                        aria-invalid={emailStatus === 'taken' || (data.email !== '' && !emailValid) || Boolean(errors.email) || undefined}
                                        aria-describedby="email-hint"
                                        className={`${fieldClass} pl-10 pr-10 ${emailStatus === 'taken' || errors.email ? invalidClass : ''}`}
                                    />
                                    {emailStatus === 'checking' && <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 motion-safe:animate-spin" aria-hidden="true" />}
                                    {emailStatus === 'available' && <Check size={17} strokeWidth={3} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-700" aria-hidden="true" />}
                                </div>
                                {errors.email ? (
                                    <Hint id="email-hint" tone="error">{errors.email}</Hint>
                                ) : data.email !== '' && !emailValid ? (
                                    <Hint id="email-hint" tone="error">{t('Enter a valid email address')}</Hint>
                                ) : emailStatus === 'taken' ? (
                                    <Hint id="email-hint" tone="error">{t('This email is already registered.')}</Hint>
                                ) : (
                                    <Hint id="email-hint">{emailStatus === 'available' ? t('This email is available.') : ' '}</Hint>
                                )}
                            </div>

                            <div className="sm:col-span-2">
                                <label htmlFor="phone" className={labelClass}>{t('Phone number')}</label>
                                <div className={`flex overflow-hidden rounded-xl border bg-white focus-within:ring-4 ${phoneStatus === 'taken' || errors.phone || (data.phone !== '' && !phoneValid) ? 'border-red-600 focus-within:ring-red-100' : 'border-gray-300 focus-within:border-[#0E3B2E] focus-within:ring-[#0E3B2E]/15'}`}>
                                    <span className="flex select-none items-center gap-2 border-r border-gray-300 bg-gray-50 px-3.5 text-sm font-semibold text-gray-800">
                                        <RwandaFlag className="h-[15px] w-[22px]" />
                                        +250
                                    </span>
                                    <div className="relative flex-1">
                                        <input
                                            id="phone"
                                            type="tel"
                                            inputMode="numeric"
                                            value={formatPhone(data.phone)}
                                            onChange={(e) => setData('phone', toLocalDigits(e.target.value))}
                                            placeholder="788 123 456"
                                            autoComplete="off"
                                            aria-invalid={phoneStatus === 'taken' || (data.phone !== '' && !phoneValid) || Boolean(errors.phone) || undefined}
                                            aria-describedby="phone-hint"
                                            className="w-full border-0 bg-transparent py-3 pl-3.5 pr-10 text-sm tracking-wide text-gray-900 placeholder:tracking-normal placeholder:text-gray-500 focus:ring-0"
                                        />
                                        {phoneStatus === 'checking' && <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 motion-safe:animate-spin" aria-hidden="true" />}
                                        {phoneStatus === 'available' && <Check size={17} strokeWidth={3} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-700" aria-hidden="true" />}
                                    </div>
                                </div>
                                {errors.phone ? (
                                    <Hint id="phone-hint" tone="error">{errors.phone}</Hint>
                                ) : data.phone !== '' && !phoneValid ? (
                                    <Hint id="phone-hint" tone="error">{t('Enter the 9 digits after +250, starting with 72, 73, 78 or 79.')}</Hint>
                                ) : phoneStatus === 'taken' ? (
                                    <Hint id="phone-hint" tone="error">{t('This phone number is already registered.')}</Hint>
                                ) : (
                                    <Hint id="phone-hint" tone={phoneValid ? 'ok' : 'muted'}>
                                        {phoneValid && network ? t(':network number detected', { network }) : t('WhatsApp number used for updates.')}
                                    </Hint>
                                )}
                            </div>
                        </div>
                    </Section>

                    <Section number={3} title={t('Identity document')} hint={t('Used to confirm the account holder\'s identity.')} done={idValid}>
                        <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label={t('Identity document')}>
                            {[
                                { value: 'nida', label: t('National ID (NIDA)'), Icon: IdCard },
                                { value: 'passport', label: t('Passport'), Icon: BookUser },
                            ].map(({ value, label, Icon }) => {
                                const selected = data.identity_document_type === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        onClick={() => {
                                            if (selected) return;
                                            setData((form) => ({ ...form, identity_document_type: value, national_id: '' }));
                                            clearErrors('national_id');
                                        }}
                                        className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E3B2E] ${
                                            selected ? 'bg-white text-[#0E3B2E] shadow-sm' : 'text-gray-700 hover:text-gray-900'
                                        }`}
                                    >
                                        <Icon size={16} aria-hidden="true" />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                        <label htmlFor="national_id" className={`${labelClass} mt-4`}>{isPassport ? t('Passport number') : t('NIDA number')}</label>
                        <div className="relative">
                            <input
                                id="national_id"
                                value={isPassport ? data.national_id : formatNida(data.national_id)}
                                onChange={(e) =>
                                    setData('national_id', isPassport
                                        ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20)
                                        : e.target.value.replace(/\D/g, '').slice(0, 16))
                                }
                                inputMode={isPassport ? 'text' : 'numeric'}
                                autoComplete="off"
                                placeholder={isPassport ? 'PC1234567' : '1 1990 8 0012345 0 12'}
                                aria-invalid={Boolean(errors.national_id) || undefined}
                                aria-describedby="national-id-hint"
                                className={`${fieldClass} pl-4 pr-20 font-medium tracking-wider placeholder:font-normal placeholder:tracking-normal ${errors.national_id ? invalidClass : ''}`}
                            />
                            <span className={`pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-sm font-semibold tabular-nums ${idValid ? 'text-emerald-800' : 'text-gray-600'}`}>
                                {idValid && <Check size={15} strokeWidth={3} aria-hidden="true" />}
                                {!isPassport && `${data.national_id.length}/16`}
                            </span>
                        </div>
                        {errors.national_id ? (
                            <Hint id="national-id-hint" tone="error">{errors.national_id}</Hint>
                        ) : (
                            <Hint id="national-id-hint">{isPassport ? t('6 to 20 letters and numbers, exactly as printed.') : t('Exactly 16 digits, as printed on your ID card.')}</Hint>
                        )}
                    </Section>

                    <Section number={4} title={t('Location')} hint={t('Choose your province, district and sector.')} done={locationDone}>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                                <label htmlFor="province" className={labelClass}>{t('Province')}</label>
                                <select id="province" value={province} onChange={(e) => { setProvince(e.target.value); setDistrict(''); setData('sector_id', ''); }} className={`${fieldClass} px-3`}>
                                    <option value="">{t('Province')}</option>
                                    {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="district" className={labelClass}>{t('District')}</label>
                                <select id="district" value={district} onChange={(e) => { setDistrict(e.target.value); setData('sector_id', ''); }} disabled={!province} className={`${fieldClass} px-3`}>
                                    <option value="">{t('District')}</option>
                                    {availableDistricts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="sector" className={labelClass}>{t('Sector')}</label>
                                <select id="sector" value={data.sector_id} onChange={(e) => setData('sector_id', e.target.value)} disabled={!district} aria-invalid={Boolean(errors.sector_id) || undefined} className={`${fieldClass} px-3 ${errors.sector_id ? invalidClass : ''}`}>
                                    <option value="">{t('Sector')}</option>
                                    {availableSectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <InputError message={errors.sector_id} className="mt-1" />
                    </Section>

                    <Section number={5} title={t('Profile photo')} hint={t('Use a clear, recent photo of your face.')} done={photoDone}>
                        <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-gray-300 p-4 text-center sm:flex-row sm:text-left">
                            <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 ring-4 ring-gray-100">
                                {preview ? <img src={preview} alt={t('Profile preview')} className="h-full w-full object-cover" /> : <Camera size={24} className="text-gray-500" aria-hidden="true" />}
                            </span>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800">{preview ? data.profile_photo?.name : t('JPG, PNG or WEBP, up to 2 MB')}</p>
                                <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                                    <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#0E3B2E] px-4 text-sm font-semibold text-white hover:bg-[#124B3A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E3B2E]">
                                        <UploadCloud size={16} aria-hidden="true" />
                                        {preview ? t('Change photo') : t('Choose photo')}
                                    </button>
                                    {preview && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setData('profile_photo', null);
                                                setPreview(null);
                                                if (fileInput.current) fileInput.current.value = '';
                                            }}
                                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                                        >
                                            <Trash2 size={16} aria-hidden="true" />
                                            {t('Remove')}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <input
                                ref={fileInput}
                                id="profile_photo"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={(e) => choosePhoto(e.target.files?.[0])}
                                className="sr-only"
                                aria-label={t('Upload profile photo')}
                            />
                        </div>
                        {photoError && <p className="mt-2 text-sm font-medium text-red-700" role="alert">{photoError}</p>}
                        <InputError message={errors.profile_photo} className="mt-2" />
                    </Section>

                    <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:items-center sm:justify-end">
                        <Link href={route('admin.users')} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-gray-300 px-5 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                            {t('Cancel')}
                        </Link>
                        <button
                            type="submit"
                            disabled={!isFormValid || processing}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-6 text-sm font-semibold text-white hover:bg-[#124B3A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E3B2E] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-600"
                        >
                            {processing ? <Loader2 size={17} className="motion-safe:animate-spin" aria-hidden="true" /> : <UserPlus size={17} aria-hidden="true" />}
                            {processing ? t('Saving...') : t('Create managed account')}
                        </button>
                    </div>
                    {!isFormValid && <p className="text-right text-sm text-gray-600">{t('Complete all five sections to continue.')}</p>}
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
