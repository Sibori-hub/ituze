import InputError from '@/Components/InputError';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/localization';

export default function Login({ status, canResetPassword }) {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const [loginStage, setLoginStage] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        let t1, t2;
        if (processing) {
            setLoginStage(t('Checking credentials...'));
            t1 = setTimeout(() => {
                setLoginStage(t('Authenticating session...'));
            }, 700);
            t2 = setTimeout(() => {
                setLoginStage(t('Redirecting to dashboard...'));
            }, 1500);
        } else {
            setLoginStage('');
        }
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [processing]);

    const submit = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout>
            <Head title={t('Log in')} />

            <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0e3b2e]/60">
                    {t('Secure sign in')}
                </p>
                <h2 className="mt-3 font-[Sora] text-3xl font-semibold tracking-tight text-[#17241f]">
                    {t('Welcome back')}
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                    {t('Log in to continue')}
                </p>
            </div>

            {status && (
                <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-800" role="status">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="mt-8 space-y-5">
                {processing && (
                    <div className="relative h-1 w-full overflow-hidden rounded-full bg-[#0e3b2e]/10" aria-hidden="true">
                        <div className="h-full w-full animate-pulse bg-gradient-to-r from-[#0e3b2e] via-[#d9a441] to-[#0e3b2e]" />
                    </div>
                )}

                <div>
                    <label
                        htmlFor="email"
                        className="mb-2 block text-sm font-semibold text-[#26352e]"
                    >
                        {t('Email')}
                    </label>
                    <div className="relative">
                        <Mail
                            size={17}
                            aria-hidden="true"
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                            id="email"
                            type="email"
                            name="email"
                            value={data.email}
                            autoComplete="username"
                            autoFocus
                            disabled={processing}
                            onChange={(e) => setData('email', e.target.value)}
                            aria-invalid={Boolean(errors.email)}
                            aria-describedby={errors.email ? 'email-error' : undefined}
                            placeholder={t('name@example.com')}
                            className="h-13 w-full rounded-xl border border-[#dce4df] bg-[#fbfcfb] py-3 pl-11 pr-4 text-sm text-[#17241f] shadow-sm shadow-black/[0.02] outline-none transition placeholder:text-gray-400 hover:border-[#b8c9be] focus:border-[#0e3b2e] focus:ring-4 focus:ring-[#0e3b2e]/10 disabled:bg-gray-50 disabled:text-gray-500"
                            required
                        />
                    </div>
                    <div id="email-error" aria-live="polite">
                        <InputError message={errors.email} className="mt-1.5" />
                    </div>
                </div>

                <div>
                    <label
                        htmlFor="password"
                        className="mb-2 block text-sm font-semibold text-[#26352e]"
                    >
                        {t('Password')}
                    </label>
                    <div className="relative">
                        <Lock
                            size={17}
                            aria-hidden="true"
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            value={data.password}
                            autoComplete="current-password"
                            disabled={processing}
                            onChange={(e) =>
                                setData('password', e.target.value)
                            }
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={errors.password ? 'password-error' : undefined}
                            className="h-13 w-full rounded-xl border border-[#dce4df] bg-[#fbfcfb] py-3 pl-11 pr-12 text-sm text-[#17241f] shadow-sm shadow-black/[0.02] outline-none transition placeholder:text-gray-400 hover:border-[#b8c9be] focus:border-[#0e3b2e] focus:ring-4 focus:ring-[#0e3b2e]/10 disabled:bg-gray-50 disabled:text-gray-500"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(value => !value)}
                            disabled={processing}
                            aria-label={showPassword ? t('Hide password') : t('Show password')}
                            aria-pressed={showPassword}
                            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:bg-[#0e3b2e]/5 hover:text-[#0e3b2e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0e3b2e] disabled:cursor-not-allowed"
                        >
                            {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                        </button>
                    </div>
                    <div id="password-error" aria-live="polite">
                        <InputError message={errors.password} className="mt-1.5" />
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-600">
                        <input
                            type="checkbox"
                            name="remember"
                            checked={data.remember}
                            disabled={processing}
                            onChange={(e) =>
                                setData('remember', e.target.checked)
                            }
                            className="h-4 w-4 rounded border-gray-300 text-[#0e3b2e] focus:ring-[#0e3b2e]/30"
                        />
                        {t('Remember me')}
                    </label>

                    {canResetPassword && (
                        <Link
                            href={route('password.request')}
                            className="text-sm font-semibold text-[#0e3b2e] decoration-[#d9a441] underline-offset-4 transition hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e3b2e]"
                        >
                            {t('Forgot password?')}
                        </Link>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={processing}
                    className="group flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-[#0e3b2e] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#0e3b2e]/15 transition duration-200 hover:-translate-y-0.5 hover:bg-[#0a2e23] hover:shadow-xl hover:shadow-[#0e3b2e]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e3b2e] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-75"
                >
                    {processing ? (
                        <>
                            <Loader2 size={18} className="animate-spin text-[#e7c77d]" aria-hidden="true" />
                            <span>{loginStage || t('Signing you in...')}</span>
                        </>
                    ) : (
                        <>
                            <span>{t('Sign in')}</span>
                            <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </>
                    )}
                </button>

                <p className="pt-1 text-center text-sm text-gray-500">
                    {t("Don't have an account?")}{' '}
                    <Link
                        href={route('register')}
                        className="font-semibold text-[#0e3b2e] decoration-[#d9a441] underline-offset-4 transition hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e3b2e]"
                    >
                        {t('Create account')}
                    </Link>
                </p>
            </form>
        </GuestLayout>
    );
}