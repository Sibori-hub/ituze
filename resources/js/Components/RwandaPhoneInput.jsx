import RwandaFlag from '@/Components/RwandaFlag';
import { formatPhone, getNetwork, RWANDA_MOBILE_REGEX, toLocalDigits } from '@/lib/rwanda';
import { useTranslation } from '@/localization';

/**
 * The +250 phone box from the sign-up page: Rwanda flag, the 9 digits after
 * +250 grouped as "788 123 456", and the detected network (MTN / Airtel).
 * `value` and `onChange` use those 9 local digits; send `0${value}` to the server.
 */
export default function RwandaPhoneInput({ id = 'phone', value, onChange, error, hint, autoFocus = false, className = '' }) {
    const { t } = useTranslation();
    const valid = RWANDA_MOBILE_REGEX.test(value);
    const network = getNetwork(value);
    const invalid = Boolean(error) || (value !== '' && !valid);

    return (
        <div className={className}>
            <div
                className={`flex items-stretch overflow-hidden rounded-xl border bg-white dark:bg-slate-900 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition focus-within:ring-4 ${
                    invalid
                        ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-100'
                        : 'border-gray-200 dark:border-slate-700 focus-within:border-[#0E3B2E] focus-within:ring-[#0E3B2E]/10'
                }`}
            >
                <span className="flex select-none items-center gap-2 border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3.5 text-sm font-semibold text-gray-700 dark:text-slate-200">
                    <RwandaFlag className="h-[15px] w-[22px]" />
                    +250
                </span>
                <input
                    id={id}
                    type="tel"
                    name={id}
                    inputMode="numeric"
                    value={formatPhone(value)}
                    placeholder="788 123 456"
                    autoComplete="tel-national"
                    autoFocus={autoFocus}
                    onChange={(e) => onChange(toLocalDigits(e.target.value))}
                    className="w-full flex-1 border-0 bg-transparent py-3 pl-3.5 pr-3 text-sm tracking-wide text-gray-800 dark:text-slate-100 placeholder:tracking-normal placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-0"
                    aria-describedby={`${id}-help`}
                    aria-invalid={invalid}
                    required
                />
            </div>
            <p id={`${id}-help`} className="mt-1 text-xs" aria-live="polite">
                {error ? (
                    <span className="font-medium text-red-600 dark:text-red-400" role="alert">{t(error)}</span>
                ) : value !== '' && valid && network ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${network === 'MTN' ? 'bg-[#FFCC00] text-[#1d1d1b]' : 'bg-[#E40000] text-white'}`}>
                            {network}
                        </span>
                        {t(':network number detected', { network })}
                    </span>
                ) : value !== '' && !valid ? (
                    <span className="text-red-600 dark:text-red-400">{t('Enter the 9 digits after +250, starting with 72, 73, 78 or 79.')}</span>
                ) : hint ? (
                    <span className="text-gray-500 dark:text-slate-400">{hint}</span>
                ) : null}
            </p>
        </div>
    );
}

export const isRwandaMobile = (digits) => RWANDA_MOBILE_REGEX.test(digits);
