import InputError from '@/Components/InputError';
import LegalModal from '@/Components/LegalModal';
import RwandaFlag from '@/Components/RwandaFlag';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowRight,
    Building2,
    Check,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    Mail,
    Megaphone,
    ShieldCheck,
    User,
    X,
} from 'lucide-react';
import useAvailability from '@/hooks/useAvailability';
import { formatPhone, getNetwork, RWANDA_MOBILE_REGEX, toLocalDigits } from '@/lib/rwanda';
import { useMemo, useState } from 'react';
import { useTranslation } from '@/localization';

const ACCOUNT_TYPES = [
    {
        value: 'owner',
        label: 'Property Owner',
        description: 'Manage properties, units, tenants, leases and rent payments.',
        Icon: Building2,
    },
    {
        value: 'advertiser',
        label: 'Advertiser',
        description: 'Promote your brand to people browsing properties on the platform.',
        Icon: Megaphone,
    },
];

// Mirrors Password::defaults() in AppServiceProvider so the form never
// accepts a password the server will reject.
const PASSWORD_RULES = [
    { label: 'At least 10 characters', test: (p) => p.length >= 10 },
    { label: 'Upper and lowercase letters', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
    { label: 'A number', test: (p) => /\d/.test(p) },
    { label: 'A symbol', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const STRENGTH_LEVELS = [
    { label: '', color: 'bg-gray-200', text: 'text-gray-400' },
    { label: 'Very weak', color: 'bg-red-400', text: 'text-red-500' },
    { label: 'Weak', color: 'bg-orange-400', text: 'text-orange-500' },
    { label: 'Good', color: 'bg-yellow-400', text: 'text-yellow-600' },
    { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-600' },
];

function SectionHeading({ number, title, done }) {
    return (
        <div className="mb-4 flex items-center gap-3">
            <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    done ? 'bg-emerald-500 text-white' : 'bg-[#0E3B2E]/[0.08] text-[#0E3B2E]'
                }`}
            >
                {done ? <Check size={14} strokeWidth={3} /> : number}
            </span>
            <h3 className="font-[Sora] text-[15px] font-semibold text-gray-800">{title}</h3>
            <span className="h-px flex-1 bg-gray-200" />
        </div>
    );
}

function TakenNotice({ message }) {
    const { t } = useTranslation();

    return (
        <span className="text-red-500">
            {message}{' '}
            <Link href={route('login')} className="font-semibold text-[#0E3B2E] underline decoration-[#D9A441] decoration-2 underline-offset-2">
                {t('Log in instead')}
            </Link>
        </span>
    );
}

function FieldStatus({ show, valid, checking = false }) {
    if (!show) return null;

    return (
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
            {checking ? (
                <Loader2 size={16} className="animate-spin text-gray-400" aria-label="Checking" />
            ) : valid ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check size={12} strokeWidth={3} />
                </span>
            ) : (
                <X size={16} className="text-red-400" />
            )}
        </span>
    );
}

export default function Register({ termsVersion }) {
    const { t } = useTranslation();
    const [legalDoc, setLegalDoc] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const { data, setData, post, processing, errors, reset, transform } = useForm({
        role: 'owner',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        password: '',
        password_confirmation: '',
        terms: false,
    });

    const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email), [data.email]);
    const phoneValid = RWANDA_MOBILE_REGEX.test(data.phone);
    const network = getNetwork(data.phone);
    const passedRules = PASSWORD_RULES.filter((rule) => rule.test(data.password));
    const passwordValid = passedRules.length === PASSWORD_RULES.length;
    const strength = STRENGTH_LEVELS[data.password ? passedRules.length : 0];
    const passwordsMatch = data.password_confirmation !== '' && data.password === data.password_confirmation;
    const namesValid = data.first_name.trim() !== '' && data.last_name.trim() !== '';

    const emailStatus = useAvailability('email', data.email.toLowerCase(), emailValid);
    const phoneStatus = useAvailability('phone', `0${data.phone}`, phoneValid);
    const emailReady = emailValid && emailStatus !== 'taken' && emailStatus !== 'checking';
    const phoneReady = phoneValid && phoneStatus !== 'taken' && phoneStatus !== 'checking';

    const checks = [namesValid, emailReady, phoneReady, passwordValid, passwordsMatch, data.terms];
    const completed = checks.filter(Boolean).length;
    const progress = Math.round((completed / checks.length) * 100);
    const isFormValid = completed === checks.length;

    const submit = (e) => {
        e.preventDefault();
        if (!isFormValid) return;

        // The account stores the local 07XXXXXXXX form.
        transform((form) => ({ ...form, phone: `0${form.phone}` }));
        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    const labelClass = 'mb-1.5 block text-[13px] font-medium text-gray-700';
    const iconClass =
        'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-[#0E3B2E]';
    const inputClass =
        'w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-10 text-sm text-gray-800 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition placeholder:text-gray-400 focus:border-[#0E3B2E] focus:ring-4 focus:ring-[#0E3B2E]/10 disabled:opacity-60';

    return (
        <GuestLayout>
            <Head title={t('Register')} />

            <div className="rounded-[28px] bg-white p-6 shadow-[0_24px_70px_-30px_rgba(14,59,46,0.35)] ring-1 ring-black/[0.04] sm:p-9">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D9A441]">{t('Get started')}</p>
                        <h2 className="mt-1.5 font-[Sora] text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-gray-900">
                            {t('Create Account')}
                        </h2>
                        <p className="mt-1.5 text-sm text-gray-500">{t('Join ITUZE GREEN PLATFORM to manage your properties')}</p>
                    </div>
                    <div className="w-full sm:w-40" aria-live="polite">
                        <div className="flex items-center justify-between text-[11px] font-medium text-gray-500">
                            <span>{t('Progress')}</span>
                            <span className="text-[#0E3B2E]">{progress}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-[#1F7A5A] to-[#D9A441] transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>

                <form onSubmit={submit} className="mt-8 space-y-8" noValidate>
                    <section>
                        <SectionHeading number={1} title={t('Register as')} done />
                        <fieldset>
                            <legend className="sr-only">{t('Register as')}</legend>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {ACCOUNT_TYPES.map(({ value, label, description, Icon }) => {
                                    const selected = data.role === value;
                                    return (
                                        <label
                                            key={value}
                                            className={`relative flex cursor-pointer gap-3.5 rounded-2xl border p-4 transition-all has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#0E3B2E]/15 ${
                                                selected
                                                    ? 'border-[#0E3B2E] bg-gradient-to-br from-[#0E3B2E]/[0.06] to-[#D9A441]/[0.08] shadow-sm'
                                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="role"
                                                value={value}
                                                checked={selected}
                                                disabled={processing}
                                                onChange={() => setData('role', value)}
                                                className="sr-only"
                                            />
                                            <span
                                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                                                    selected ? 'bg-[#0E3B2E] text-[#F3D58F]' : 'bg-gray-100 text-gray-500'
                                                }`}
                                            >
                                                <Icon size={19} aria-hidden="true" />
                                            </span>
                                            <span className="pr-5">
                                                <span className="block text-sm font-semibold text-gray-900">{t(label)}</span>
                                                <span className="mt-0.5 block text-xs leading-5 text-gray-500">{t(description)}</span>
                                            </span>
                                            <span
                                                className={`absolute right-3.5 top-3.5 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                                                    selected ? 'border-[#0E3B2E] bg-[#0E3B2E] text-white' : 'border-gray-300'
                                                }`}
                                                aria-hidden="true"
                                            >
                                                {selected && <Check size={11} strokeWidth={3.5} />}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            <InputError message={errors.role} className="mt-1" />
                        </fieldset>
                    </section>

                    <section>
                        <SectionHeading number={2} title={t('Your details')} done={namesValid && emailReady && phoneReady} />
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="first_name" className={labelClass}>{t('First Name')}</label>
                                    <div className="group relative">
                                        <User size={18} className={iconClass} />
                                        <input
                                            id="first_name"
                                            name="first_name"
                                            value={data.first_name}
                                            autoComplete="given-name"
                                            autoFocus
                                            placeholder="Jean"
                                            onChange={(e) => setData('first_name', e.target.value)}
                                            className={inputClass}
                                            required
                                        />
                                        <FieldStatus show={data.first_name.trim() !== ''} valid />
                                    </div>
                                    <InputError message={errors.first_name} className="mt-1" />
                                </div>
                                <div>
                                    <label htmlFor="last_name" className={labelClass}>{t('Last Name')}</label>
                                    <div className="group relative">
                                        <User size={18} className={iconClass} />
                                        <input
                                            id="last_name"
                                            name="last_name"
                                            value={data.last_name}
                                            autoComplete="family-name"
                                            placeholder="Uwimana"
                                            onChange={(e) => setData('last_name', e.target.value)}
                                            className={inputClass}
                                            required
                                        />
                                        <FieldStatus show={data.last_name.trim() !== ''} valid />
                                    </div>
                                    <InputError message={errors.last_name} className="mt-1" />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="email" className={labelClass}>{t('Email')}</label>
                                <div className="group relative">
                                    <Mail size={18} className={iconClass} />
                                    <input
                                        id="email"
                                        type="email"
                                        name="email"
                                        value={data.email}
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        onChange={(e) => setData('email', e.target.value.trim())}
                                        className={`${inputClass} ${
                                            emailStatus === 'taken' ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''
                                        }`}
                                        aria-invalid={emailStatus === 'taken' || (data.email !== '' && !emailValid)}
                                        aria-describedby="email-help"
                                        required
                                    />
                                    <FieldStatus
                                        show={data.email !== ''}
                                        valid={emailValid && emailStatus !== 'taken'}
                                        checking={emailStatus === 'checking'}
                                    />
                                </div>
                                <p id="email-help" className="mt-1 text-xs" aria-live="polite">
                                    {data.email !== '' && !emailValid ? (
                                        <span className="text-red-500">{t('Enter a valid email address')}</span>
                                    ) : emailStatus === 'taken' ? (
                                        <TakenNotice message={t('This email is already registered.')} />
                                    ) : (
                                        <span className="text-gray-400">{t('We will send a verification code here.')}</span>
                                    )}
                                </p>
                                <InputError message={errors.email} className="mt-1" />
                            </div>

                            <div>
                                <label htmlFor="phone" className={labelClass}>{t('WhatsApp number')}</label>
                                <div
                                    className={`flex items-stretch overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition focus-within:ring-4 ${
                                        (data.phone !== '' && !phoneValid) || phoneStatus === 'taken'
                                            ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-100'
                                            : 'border-gray-200 focus-within:border-[#0E3B2E] focus-within:ring-[#0E3B2E]/10'
                                    }`}
                                >
                                    <span className="flex select-none items-center gap-2 border-r border-gray-200 bg-gray-50 px-3.5 text-sm font-semibold text-gray-700">
                                        <RwandaFlag className="h-[15px] w-[22px]" />
                                        +250
                                    </span>
                                    <div className="relative flex-1">
                                        <input
                                            id="phone"
                                            type="tel"
                                            name="phone"
                                            inputMode="numeric"
                                            value={formatPhone(data.phone)}
                                            placeholder="788 123 456"
                                            autoComplete="tel-national"
                                            onChange={(e) => setData('phone', toLocalDigits(e.target.value))}
                                            className="w-full border-0 bg-transparent py-3 pl-3.5 pr-10 text-sm tracking-wide text-gray-800 placeholder:tracking-normal placeholder:text-gray-400 focus:ring-0"
                                            aria-describedby="phone-help"
                                            aria-invalid={phoneStatus === 'taken' || (data.phone !== '' && !phoneValid)}
                                            required
                                        />
                                        <FieldStatus
                                            show={data.phone !== ''}
                                            valid={phoneValid && phoneStatus !== 'taken'}
                                            checking={phoneStatus === 'checking'}
                                        />
                                    </div>
                                </div>
                                <p id="phone-help" className="mt-1 text-xs" aria-live="polite">
                                    {phoneStatus === 'taken' ? (
                                        <TakenNotice message={t('This phone number is already registered.')} />
                                    ) : data.phone !== '' && phoneValid && network ? (
                                        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600">
                                            <span
                                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                                    network === 'MTN' ? 'bg-[#FFCC00] text-[#1d1d1b]' : 'bg-[#E40000] text-white'
                                                }`}
                                            >
                                                {network}
                                            </span>
                                            {t(':network number detected', { network })}
                                        </span>
                                    ) : data.phone !== '' && !phoneValid ? (
                                        <span className="text-red-500">{t('Enter the 9 digits after +250, starting with 72, 73, 78 or 79.')}</span>
                                    ) : (
                                        <span className="text-gray-400">{t('Your verification code arrives on WhatsApp.')}</span>
                                    )}
                                </p>
                                <InputError message={errors.phone} className="mt-1" />
                            </div>
                        </div>
                    </section>

                    <section>
                        <SectionHeading number={3} title={t('Secure your account')} done={passwordValid && passwordsMatch} />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="password" className={labelClass}>{t('Password')}</label>
                                <div className="group relative">
                                    <Lock size={18} className={iconClass} />
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={data.password}
                                        autoComplete="new-password"
                                        placeholder="••••••••••"
                                        onChange={(e) => setData('password', e.target.value)}
                                        className={inputClass}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                                        aria-label={showPassword ? t('Hide password') : t('Show password')}
                                    >
                                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                    </button>
                                </div>
                                <InputError message={errors.password} className="mt-1" />
                            </div>
                            <div>
                                <label htmlFor="password_confirmation" className={labelClass}>{t('Confirm Password')}</label>
                                <div className="group relative">
                                    <Lock size={18} className={iconClass} />
                                    <input
                                        id="password_confirmation"
                                        type={showConfirmation ? 'text' : 'password'}
                                        name="password_confirmation"
                                        value={data.password_confirmation}
                                        autoComplete="new-password"
                                        placeholder="••••••••••"
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        className={`${inputClass} ${
                                            data.password_confirmation !== '' && !passwordsMatch
                                                ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                                : ''
                                        }`}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmation((v) => !v)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                                        aria-label={showConfirmation ? t('Hide password') : t('Show password')}
                                    >
                                        {showConfirmation ? <EyeOff size={17} /> : <Eye size={17} />}
                                    </button>
                                </div>
                                {data.password_confirmation !== '' && !passwordsMatch && (
                                    <p className="mt-1 text-xs text-red-500">{t('Passwords do not match')}</p>
                                )}
                                <InputError message={errors.password_confirmation} className="mt-1" />
                            </div>
                        </div>

                        <div className="mt-4 rounded-2xl bg-gray-50 p-4 ring-1 ring-inset ring-gray-100">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-gray-600">{t('Password strength')}</span>
                                <span className={`font-semibold ${strength.text}`}>{strength.label ? t(strength.label) : '—'}</span>
                            </div>
                            <div className="mt-2 grid grid-cols-4 gap-1.5">
                                {PASSWORD_RULES.map((rule, index) => (
                                    <span
                                        key={rule.label}
                                        className={`h-1.5 rounded-full transition-colors duration-300 ${
                                            data.password && index < passedRules.length ? strength.color : 'bg-gray-200'
                                        }`}
                                    />
                                ))}
                            </div>
                            <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                                {PASSWORD_RULES.map((rule) => {
                                    const met = rule.test(data.password);
                                    return (
                                        <li key={rule.label} className={`flex items-center gap-2 text-xs transition-colors ${met ? 'text-emerald-700' : 'text-gray-500'}`}>
                                            <span
                                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors ${
                                                    met ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-transparent'
                                                }`}
                                            >
                                                <Check size={10} strokeWidth={3.5} />
                                            </span>
                                            {t(rule.label)}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </section>

                    <div>
                        <label
                            htmlFor="terms"
                            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${
                                data.terms ? 'border-[#0E3B2E]/30 bg-[#0E3B2E]/[0.03]' : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <input
                                id="terms"
                                type="checkbox"
                                name="terms"
                                checked={data.terms}
                                disabled={processing}
                                onChange={(e) => setData('terms', e.target.checked)}
                                aria-describedby="terms-error"
                                className="mt-0.5 h-[18px] w-[18px] shrink-0 rounded-md border-gray-300 text-[#0E3B2E] focus:ring-[#0E3B2E]/30"
                            />
                            <span className="text-xs leading-5 text-gray-600">
                                {t('I have read and agree to the')}{' '}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setLegalDoc('terms');
                                    }}
                                    className="font-semibold text-[#0E3B2E] underline decoration-[#D9A441] decoration-2 underline-offset-2 hover:text-[#1F7A5A]"
                                >
                                    {t('Terms and Conditions')}
                                </button>{' '}
                                {t('and the')}{' '}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setLegalDoc('privacy');
                                    }}
                                    className="font-semibold text-[#0E3B2E] underline decoration-[#D9A441] decoration-2 underline-offset-2 hover:text-[#1F7A5A]"
                                >
                                    {t('Privacy Policy')}
                                </button>
                                {termsVersion && <span className="text-gray-400"> ({t('version')} {termsVersion})</span>}.
                            </span>
                        </label>
                        <div id="terms-error" aria-live="polite">
                            <InputError message={errors.terms} className="mt-1" />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={!isFormValid || processing}
                            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#0E3B2E] py-4 text-sm font-semibold tracking-wide text-white shadow-[0_12px_30px_-12px_rgba(14,59,46,0.7)] transition-all hover:bg-[#124B3A] hover:shadow-[0_16px_36px_-12px_rgba(14,59,46,0.8)] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
                        >
                            {processing ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    {t('CREATING ACCOUNT...')}
                                </>
                            ) : (
                                <>
                                    {t('Create my account')}
                                    <ArrowRight size={18} className="text-[#F3D58F] transition-transform group-enabled:group-hover:translate-x-1" />
                                </>
                            )}
                        </button>
                        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-gray-400">
                            {isFormValid ? (
                                <>
                                    <ShieldCheck size={14} className="text-emerald-500" />
                                    {t('Next, we will send verification codes to your email and WhatsApp.')}
                                </>
                            ) : (
                                t('Fill in all fields correctly to continue')
                            )}
                        </p>
                    </div>
                </form>
            </div>

            {legalDoc && (
                <LegalModal
                    document={legalDoc}
                    onClose={() => setLegalDoc(null)}
                    onAgree={() => {
                        setData('terms', true);
                        setLegalDoc(null);
                    }}
                />
            )}
        </GuestLayout>
    );
}
