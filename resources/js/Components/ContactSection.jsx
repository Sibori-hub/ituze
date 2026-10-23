import RwandaPhoneInput, { isRwandaMobile } from '@/Components/RwandaPhoneInput';
import { useForm } from '@inertiajs/react';
import { ArrowRight, CheckCircle2, Loader2, Mail, MapPin, MessageCircle, Phone, Send } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/localization';

const TOPICS = [
    { value: 'rent', label: 'Rent a space' },
    { value: 'list', label: 'List my property' },
    { value: 'partnership', label: 'Partnership' },
    { value: 'other', label: 'Other' },
];

const fieldClass =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition placeholder:text-gray-400 focus:border-[#0E3B2E] focus:ring-4 focus:ring-[#0E3B2E]/10';

function ContactTile({ href, icon: Icon, tone, title, value, action, external = false }) {
    return (
        <a
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-transparent hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300"
        >
            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}>
                <Icon size={22} aria-hidden="true" />
            </span>
            <span className="mt-4 text-sm font-bold text-slate-900">{title}</span>
            <span className="mt-1 break-words text-sm text-slate-600">{value}</span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#0E3B2E]">
                {action}
                <ArrowRight size={14} className="transition group-hover:translate-x-1" aria-hidden="true" />
            </span>
        </a>
    );
}

/**
 * Home page "Contact us": quick contact tiles, a form that reaches the admins
 * by SMS and email, and the office map.
 */
