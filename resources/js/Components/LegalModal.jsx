import { privacySections, termsSections } from '@/Pages/Legal/legalContent';
import { useTranslation } from '@/localization';
import { usePage } from '@inertiajs/react';
import { X } from 'lucide-react';
import { useEffect } from 'react';

const DOCUMENTS = {
    terms: { title: 'Terms and Conditions', sections: termsSections },
    privacy: { title: 'Privacy Policy', sections: privacySections },
};

function Section({ index, section }) {
    return (
        <section className="mt-7">
            <h3 className="font-[Sora] text-base font-semibold text-[#0E3B2E] dark:text-emerald-300">
                {index}. {section.heading}
            </h3>

            {(section.body || []).map((paragraph) => (
                <p key={paragraph} className="mt-2.5 text-sm leading-7 text-gray-600 dark:text-slate-300">
                    {paragraph}
                </p>
            ))}

            {section.list && (
                <ul className="mt-2.5 space-y-2">
                    {section.list.map((item) => (
                        <li key={item} className="flex gap-3 text-sm leading-7 text-gray-600 dark:text-slate-300">
                            <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d9a441]" aria-hidden="true" />
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
            )}

            {(section.after || []).map((paragraph) => (
                <p key={paragraph} className="mt-2.5 text-sm leading-7 text-gray-600 dark:text-slate-300">
                    {paragraph}
                </p>
            ))}
        </section>
    );
}

/**
 * In-page reader for the Terms and Privacy Policy.
 *
 * The section content is bundled locally, so the dialog opens instantly with no
 * extra request. The full pages at /terms and /privacy remain the canonical,
 * linkable addresses.
 */
export default function LegalModal({ document: documentKey = 'terms', onClose, onAgree }) {
    const { t } = useTranslation();
    const legal = usePage().props.legal || {};
    const doc = DOCUMENTS[documentKey] || DOCUMENTS.terms;

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        const previousOverflow = window.document.body.style.overflow;
        window.document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.document.body.style.overflow = previousOverflow;
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-modal-title"
            onClick={onClose}
        >
            <div
                className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white dark:bg-slate-900 shadow-2xl sm:max-h-[85vh] sm:rounded-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex items-start justify-between gap-4 bg-[#0E3B2E] px-5 py-4 sm:px-8">
                    <div>
                        <h2 id="legal-modal-title" className="font-[Sora] text-lg font-semibold text-white">
                            {t(doc.title)}
                        </h2>
                        {(legal.termsUpdatedAt || legal.termsVersion) && (
                            <p className="mt-1 text-[11px] text-white/60">
                                {legal.termsUpdatedAt && `${t('Last updated')}: ${legal.termsUpdatedAt}`}
                                {legal.termsUpdatedAt && legal.termsVersion && ' · '}
                                {legal.termsVersion && `${t('Version')} ${legal.termsVersion}`}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        autoFocus
                        aria-label={t('Close')}
                        className="shrink-0 rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
                    {doc.sections.map((section, index) => (
                        <Section key={section.heading} index={index + 1} section={section} />
                    ))}

                    {legal.company?.name && (
                        <section className="mt-7">
                            <h3 className="font-[Sora] text-base font-semibold text-[#0E3B2E] dark:text-emerald-300">
                                {doc.sections.length + 1}. {t('Contact')}
                            </h3>
                            <div className="mt-2.5 space-y-1 text-sm leading-7 text-gray-600 dark:text-slate-300">
                                <p className="font-semibold text-[#0E3B2E] dark:text-emerald-300">{legal.company.name}</p>
                                {legal.company.email && <p>{t('Email')}: {legal.company.email}</p>}
                                {legal.company.phone && <p>{t('Phone')}: {legal.company.phone}</p>}
                                {legal.company.address && <p>{t('Address')}: {legal.company.address}</p>}
                            </div>
                        </section>
                    )}
                </div>

                <footer className="flex items-center justify-end gap-2 border-t border-black/5 bg-gray-50 dark:bg-slate-800/60 px-5 py-4 sm:px-8">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-200 transition hover:bg-gray-100 dark:hover:bg-slate-800"
                    >
                        {t('Close')}
                    </button>
                    {onAgree && (
                        <button
                            type="button"
                            onClick={onAgree}
                            className="rounded-xl bg-[#0E3B2E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0a2e23]"
                        >
                            {t('I have read and agree')}
                        </button>
                    )}
                </footer>
            </div>
        </div>
    );
}
