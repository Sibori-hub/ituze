import { useTranslation } from '@/localization';
import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { checkDescriptionResponse, descriptionErrorMessage } from '@/lib/descriptionRequest';
import { csrfFetch } from '@/lib/csrf';

/**
 * Room description, typed or drafted by AI from the room's details and its
 * building (category, floor, size, rent, amenities, location).
 */
export default function RoomDescriptionField({ property, data, setData, error }) {
    const { t } = useTranslation();
    const [state, setState] = useState({ busy: false, message: '', tone: 'info' });

    const generate = async () => {
        // Units are chosen by floor now; older rooms still name their unit category.
        if (!data.property_unit_id && (data.floor_number ?? '') === '') {
            setState({ busy: false, message: t('Choose the floor first, so the description can mention it.'), tone: 'warning' });
            (document.getElementById('room-floor_number') || document.getElementById('room-property_unit_id') || document.getElementById('parent-unit'))?.focus();
            return;
        }
        setState({ busy: true, message: '', tone: 'info' });
        try {
            const res = await csrfFetch(route('properties.units.describe', property.id), {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify({
                    property_unit_id: data.property_unit_id || null,
                    floor_number: data.floor_number === '' || data.floor_number === undefined ? null : data.floor_number,
                    unit_number: data.unit_number,
                    size_sqm: data.size_sqm === '' ? null : data.size_sqm,
                    rent_amount: data.rent_amount === '' ? null : data.rent_amount,
                    rent_frequency: data.rent_frequency,
                    bedrooms: data.bedrooms === '' ? null : data.bedrooms,
                    bathrooms: data.bathrooms === '' ? null : data.bathrooms,
                }),
            });
            checkDescriptionResponse(res);
            const json = await res.json();
            if (!json?.description) throw new Error('empty');
            setData('description', json.description);
            setState({ busy: false, message: t('Description written. Read it and change anything you like.'), tone: 'info' });
        } catch (error) {
            setState({ busy: false, message: descriptionErrorMessage(error, t), tone: 'warning' });
        }
    };

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="room-description" className="block text-sm font-medium text-gray-700 dark:text-slate-200">{t('Description')}</label>
                <button
                    type="button"
                    onClick={generate}
                    disabled={state.busy}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#0E3B2E]/30 dark:border-emerald-400/30 bg-[#0E3B2E]/5 dark:bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-[#0E3B2E] dark:text-emerald-300 transition-colors hover:bg-[#0E3B2E]/10 disabled:opacity-60"
                >
                    {state.busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
                    {state.busy ? t('Writing...') : t('Write with AI')}
                </button>
            </div>
            <textarea
                id="room-description"
                value={data.description}
                onChange={(e) => setData('description', e.target.value)}
                rows={5}
                aria-invalid={error ? 'true' : undefined}
                className="mt-1.5 w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40 px-4 py-2.5 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-[#0E3B2E]/15"
                placeholder={t('Describe the room: features, finishes, view…')}
            />
            <div className="mt-1 flex justify-between gap-3 text-xs">
                <p aria-live="polite" className={state.tone === 'warning' ? 'text-amber-800 dark:text-amber-300' : 'text-gray-600 dark:text-slate-300'}>
                    {state.message || t('Tip: fill in the unit, size and rent first for a better description.')}
                </p>
                <span className="flex-none text-gray-500 dark:text-slate-400">{t(':count characters', { count: (data.description || '').length })}</span>
            </div>
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
}
