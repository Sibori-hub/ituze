import { useTranslation } from '@/localization';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const DISMISS_KEY = 'ituze.install-dismissed';

// Chrome/Edge/Android fire this once; keep it for the button even if the
// banner mounts later (for example after an Inertia page change).
let deferredPrompt = null;
if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredPrompt = event;
        window.dispatchEvent(new Event('ituze:installable'));
    });
}

const isStandalone = () => typeof window !== 'undefined'
    && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/**
 * Invites phone users to install ITUZE on the home screen. Android and
 * desktop Chrome get a one-tap install button; iPhone users get the two
 * steps Safari needs. Hidden once installed or dismissed.
 */
export default function InstallAppBanner({ className = '' }) {
    const { t } = useTranslation();
    const [canInstall, setCanInstall] = useState(Boolean(deferredPrompt));
    const [hidden, setHidden] = useState(true);

    useEffect(() => {
        let dismissed = false;
        try {
            dismissed = Number(window.localStorage.getItem(DISMISS_KEY) || 0) > Date.now() - 14 * 86400000;
        } catch {
            /* storage blocked: show the banner */
        }
        setHidden(isStandalone() || dismissed);
        const onInstallable = () => setCanInstall(true);
        const onInstalled = () => setHidden(true);
        window.addEventListener('ituze:installable', onInstallable);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('ituze:installable', onInstallable);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const ios = isIos();
    if (hidden || (!canInstall && !ios)) return null;

    const dismiss = () => {
        try {
            window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
            /* ignore */
        }
        setHidden(true);
    };

    const install = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        setCanInstall(false);
        if (outcome === 'accepted') setHidden(true);
    };

    return (
        <div className={`mx-auto mb-4 flex max-w-7xl animate-fade-in items-center gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-3 text-sm text-gray-800 shadow-sm ${className}`} role="region" aria-label={t('Install the ITUZE app')}>
            <img src="/icons/icon-192.png" alt="" className="h-10 w-10 flex-none rounded-xl ring-1 ring-black/5" />
            <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{t('Install the ITUZE app')}</p>
                {ios && !canInstall ? (
                    <p className="text-xs text-gray-600">
                        {t('In Safari, tap')} <Share size={13} className="inline align-text-bottom" aria-label={t('Share')} /> {t('then')} <SquarePlus size={13} className="inline align-text-bottom" aria-hidden="true" /> <strong>{t('Add to Home Screen')}</strong>.
                    </p>
                ) : (
                    <p className="text-xs text-gray-600">{t('Open it from your home screen like any app, full screen and quick.')}</p>
                )}
            </div>
            {canInstall && (
                <button type="button" onClick={install} className="inline-flex flex-none items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#124B3A]">
                    <Download size={14} aria-hidden="true" />{t('Install')}
                </button>
            )}
            <button type="button" onClick={dismiss} aria-label={t('Not now')} className="flex-none rounded-lg p-1.5 text-gray-500 hover:bg-white hover:text-gray-800">
                <X size={16} aria-hidden="true" />
            </button>
        </div>
    );
}
