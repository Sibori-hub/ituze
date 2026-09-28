import InputError from '@/Components/InputError';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
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

            <div className="pt-4 text-center">
                <h2 className="font-[Sora] text-xl font-bold text-gray-800">
                    {t('Welcome back')}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                    {t('Log in to continue')}
                </p>
            </div>

            {status && (
                <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="mt-6 space-y-4">
                {processing && (
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#0E3B2E]/10">
                        <div className="h-full w-full bg-gradient-to-r from-[#0E3B2E] via-[#D9A441] to-[#0E3B2E] animate-pulse" />
                    </div>
                )}

                <div>
                    <label
                        htmlFor="email"
                        className="mb-1 block text-sm font-medium text-gray-700"
                    >
                        {t('Email')}
                    </label>
                    <div className="relative">
                        <Mail
                            size={18}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
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
                            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-[#0E3B2E] focus:ring-1 focus:ring-[#0E3B2E] disabled:bg-gray-50 disabled:text-gray-500"
                            required
                        />
                    </div>
                    <InputError message={errors.email} className="mt-1" />
                </div>

                <div>
                    <label
                        htmlFor="password"
                        className="mb-1 block text-sm font-medium text-gray-700"
                    >
                        {t('Password')}
                    </label>
                    <div className="relative">
                        <Lock
                            size={18}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                            id="password"
                            type="password"
                            name="password"
                            value={data.password}
                            autoComplete="current-password"
                            disabled={processing}
                            onChange={(e) =>
                                setData('password', e.target.value)
                            }
                            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-[#0E3B2E] focus:ring-1 focus:ring-[#0E3B2E] disabled:bg-gray-50 disabled:text-gray-500"
                            required
                        />
                    </div>
                    <InputError message={errors.password} className="mt-1" />
                </div>

                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                            type="checkbox"
                            name="remember"
                            checked={data.remember}
                            disabled={processing}
                            onChange={(e) =>
                                setData('remember', e.target.checked)
                            }
                            className="rounded border-gray-300 text-[#0E3B2E] focus:ring-[#0E3B2E]"
                        />
                        {t('Remember me')}
                    </label>

                    {canResetPassword && (
                        <Link
                            href={route('password.request')}
                            className="text-sm text-[#0E3B2E] hover:underline"
                        >
                            {t('Forgot password?')}
                        </Link>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={processing}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0a2e23] hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#0E3B2E]/80"
                >
                    {processing ? (
                        <>
                            <Loader2 size={18} className="animate-spin text-[#D9A441]" />
                            <span>{loginStage || t('Signing you in...')}</span>
                        </>
                    ) : (
                        <>
                            <span>{t('LOG IN')}</span>
                            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                        </>
                    )}
                </button>

                {processing && (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-[#0E3B2E]/15 bg-[#0E3B2E]/5 py-2.5 px-3 text-xs font-medium text-[#0E3B2E] animate-pulse">
                        <Loader2 size={14} className="animate-spin text-[#0E3B2E]" />
                        <span>{loginStage || t('Authenticating...')}</span>
                    </div>
                )}

                <p className="text-center text-sm text-gray-500">
                    {t("Don't have an account?")}{' '}
                    <Link
                        href={route('register')}
                        className="font-medium text-[#0E3B2E] hover:underline"
                    >
                        {t('Register')}
                    </Link>
                </p>
            </form>
        </GuestLayout>
    );
}