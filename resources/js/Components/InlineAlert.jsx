import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

const variants = {
    success: {
        container: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300',
        iconBg: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        icon: CheckCircle2,
    },
    error: {
        container: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-300',
        iconBg: 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400',
        icon: XCircle,
    },
    warning: {
        container: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300',
        iconBg: 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',
        icon: AlertTriangle,
    },
    info: {
        container: 'bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/30 text-sky-800 dark:text-sky-300',
        iconBg: 'bg-sky-100 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400',
        icon: Info,
    },
};

export default function InlineAlert({ message, type = 'success', className = '' }) {
    if (!message) return null;
    const variant = variants[type] || variants.info;
    const Icon = variant.icon;

    return (
        <div className={`flex items-start gap-3 rounded-xl border p-4 ${variant.container} ${className}`} role="alert">
            <div className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg ${variant.iconBg}`}>
                <Icon size={16} strokeWidth={2.25} />
            </div>
            <div className="flex-1 text-sm font-medium leading-5 break-words pt-0.5">
                {message}
            </div>
        </div>
    );
}
