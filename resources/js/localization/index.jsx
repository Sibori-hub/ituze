import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import authCatalog from './catalogs/auth';
import coreCatalog from './catalogs/core';
import managementCatalog from './catalogs/management';
import publicCatalog from './catalogs/public';

const STORAGE_KEY = 'ituze-language';
const supportedLanguages = ['en', 'fr', 'rw'];
const catalogs = [coreCatalog, authCatalog, managementCatalog, publicCatalog];
const LanguageContext = createContext(null);

const getInitialLanguage = () => {
    if (typeof window === 'undefined') return 'en';

    const savedLanguage = window.localStorage.getItem(STORAGE_KEY);

    return supportedLanguages.includes(savedLanguage) ? savedLanguage : 'en';
};

export function LanguageProvider({ children }) {
    const [language, setLanguageState] = useState(getInitialLanguage);

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    const setLanguage = (nextLanguage) => {
        if (!supportedLanguages.includes(nextLanguage)) return;

        window.localStorage.setItem(STORAGE_KEY, nextLanguage);
        setLanguageState(nextLanguage);
    };

    const value = useMemo(() => ({
        language,
        setLanguage,
        t: (phrase, replacements = {}) => {
            if (typeof phrase !== 'string') return phrase;
            if (language === 'en') return interpolate(phrase, replacements);

            const translation = catalogs.reduce(
                (result, catalog) => result || catalog[language]?.[phrase],
                null,
            );

            return interpolate(translation || phrase, replacements);
        },
    }), [language]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
    const context = useContext(LanguageContext);

    if (!context) {
        throw new Error('useTranslation must be used inside LanguageProvider.');
    }

    return context;
}

function interpolate(phrase, replacements) {
    return Object.entries(replacements).reduce(
        (text, [key, value]) => text.replaceAll(`:${key}`, String(value)),
        phrase,
    );
}
