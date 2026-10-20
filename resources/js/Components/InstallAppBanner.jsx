import { useTranslation } from '@/localization';
import { Download, EllipsisVertical, Share, Smartphone, SquarePlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const DISMISS_KEY = 'ituze.install-dismissed';

// app.jsx catches Chrome's one-tap install offer as early as possible and
// keeps it on window.ituzeInstallPrompt.
const installOffer = () => (typeof window === 'undefined' ? null : window.ituzeInstallPrompt || null);

export const isStandalone = () => typeof window !== 'undefined'
    && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
const agent = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent);
const isIos = () => /iphone|ipad|ipod/i.test(agent());
const isAndroid = () => /android/i.test(agent());
const APK_URL = '/downloads/ituze.apk';
const isPhone = () => /android|iphone|ipad|ipod|mobile/i.test(agent());
// Pages opened inside WhatsApp, Facebook or Instagram cannot be installed.
const isInAppBrowser = () => /FBAN|FBAV|Instagram|WhatsApp|Line\//i.test(agent());

/** Opens the install prompt when the browser allows it; returns false otherwise. */
export async function promptInstall() {
    const offer = installOffer();
    if (!offer) return false;
    window.ituzeInstallPrompt = null;
    offer.prompt();
    const { outcome } = await offer.userChoice;
    return outcome === 'accepted';
}

/**
 * Invites phone users to install ITUZE on the home screen. When the browser
 * offers one-tap install, the button installs; otherwise the banner shows
 * the menu steps for that browser. Hidden once installed or dismissed.
 */
export default function InstallAppBanner({ className = '', force = false }) {
    const { t } = useTranslation();
    const [canInstall, setCanInstall] = useState(Boolean(installOffer()));
    const [hidden, setHidden] = useState(true);
    const [showSteps, setShowSteps] = useState(false);

    useEffect(() => {
        let dismissed = false;
        try {
            dismissed = Number(window.localStorage.getItem(DISMISS_KEY) || 0) > Date.now() - 7 * 86400000;
        } catch {
            /* storage blocked: show the banner */
        }
        setHidden(isStandalone() || (!force && dismissed) || (!force && !isPhone() && !installOffer()));
        const onInstallable = () => {
            setCanInstall(true);
            if (!isStandalone()) setHidden(false);
        };
        const onInstalled = () => setHidden(true);
        // "Install app" in the account menu brings the banner back with the steps.
        const onShow = () => { if (!isStandalone()) { setHidden(false); setShowSteps(true); window.scrollTo?.({ top: 0, behavior: 'smooth' }); document.querySelector('main')?.scrollTo?.({ top: 0, behavior: 'smooth' }); } };
        window.addEventListener('ituze:show-install', onShow);
        window.addEventListener('ituze:installable', onInstallable);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('ituze:installable', onInstallable);
            window.removeEventListener('appinstalled', onInstalled);
            window.removeEventListener('ituze:show-install', onShow);
        };
    }, [force]);

    if (hidden) return null;

    const dismiss = () => {
        try {
            window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
            /* ignore */
        }
        setHidden(true);
    };

    const install = async () => {
        // Check at tap time: the offer may have arrived after the banner appeared.
        if (canInstall || installOffer()) {
            const accepted = await promptInstall();
            setCanInstall(false);
            if (accepted) setHidden(true);
            return;
        }
        setShowSteps((value) => !value);
    };

    const steps = isInAppBrowser()
        ? <>{t('Open this page in Chrome or Safari first (menu ⋮ → Open in browser), then install it.')}</>
        : isIos()
            ? <>{t('In Safari, tap')} <Share size={13} className="inline align-text-bottom" aria-label={t('Share')} /> {t('then')} <SquarePlus size={13} className="inline align-text-bottom" aria-hidden="true" /> <strong>{t('Add to Home Screen')}</strong>.</>
            : <>{t('Tap the browser menu')} <EllipsisVertical size={13} className="inline align-text-bottom" aria-label={t('menu')} /> {t('then')} <strong>{t('Install app')}</strong> {t('or')} <strong>{t('Add to Home screen')}</strong>.</>;

    return (
        <div className={`mx-auto mb-4 max-w-7xl animate-fade-in rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-3 text-sm text-gray-800 shadow-sm ${className}`} role="region" aria-label={t('Install the ITUZE app')}>
            <div className="flex items-center gap-3">
                <img src="/icons/icon-192.png" alt="" className="h-10 w-10 flex-none rounded-xl ring-1 ring-black/5" />
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{t('Install the ITUZE app')}</p>
                    <p className="text-xs text-gray-600">{t('Open it from your home screen like any app, full screen and quick.')}</p>
                </div>
                <button type="button" onClick={install} aria-expanded={!canInstall ? showSteps : undefined}
                    className="inline-flex flex-none items-center gap-1.5 rounded-xl bg-[#0E3B2E] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#124B3A]">
                    <Download size={14} aria-hidden="true" />{t('Install')}
                </button>
                <button type="button" onClick={dismiss} aria-label={t('Not now')} className="flex-none rounded-lg p-1.5 text-gray-500 hover:bg-white hover:text-gray-800">
                    <X size={16} aria-hidden="true" />
                </button>
            </div>
            {isAndroid() && !canInstall && !isInAppBrowser() && (
                <div className="mt-2 rounded-xl bg-white px-3 py-2.5 text-xs text-gray-700 ring-1 ring-emerald-100">
                    <p className="font-semibold text-gray-900">{t('No install option on your phone? Get the Android app:')}</p>
                    <a href={APK_URL} download="ITUZE.apk" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#D9A441] px-3 py-2 font-semibold text-[#0E3B2E] hover:bg-[#c99535]">
                        <Smartphone size={14} aria-hidden="true" />{t('Download the Android app (1.6 MB)')}
                    </a>
                    <p className="mt-2 text-gray-600">{t('Then open the downloaded file and tap Install. If your phone asks, allow installing apps from this source.')}</p>
                </div>
            )}
            {(showSteps || (!canInstall && isIos())) && (
                <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs text-gray-700 ring-1 ring-emerald-100" role="status">{steps}</p>
            )}
        </div>
    );
}
