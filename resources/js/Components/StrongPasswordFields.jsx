import InputError from '@/Components/InputError';
import { Check, Eye, EyeOff, Lock } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '@/localization';

// Mirrors Password::defaults() in AppServiceProvider so a form never
// accepts a password the server will reject.
export const PASSWORD_RULES = [
    { label: 'At least 10 characters', test: (p) => p.length >= 10 },
    { label: 'Upper and lowercase letters', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
    { label: 'A number', test: (p) => /\d/.test(p) },
    { label: 'A symbol', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const STRENGTH_LEVELS = [
    { label: '', color: 'bg-gray-200 dark:bg-slate-700', text: 'text-gray-400 dark:text-slate-500' },
    { label: 'Very weak', color: 'bg-red-400', text: 'text-red-500' },
    { label: 'Weak', color: 'bg-orange-400', text: 'text-orange-500' },
    { label: 'Good', color: 'bg-yellow-400', text: 'text-yellow-600 dark:text-yellow-400' },
    { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
];

/** True when the password passes every rule and both boxes match. */
export function passwordReady(password, confirmation) {
    return PASSWORD_RULES.every((rule) => rule.test(password)) && password === confirmation;
}

const inputClass =
    'w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 pl-11 pr-11 text-sm text-gray-800 dark:text-slate-100 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:border-[#0E3B2E] focus:ring-4 focus:ring-[#0E3B2E]/10';

function PasswordBox({ id, label, value, onChange, error, invalid, autoFocus, describedBy }) {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-gray-700 dark:text-slate-200">{label}</label>
            <div className="relative">
                <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" aria-hidden="true" />
                <input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    name={id}
                    value={value}
                    autoComplete="new-password"
                    placeholder="••••••••••"
                    autoFocus={autoFocus}
                    onChange={(e) => onChange(e.target.value)}
                    className={`${inputClass} ${invalid ? 'border-red-300 dark:border-red-500/40 focus:border-red-400 focus:ring-red-100' : ''}`}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    required
                />
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 dark:text-slate-400 transition hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3B2E]"
                    aria-label={visible ? t('Hide password') : t('Show password')}
                    aria-pressed={visible}
                >
                    {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
            </div>
            <InputError message={error ? t(error) : null} className="mt-1" />
        </div>
    );
}

/**
 * New password + confirmation with show/hide, strength bar and the four rules,
 * exactly as on the sign-up page.
 */
export default function StrongPasswordFields({
    password,
    confirmation,
    onPasswordChange,
    onConfirmationChange,
    errors = {},
    passwordLabel,
    autoFocus = false,
    columns = false,
}) {
    const { t } = useTranslation();
    const passed = PASSWORD_RULES.filter((rule) => rule.test(password));
    const strength = STRENGTH_LEVELS[password ? passed.length : 0];
    const mismatch = confirmation !== '' && password !== confirmation;

    return (
        <div>
            <div className={`grid grid-cols-1 gap-4 ${columns ? 'sm:grid-cols-2' : ''}`}>
                <PasswordBox
                    id="password"
                    label={passwordLabel ?? t('New password')}
                    value={password}
                    onChange={onPasswordChange}
                    error={errors.password}
                    autoFocus={autoFocus}
                    describedBy="password-rules"
                />
                <div>
                    <PasswordBox
                        id="password_confirmation"
                        label={t('Confirm Password')}
                        value={confirmation}
                        onChange={onConfirmationChange}
                        error={errors.password_confirmation}
                        invalid={mismatch}
                        describedBy={mismatch ? 'password-mismatch' : undefined}
                    />
                    {mismatch && (
                        <p id="password-mismatch" className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">{t('Passwords do not match')}</p>
                    )}
                </div>
            </div>

            <div id="password-rules" className="mt-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 p-4 ring-1 ring-inset ring-gray-100 dark:ring-slate-700" aria-live="polite">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-600 dark:text-slate-300">{t('Password strength')}</span>
                    <span className={`font-semibold ${strength.text}`}>{strength.label ? t(strength.label) : '—'}</span>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
                    {PASSWORD_RULES.map((rule, index) => (
                        <span
                            key={rule.label}
                            className={`h-1.5 rounded-full transition-colors duration-300 ${password && index < passed.length ? strength.color : 'bg-gray-200 dark:bg-slate-700'}`}
                        />
                    ))}
                </div>
                <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                    {PASSWORD_RULES.map((rule) => {
                        const met = rule.test(password);
                        return (
                            <li key={rule.label} className={`flex items-center gap-2 text-xs transition-colors ${met ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-600 dark:text-slate-300'}`}>
                                <span
                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors ${met ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-transparent'}`}
                                    aria-hidden="true"
                                >
                                    <Check size={10} strokeWidth={3.5} />
                                </span>
                                {t(rule.label)}
                                <span className="sr-only">{met ? t('done') : t('not yet')}</span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
