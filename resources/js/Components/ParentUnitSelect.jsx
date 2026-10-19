import { useFloorLabel } from '@/Components/PropertyUnitsSection';
import { useTranslation } from '@/localization';
import { Link } from '@inertiajs/react';
import { Info } from 'lucide-react';

/**
 * The unit (category on a floor) a room belongs to.
 */
export default function ParentUnitSelect({ property, propertyUnits = [], value, onChange, error }) {
    const { t } = useTranslation();
    const floorLabel = useFloorLabel();

    if (propertyUnits.length === 0) {
        return (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
                <Info size={18} className="mt-0.5 flex-none" aria-hidden="true" />
                <div>
                    <p className="font-semibold">{t('This property has no units yet.')}</p>
                    <p className="mt-1">{t('Add a unit first (a floor and a category such as Office), then add rooms to it.')}</p>
                    <Link href={route('properties.show', property.id)} className="mt-2 inline-block font-semibold underline underline-offset-2">
                        {t('Go to the property to add a unit')}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div>
            <label htmlFor="parent-unit" className="block text-sm font-medium text-gray-700">{t('Unit')} *</label>
            <select
                id="parent-unit"
                value={value ?? ''}
                onChange={(e) => onChange(propertyUnits.find(unit => String(unit.id) === e.target.value) || null)}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby="parent-unit-help"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-sm transition-all focus:border-[#0E3B2E] focus:bg-white focus:ring-2 focus:ring-[#0E3B2E]/15"
            >
                <option value="">{t('Choose the unit')}</option>
                {[...propertyUnits]
                    .sort((a, b) => a.floor_number - b.floor_number || String(a.category).localeCompare(String(b.category)))
                    .map(unit => (
                        <option key={unit.id} value={unit.id}>{`${t(unit.category || '')} · ${floorLabel(unit.floor_number)}`}</option>
                    ))}
            </select>
            <p id="parent-unit-help" className="mt-1 text-xs text-gray-500">{t('The room takes the category and floor of its unit.')}</p>
            {error && <p className="mt-1 text-sm text-red-500" role="alert">{error}</p>}
        </div>
    );
}
