import BrandLockup from '@/Components/BrandLockup';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import OtpInput from '@/Components/OtpInput';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { AlertCircle, Check, CheckCircle2, Clock, Inbox, Loader2, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/localization';

const RESEND_COOLDOWN = 30;

const formatSeconds = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Classes for the top-right header button, so pages can pass their own action. */
export const HEADER_BUTTON_CLASS =
    'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 transition hover:border-gray-400 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E3B2E]';

/** Counts down once per second from a value the server sends with each page load. */
function useCountdown(start) {
    const [seconds, setSeconds] = useState(start);

    useEffect(() => setSeconds(start), [start]);

    useEffect(() => {
        if (seconds <= 0) return undefined;
        const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
        return () => clearTimeout(timer);
    }, [seconds]);

    return [seconds, setSeconds];
}

/** Where the visitor is in sign-up. Meaning never relies on colour alone. */
function StepIndicator({ steps }) {
    const { t } = useTranslation();
    const current = steps.findIndex((step) => step.state === 'current');

    return (
        <nav aria-label={t('Progress')} className="mb-7">
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-gray-600">
                {t('Step :current of :total', { current: current + 1, total: steps.length })}
            </p>
            <ol className="mt-3 flex items-center justify-center gap-1.5">
                {steps.map(({ label, state }, index) => (
                    <li key={label} className="flex items-center gap-1.5" aria-current={state === 'current' ? 'step' : undefined}>
                        {index > 0 && <span aria-hidden="true" className={`h-0.5 w-4 rounded ${state === 'next' ? 'bg-gray-300' : 'bg-[#0E3B2E]'}`} />}
                        <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                state === 'done'
                                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200'
                                    : state === 'current'
                                      ? 'bg-[#0E3B2E] text-white'
                                      : 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200'
                            }`}
                        >
                            {state === 'done' && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                            {label}
                            {state === 'done' && <span className="sr-only">({t('completed')})</span>}
                            {state === 'current' && <span className="sr-only">({t('current step')})</span>}
                        </span>
                    </li>
                ))}
            </ol>
        </nav>
    );
}

/**
 * Code-entry page shared by the email, WhatsApp and sign-in verification
 * steps: a plain light page with one card, built to WCAG 2.2 AA (contrast,
 * visible focus, keyboard use, labelled controls, linked errors, 44px targets,
 * reduced-motion support and a countdown that is not read aloud every second).
 */
export default function VerificationDialog({
    pageTitle,
    title,
    description,
    destination,
    Icon,
    steps,
    verifyRoute,
    resendRoute,
    submitLabel,
    statusMessage,
    expiresIn = 0,
    tip,
    devPanel,
    headerAction,
}) {
    const { t } = useTranslation();
    const { errors } = usePage().props;
    const { data, setData, post, processing, transform } = useForm({ otp: '' });
    const resendForm = useForm({});
    const [attempt, setAttempt] = useState(0);
    const [cooldown, setCooldown] = useCountdown(RESEND_COOLDOWN);
    const [secondsLeft, setSecondsLeft] = useCountdown(expiresIn);
    const expired = secondsLeft <= 0;
    const canResend = expired || cooldown <= 0;
    const error = errors.otp;

    // Screen readers hear about the timer only when it matters, not every second.
    const timerAnnouncement = expired
        ? t('This code has expired. Send a new one below.')
        : secondsLeft <= 60
          ? t('Less than a minute left to use this code.')
          : '';

    const verify = (code) => {
        if (processing || code.length !== 6) return;

        transform(() => ({ otp: code }));
        post(verifyRoute, {
            preserveScroll: true,
            onError: () => {
                setData('otp', '');
                // A new key replays the error state (and shake, where motion is allowed).
                setAttempt((count) => count + 1);
            },
        });
    };

    const resend = () => {
        resendForm.post(resendRoute, {
            preserveScroll: true,
            onSuccess: (page) => {
                setCooldown(RESEND_COOLDOWN * 2);
                setSecondsLeft(page.props.expiresIn ?? 0);
                setData('otp', '');
            },
        });
    };

    return (
        <>
            <Head title={pageTitle} />

            <div className="min-h-screen bg-[#F5F7F6] font-[Inter] text-gray-900">
                <a
                    href="#verify-main"
                    className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
                >
                    {t('Skip to main content')}
                </a>

                <header className="border-b border-gray-200 bg-white">
                    <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                        <Link href="/" className="min-w-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0E3B2E]">
                            <BrandLockup
                                logoClassName="h-10 w-10"
                                className="gap-2 sm:gap-3"
                                nameClassName="hidden text-sm font-bold text-gray-900 sm:block"
                                subtitleClassName="hidden text-[10px] font-medium text-gray-600 sm:block"
                            />
                        </Link>
                        <div className="flex shrink-0 items-center gap-2">
                            <LanguageSwitcher className="rounded-xl bg-[#0E3B2E] p-1" />
                            {headerAction ?? (
                                <Link href={route('logout')} method="post" as="button" className={HEADER_BUTTON_CLASS}>
                                    {t('Log Out')}
                                </Link>
                            )}
                        </div>
                    </div>
                </header>

                <main id="verify-main" tabIndex={-1} className="mx-auto flex max-w-5xl justify-center px-4 py-8 focus:outline-none sm:py-14">
                    <section
                        aria-labelledby="verify-title"
                        aria-describedby="verify-description"
                        className="w-full max-w-[460px] rounded-2xl border border-gray-200 bg-white p-6 shadow-sm motion-safe:animate-pop-in sm:p-10"
                    >
                        {steps && <StepIndicator steps={steps} />}

                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-[#0E3B2E] ring-1 ring-emerald-200" aria-hidden="true">
                            <Icon size={26} />
                        </div>

                        <h1 id="verify-title" className="mt-5 text-center font-[Sora] text-2xl font-bold text-gray-900">
                            {title}
                        </h1>
                        <div id="verify-description" className="mt-2 text-center text-[15px] leading-6 text-gray-700">
                            <p>{description}</p>
                            <div className="mt-1 break-all font-semibold text-gray-900">{destination}</div>
                        </div>

                        {statusMessage && (
                            <p role="status" className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
                                <CheckCircle2 size={18} className="mt-px shrink-0 text-emerald-700" aria-hidden="true" />
                                {statusMessage}
                            </p>
                        )}

                        <form
                            className="mt-7"
                            onSubmit={(event) => {
                                event.preventDefault();
                                verify(data.otp);
                            }}
                            noValidate
                        >
                            <p id="code-label" className="mb-3 text-center text-sm font-semibold text-gray-900">
                                {t('Enter the 6-digit code')}
                            </p>
                            <OtpInput
                                key={attempt}
                                value={data.otp}
                                onChange={(code) => setData('otp', code)}
                                onComplete={verify}
                                disabled={processing}
                                invalid={Boolean(error) && data.otp === ''}
                                labelledBy="code-label"
                                describedBy={error ? 'code-error code-hint' : 'code-hint'}
                            />

                            {error && (
                                <p id="code-error" role="alert" className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-red-700">
                                    <AlertCircle size={16} aria-hidden="true" />
                                    {error}
                                </p>
                            )}

                            <p id="code-hint" className={`mt-3 flex items-center justify-center gap-1.5 text-sm tabular-nums ${expired ? 'font-medium text-amber-800' : secondsLeft <= 60 ? 'font-medium text-amber-800' : 'text-gray-600'}`}>
                                {expired ? <AlertCircle size={15} aria-hidden="true" /> : <Clock size={15} aria-hidden="true" />}
                                {expired
                                    ? t('This code has expired. Send a new one below.')
                                    : t('Code expires in :time', { time: formatSeconds(secondsLeft) })}
                            </p>
                            <p className="sr-only" aria-live="polite">{timerAnnouncement}</p>

                            <button
                                type="submit"
                                disabled={processing || data.otp.length !== 6}
                                className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0E3B2E] px-4 text-base font-semibold text-white transition hover:bg-[#124B3A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E3B2E] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-600"
                            >
                                {processing ? (
                                    <>
                                        <Loader2 size={18} className="motion-safe:animate-spin" aria-hidden="true" />
                                        <span role="status">{t('Verifying...')}</span>
                                    </>
                                ) : (
                                    submitLabel
                                )}
                            </button>
                        </form>

                        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-gray-700">
                            <span>{t("Didn't get the code?")}</span>
                            {canResend ? (
                                <button
                                    type="button"
                                    onClick={resend}
                                    disabled={resendForm.processing}
                                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 font-semibold text-[#0E3B2E] underline decoration-2 underline-offset-4 transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0E3B2E] disabled:opacity-60"
                                >
                                    <RotateCw size={15} className={resendForm.processing ? 'motion-safe:animate-spin' : ''} aria-hidden="true" />
                                    {t('Resend code')}
                                </button>
                            ) : (
                                <span className="inline-flex min-h-11 items-center font-medium tabular-nums text-gray-600">
                                    {t('Resend in :time', { time: formatSeconds(cooldown) })}
                                </span>
                            )}
                        </div>

                        {tip && (
                            <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700">
                                <Inbox size={17} className="mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />
                                {tip}
                            </p>
                        )}

                        {devPanel && (
                            <details className="group mt-4 rounded-xl border border-dashed border-amber-400 bg-amber-50 text-amber-900">
                                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-xs font-semibold uppercase tracking-wide">
                                    {t('Development only')}
                                    <span className="text-[11px] font-medium normal-case text-amber-800 group-open:hidden">{t('Show')}</span>
                                </summary>
                                <div className="space-y-2.5 border-t border-dashed border-amber-300 px-4 pb-4 pt-3">
                                    {devPanel(verify)}
                                </div>
                            </details>
                        )}
                    </section>
                </main>
            </div>
        </>
    );
}

/** The local test code as a one-click button. */
export function DevCodeButton({ code, onUse }) {
    const { t } = useTranslation();

    if (!code) {
        return <p className="text-xs">{t('Click Resend Code to generate a test code.')}</p>;
    }

    return (
        <button
            type="button"
            onClick={() => onUse(code)}
            className="flex min-h-11 w-full items-center justify-between rounded-lg bg-white px-3 text-left ring-1 ring-amber-300 transition hover:ring-amber-500"
        >
            <span className="font-[Sora] text-lg font-bold tracking-[0.3em] text-gray-900">{code}</span>
            <span className="text-xs font-semibold text-amber-900">{t('Use this code')}</span>
        </button>
    );
}
