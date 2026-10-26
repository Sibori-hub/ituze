import { router } from '@inertiajs/react';
import { Building2, Loader2, MapPin, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '@/localization';

const PLACE_TYPES = { province: 'Province', district: 'District', sector: 'Sector' };

/**
 * Home page search text box with live suggestions: places and buildings that
 * still have a space to rent. A place sets the location filters; a building
 * opens its page.
 */
export default function SearchSuggestBox({ value, onChange, onPickPlace, onSearchNow }) {
    const { t } = useTranslation();
    const listId = useId();
    const boxRef = useRef(null);
    const [results, setResults] = useState({ places: [], properties: [] });
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const term = value.trim();

    useEffect(() => {
        if (term.length < 2) {
            setResults({ places: [], properties: [] });
            setLoading(false);
            return undefined;
        }
        const controller = new AbortController();
        setLoading(true);
        const timer = window.setTimeout(() => {
            window.axios
                .get(route('search.suggestions'), { params: { q: term }, signal: controller.signal })
                .then(({ data }) => {
                    setResults({ places: data.places || [], properties: data.properties || [] });
                    setActive(-1);
                })
                .catch(() => {})
                .finally(() => !controller.signal.aborted && setLoading(false));
        }, 200);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [term]);

    useEffect(() => {
        const close = (event) => !boxRef.current?.contains(event.target) && setOpen(false);
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, []);

    const options = [
        ...results.places.map((place) => ({ kind: 'place', key: `${place.type}-${place.filters.sector_id || place.filters.district_id || place.filters.province_id}`, item: place })),
        ...results.properties.map((property) => ({ kind: 'property', key: `property-${property.id}`, item: property })),
    ];
    const showList = open && term.length >= 2 && (options.length > 0 || !loading);

    const pick = (option) => {
        setOpen(false);
        if (option.kind === 'place') onPickPlace(option.item);
        else router.visit(option.item.url);
    };

    const onKeyDown = (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (!options.length) return;
            event.preventDefault();
            setOpen(true);
            setActive((index) => (event.key === 'ArrowDown' ? (index + 1) % options.length : index <= 0 ? options.length - 1 : index - 1));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (open && options[active]) pick(options[active]);
            else {
                setOpen(false);
                onSearchNow();
            }
        } else if (event.key === 'Escape') {
            setOpen(false);
            setActive(-1);
        }
    };

    const optionId = (index) => `${listId}-option-${index}`;
    const groupTitle = (key, label) => <li key={key} role="presentation" className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</li>;

    return (
        <div ref={boxRef} className="relative sm:col-span-2 xl:col-span-1">
            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-4 text-sm text-slate-500 dark:text-slate-400 focus-within:border-[#078dcc] focus-within:ring-2 focus-within:ring-[#078dcc]/20">
                {loading ? <Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true" /> : <Search size={18} className="shrink-0" aria-hidden="true" />}
                <input
                    value={value}
                    onChange={(event) => {
                        onChange(event.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                    placeholder={t('Location or property name')}
                    aria-label={t('Search by location or property name')}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={showList}
                    aria-controls={listId}
                    aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
                    autoComplete="off"
                    className="w-full border-0 bg-transparent p-0 text-slate-800 dark:text-slate-200 outline-none ring-0 focus:ring-0"
                />
            </label>

            {showList && (
                <ul id={listId} role="listbox" aria-label={t('Suggestions')} className="absolute inset-x-0 top-full z-30 mt-2 max-h-[22rem] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1 shadow-2xl">
                    {options.length === 0 ? (
                        <li role="presentation" className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{t('No suggestions. Press Enter to search ":text".', { text: term })}</li>
                    ) : (
                        options.map((option, index) => {
                            const { item } = option;
                            const isPlace = option.kind === 'place';
                            return [
                                index === 0 && isPlace && groupTitle('places-title', t('Places')),
                                !isPlace && (index === 0 || options[index - 1].kind === 'place') && groupTitle('buildings-title', t('Buildings')),
                                <li
                                    key={option.key}
                                    id={optionId(index)}
                                    role="option"
                                    aria-selected={index === active}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => pick(option)}
                                    onMouseEnter={() => setActive(index)}
                                    className={`mx-1 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ${index === active ? 'bg-[#078dcc]/10' : ''}`}
                                >
                                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isPlace ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400' : 'bg-[#064b78]/10 dark:bg-sky-400/10 text-[#064b78] dark:text-sky-300'}`}>
                                        {isPlace ? <MapPin size={17} aria-hidden="true" /> : <Building2 size={17} aria-hidden="true" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.name}</span>
                                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                                            {[isPlace ? t(PLACE_TYPES[item.type]) : null, item.context].filter(Boolean).join(' · ')}
                                        </span>
                                    </span>
                                    <span className="shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                                        {t(':count available', { count: item.available })}
                                    </span>
                                </li>,
                            ];
                        })
                    )}
                </ul>
            )}
        </div>
    );
}
