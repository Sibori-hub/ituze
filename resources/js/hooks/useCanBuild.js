import { usePage } from '@inertiajs/react';

/**
 * Whether this account may add or change buildings, floors, units and prices:
 * the owner (or an admin), never a manager, never a read-only account.
 */
export default function useCanBuild() {
    const { auth } = usePage().props;

    return !auth?.readOnly && auth?.user?.role !== 'manager';
}
