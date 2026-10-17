import usePresence from '@/hooks/usePresence';
import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/localization';

/**
 * Confirmation that an action worked. Fades in, closes itself after a few
 * seconds (the bar pauses while hovered) and fades out however it is closed.
 */
export default function SuccessModal({ message, onClose }) {
    const { t } = useTranslation();
    const open = Boolean(message);
    const { mounted, closing } = usePresence(open);
    const shown = useRef(message);
    if (open) shown.current = message;

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => (event.key === 'Escape' || event.key === 'Enter') && onClose();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!mounted) return null;

    return createPortal(
        <div
            className={`fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm ${
                closing ? 'pointer-events-none animate-fade-out' : 'animate-fade-in'
            }`}
            onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
            <div
                role="status"
                aria-live="polite"
                className={`group relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-7 text-center shadow-2xl ring-1 ring-black/5 ${
                    closing ? 'animate-pop-out' : 'animate-pop-in'
                }`}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-300 transition hover:bg-gray-100 hover:text-gray-600"
                    aria-label={t('Close')}
                >
                    <X size={16} />
                </button>

                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60">
                    <CheckCircle2 size={34} className="text-emerald-600" />
                </div>
                <h2 className="mt-5 font-[Sora] text-xl font-bold text-gray-900">{t('Success')}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">{shown.current}</p>
                <button
                    type="button"
                    onClick={onClose}
                    autoFocus
                    className="mt-6 inline-flex min-w-32 items-center justify-center rounded-xl bg-[#0E3B2E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#124B3A] active:scale-[0.98]"
                >
                    {t('Continue')}
                </button>

                {/* Auto-close timer: pauses while the pointer is over the dialog. */}
                <span
                    key={shown.current}
                    onAnimationEnd={onClose}
                    className="absolute inset-x-0 bottom-0 h-1 origin-left animate-countdown bg-gradient-to-r from-emerald-400 to-[#D9A441] group-hover:[animation-play-state:paused] motion-reduce:hidden"
                    aria-hidden="true"
                />
            </div>
        </div>,
        document.body,
    );
}
