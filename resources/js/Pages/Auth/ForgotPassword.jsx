import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import RwandaPhoneInput, { isRwandaMobile } from '@/Components/RwandaPhoneInput';
import StrongPasswordFields, { passwordReady } from '@/Components/StrongPasswordFields';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Mail, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/localization';

function EmailReset() {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors } = useForm({ email: '' });

    const submit = (e) => {
        e.preventDefault();
        post(route('password.email'));
    };

    return (
        <form onSubmit={submit} noValidate>
            <p className="mb-4 text-sm text-gray-600">
                {t('Forgot your password? No problem. Just let us know your email address and we will email you a password reset link that will allow you to choose a new one.')}
            </p>
            <InputLabel htmlFor="email" value={t('Email')} />
            <TextInput
                id="email"
                type="email"
                name="email"
                value={data.email}
                className="mt-1 block w-full"
                autoComplete="email"
                isFocused={true}
                onChange={(e) => setData('email', e.target.value)}
                aria-describedby={errors.email ? 'email-error' : undefined}
            />
            <InputError id="email-error" message={errors.email ? t(errors.email) : null} className="mt-2" />

            <div className="mt-4 flex items-center justify-end">
                <PrimaryButton disabled={processing}>{t('Email Password Reset Link')}</PrimaryButton>
            </div>
        </form>
    );
}

function PhoneSendCode() {
    const { t } = useTranslation();
    // The 9 digits after +250, as on the sign-up page.
    const { data, setData, post, processing, errors, transform } = useForm({ phone: '' });

    const submit = (e) => {
        e.preventDefault();
        transform((form) => ({ phone: `0${form.phone}` }));
        post(route('password.phone.send'), { preserveScroll: true });
    };

    return (
        <form onSubmit={submit} noValidate>
            <p className="mb-4 text-sm text-gray-600">
                {t('Type the phone number on your account. We will send you a 6-digit code by SMS to choose a new password.')}
            </p>
            <label htmlFor="phone" className="mb-1.5 block text-[13px] font-medium text-gray-700">{t('Phone number (SMS)')}</label>
            <RwandaPhoneInput id="phone" value={data.phone} onChange={(digits) => setData('phone', digits)} error={errors.phone} autoFocus />

            <div className="mt-4 flex items-center justify-end">
                <PrimaryButton disabled={processing || !isRwandaMobile(data.phone)}>{t('Send code by SMS')}</PrimaryButton>
            </div>
        </form>
    );
}

function StartAgainButton() {
    const { t } = useTranslation();

    return (
        <button
            type="button"
            onClick={() => router.delete(route('password.phone.cancel'), { preserveScroll: true })}
            className="rounded-md text-sm text-gray-600 underline hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E] focus-visible:ring-offset-2"
        >
            {t('Use another number or send a new code')}
        </button>
    );
}

/** Step 2: only the code. The new-password boxes appear after the code is confirmed. */
function PhoneEnterCode({ phoneReset }) {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors } = useForm({ otp: '' });

    const submit = (e) => {
        e.preventDefault();
        post(route('password.phone.verify'), { preserveScroll: true, preserveState: true, onError: () => setData('otp', '') });
    };

    return (
        <form onSubmit={submit} noValidate>
            <p className="mb-4 text-sm text-gray-600">
                {t('Enter the 6-digit code we sent by SMS to :phone.', { phone: phoneReset.phone })}
            </p>

            <InputLabel htmlFor="otp" value={t('Code from the SMS')} />
            <TextInput
                id="otp"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={data.otp}
                className="mt-1 block w-full text-center text-lg tracking-[0.4em]"
                isFocused={true}
                onChange={(e) => setData('otp', e.target.value.replace(/\D/g, '').slice(0, 6))}
                aria-describedby={errors.otp ? 'otp-error' : undefined}
            />
            <InputError id="otp-error" message={errors.otp ? t(errors.otp) : null} className="mt-2" role="alert" />

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <StartAgainButton />
                <PrimaryButton disabled={processing || data.otp.length !== 6}>{t('Check code')}</PrimaryButton>
            </div>
        </form>
    );
}

/** Step 3: reached only after a correct code. */
function PhoneChoosePassword() {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors, reset } = useForm({
        password: '',
        password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('password.phone.reset'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <form onSubmit={submit} noValidate>
            <StrongPasswordFields
                password={data.password}
                confirmation={data.password_confirmation}
                onPasswordChange={(value) => setData('password', value)}
                onConfirmationChange={(value) => setData('password_confirmation', value)}
                errors={errors}
                autoFocus
            />

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <StartAgainButton />
                <PrimaryButton disabled={processing || !passwordReady(data.password, data.password_confirmation)}>{t('Save new password')}</PrimaryButton>
            </div>
        </form>
    );
}

export default function ForgotPassword({ status, phoneReset }) {
    const { t } = useTranslation();
    const [method, setMethod] = useState(phoneReset ? 'phone' : 'email');

    const methods = [
        { value: 'email', label: t('By email'), Icon: Mail },
        { value: 'phone', label: t('By SMS'), Icon: Smartphone },
    ];

    return (
        <GuestLayout>
            <Head title={t('Forgot Password')} />

            <h1 className="mb-4 font-[Sora] text-xl font-bold text-gray-900">{t('Forgot Password')}</h1>

            <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label={t('How do you want to reset your password?')}>
                {methods.map(({ value, label, Icon }) => {
                    const selected = method === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setMethod(value)}
                            className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E] ${
                                selected ? 'bg-white text-[#0E3B2E] shadow-sm' : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            <Icon size={16} aria-hidden="true" />
                            {label}
                        </button>
                    );
                })}
            </div>

            {status && (
                <div role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
                    {t(status)}
                </div>
            )}

            {method === 'email' ? <EmailReset /> : !phoneReset ? <PhoneSendCode /> : phoneReset.verified ? <PhoneChoosePassword /> : <PhoneEnterCode phoneReset={phoneReset} />}
        </GuestLayout>
    );
}
