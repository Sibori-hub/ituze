import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { useTranslation } from '@/localization';

/**
 * The light / dark switch. `tone="dark"` is for the green headers and bars,
 * `tone="light"` for white headers.
 */
export default function ThemeToggle({ tone = 'dark', className = '' }) {
    const { t } = useTranslation();
    const [dark, toggle] = useTheme();
    const look = tone === 'dark'
        ? 'text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-white/60'
        : 'border border-slate-200 text-slate-700 hover:bg-slate-100 focus-visible:ring-[#078dcc] dark:border-slate-700 dark:text-amber-300 dark:hover:bg-slate-800';

    return (
        <button
            type="button"
            onClick={toggle}
            aria-pressed={dark}
            aria-label={t('Dark mode')}
            title={dark ? t('Switch to light mode') : t('Switch to dark mode')}
            className={`inline-flex items-center justify-center rounded-lg p-2 transition focus:outline-none focus-visible:ring-2 ${look} ${className}`}
        >
            {dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
        </button>
    );
}
