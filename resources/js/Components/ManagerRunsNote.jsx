import { useTranslation } from '@/localization';
import { usePage } from '@inertiajs/react';
import { Eye } from 'lucide-react';

/** Tells an owner that their manager runs this: they can look, the manager makes the changes. */
export default function ManagerRunsNote({ className = '' }) {
    const { t } = useTranslation();
    const { delegatedToManager, runByManager } = usePage().props;
    if (!delegatedToManager && !runByManager) return null;

    return (
        <p role="note" className={`flex items-start gap-2 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-950 ring-1 ring-sky-200 ${className}`}>
            <Eye size={16} className="mt-0.5 flex-none" aria-hidden="true" />
            {runByManager && !delegatedToManager
                ? t('Your manager looks after this tenant. You can see everything here; the manager makes the changes.')
                : t('Your manager runs this. You can see everything here (tenants, payments, leases); the manager makes the changes.')}
        </p>
    );
}
