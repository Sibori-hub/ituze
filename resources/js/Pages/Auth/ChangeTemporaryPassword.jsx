import InputError from '@/Components/InputError';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Check, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/localization';

// Mirrors Password::defaults() in AppServiceProvider.
const PASSWORD_RULES = [
    { label: 'At least 10 characters', test: (p) => p.length >= 10 },
    { label: 'Upper and lowercase letters', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
    { label: 'A number', test: (p) => /\d/.test(p) },
    { label: 'A symbol', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const fieldClass =
    'w-full rounded-xl border-gray-300 bg-white py-3 pl-3.5 pr-12 text-sm text-gray-900 focus:border-[#0E3B2E] focus:ring-4 focus:ring-[#0E3B2E]/15';

function PasswordInput({ id, label, value, onChange, error, autoComplete, describedBy }) {
    const { t } = useTranslation();
    const [show, setShow] = useState(false);

    return (
        <div>
            <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-gray-800">{label}</label>
            <div className="relative">
                <input
                    id={id}
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    autoComplete={autoComplete}
                    aria-invalid={Boolean(error) || undefined}
                    aria-describedby={describedBy}
                    className={`${fieldClass} ${error ? 'border-red-600 focus:border-red-600 focus:ring-red-100' : ''}`}
                />
                <button
                    type="button"
                    onClick={() => setShow((visible) => !visible)}
                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E3B2E]"
                    aria-label={show ? t('Hide password') : t('Show password')}
                >
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
            </div>
            <InputError message={error} className="mt-1" />
        </div>
    );
}

/**
 * First sign-in for an account an administrator created: replace the
 * temporary password before anything else.
 */
export default function ChangeTemporaryPassword() {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors, reset } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const checks = PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.test(data.password) }));
    const strong = checks.every((rule) => rule.met);
    const matches = data.password !== '' && data.password === data.password_confirmation;
    const canSubmit = data.current_password !== '' && strong && matches;

    const submit = (e) => {
        e.preventDefault();
        if (!canSubmit || processing) return;
        post(route('password.change.update'), { onFinish: () => reset('current_password', 'password', 'password_confirmation') });
    };

    return (
        <GuestLayout>
            <Head title={t('Choose your password')} />

            <div className="pt-5 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-[#0E3B2E] ring-1 ring-emerald-200" aria-hidden="true">
                    <KeyRound size={24} />
                </span>
                <h1 className="mt-4 font-[Sora] text-2xl font-bold text-gray-900">{t('Choose your password')}</h1>
                <p className="mt-2 text-[15px] leading-6 text-gray-700">
                    {t('ITUZE GREEN PLATFORM gave you a temporary password. Replace it with one only you know.')}
                </p>
            </div>

            <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
                <PasswordInput
                    id="current_password"
                    label={t('Temporary password')}
                    value={data.current_password}
                    onChange={(value) => setData('current_password', value)}
                    error={errors.current_password}
                    autoComplete="current-password"
                />
                <PasswordInput
                    id="password"
                    label={t('New password')}
                    value={data.password}
                    onChange={(value) => setData('password', value)}
                    error={errors.password}
                    autoComplete="new-password"
                    describedBy="new-password-rules"
                />
                <ul id="new-password-rules" className="grid gap-1.5 sm:grid-cols-2">
                    {checks.map((rule) => (
                        <li key={rule.label} className={`flex items-center gap-2 text-sm ${rule.met ? 'text-emerald-800' : 'text-gray-600'}`}>
                            <span className={`flex h-4 w-4 items-center justify-center rounded-full ${rule.met ? 'bg-emerald-600 text-white' : 'bg-gray-200'}`} aria-hidden="true">
                                {rule.met && <Check size={10} strokeWidth={3.5} />}
                            </span>
                            {t(rule.label)}
                            <span className="sr-only">{rule.met ? t('completed') : ''}</span>
                        </li>
                    ))}
                </ul>
                <PasswordInput
                    id="password_confirmation"
                    label={t('Confirm Password')}
                    value={data.password_confirmation}
                    onChange={(value) => setData('password_confirmation', value)}
                    error={data.password_confirmation !== '' && !matches ? t('Passwords do not match') : null}
                    autoComplete="new-password"
                />

                <button
                    type="submit"
                    disabled={!canSubmit || processing}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-4 text-base font-semibold text-white hover:bg-[#124B3A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E3B2E] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-600"
                >
                    {processing && <Loader2 size={18} className="motion-safe:animate-spin" aria-hidden="true" />}
                    {processing ? t('Saving...') : t('Save my password')}
                </button>

                <p className="text-center text-sm">
                    <Link href={route('logout')} method="post" as="button" className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-gray-700 underline underline-offset-4 hover:text-gray-900">
                        {t('Log Out')}
                    </Link>
                </p>
            </form>
        </GuestLayout>
    );
}
