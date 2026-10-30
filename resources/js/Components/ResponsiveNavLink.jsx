import { Link } from '@inertiajs/react';

export default function ResponsiveNavLink({
    active = false,
    className = '',
    children,
    ...props
}) {
    return (
        <Link
            {...props}
            className={`flex w-full items-start border-l-4 py-2 pe-4 ps-3 ${
                active
                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 focus:border-indigo-700 focus:bg-indigo-100 focus:text-indigo-800'
                    : 'border-transparent text-gray-600 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-800 dark:hover:text-white focus:border-gray-300 focus:bg-gray-50 dark:focus:bg-slate-800 focus:text-gray-800'
            } text-base font-medium transition duration-150 ease-in-out focus:outline-none ${className}`}
        >
            {children}
        </Link>
    );
}
