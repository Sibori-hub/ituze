import { usePage } from '@inertiajs/react';

/**
 * Whether this account may change tenants, payments and leases on this page:
 * not a read-only account, and not an owner looking at what their manager runs.
 */
export default function useCanEdit() {
    const { props } = usePage();

    return !props.auth?.readOnly && !props.delegatedToManager && !props.runByManager;
}
