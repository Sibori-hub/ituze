import InputError from '@/Components/InputError';
import RwandaFlag from '@/Components/RwandaFlag';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, useForm, usePage } from '@inertiajs/react';
import { ArrowRight, BadgeCheck, BookUser, Camera, Check, FileText, IdCard, Loader2, MapPin, Trash2, UploadCloud } from 'lucide-react';
import { displayPhone, formatNida } from '@/lib/rwanda';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/localization';

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // matches max:2048 on the server
const MAX_ID_BYTES = 5 * 1024 * 1024; // matches max:5120 on the server

/** Resizes a large photo to at most 1280 px as JPEG; returns the original if the browser cannot read it. */
async function shrinkPhoto(file, maxSide = 1280) {
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        if (!blob) return file;

        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch {
        return file;
    }
}

function Stepper() {
    const { t } = useTranslation();
    const steps = [
        { label: t('Account'), done: true },
        { label: t('Email'), done: true },
        { label: t('Phone'), done: true },
        { label: t('Profile'), current: true },
        { label: t('Approval') },
    ];

    return (
        <ol className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2 text-[11px] font-semibold" aria-label={t('Progress')}>
            {steps.map(({ label, done, current }, index) => (
                <li key={label} className="flex items-center gap-1.5" aria-current={current ? 'step' : undefined}>
                    {index > 0 && <span className={`h-px w-3 sm:w-4 ${done || current ? 'bg-emerald-300' : 'bg-gray-200 dark:bg-slate-700'}`} />}
                    <span
                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${
                            done ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : current ? 'bg-[#0E3B2E] text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500'
                        }`}
                    >
                        {done && <Check size={11} strokeWidth={3} />}
                        {label}
                    </span>
                </li>
            ))}
        </ol>
    );
}

function Section({ icon: Icon, title, hint, done, children }) {
    return (
        <section className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
            <div className="mb-4 flex items-start gap-3">
                <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        done ? 'bg-emerald-500 text-white' : 'bg-[#0E3B2E]/[0.07] text-[#0E3B2E] dark:text-emerald-300'
                    }`}
                >
                    {done ? <Check size={17} strokeWidth={3} /> : <Icon size={17} />}
                </span>
                <div>
                    <h3 className="font-[Sora] text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</h3>
                    {hint && <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{hint}</p>}
                </div>
            </div>
            {children}
        </section>
    );
}

/** One side of the ID document: a photo (shrunk when large) or a PDF, with a preview. */
function IdDocumentUpload({ id, label, file, onChange, error }) {
    const { t } = useTranslation();
    const input = useRef(null);
    const [preview, setPreview] = useState(null);
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        if (!file || file.type === 'application/pdf') {
            setPreview(null);
            return undefined;
        }
        const url = URL.createObjectURL(file);
        setPreview(url);

        return () => URL.revokeObjectURL(url);
    }, [file]);

    const choose = async (picked) => {
        if (!picked) return;
        const isPdf = picked.type === 'application/pdf' || /\.pdf$/i.test(picked.name);
        const isImage = picked.type ? picked.type.startsWith('image/') : /\.(jpe?g|png|webp)$/i.test(picked.name);
        if (!isPdf && !isImage) {
            setLocalError(t('Please choose a photo (JPG, PNG or WEBP) or a PDF.'));
            return;
        }
        // Keep ID photos sharp enough to read: shrink only large ones, to at most 2000 px.
        const ready = isImage && picked.size > MAX_ID_BYTES ? await shrinkPhoto(picked, 2000) : picked;
        if (ready.size > MAX_ID_BYTES) {
            setLocalError(t('This file is :size MB. The maximum is 5 MB.', { size: (ready.size / 1048576).toFixed(1) }));
            return;
        }
        setLocalError('');
        onChange(ready);
    };

    const remove = () => {
        onChange(null);
        if (input.current) input.current.value = '';
    };

    const message = localError || (error ? t(error) : '');

    return (
        <div>
            <p id={`${id}-label`} className="mb-1.5 text-[13px] font-medium text-gray-700 dark:text-slate-200">{label}</p>
            <div
                className={`flex items-center gap-3 rounded-xl border-2 border-dashed p-3 ${
                    message ? 'border-red-300 dark:border-red-500/40' : file ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-500/10' : 'border-gray-200 dark:border-slate-700'
                }`}
            >
                <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50 dark:bg-slate-800/60 ring-1 ring-gray-100 dark:ring-slate-700">
                    {preview ? (
                        <img src={preview} alt={t(':label preview', { label })} className="h-full w-full object-cover" />
                    ) : file ? (
                        <FileText size={22} className="text-[#0E3B2E] dark:text-emerald-300" aria-hidden="true" />
                    ) : (
                        <IdCard size={22} className="text-gray-400 dark:text-slate-500" aria-hidden="true" />
                    )}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-gray-500 dark:text-slate-400">{file ? file.name : t('JPG, PNG, WEBP or PDF, up to 5 MB')}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => input.current?.click()}
                            aria-describedby={`${id}-label${message ? ` ${id}-error` : ''}`}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#0E3B2E] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#124B3A] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0E3B2E]/25"
                        >
                            <UploadCloud size={14} aria-hidden="true" />
                            {file ? t('Change file') : t('Upload')}
                        </button>
                        {file && (
                            <button
                                type="button"
                                onClick={remove}
                                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 transition hover:bg-gray-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0E3B2E]/15"
                            >
                                <Trash2 size={14} aria-hidden="true" />
                                {t('Remove')}
                            </button>
                        )}
                    </div>
                </div>
                <input
                    ref={input}
                    id={id}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => choose(e.target.files?.[0])}
                    className="hidden"
                    aria-labelledby={`${id}-label`}
                />
            </div>
            {message && (
                <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                    {message}
                </p>
            )}
        </div>
    );
}

