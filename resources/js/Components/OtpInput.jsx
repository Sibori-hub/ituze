import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/localization';

/**
 * One box per digit. Supports typing, backspace, arrow keys, pasting the whole
 * code into any box and the browser's one-time-code autofill. Calls onComplete
 * with the full code as soon as every box is filled.
 *
 * Accessibility: the boxes form one labelled group, each box announces its
 * position ("Digit 2 of 6"), errors are linked through `describedBy`, borders
 * meet the 3:1 non-text contrast minimum and the error shake only plays when
 * the visitor has not asked for reduced motion.
 */
export default function OtpInput({
    value,
    onChange,
    onComplete,
    length = 6,
    disabled = false,
    invalid = false,
    autoFocus = true,
    labelledBy,
    describedBy,
}) {
    const { t } = useTranslation();
    const refs = useRef([]);
    const [digits, setDigits] = useState(() => Array.from({ length }, (_, i) => value[i] || ''));

    // The parent clears the value after a failed attempt: empty the boxes and start over.
    useEffect(() => {
        if (value === '') {
            setDigits(Array(length).fill(''));
            refs.current[0]?.focus();
        }
    }, [value, length]);

    useEffect(() => {
        if (autoFocus) refs.current[0]?.focus();
    }, [autoFocus]);

    const focus = (index) => {
        const box = refs.current[Math.max(0, Math.min(length - 1, index))];
        box?.focus();
        box?.select();
    };

    const update = (next) => {
        setDigits(next);
        const code = next.join('');
        onChange(code);
        if (next.every(Boolean)) onComplete?.(code);
    };

    const fillFrom = (index, text) => {
        const incoming = text.replace(/\D/g, '');
        if (!incoming) return;

        const next = [...digits];
        let position = index;
        for (const char of incoming) {
            if (position >= length) break;
            next[position++] = char;
        }
        update(next);
        focus(position >= length ? length - 1 : position);
    };

    const handleChange = (index, event) => {
        let typed = event.target.value.replace(/\D/g, '');
        // Typing over a filled box gives two characters; keep the new one.
        if (typed.length === 2 && digits[index]) typed = typed.slice(-1);
        fillFrom(index, typed);
    };

    const handleKeyDown = (index, event) => {
        if (event.key === 'Backspace') {
            event.preventDefault();
            const next = [...digits];
            if (digits[index]) {
                next[index] = '';
                update(next);
            } else if (index > 0) {
                next[index - 1] = '';
                update(next);
                focus(index - 1);
            }
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            focus(index - 1);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            focus(index + 1);
        }
    };

    return (
        <div
            className={`flex justify-center gap-2 sm:gap-3 ${invalid ? 'motion-safe:animate-shake' : ''}`}
            role="group"
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
        >
            {digits.map((digit, index) => (
                <input
                    key={index}
                    ref={(element) => (refs.current[index] = element)}
                    value={digit}
                    onChange={(event) => handleChange(index, event)}
                    onKeyDown={(event) => handleKeyDown(index, event)}
                    onPaste={(event) => {
                        event.preventDefault();
                        fillFrom(index, event.clipboardData.getData('text'));
                    }}
                    onFocus={(event) => event.target.select()}
                    disabled={disabled}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    aria-label={t('Digit :number of :total', { number: index + 1, total: length })}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    className={`h-14 w-11 rounded-xl border-2 bg-white text-center font-[Sora] text-2xl font-semibold text-gray-900 caret-[#0E3B2E] outline-none transition-colors sm:h-16 sm:w-14 ${
                        invalid ? 'border-red-600 bg-red-50' : digit ? 'border-[#0E3B2E]' : 'border-gray-400'
                    } focus-visible:border-[#0E3B2E] focus-visible:ring-4 focus-visible:ring-[#0E3B2E]/25 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500`}
                />
            ))}
        </div>
    );
}
