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

    const [showPassword, setShowPassword] = useState(false);

    const submit = (e) => {
        e.preventDefault();
        post(route('login'), {
            preserveState: true,
            preserveScroll: true,
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout>
            <Head title={t('Log in')} />

            <div className="mb-8 text-center md:text-left">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#0a6da5]">
                    {t('Welcome back')}
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-900">
                    {t('Sign in')}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                    {t('Log in to continue')}
                </p>
            </div>

            {status && (
                <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-800" role="status">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-5">
                <div>
                    <label
                        htmlFor="email"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                        {t('Email')}
                    </label>
                    <div className="relative">
                        <Mail
                            size={17}
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
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
                            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-900 shadow-sm transition focus:border-[#0a6da5] focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100"
                            required
                        />
                    </div>
                    <InputError message={errors.email} className="mt-2" />
                </div>

                <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <label
                            htmlFor="password"
                            className="block text-sm font-semibold text-slate-700"
                        >
                            {t('Password')}
                        </label>
                        {canResetPassword && (
                            <Link
                                href={route('password.request')}
                                className="text-xs font-medium text-[#0a6da5] transition hover:text-[#094f7d]"
                            >
                                {t('Forgot password?')}
                            </Link>
                        )}
                    </div>
                    <div className="relative">
                        <Lock
                            size={17}
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
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
                            className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-12 text-sm text-slate-900 shadow-sm transition focus:border-[#0a6da5] focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(value => !value)}
                            disabled={processing}
                            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100"
                        >
                            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                    </div>
                    <InputError message={errors.password} className="mt-2" />
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                        <input
                            type="checkbox"
                            name="remember"
                            checked={data.remember}
                            disabled={processing}
                            onChange={(e) =>
                                setData('remember', e.target.checked)
                            }
                            className="h-4 w-4 rounded border-slate-300 text-[#0a6da5] focus:ring-[#0a6da5]"
                        />
                        {t('Remember me')}
                    </label>
                    <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{t('Secure')}</span>
                </div>

                <button
                    type="submit"
                    disabled={processing}
                    className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0E3B2E] px-4 py-3.5 text-sm font-bold uppercase tracking-[0.12em] text-white shadow-[0_18px_30px_-18px_rgba(14,59,46,0.9)] transition hover:bg-[#143f35] disabled:cursor-not-allowed disabled:opacity-80"
                >
                    {processing ? (
                        <>
                            <Loader2 size={18} className="animate-spin text-[#f0c867]" aria-hidden="true" />
                            <span>{t('Signing you in...')}</span>
                        </>
                    ) : (
                        <>
                            <span>{t('Log in')}</span>
                            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </>
                    )}
                </button>

                <p className="text-center text-sm text-slate-500">
                    {t("Don't have an account?")}{' '}
                    <Link
                        href={route('register')}
                        className="font-semibold text-[#0a6da5] transition hover:text-[#094f7d]"
                    >
                        {t('Register')}
                    </Link>
                </p>
            </form>
        </GuestLayout>
    );
}