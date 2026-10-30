export default function Checkbox({ className = '', ...props }) {
    return (
        <input
            {...props}
            type="checkbox"
            className={
                'rounded border-gray-300 dark:border-slate-600 text-indigo-600 dark:text-indigo-400 shadow-sm focus:ring-indigo-500 ' +
                className
            }
        />
    );
}
