import { useTranslation } from '@/localization';

/**
 * "Ground floor", "Floor 2" or "Basement 1" for a floor number
 * (0 = ground, positive = upper floors, negative = basements).
 */
export default function useFloorLabel() {
    const { t } = useTranslation();

    return (floor) => {
        const n = Number(floor);
        if (n === 0) return t('Ground floor');
        return n > 0 ? t('Floor :number', { number: n }) : t('Basement :number', { number: Math.abs(n) });
    };
}