export default function Complete({ registrationDetails, locations, needsTerms = false }) {
    const { t } = useTranslation();
    const { auth } = usePage().props;
    const registration = registrationDetails ?? auth.user;
    const provinces = locations?.provinces ?? [];
    const districts = locations?.districts ?? [];
    const sectors = locations?.sectors ?? [];

    const { data, setData, post, processing, errors, clearErrors } = useForm({
        national_id: '',
        identity_document_type: 'nida',
        profile_photo: null,
        identity_document: null,
        sector_id: '',
        terms: false,
        // A company: its RDB certificate and street address.
        rdb_certificate: null,
        address: '',
        gender: '',
        marital_status: '',
    });
    const isCompany = auth.user?.account_type === 'company';

    const fileInput = useRef(null);
    const [preview, setPreview] = useState(null);
    const [photoError, setPhotoError] = useState('');
    const [dragging, setDragging] = useState(false);
    const [selectedProvince, setSelectedProvince] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');

    // Release the old preview image when a new one replaces it.
    useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

    const availableDistricts = useMemo(
        () => districts.filter((district) => String(district.province_id) === selectedProvince),
        [districts, selectedProvince],
    );
    const availableSectors = useMemo(
        () => sectors.filter((sector) => String(sector.district_id) === selectedDistrict),
        [sectors, selectedDistrict],
    );

    const isPassport = data.identity_document_type === 'passport';
    const idValid = isPassport ? /^[A-Z0-9]{6,20}$/.test(data.national_id) : /^\d{16}$/.test(data.national_id);
    const idDone = idValid && Boolean(data.identity_document) && Boolean(data.gender) && Boolean(data.marital_status);
    const photoDone = Boolean(data.profile_photo);
    const locationDone = Boolean(data.sector_id) && (!isCompany || data.address.trim() !== '');
    const rdbDone = !isCompany || Boolean(data.rdb_certificate);
    const doneCount = [photoDone, idDone, locationDone].filter(Boolean).length;
    const isFormValid = doneCount === 3 && rdbDone && (!needsTerms || data.terms);

    const initials = `${registration.first_name?.[0] ?? ''}${registration.last_name?.[0] ?? ''}`.toUpperCase();

    const choosePhoto = async (picked) => {
        if (!picked) return;

        // Some phones and gallery apps report no type; fall back to the extension (the server re-checks).
        const looksLikeImage = picked.type ? picked.type.startsWith('image/') : /\.(jpe?g|png|webp)$/i.test(picked.name);
        if (!looksLikeImage) {
            setPhotoError(t('Please choose an image file (JPG, PNG or WEBP).'));
            return;
        }
        // Phone camera photos are often 3–8 MB: make them smaller here instead of refusing them.
        const file = picked.size > MAX_PHOTO_BYTES ? await shrinkPhoto(picked) : picked;
        if (file.size > MAX_PHOTO_BYTES) {
            setPhotoError(t('This photo is :size MB. The maximum is 2 MB, so please choose a smaller one.', { size: (file.size / 1048576).toFixed(1) }));
            return;
        }

        setPhotoError('');
        clearErrors('profile_photo');
        setData('profile_photo', file);
        setPreview(URL.createObjectURL(file));
    };

    const removePhoto = () => {
        setData('profile_photo', null);
        setPreview(null);
        if (fileInput.current) fileInput.current.value = '';
    };

    const changeIdType = (type) => {
        if (type === data.identity_document_type) return;
        setData((current) => ({ ...current, identity_document_type: type, national_id: '' }));
        clearErrors('national_id');
    };

    const changeIdNumber = (value) => {
        const cleaned = isPassport
            ? value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20)
            : value.replace(/\D/g, '').slice(0, 16);
        setData('national_id', cleaned);
    };

    const submit = (e) => {
        e.preventDefault();
        if (!isFormValid) return;
        post(route('profile.complete.store'), { forceFormData: true, preserveScroll: true });
    };

    const fieldClass =
        'w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 text-sm text-gray-800 dark:text-slate-100 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-[#0E3B2E] focus:ring-4 focus:ring-[#0E3B2E]/10 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-slate-800 disabled:text-gray-400 dark:disabled:text-slate-500';

    return (
        <GuestLayout>
            <Head title={t('Complete Your Profile')} />

            <div className="pt-5">
                <Stepper />

                <div className="mt-6 text-center">
                    <h2 className="font-[Sora] text-2xl font-bold tracking-[-0.02em] text-gray-900 dark:text-slate-100">{t('Complete Your Profile')}</h2>
                    <p className="mt-1.5 text-sm text-gray-500 dark:text-slate-400">{t('One last step. After this, our team reviews your account.')}</p>
                </div>

                <div className="mx-auto mt-4 max-w-xs" aria-live="polite">
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-[#1F7A5A] to-[#D9A441] transition-all duration-500"
                            style={{ width: `${Math.round((doneCount / 3) * 100)}%` }}
                        />
                    </div>
                    <p className="mt-1.5 text-center text-[11px] font-medium text-gray-400 dark:text-slate-500">
                        {t(':done of :total completed', { done: doneCount, total: 3 })}
                    </p>
                </div>
            </div>

            {/* Who is signing up, already verified in the previous steps. */}
            <div className="mt-6 flex items-center gap-4 rounded-2xl bg-gradient-to-br from-[#0E3B2E]/[0.05] to-[#D9A441]/[0.08] p-4 ring-1 ring-inset ring-[#0E3B2E]/10">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0E3B2E] font-[Sora] text-sm font-bold text-[#F3D58F] ring-2 ring-white">
                    {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : initials}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900 dark:text-slate-100">
                        {registration.first_name} {registration.last_name}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
                        <span className="inline-flex min-w-0 items-center gap-1">
                            <BadgeCheck size={13} className="shrink-0 text-emerald-500" />
                            <span className="truncate">{registration.email}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <RwandaFlag className="h-2.5 w-[15px]" />
                            {displayPhone(registration.phone)}
                            <BadgeCheck size={13} className="text-emerald-500" />
                        </span>
                    </p>
                </div>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
                <Section icon={Camera} title={isCompany ? t('Company logo') : t('Profile photo')} hint={isCompany ? t('Upload the company’s logo (JPG, PNG or WEBP).') : t('Use a clear, recent photo of your face.')} done={photoDone}>
                    <div
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragging(false);
                            choosePhoto(e.dataTransfer.files?.[0]);
                        }}
                        className={`flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-4 text-center transition sm:flex-row sm:text-left ${
                            dragging ? 'border-[#0E3B2E] dark:border-emerald-500 bg-[#0E3B2E]/[0.03]' : 'border-gray-200 dark:border-slate-700'
                        }`}
                    >
                        <button
                            type="button"
                            onClick={() => fileInput.current?.click()}
                            className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-gray-50 dark:bg-slate-800/60 ring-4 ring-gray-100 dark:ring-slate-700 transition hover:ring-[#0E3B2E]/20"
                            aria-label={t('Upload profile photo')}
                        >
                            {preview ? (
                                <img src={preview} alt={t('Profile preview')} className="h-full w-full object-cover" />
                            ) : (
                                <Camera size={24} className="mx-auto text-gray-400 dark:text-slate-500 transition group-hover:text-[#0E3B2E]" />
                            )}
                        </button>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700 dark:text-slate-200">
                                {preview ? data.profile_photo?.name : isCompany ? t('Drag the logo here, or choose it') : t('Drag a photo here, or choose one')}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">{t('JPG, PNG or WEBP, up to 2 MB')}</p>
                            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                                <button
                                    type="button"
                                    onClick={() => fileInput.current?.click()}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E3B2E] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#124B3A]"
                                >
                                    <UploadCloud size={14} />
                                    {preview ? t('Change photo') : t('Choose photo')}
                                </button>
                                {preview && (
                                    <button
                                        type="button"
                                        onClick={removePhoto}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-slate-300 transition hover:bg-gray-50 dark:hover:bg-slate-800"
                                    >
                                        <Trash2 size={14} />
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
                            className="hidden"
                        />
                    </div>
                    {photoError && <p className="mt-2 text-xs font-medium text-red-500">{photoError}</p>}
                    <InputError message={errors.profile_photo} className="mt-2" />
                </Section>

                <Section icon={IdCard} title={isCompany ? t('Representative’s identity document') : t('Identity document')} hint={isCompany ? t('The ID of the person who represents the company. Our team uses it to confirm who you are.') : t('Our team uses this to confirm your identity.')} done={idDone && rdbDone}>
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 dark:bg-slate-800 p-1" role="radiogroup" aria-label={t('Identity document')}>
                        {[
                            { value: 'nida', label: t('National ID (NIDA)'), short: 'NIDA', Icon: IdCard },
                            { value: 'passport', label: t('Passport'), short: t('Passport'), Icon: BookUser },
                        ].map(({ value, label, short, Icon }) => {
                            const selected = data.identity_document_type === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => changeIdType(value)}
                                    className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold transition sm:text-sm ${
                                        selected ? 'bg-white dark:bg-slate-900 text-[#0E3B2E] dark:text-emerald-300 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white'
                                    }`}
                                >
                                    <Icon size={15} />
                                    <span className="sm:hidden">{short}</span>
                                    <span className="hidden sm:inline">{label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <label htmlFor="national_id" className="mb-1.5 mt-4 block text-[13px] font-medium text-gray-700 dark:text-slate-200">
                        {isPassport ? t('Passport number') : t('NIDA number')}
                    </label>
                    <div className="relative">
                        <input
                            id="national_id"
                            name="national_id"
                            value={isPassport ? data.national_id : formatNida(data.national_id)}
                            onChange={(e) => changeIdNumber(e.target.value)}
                            inputMode={isPassport ? 'text' : 'numeric'}
                            autoComplete="off"
                            placeholder={isPassport ? 'PC1234567' : '1 1990 8 0012345 0 12'}
                            className={`${fieldClass} pl-4 pr-20 font-medium tracking-[0.08em] placeholder:font-normal placeholder:tracking-normal ${
                                errors.national_id ? 'border-red-300 dark:border-red-500/40 focus:border-red-400 focus:ring-red-100' : ''
                            }`}
                            aria-describedby="national_id-help"
                        />
                        <span
                            className={`pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs font-semibold tabular-nums ${
                                idValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-slate-500'
                            }`}
                        >
                            {idValid && <Check size={14} strokeWidth={3} />}
                            {isPassport ? '' : `${data.national_id.length}/16`}
                        </span>
                    </div>
                    <p id="national_id-help" className="mt-1.5 text-xs text-gray-400 dark:text-slate-500">
                        {isPassport ? t('6 to 20 letters and numbers, exactly as printed.') : t('Exactly 16 digits, as printed on your ID card.')}
                    </p>
                    <InputError message={errors.national_id || errors.identity_document_type} className="mt-1" />

                    {/* The same personal details as tenants: for a company, the representative's. */}
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {[
                            ['gender', isCompany ? t('Representative’s gender') : t('Gender'), [['female', t('Female')], ['male', t('Male')]]],
                            ['marital_status', isCompany ? t('Representative’s marital status') : t('Marital status'), [['single', t('Single')], ['married', t('Married')], ['divorced', t('Divorced')], ['widowed', t('Widowed')]]],
                        ].map(([field, legend, options]) => (
                            <fieldset key={field} className={field === 'marital_status' ? 'sm:col-span-2' : ''}>
                                <legend className="mb-1.5 text-[13px] font-medium text-gray-700 dark:text-slate-200">{legend}</legend>
                                <div className="flex flex-wrap gap-2">
                                    {options.map(([value, label]) => {
                                        const selected = data[field] === value;
                                        return (
                                            <label key={value} className={`inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#0E3B2E]/15 ${selected ? 'border-[#0E3B2E] dark:border-emerald-500 bg-[#0E3B2E] text-white shadow-sm' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 hover:border-gray-300 dark:hover:border-slate-500'}`}>
                                                <input type="radio" name={field} value={value} checked={selected} onChange={() => { clearErrors(field); setData(field, value); }} className="sr-only" />
                                                {selected && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                                                {label}
                                            </label>
                                        );
                                    })}
                                </div>
                                <InputError message={errors[field]} className="mt-1" />
                            </fieldset>
                        ))}
                    </div>

                    <div className="mt-4">
                        <IdDocumentUpload
                            id="identity_document"
                            label={isPassport ? t('Passport photo page') : t('Photo or scan of your ID card')}
                            file={data.identity_document}
                            onChange={(file) => {
                                clearErrors('identity_document');
                                setData('identity_document', file);
                            }}
                            error={errors.identity_document}
                        />
                    </div>
                    {isCompany && (
                        <div className="mt-4 border-t border-gray-100 dark:border-slate-800 pt-4">
                            <IdDocumentUpload
                                id="rdb_certificate"
                                label={t('RDB registration certificate of the company')}
                                file={data.rdb_certificate}
                                onChange={(file) => {
                                    clearErrors('rdb_certificate');
                                    setData('rdb_certificate', file);
                                }}
                                error={errors.rdb_certificate}
                            />
                        </div>
                    )}
                    <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">{isCompany ? t('Only the ITUZE team can see these files. Make sure every word is clear.') : t('Only the ITUZE team can see this file. Make sure every word and the photo are clear.')}</p>
                </Section>

                <Section icon={MapPin} title={isCompany ? t('Company address') : t('Where you live')} hint={isCompany ? t('Where the company is: province, district, sector and street.') : t('Choose your province, district and sector.')} done={locationDone}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <select
                            aria-label={t('Province')}
                            value={selectedProvince}
                            onChange={(e) => {
                                setSelectedProvince(e.target.value);
                                setSelectedDistrict('');
                                setData('sector_id', '');
                            }}
                            className={`${fieldClass} px-3.5`}
                        >
                            <option value="">{t('Province')}</option>
                            {provinces.map((province) => (
                                <option key={province.id} value={province.id}>{province.name}</option>
                            ))}
                        </select>
                        <select
                            aria-label={t('District')}
                            value={selectedDistrict}
                            onChange={(e) => {
                                setSelectedDistrict(e.target.value);
                                setData('sector_id', '');
                            }}
                            disabled={!selectedProvince}
                            className={`${fieldClass} px-3.5`}
                        >
                            <option value="">{t('District')}</option>
                            {availableDistricts.map((district) => (
                                <option key={district.id} value={district.id}>{district.name}</option>
                            ))}
                        </select>
                        <select
                            aria-label={t('Sector')}
                            value={data.sector_id}
                            onChange={(e) => setData('sector_id', e.target.value)}
                            disabled={!selectedDistrict}
                            className={`${fieldClass} px-3.5`}
                        >
                            <option value="">{t('Sector')}</option>
                            {availableSectors.map((sector) => (
                                <option key={sector.id} value={sector.id}>{sector.name}</option>
                            ))}
                        </select>
                    </div>
                    <InputError message={errors.sector_id} className="mt-1" />
                    {isCompany && (
                        <div className="mt-3">
                            <label htmlFor="address" className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-slate-200">{t('Street address')}</label>
                            <input id="address" value={data.address} onChange={(e) => setData('address', e.target.value)} maxLength={255} autoComplete="street-address"
                                placeholder={t('e.g. KG 7 Ave, Ikaze House, 2nd floor')} className={`${fieldClass} px-3.5`} aria-invalid={Boolean(errors.address) || undefined} />
                            <InputError message={errors.address} className="mt-1" />
                        </div>
                    )}
                </Section>

                {needsTerms && (
                    <label htmlFor="terms" className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${data.terms ? 'border-[#0E3B2E]/30 dark:border-emerald-400/30 bg-[#0E3B2E]/[0.03]' : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-500'}`}>
                        <input id="terms" type="checkbox" checked={data.terms} disabled={processing} onChange={(e) => setData('terms', e.target.checked)}
                            className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-md border-gray-300 dark:border-slate-600 text-[#0E3B2E] dark:text-emerald-300 focus:ring-[#0E3B2E]/30" />
                        <span className="text-xs leading-5 text-gray-600 dark:text-slate-300">
                            {t('I have read and agree to the')}{' '}
                            <a href={route('legal.terms')} target="_blank" rel="noreferrer" className="font-semibold text-[#0E3B2E] dark:text-emerald-300 underline decoration-[#D9A441] decoration-2 underline-offset-2">{t('Terms and Conditions')}</a>{' '}
                            {t('and the')}{' '}
                            <a href={route('legal.privacy')} target="_blank" rel="noreferrer" className="font-semibold text-[#0E3B2E] dark:text-emerald-300 underline decoration-[#D9A441] decoration-2 underline-offset-2">{t('Privacy Policy')}</a>
                        </span>
                    </label>
                )}
                <InputError message={errors.terms} className="-mt-2" />

                <div className="pt-1">
                    <button
                        type="submit"
                        disabled={!isFormValid || processing}
                        className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D9A441] py-3.5 text-sm font-semibold tracking-wide text-[#0E3B2E] dark:text-emerald-300 shadow-[0_10px_24px_-12px_rgba(217,164,65,0.9)] transition-all hover:bg-[#c9962f] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-slate-800 disabled:text-gray-400 dark:disabled:text-slate-500 disabled:shadow-none"
                    >
                        {processing ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                {t('Saving...')}
                            </>
                        ) : (
                            <>
                                {t(auth.user?.role === 'manager' ? 'Save and continue' : 'Submit for approval')}
                                <ArrowRight size={17} className="transition-transform group-enabled:group-hover:translate-x-1" />
                            </>
                        )}
                    </button>
                    {!isFormValid && (
                        <p className="mt-2 text-center text-xs text-gray-400 dark:text-slate-500">{t('Complete the three sections above to continue.')}</p>
                    )}
                </div>
            </form>
        </GuestLayout>
    );
}
