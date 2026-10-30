import InputError from '@/Components/InputError';
import RwandaFlag from '@/Components/RwandaFlag';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/localization';

/**
 * Anything that starts like a number is treated as a Rwandan phone number;
 * the server accepts 0788…, 788… and +250 788… alike.
 */
function detectIdentifier(value) {
    const trimmed = value.trim();
    if (trimmed === '') return { type: null };
    if (trimmed.includes('@') || /[a-z]/i.test(trimmed)) return { type: 'email' };

    let digits = trimmed.replace(/\D/g, '');
    if (digits.startsWith('250')) digits = digits.slice(3);
    if (digits.startsWith('0')) digits = digits.slice(1);

    const network = /^7[89]/.test(digits) ? 'MTN' : /^7[23]/.test(digits) ? 'Airtel' : null;
    const formatted = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean).join(' ');

    return { type: 'phone', complete: /^7[2389]\d{7}$/.test(digits), network, formatted };
}

export default function Login({ status, canResetPassword, loginOtpEnabled }) {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const [attempt, setAttempt] = useState(0);

    const identifier = detectIdentifier(data.email);
    const isPhone = identifier.type === 'phone';
    const canSubmit = data.email.trim() !== '' && data.password !== '';
    const failed = Boolean(errors.email || errors.password);

    const submit = (e) => {
        e.preventDefault();
        if (!canSubmit || processing) return;

        post(route('login'), {
            preserveScroll: true,
            onError: () => setAttempt((count) => count + 1),
            onFinish: () => reset('password'),
        });
    };

    const watchCapsLock = (e) => setCapsLock(Boolean(e.getModifierState?.('CapsLock')));

    const inputClass =
        'w-full rounded-xl border bg-white dark:bg-slate-900 py-3.5 text-sm text-gray-900 dark:text-slate-100 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-4 disabled:bg-gray-50 dark:disabled:bg-slate-800';
    const okBorder = 'border-gray-200 dark:border-slate-700 focus:border-[#0E3B2E] focus:ring-[#0E3B2E]/10';
    const errorBorder = 'border-red-300 dark:border-red-500/40 focus:border-red-400 focus:ring-red-100';

    return (
        <GuestLayout>
            <Head title={t('Log in')} />

            <div
                key={attempt}
                className={`rounded-[28px] bg-white dark:bg-slate-900 p-6 shadow-[0_24px_70px_-30px_rgba(14,59,46,0.35)] ring-1 ring-black/[0.04] sm:p-9 ${
                    attempt > 0 && failed ? 'animate-shake' : 'animate-pop-in'
                }`}
            >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D9A441]">{t('Welcome back')}</p>
                <h2 className="mt-1.5 font-[Sora] text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-gray-900 dark:text-slate-100">{t('Sign in')}</h2>
                <p className="mt-1.5 text-sm text-gray-500 dark:text-slate-400">{t('Use the email or phone number you registered with.')}</p>

                {status && (
                    <div className="mt-5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-3.5 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300" role="status">
                        {status}
                    </div>
                )}

                <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
                    <div>
                        <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-slate-200">
                            {t('Email, phone number or username')}
                        </label>
                        <div className="group relative">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center gap-2">
                                {isPhone ? (
                                    <RwandaFlag className="h-[14px] w-[21px] animate-fade-up" />
                                ) : (
                                    <Mail size={18} className="text-gray-400 dark:text-slate-500 transition-colors group-focus-within:text-[#0E3B2E]" />
                                )}
                            </span>
                            <input
                                id="email"
                                name="email"
                                type="text"
                                inputMode={isPhone ? 'tel' : 'email'}
                                value={data.email}
                                autoComplete="username"
                                autoCapitalize="none"
                                spellCheck={false}
                                autoFocus
                                placeholder="you@example.com  ·  0788 123 456  ·  jean.ikaze"
                                disabled={processing}
                                onChange={(e) => setData('email', e.target.value)}
                                aria-invalid={Boolean(errors.email)}
                                aria-describedby="email-help"
                                className={`${inputClass} pr-4 pl-11 ${errors.email ? errorBorder : okBorder}`}
                            />
                        </div>
                        <p id="email-help" className="mt-1.5 min-h-[1rem] text-xs" aria-live="polite">
                            {errors.email ? (
                                <InputError message={errors.email} />
                            ) : isPhone && identifier.formatted ? (
                                <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-slate-400">
                                    {identifier.network && (
                                        <span
                                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                                identifier.network === 'MTN' ? 'bg-[#FFCC00] text-[#1d1d1b]' : 'bg-[#E40000] text-white'
                                            }`}
                                        >
                                            {identifier.network}
                                        </span>
                                    )}
                                    +250 {identifier.formatted}
                                </span>
                            ) : null}
                        </p>
                    </div>

                    <div>
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                            <label htmlFor="password" className="block text-[13px] font-medium text-gray-700 dark:text-slate-200">
                                {t('Password')}
                            </label>
                            {canResetPassword && (
                                <Link
                                    href={route('password.request')}
                                    className="text-xs font-semibold text-[#0E3B2E] dark:text-emerald-300 underline decoration-[#D9A441] decoration-2 underline-offset-4 transition hover:text-[#1F7A5A]"
                                >
                                    {t('Forgot password?')}
                                </Link>
                            )}
                        </div>
                        <div className="group relative">
                            <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 transition-colors group-focus-within:text-[#0E3B2E]" />
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                value={data.password}
                                autoComplete="current-password"
                                placeholder="••••••••••"
                                disabled={processing}
                                onChange={(e) => setData('password', e.target.value)}
                                onKeyUp={watchCapsLock}
                                onKeyDown={watchCapsLock}
                                onBlur={() => setCapsLock(false)}
                                aria-invalid={Boolean(errors.password)}
                                className={`${inputClass} pl-11 pr-12 ${errors.password ? errorBorder : okBorder}`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((value) => !value)}
                                disabled={processing}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 dark:text-slate-500 transition hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-600"
                                aria-label={showPassword ? t('Hide password') : t('Show password')}
                            >
                                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                            </button>
                        </div>
                        {capsLock && (
                            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400" role="status">
                                <TriangleAlert size={13} />
                                {t('Caps Lock is on')}
                            </p>
                        )}
                        <InputError message={errors.password} className="mt-1.5" />
                    </div>

                    <label className="flex cursor-pointer select-none items-center justify-between gap-3">
                        <span className="text-sm text-gray-600 dark:text-slate-300">{t('Remember me')}</span>
                        <span className="relative inline-flex">
                            <input
                                type="checkbox"
                                name="remember"
                                checked={data.remember}
                                disabled={processing}
                                onChange={(e) => setData('remember', e.target.checked)}
                                className="peer sr-only"
                            />
                            <span className="h-6 w-11 rounded-full bg-gray-200 dark:bg-slate-700 transition-colors peer-checked:bg-[#0E3B2E] peer-focus-visible:ring-4 peer-focus-visible:ring-[#0E3B2E]/15" />
                            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white dark:bg-slate-900 shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
                        </span>
                    </label>

                    <button
                        type="submit"
                        disabled={!canSubmit || processing}
                        className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0E3B2E] py-4 text-sm font-semibold tracking-wide text-white shadow-[0_12px_30px_-12px_rgba(14,59,46,0.7)] transition-all hover:bg-[#124B3A] hover:shadow-[0_16px_36px_-12px_rgba(14,59,46,0.8)] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-slate-800 disabled:text-gray-400 dark:disabled:text-slate-500 disabled:shadow-none"
                    >
                        {processing ? (
                            <>
                                <Loader2 size={18} className="animate-spin text-[#F3D58F]" />
                                {t('Signing you in...')}
                            </>
                        ) : (
                            <>
                                {t('Log in')}
                                <ArrowRight size={17} className="text-[#F3D58F] transition-transform group-enabled:group-hover:translate-x-1" />
                            </>
                        )}
                    </button>

                    {loginOtpEnabled && (
                        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-gray-400 dark:text-slate-500">
                            <KeyRound size={13} className="text-[#D9A441]" />
                            {t('We will send a one-time code to finish signing in.')}
                        </p>
                    )}
                </form>
            </div>

        </GuestLayout>
    );
}
