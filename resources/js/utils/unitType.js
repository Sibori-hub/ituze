export const isApartmentUnitType = (unitType) => (
    ['apartment', 'studio'].includes(String(unitType?.name || '').trim().toLowerCase())
);

export const isApartmentUnit = (unit) => isApartmentUnitType(unit?.unit_type);
