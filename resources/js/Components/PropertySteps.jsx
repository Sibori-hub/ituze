import { useTranslation } from '@/localization';
import { Check } from 'lucide-react';

const STEPS = ['Property details', 'Payment', 'Units, rooms and tenants'];

/**
 * Creating a property for a self-registered owner: details, then payment,
 * then (once ITUZE approves the payment) units, rooms and tenants.
 * `current` is 1, 2 or 3; steps before it show as done.
 */
export default function PropertySteps({ current, waitingApproval = false }) {
    const { t } = useTranslation();

    return (
        <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label={t('Steps to add a property')}>
            {STEPS.map((label, index) => {
                const step = index + 1;
                const done = step < current;
                const active = step === current;
                return (
                    <li key={label} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
                        <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-emerald-600 text-white' : active ? 'bg-[#0E3B2E] text-white ring-4 ring-[#0E3B2E]/15' : 'bg-gray-200 text-gray-600'}`}>
                            {done ? <Check size={14} aria-hidden="true" /> : step}
                        </span>
                        <span className={`font-semibold ${active ? 'text-gray-900' : done ? 'text-emerald-800' : 'text-gray-500'}`}>
                            {t(label)}
                            {active && step === 2 && waitingApproval && <span className="ml-1 font-normal text-amber-800">({t('waiting for approval')})</span>}
                        </span>
                        {step < STEPS.length && <span className="mx-1 hidden h-px w-8 bg-gray-300 sm:block" aria-hidden="true" />}
                    </li>
                );
            })}
        </ol>
    );
}
