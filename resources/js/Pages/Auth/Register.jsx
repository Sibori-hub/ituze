import InputError from '@/Components/InputError';
import LegalModal from '@/Components/LegalModal';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { User, Mail, Phone, Lock, Check, X, Building2, Megaphone } from 'lucide-react';
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

function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const levels = [
        { label: '', width: '0%', color: 'bg-gray-200' },
        { label: 'Very weak', width: '25%', color: 'bg-red-400' },
        { label: 'Weak', width: '50%', color: 'bg-orange-400' },
        { label: 'Good', width: '75%', color: 'bg-yellow-400' },
        { label: 'Strong', width: '100%', color: 'bg-green-500' },
    ];

    return levels[score];
}

// Rwanda mobile prefixes: 078/079 = MTN, 072/073 = Airtel.
const RWANDA_PHONE_REGEX = /^(078|079|072|073)\d{7}$/;

function getNetwork(phone) {
    if (phone.startsWith('078') || phone.startsWith('079')) return 'MTN';
    if (phone.startsWith('072') || phone.startsWith('073')) return 'Airtel';
    return null;
}

export default function Register({ termsVersion }) {
    const { t } = useTranslation();
    const [legalDoc, setLegalDoc] = useState(null);
    const { data, setData, post, processing, errors, reset } = useForm({
        role: 'owner',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        password: '',
        password_confirmation: '',
        terms: false,
    });

    const strength = useMemo(
        () => getPasswordStrength(data.password),
        [data.password],
    );

    const emailValid = useMemo(
        () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email),
        [data.email],
    );

    const phoneValid = useMemo(
        () => RWANDA_PHONE_REGEX.test(data.phone),
        [data.phone],
    );

    const network = useMemo(() => getNetwork(data.phone), [data.phone]);

    const passwordStrongEnough = data.password.length >= 10;

    const passwordsMatch =
        data.password_confirmation !== '' &&
        data.password === data.password_confirmation;

    const isFormValid =
        data.first_name.trim() !== '' &&
        data.last_name.trim() !== '' &&
        emailValid &&
        phoneValid &&
        passwordStrongEnough &&
        passwordsMatch &&
        data.terms;

    const submit = (e) => {
        e.preventDefault();
        if (!isFormValid) return;
        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    const inputWrap = 'group relative';
    const inputIcon =
        'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-[#0E3B2E]';
    const inputBase =
        'w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 pl-11 pr-3 text-sm text-gray-800 transition-all placeholder:text-gray-400 focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15';

    return (
        <GuestLayout>
            <Head title={t('Register')} />

            <div className="pt-5 text-center">
                <h2 className="font-[Sora] text-2xl font-bold text-gray-800">
                    {t('Create Account')}
                </h2>
                <p className="mt-1.5 text-sm text-gray-500">
                    {t('Join ITUZE GREEN PLATFORM to manage your properties')}
                </p>
            </div>

            <form onSubmit={submit} className="mt-7 space-y-5">
                <fieldset>
                    <legend className="mb-2 block text-sm font-medium text-gray-700">
                        {t('Register as')}
                    </legend>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {ACCOUNT_TYPES.map(({ value, label, description, Icon }) => {
                            const selected = data.role === value;
                            return (
                                <label
                                    key={value}
                                    className={`relative flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-all ${
                                        selected
                                            ? 'border-[#0E3B2E] bg-[#0E3B2E]/[0.04] ring-2 ring-[#0E3B2E]/15'
                                            : 'border-gray-200 bg-gray-50/50 hover:border-gray-300'
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
                                    <Icon
                                        size={20}
                                        className={`mt-0.5 shrink-0 ${selected ? 'text-[#0E3B2E]' : 'text-gray-400'}`}
                                        aria-hidden="true"
                                    />
                                    <span>
                                        <span className="block text-sm font-semibold text-gray-800">
                                            {t(label)}
                                        </span>
                                        <span className="mt-0.5 block text-xs leading-5 text-gray-500">
                                            {t(description)}
                                        </span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                    <InputError message={errors.role} className="mt-1" />
                </fieldset>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label
                            htmlFor="first_name"
                            className="mb-1.5 block text-sm font-medium text-gray-700"
                        >
                            {t('First Name')}
                        </label>
                        <div className={inputWrap}>
                            <User size={18} className={inputIcon} />
                            <input
                                id="first_name"
                                name="first_name"
                                value={data.first_name}
                                autoComplete="given-name"
                                autoFocus
                                placeholder="Jean"
                                onChange={(e) =>
                                    setData('first_name', e.target.value)
                                }
                                className={inputBase}
                                required
                            />
                        </div>
                        <InputError
                            message={errors.first_name}
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="last_name"
                            className="mb-1.5 block text-sm font-medium text-gray-700"
                        >
                            {t('Last Name')}
                        </label>
                        <div className={inputWrap}>
                            <User size={18} className={inputIcon} />
                            <input
                                id="last_name"
                                name="last_name"
                                value={data.last_name}
                                autoComplete="family-name"
                                placeholder="Sibomana"
                                onChange={(e) =>
                                    setData('last_name', e.target.value)
                                }
                                className={inputBase}
                                required
                            />
                        </div>
                        <InputError
                            message={errors.last_name}
                            className="mt-1"
                        />
                    </div>
                </div>

                <div>
                    <label
                        htmlFor="email"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                        {t('Email')}
                    </label>
                    <div className={inputWrap}>
                        <Mail size={18} className={inputIcon} />
                        <input
                            id="email"
                            type="email"
                            name="email"
                            value={data.email}
                            autoComplete="username"
                            placeholder="you@example.com"
                            onChange={(e) => setData('email', e.target.value)}
                            className={`${inputBase} pr-9`}
                            required
                        />
                        {data.email !== '' && (
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                                {emailValid ? (
                                    <Check
                                        size={16}
                                        className="text-green-500"
                                    />
                                ) : (
                                    <X size={16} className="text-red-400" />
                                )}
                            </span>
                        )}
                    </div>
                    {data.email !== '' && !emailValid && (
                        <p className="mt-1 text-xs text-red-500">
                            {t('Enter a valid email address')}
                        </p>
                    )}
                    <InputError message={errors.email} className="mt-1" />
                </div>

                <div>
                    <label
                        htmlFor="phone"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                        {t('Phone Number')}
                    </label>
                    <div className={inputWrap}>
                        <Phone size={18} className={inputIcon} />
                        <input
                            id="phone"
                            type="tel"
                            name="phone"
                            value={data.phone}
                            placeholder="078XXXXXXX"
                            autoComplete="tel"
                            maxLength={10}
                            onChange={(e) =>
                                setData(
                                    'phone',
                                    e.target.value.replace(/\D/g, ''),
                                )
                            }
                            className={`${inputBase} pr-9`}
                            required
                        />
                        {data.phone !== '' && (
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                                {phoneValid ? (
                                    <Check
                                        size={16}
                                        className="text-green-500"
                                    />
                                ) : (
                                    <X size={16} className="text-red-400" />
                                )}
                            </span>
                        )}
                    </div>
                    {data.phone !== '' && phoneValid && network && (
                        <p className="mt-1 text-xs font-medium text-green-600">
                            {t(':network number detected', { network })}
                        </p>
                    )}
                    {data.phone !== '' && !phoneValid && (
                        <p className="mt-1 text-xs text-red-500">
                            {t('Enter a valid 10-digit Rwanda mobile number (072, 073, 078, or 079)')}
                        </p>
                    )}
                    <InputError message={errors.phone} className="mt-1" />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <label
                            htmlFor="password"
                            className="mb-1.5 block text-sm font-medium text-gray-700"
                        >
                            {t('Password')}
                        </label>
                        <div className={inputWrap}>
                            <Lock size={19} className={inputIcon} />
                            <input
                                id="password"
                                type="password"
                                name="password"
                                value={data.password}
                                autoComplete="new-password"
                                placeholder="••••••••"
                                onChange={(e) =>
                                    setData('password', e.target.value)
                                }
                                className={`${inputBase} py-3.5 text-base`}
                                required
                            />
                        </div>
                        <InputError
                            message={errors.password}
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="password_confirmation"
                            className="mb-1.5 block text-sm font-medium text-gray-700"
                        >
                            {t('Confirm Password')}
                        </label>
                        <div className={inputWrap}>
                            <Lock size={19} className={inputIcon} />
                            <input
                                id="password_confirmation"
                                type="password"
                                name="password_confirmation"
                                value={data.password_confirmation}
                                autoComplete="new-password"
                                placeholder="••••••••"
                                onChange={(e) =>
                                    setData(
                                        'password_confirmation',
                                        e.target.value,
                                    )
                                }
                                className={`${inputBase} py-3.5 text-base ${
                                    data.password_confirmation !== '' &&
                                    !passwordsMatch
                                        ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                                        : ''
                                }`}
                                required
                            />
                        </div>
                        {data.password_confirmation !== '' &&
                            !passwordsMatch && (
                                <p className="mt-1 text-xs text-red-500">
                                    {t('Passwords do not match')}
                                </p>
                            )}
                        <InputError
                            message={errors.password_confirmation}
                            className="mt-1"
                        />
                    </div>
                </div>

                {data.password !== '' && (
                    <div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{t('Password strength')}</span>
                            <span className="font-medium">
                                {t(strength.label)}
                            </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                                style={{ width: strength.width }}
                            />
                        </div>
                        <p className="mt-1.5 text-xs text-gray-400">
                            {t('Use at least 10 characters with upper/lowercase letters, numbers, and symbols.')}
                        </p>
                    </div>
                )}

                <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 transition-colors hover:border-gray-300">
                    <input
                        id="terms"
                        type="checkbox"
                        name="terms"
                        checked={data.terms}
                        disabled={processing}
                        onChange={(e) => setData('terms', e.target.checked)}
                        aria-describedby="terms-error"
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-[#0E3B2E] focus:ring-[#0E3B2E]/30"
                    />
                    <span className="text-xs leading-5 text-gray-600">
                        <label htmlFor="terms" className="cursor-pointer">
                            {t('I have read and agree to the')}
                        </label>{' '}
                        <button
                            type="button"
                            onClick={() => setLegalDoc('terms')}
                            className="font-semibold text-[#0E3B2E] underline decoration-[#D9A441] underline-offset-2"
                        >
                            {t('Terms and Conditions')}
                        </button>{' '}
                        <label htmlFor="terms" className="cursor-pointer">
                            {t('and the')}
                        </label>{' '}
                        <button
                            type="button"
                            onClick={() => setLegalDoc('privacy')}
                            className="font-semibold text-[#0E3B2E] underline decoration-[#D9A441] underline-offset-2"
                        >
                            {t('Privacy Policy')}
                        </button>
                        {termsVersion && (
                            <span className="text-gray-400"> ({t('version')} {termsVersion})</span>
                        )}
                        .
                    </span>
                </div>
                <div id="terms-error" aria-live="polite">
                    <InputError message={errors.terms} className="mt-1" />
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={!isFormValid || processing}
                        className="w-full rounded-xl bg-[#D9A441] py-3.5 text-sm font-semibold tracking-wide text-[#0E3B2E] shadow-sm transition-all hover:bg-[#c9962f] hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
                    >
                        {processing ? t('CREATING ACCOUNT...') : t('REGISTER')}
                    </button>
                    {!isFormValid && (
                        <p className="mt-2 text-center text-xs text-gray-400">
                            {t('Fill in all fields correctly to continue')}
                        </p>
                    )}
                </div>

                <p className="text-center text-sm text-gray-500">
                    {t('Already have an account?')}{' '}
                    <Link
                        href={route('login')}
                        className="font-medium text-[#0E3B2E] hover:underline"
                    >
                        {t('Login')}
                    </Link>
                </p>
            </form>

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