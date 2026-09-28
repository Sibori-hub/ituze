import { useTranslation } from '@/localization';

const options = [
    { code: 'en', label: 'EN', name: 'English' },
    { code: 'fr', label: 'FR', name: 'Français' },
    { code: 'rw', label: 'RW', name: 'Kinyarwanda' },
];

export default function LanguageSwitcher({ className = '' }) {
    const { language, setLanguage, t } = useTranslation();

    return (
        <label className={`inline-flex items-center gap-2 ${className}`}>
            <span className="sr-only">{t('Select language')}</span>
            <select
                aria-label={t('Select language')}
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-xs font-semibold text-white shadow-sm outline-none transition focus:border-white/50 focus:ring-2 focus:ring-white/20 [&>option]:text-gray-900"
            >
                {options.map((option) => (
                    <option key={option.code} value={option.code}>
                        {option.label} · {t(option.name)}
                    </option>
                ))}
            </select>
        </label>
    );
}
