import { useId } from 'react';
import { Building2 } from 'lucide-react';
import { useTranslation } from '@/localization';

const inputClass = 'mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40 px-4 py-2.5 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#0E3B2E]/15';

/**
 * Floors of a building: the ground floor, floors above it and basements.
 * Units are later placed on one of these floors.
 */
export default function BuildingFloorsFields({ totalFloors, basementFloors, onChange, errors = {} }) {
    const { t } = useTranslation();
    const id = useId();
    const upper = Math.max(0, parseInt(totalFloors, 10) || 0);
    const basements = Math.max(0, parseInt(basementFloors, 10) || 0);

    const summary = [
        t('Ground floor'),
        upper > 0 ? (upper === 1 ? t('1 upper floor') : t(':count upper floors', { count: upper })) : null,
        basements > 0 ? (basements === 1 ? t('1 basement') : t(':count basements', { count: basements })) : t('No basement'),
    ].filter(Boolean).join(' · ');

    return (
        <fieldset className="rounded-2xl border border-gray-200 dark:border-slate-700 p-4">
            <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-slate-100">{t('Floors')} *</legend>
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label htmlFor={`${id}-upper`} className="block text-sm font-medium text-gray-700 dark:text-slate-200">{t('Floors above the ground floor')}</label>
                    <input
                        id={`${id}-upper`}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="200"
                        value={totalFloors}
                        onChange={(e) => onChange('total_floors', e.target.value)}
                        aria-describedby={`${id}-upper-help`}
                        aria-invalid={errors.total_floors ? 'true' : undefined}
                        className={inputClass}
                    />
                    <p id={`${id}-upper-help`} className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t('Enter 0 if the building has only a ground floor.')}</p>
                    {errors.total_floors && <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">{errors.total_floors}</p>}
                </div>
                <div>
                    <label htmlFor={`${id}-basements`} className="block text-sm font-medium text-gray-700 dark:text-slate-200">{t('Basements')}</label>
                    <input
                        id={`${id}-basements`}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="20"
                        value={basementFloors}
                        onChange={(e) => onChange('basement_floors', e.target.value)}
                        aria-describedby={`${id}-basements-help`}
                        aria-invalid={errors.basement_floors ? 'true' : undefined}
                        className={inputClass}
                    />
                    <p id={`${id}-basements-help`} className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t('Enter 0 if there is no basement.')}</p>
                    {errors.basement_floors && <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">{errors.basement_floors}</p>}
                </div>
            </div>
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-slate-800/60 px-3 py-2 text-sm text-gray-700 dark:text-slate-200" aria-live="polite">
                <Building2 size={16} aria-hidden="true" className="flex-none text-[#0E3B2E] dark:text-emerald-300" />
                {summary}
            </p>
        </fieldset>
    );
}
