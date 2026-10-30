import { useForm } from '@inertiajs/react';
import { CheckCircle2, Info, Loader2, Mail, MailCheck, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/localization';

// Shown after the confirm / unsubscribe links in the emails bring people back here.
const RESULTS = {
    confirmed: { tone: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-500/30', Icon: CheckCircle2, text: 'Your subscription is confirmed. Welcome to ITUZE news!' },
    unsubscribed: { tone: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 ring-slate-200 dark:ring-slate-700', Icon: Info, text: 'You are unsubscribed. You will not receive our newsletter any more.' },
    invalid: { tone: 'bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-300 ring-amber-200 dark:ring-amber-500/30', Icon: Info, text: 'This link is no longer valid. Subscribe again below if you want our news.' },
};

/**
 * "Get ITUZE news" sign-up before the footer. Double opt-in: the visitor must
 * click the link in the confirmation email before any newsletter is sent.
 */
export default function NewsletterSection() {
    const { t, language } = useTranslation();
    const [sent, setSent] = useState(false);
    const [result, setResult] = useState(null);
    const { data, setData, post, processing, errors, reset, transform } = useForm({ email: '', website: '' });

    useEffect(() => {
        const value = new URLSearchParams(window.location.search).get('newsletter');
        if (RESULTS[value]) setResult(value);
    }, []);

    const submit = (e) => {
        e.preventDefault();
        transform((form) => ({ ...form, locale: language }));
        post(route('newsletter.subscribe'), {
            preserveScroll: true,
            onSuccess: () => {
                setSent(true);
                reset();
            },
        });
    };

    const banner = result ? RESULTS[result] : null;

    return (
        <section id="newsletter" className="bg-white dark:bg-slate-900 px-4 py-8 sm:px-6 lg:px-8" aria-labelledby="newsletter-title">
            <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl bg-gradient-to-r from-[#eef8f3] dark:from-emerald-500/10 via-white dark:via-slate-900 to-[#fff4e8] dark:to-amber-500/10 px-5 py-5 ring-1 ring-slate-200/80 sm:px-7">
                {/* Thin brand stripe on the left edge */}
                <span className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#0E3B2E] to-orange-500" aria-hidden="true" />
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-200/40 blur-2xl" aria-hidden="true" />

                <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
                    <div className="flex min-w-0 items-center gap-3 md:flex-1">
                        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-[#0E3B2E] dark:text-emerald-300 shadow-sm ring-1 ring-emerald-100 dark:ring-emerald-500/30">
                            <Mail size={20} aria-hidden="true" />
                            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-orange-500 ring-2 ring-white" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <h2 id="newsletter-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('Get ITUZE news first')}</h2>
                            <p className="mt-0.5 text-[13px] leading-5 text-slate-600 dark:text-slate-300">
                                {t('New spaces for rent, tips for owners and special offers — straight to your inbox. No spam, unsubscribe any time.')}
                            </p>
                        </div>
                    </div>

                    <div className="md:w-[380px] md:shrink-0">
                        {banner && (
                            <p className={`mb-2 flex items-start gap-2 rounded-xl px-3 py-2 text-[13px] font-medium ring-1 ring-inset ${banner.tone}`} role="status">
                                <banner.Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                                {t(banner.text)}
                            </p>
                        )}

                        {sent ? (
                            <div className="flex items-start gap-3 rounded-xl bg-white dark:bg-slate-900 px-4 py-3 ring-1 ring-emerald-200 dark:ring-emerald-500/30" role="status">
                                <MailCheck size={22} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
                                <div className="min-w-0 text-[13px]">
                                    <p className="font-semibold text-slate-900 dark:text-slate-100">{t('Almost done! Check your email.')}</p>
                                    <p className="text-slate-600 dark:text-slate-300">{t('We sent you a link. Click it to confirm your subscription.')}</p>
                                    <button type="button" onClick={() => setSent(false)} className="mt-1 font-semibold text-[#0E3B2E] dark:text-emerald-300 underline underline-offset-4 hover:text-[#124B3A] dark:hover:text-emerald-200">
                                        {t('Use another email')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={submit} noValidate>
                                <label htmlFor="newsletter-email" className="sr-only">{t('Your email address')}</label>
                                <div className="flex items-center gap-1 rounded-xl bg-white dark:bg-slate-900 p-1 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 focus-within:ring-2 focus-within:ring-[#0E3B2E]/40">
                                    <input
                                        id="newsletter-email"
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        placeholder={t('Your email address')}
                                        autoComplete="email"
                                        className="min-h-[42px] w-full min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-gray-800 dark:text-slate-100 placeholder:text-gray-500 dark:placeholder:text-slate-500 focus:ring-0"
                                        aria-invalid={Boolean(errors.email) || undefined}
                                        aria-describedby={`newsletter-note${errors.email ? ' newsletter-error' : ''}`}
                                        required
                                    />
                                    <button
                                        type="submit"
                                        disabled={processing || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)}
                                        className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-4 text-sm font-bold text-white transition hover:bg-orange-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-600"
                                    >
                                        {processing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                                        {t('Subscribe')}
                                    </button>
                                </div>
                                {errors.email && <p id="newsletter-error" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400" role="alert">{t(errors.email)}</p>}
                                <p id="newsletter-note" className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                    {t('We only use your email for ITUZE news. Every email has an unsubscribe link.')}
                                </p>
                                <div className="hidden" aria-hidden="true">
                                    <label htmlFor="newsletter-website">Website</label>
                                    <input id="newsletter-website" tabIndex={-1} autoComplete="off" value={data.website} onChange={(e) => setData('website', e.target.value)} />
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
