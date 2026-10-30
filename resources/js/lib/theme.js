import { useEffect, useState } from 'react';

/**
 * Light or dark for the whole app: the visitor's choice (kept in this browser),
 * else their device setting. app.blade.php applies it before the first paint;
 * printing always uses light so receipts and reports stay readable on paper.
 */
const THEME_KEY = 'ituze-theme';
const EVENT = 'ituze:theme';
const root = () => document.documentElement;

const savedTheme = () => {
    try {
        return window.localStorage.getItem(THEME_KEY);
    } catch {
        return null;
    }
};

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

export const isDark = () => typeof document !== 'undefined' && root().classList.contains('dark');

export function applyTheme(dark) {
    root().classList.toggle('dark', dark);
    root().style.colorScheme = dark ? 'dark' : 'light';
    window.dispatchEvent(new CustomEvent(EVENT, { detail: dark }));
}

export function setTheme(dark) {
    try {
        window.localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
    } catch {
        // Private mode: the choice lasts for this page only.
    }
    applyTheme(dark);
}

/** Keeps the theme right after the first paint: device changes, and printing in light. */
export function startTheme() {
    const saved = savedTheme();
    applyTheme(saved ? saved === 'dark' : systemDark());
    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', (event) => {
        if (!savedTheme()) applyTheme(event.matches);
    });
    let darkBeforePrint = false;
    window.addEventListener('beforeprint', () => {
        darkBeforePrint = isDark();
        if (darkBeforePrint) root().classList.remove('dark');
    });
    window.addEventListener('afterprint', () => {
        if (darkBeforePrint) root().classList.add('dark');
    });
}

/** [dark, toggle] for a switch button; every switch on the page stays in step. */
export function useTheme() {
    const [dark, setDark] = useState(isDark);
    useEffect(() => {
        const follow = (event) => setDark(event.detail);
        window.addEventListener(EVENT, follow);
        setDark(isDark());
        return () => window.removeEventListener(EVENT, follow);
    }, []);
    return [dark, () => setTheme(!isDark())];
}
