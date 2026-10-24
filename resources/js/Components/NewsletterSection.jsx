import { useForm } from '@inertiajs/react';
import { CheckCircle2, Info, Loader2, Mail, MailCheck, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '@/localization';

// Shown after the confirm / unsubscribe links in the emails bring people back here.
const RESULTS = {
    confirmed: { tone: 'bg-emerald-50 text-emerald-900 ring-emerald-200', Icon: CheckCircle2, text: 'Your subscription is confirmed. Welcome to ITUZE news!' },
    unsubscribed: { tone: 'bg-slate-100 text-slate-800 ring-slate-200', Icon: Info, text: 'You are unsubscribed. You will not receive our newsletter any more.' },
    invalid: { tone: 'bg-amber-50 text-amber-900 ring-amber-200', Icon: Info, text: 'This link is no longer valid. Subscribe again below if you want our news.' },
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
        <section id="newsletter" className="bg-white px-4 py-14 sm:px-6 lg:px-8" aria-labelledby="newsletter-title">
            <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#e8f5ef] via-white to-[#fff3e6] p-8 shadow-xl ring-1 ring-slate-200 sm:p-12">
                <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-orange-200/50 blur-3xl" aria-hidden="true" />
                <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-emerald-200/50 blur-3xl" aria-hidden="true" />

                <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
                    <div>
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0E3B2E] text-white shadow-lg">
                            <Mail size={22} aria-hidden="true" />
                        </span>
                        <h2 id="newsletter-title" className="mt-5 text-3xl font-light text-slate-900 sm:text-4xl">{t('Get ITUZE news first')}</h2>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                            {t('New spaces for rent, tips for owners and special offers — straight to your inbox. No spam, unsubscribe any time.')}
                        </p>
                    </div>

                    <div>
                        {banner && (
                            <p className={`mb-4 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-medium ring-1 ring-inset ${banner.tone}`} role="status">
                                <banner.Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                                {t(banner.text)}
                            </p>
                        )}

                        {sent ? (
                            <div className="rounded-2xl bg-white/90 p-6 text-center shadow ring-1 ring-emerald-200" role="status">
                                <MailCheck size={32} className="mx-auto text-emerald-700" aria-hidden="true" />
                                <p className="mt-3 text-lg font-bold text-slate-900">{t('Almost done! Check your email.')}</p>
                                <p className="mt-1 text-sm text-slate-600">{t('We sent you a link. Click it to confirm your subscription.')}</p>
                                <button type="button" onClick={() => setSent(false)} className="mt-4 text-sm font-semibold text-[#0E3B2E] underline underline-offset-4 hover:text-[#124B3A]">
                                    {t('Use another email')}
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={submit} noValidate>
                                <label htmlFor="newsletter-email" className="mb-1.5 block text-[13px] font-medium text-gray-700">{t('Your email address')}</label>
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <input
                                        id="newsletter-email"
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        placeholder="name@example.com"
                                        autoComplete="email"
                                        className="min-h-[48px] w-full flex-1 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 shadow-sm placeholder:text-gray-400 focus:border-[#0E3B2E] focus:ring-4 focus:ring-[#0E3B2E]/10"
                                        aria-invalid={Boolean(errors.email) || undefined}
                                        aria-describedby={`newsletter-note${errors.email ? ' newsletter-error' : ''}`}
                                        required
                                    />
                                    <button
                                        type="submit"
                                        disabled={processing || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)}
                                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(249,115,22,0.9)] transition hover:bg-orange-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                                    >
                                        {processing ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
                                        {t('Subscribe')}
                                    </button>
                                </div>
                                {errors.email && <p id="newsletter-error" className="mt-2 text-xs font-medium text-red-600" role="alert">{t(errors.email)}</p>}
                                <p id="newsletter-note" className="mt-3 text-xs text-slate-500">
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
