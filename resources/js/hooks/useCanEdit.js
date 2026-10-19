import { usePage } from '@inertiajs/react';

/**
 * False for owners Q.R.A manages: they can follow their properties but every
 * change is made by ITUZE GREEN PLATFORM. Use it to hide add/edit/delete actions.
 */
export default function useCanEdit() {
    return !usePage().props.auth?.readOnly;
}
