const parseDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day
        ? date
        : null;
};

const nextMonthlyDueDate = (date, dueDay) => {
    let year = date.getUTCFullYear();
    let month = date.getUTCMonth();
    let lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    let candidate = new Date(Date.UTC(year, month, Math.min(dueDay, lastDay)));

    if (candidate <= date) {
        month += 1;
        if (month > 11) {
            year += 1;
            month = 0;
        }
        lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        candidate = new Date(Date.UTC(year, month, Math.min(dueDay, lastDay)));
    }

    return candidate;
};

export function countRentPeriods(startValue, endValue, frequency) {
    const start = parseDate(startValue);
    const end = parseDate(endValue);

    if (!start || !end || end < start) return 0;

    if (frequency === 'daily') {
        return Math.floor((end - start) / 86400000) + 1;
    }

    if (frequency === 'weekly') {
        return Math.floor((end - start) / (7 * 86400000)) + 1;
    }

    const monthlyDueDay = start.getUTCDate();
    let periodStart = start;
    let count = 0;

    while (periodStart <= end) {
        count += 1;

        if (frequency === 'monthly') {
            periodStart = nextMonthlyDueDate(periodStart, monthlyDueDay);
        } else {
            const months = frequency === 'quarterly' ? 3 : 12;
            const targetMonth = periodStart.getUTCMonth() + months;
            const year = periodStart.getUTCFullYear() + Math.floor(targetMonth / 12);
            const month = targetMonth % 12;
            const day = Math.min(periodStart.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
            periodStart = new Date(Date.UTC(year, month, day));
        }
    }

    return count;
}
