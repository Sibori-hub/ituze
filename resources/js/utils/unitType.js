// Only apartments record bedrooms and bathrooms and can be rented by the day.
// Category names are typed by admins and owners, so match the word in any
// common spelling; keep in step with UnitType::FILTER_KEYWORDS['apartments'].
const RESIDENTIAL_KEYWORDS = ['apartment', 'appartement', 'apartement', 'appartment'];

// A word starting with a keyword: "Apartments", "Appartement 2" — not "Ware Houses".
const RESIDENTIAL_PATTERN = new RegExp(`(^|[^\\p{L}])(${RESIDENTIAL_KEYWORDS.join('|')})`, 'iu');

export const isApartmentUnitType = (unitType) => RESIDENTIAL_PATTERN.test(String(unitType?.name || ''));

export const isApartmentUnit = (unit) => isApartmentUnitType(unit?.unit_type);
