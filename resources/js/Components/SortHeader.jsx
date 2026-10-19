import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';

/**
 * Table header cell that sorts by its column. `filters.sort` / `filters.direction`
 * describe the current order; `defaultSort` is the column used when none is set.
 */
export default function SortHeader({ column, label, filters, onSort, align = 'left', defaultSort = 'end_date' }) {
    const active = (filters.sort || defaultSort) === column;
    const direction = active ? (filters.direction || 'asc') : null;
    const Icon = !active ? ChevronsUpDown : direction === 'asc' ? ChevronUp : ChevronDown;

    return (
        <th
            scope="col"
            aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
            className={`px-3 py-3 font-semibold ${align === 'right' ? 'text-right' : ''}`}
        >
            <button
                type="button"
                onClick={() => onSort(column)}
                className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]/40 ${active ? 'text-gray-900' : ''}`}
            >
                {label}
                <Icon size={13} aria-hidden="true" className={active ? 'text-[#0E3B2E]' : 'text-gray-400'} />
            </button>
        </th>
    );
}
