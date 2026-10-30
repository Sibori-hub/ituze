import usePresence from '@/hooks/usePresence';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/localization';

/**
 * Centred confirmation dialog with enter and exit animations. Rendered into
 * document.body so a transformed or animated page wrapper can never pull it
 * off-centre.
 */
export default function ConfirmActionModal({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    tone = 'default',
    processing = false,
    onConfirm,
    onCancel,
}) {
    const { t } = useTranslation();
    const { mounted, closing } = usePresence(open);

    // Parents clear their state when the dialog closes; keep showing the last
    // content while the exit animation plays.
    const content = useRef({ title, message, confirmLabel, tone });
    if (open) content.current = { title, message, confirmLabel, tone };

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => event.key === 'Escape' && !processing && onCancel?.();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, processing, onCancel]);

    if (!mounted) return null;

    const shown = content.current;
    const isDanger = shown.tone === 'danger';

    return createPortal(
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm ${
                closing ? 'pointer-events-none animate-fade-out' : 'animate-fade-in'
            }`}
            onMouseDown={(event) => event.target === event.currentTarget && !processing && onCancel?.()}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-action-title"
                aria-describedby="confirm-action-message"
                className={`w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 text-center shadow-2xl ${closing ? 'animate-pop-out' : 'animate-pop-in'}`}
            >
                <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${isDanger ? 'bg-red-50 dark:bg-red-500/10' : 'bg-[#0E3B2E]/10 dark:bg-emerald-400/15'}`}>
                    {isDanger ? <AlertTriangle size={26} className="text-red-500" /> : <CheckCircle2 size={26} className="text-[#0E3B2E] dark:text-emerald-300" />}
                </div>

                <h3 id="confirm-action-title" className="mt-4 font-[Sora] text-lg font-bold text-gray-900 dark:text-slate-100">{shown.title}</h3>
                <p id="confirm-action-message" className="mt-1.5 text-sm leading-6 text-gray-500 dark:text-slate-400">{shown.message}</p>

                <div className="mt-6 flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={processing}
                        className="flex-1 rounded-xl border border-gray-200 dark:border-slate-700 py-2.5 text-sm font-semibold text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
                    >
                        {t('Cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={processing || closing}
                        autoFocus
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
                            isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0E3B2E] hover:bg-[#124B3A]'
                        }`}
                    >
                        {processing && <Loader2 size={15} className="animate-spin" />}
                        {processing ? t('Please wait...') : shown.confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
