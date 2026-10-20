import '../css/app.css';
import './bootstrap';

import AppErrorBoundary from '@/Components/AppErrorBoundary';
import { reportClientError, showFallbackIfBlank } from '@/lib/reportClientError';
import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '@/localization';

// Install (PWA): Chrome may offer one-tap install as soon as the page loads,
// before the install banner's code has arrived. Catch it here, first.
window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.ituzeInstallPrompt = event;
    window.dispatchEvent(new Event('ituze:installable'));
});
window.addEventListener('appinstalled', () => {
    window.ituzeInstallPrompt = null;
});

const appName = import.meta.env.VITE_APP_NAME || 'ITUZE GREEN PLATFORM';

/**
 * After an update the browser may still hold the previous version, whose code
 * files no longer exist. Load the new version once instead of showing a blank
 * page; the timestamp guard prevents a reload loop if something else is wrong.
 */
const reloadForNewVersion = () => {
    try {
        const last = Number(window.sessionStorage.getItem('ituze.version-reload') || 0);
        if (Date.now() - last < 30000) return false;
        window.sessionStorage.setItem('ituze.version-reload', String(Date.now()));
    } catch {
        // Storage unavailable: still reload once.
    }
    window.location.reload();
    return true;
};

window.addEventListener('error', (event) => {
    reportClientError(event.error || event.message, { source: `${event.filename || ''}:${event.lineno || ''}` });
    showFallbackIfBlank();
});
window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason, { source: 'promise' });
    showFallbackIfBlank();
});

window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewVersion()) event.preventDefault();
});

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ).catch((error) => {
            if (reloadForNewVersion()) return new Promise(() => {});
            throw error;
        }),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <AppErrorBoundary>
                <LanguageProvider>
                    <App {...props} />
                </LanguageProvider>
            </AppErrorBoundary>,
        );
    },
    progress: false,
});

// Installable app (PWA): register the service worker once the page has loaded.
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Service worker not registered', error));
    });
}