export default function ContactSection({ phone, phoneDisplay, email, address, mapUrl, whatsappUrl }) {
    const { t } = useTranslation();
    const [sent, setSent] = useState(false);
    const { data, setData, post, processing, errors, reset, transform, clearErrors } = useForm({
        name: '',
        phone: '',
        email: '',
        topic: 'rent',
        message: '',
        website: '',
    });

    const ready = data.name.trim() !== '' && isRwandaMobile(data.phone) && data.message.trim().length >= 5;

    const submit = (e) => {
        e.preventDefault();
        transform((form) => ({ ...form, phone: `0${form.phone}` }));
        post(route('contact.store'), {
            preserveScroll: true,
            onSuccess: () => {
                setSent(true);
                reset();
            },
        });
    };

    return (
        <section id="contact" className="relative overflow-hidden bg-gradient-to-b from-[#f6f8fa] to-white" aria-labelledby="contact-title">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange-200/40 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" aria-hidden="true" />

            <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                    <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">{t('Contact us')}</p>
                    <h2 id="contact-title" className="mt-3 text-4xl font-light text-slate-900">{t('We are here to help')}</h2>
                    <p className="mt-4 text-sm leading-6 text-slate-600">
                        {t('Questions about renting, listing your property or working with us? Reach us any way you like.')}
                    </p>
                    <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
                        </span>
                        {t('Always open — we are online 24/7')}
                    </p>
                </div>

                <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <ContactTile href={`tel:${phone}`} icon={Phone} tone="bg-[#0E3B2E]/10 text-[#0E3B2E]" title={t('Call us')} value={phoneDisplay} action={t('Call now')} />
                    <ContactTile href={whatsappUrl} icon={MessageCircle} tone="bg-[#25d366]/15 text-[#128c4b]" title="WhatsApp" value={phoneDisplay} action={t('Chat on WhatsApp')} external />
                    <ContactTile href={`mailto:${email}`} icon={Mail} tone="bg-orange-100 text-orange-700" title={t('Email us')} value={email} action={t('Write an email')} />
                    <ContactTile href={mapUrl} icon={MapPin} tone="bg-sky-100 text-sky-700" title={t('Visit us')} value={address} action={t('Open in Google Maps')} external />
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
                    <div className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200 sm:p-8">
                        {sent ? (
                            <div className="flex h-full flex-col items-center justify-center py-10 text-center" role="status">
                                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                    <CheckCircle2 size={32} aria-hidden="true" />
                                </span>
                                <h3 className="mt-5 text-2xl font-bold text-slate-900">{t('Message sent. Thank you!')}</h3>
                                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{t('Our team received your message and will contact you soon by phone or email.')}</p>
                                <button
                                    type="button"
                                    onClick={() => setSent(false)}
                                    className="mt-6 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0E3B2E]/20"
                                >
                                    {t('Send another message')}
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={submit} noValidate>
                                <h3 className="text-xl font-bold text-slate-900">{t('Send us a message')}</h3>
                                <p className="mt-1 text-sm text-slate-600">{t('We reply quickly by phone, WhatsApp or email.')}</p>

                                <fieldset className="mt-6">
                                    <legend className="mb-2 text-[13px] font-medium text-gray-700">{t('What is it about?')}</legend>
                                    <div className="flex flex-wrap gap-2" role="radiogroup">
                                        {TOPICS.map((topic) => {
                                            const selected = data.topic === topic.value;
                                            return (
                                                <button
                                                    key={topic.value}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={selected}
                                                    onClick={() => setData('topic', topic.value)}
                                                    className={`min-h-[40px] rounded-full px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0E3B2E]/20 ${
                                                        selected ? 'bg-[#0E3B2E] text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {t(topic.label)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </fieldset>

                                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label htmlFor="contact-name" className="mb-1.5 block text-[13px] font-medium text-gray-700">{t('Your name')}</label>
                                        <input
                                            id="contact-name"
                                            value={data.name}
                                            onChange={(e) => setData('name', e.target.value)}
                                            autoComplete="name"
                                            className={fieldClass}
                                            aria-invalid={Boolean(errors.name) || undefined}
                                            aria-describedby={errors.name ? 'contact-name-error' : undefined}
                                            required
                                        />
                                        {errors.name && <p id="contact-name-error" className="mt-1 text-xs font-medium text-red-600">{t(errors.name)}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="contact-email" className="mb-1.5 block text-[13px] font-medium text-gray-700">
                                            {t('Email')} <span className="font-normal text-gray-500">({t('optional')})</span>
                                        </label>
                                        <input
                                            id="contact-email"
                                            type="email"
                                            value={data.email}
                                            onChange={(e) => setData('email', e.target.value)}
                                            autoComplete="email"
                                            className={fieldClass}
                                            aria-invalid={Boolean(errors.email) || undefined}
                                            aria-describedby={errors.email ? 'contact-email-error' : undefined}
                                        />
                                        {errors.email && <p id="contact-email-error" className="mt-1 text-xs font-medium text-red-600">{t(errors.email)}</p>}
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label htmlFor="contact-phone" className="mb-1.5 block text-[13px] font-medium text-gray-700">{t('Phone number')}</label>
                                    <RwandaPhoneInput
                                        id="contact-phone"
                                        value={data.phone}
                                        onChange={(digits) => {
                                            clearErrors('phone');
                                            setData('phone', digits);
                                        }}
                                        error={errors.phone}
                                        hint={t('We call or WhatsApp you on this number.')}
                                    />
                                </div>

                                <div className="mt-4">
                                    <div className="mb-1.5 flex items-center justify-between">
                                        <label htmlFor="contact-message" className="text-[13px] font-medium text-gray-700">{t('Message')}</label>
                                        <span className="text-xs text-gray-500" aria-hidden="true">{data.message.length}/2000</span>
                                    </div>
                                    <textarea
                                        id="contact-message"
                                        rows={5}
                                        maxLength={2000}
                                        value={data.message}
                                        onChange={(e) => setData('message', e.target.value)}
                                        placeholder={t('Tell us what you are looking for: city, type of space, budget...')}
                                        className={`${fieldClass} resize-y`}
                                        aria-invalid={Boolean(errors.message) || undefined}
                                        aria-describedby={errors.message ? 'contact-message-error' : undefined}
                                        required
                                    />
                                    {errors.message && <p id="contact-message-error" className="mt-1 text-xs font-medium text-red-600">{t(errors.message)}</p>}
                                </div>

                                {/* Hidden from people; bots that fill it are ignored. */}
                                <div className="hidden" aria-hidden="true">
                                    <label htmlFor="contact-website">Website</label>
                                    <input id="contact-website" tabIndex={-1} autoComplete="off" value={data.website} onChange={(e) => setData('website', e.target.value)} />
                                </div>

                                <button
                                    type="submit"
                                    disabled={processing || !ready}
                                    className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(249,115,22,0.9)] transition hover:bg-orange-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none sm:w-auto"
                                >
                                    {processing ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
                                    {processing ? t('Sending...') : t('Send message')}
                                </button>
                            </form>
                        )}
                    </div>

                    <div className="relative min-h-[26rem] overflow-hidden rounded-3xl bg-slate-200 shadow-xl ring-1 ring-slate-200">
                        <iframe
                            title={t('ITUZE GREEN PLATFORM location map')}
                            src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
                            className="absolute inset-0 h-full w-full border-0"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                        <a
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-2xl bg-white/95 p-4 text-sm text-slate-700 shadow-lg backdrop-blur transition hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300"
                        >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                                <MapPin size={19} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block font-bold text-slate-900">{t('Find us on Google Maps')}</span>
                                <span className="mt-0.5 block text-xs leading-5">{address}</span>
                            </span>
                            <ArrowRight size={16} className="shrink-0 text-[#064b78]" aria-hidden="true" />
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}
