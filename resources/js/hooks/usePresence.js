import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Keeps a dialog mounted for a short exit animation after `open` turns false.
 * Returns `mounted` (render it at all) and `closing` (play the exit animation).
 */
export default function usePresence(open, duration = 180) {
    const [mounted, setMounted] = useState(open);
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        if (open) {
            setMounted(true);
            setClosing(false);
            return undefined;
        }
        if (!mounted) return undefined;

        setClosing(true);
        const timer = setTimeout(() => {
            setMounted(false);
            setClosing(false);
        }, prefersReducedMotion() ? 0 : duration);

        return () => clearTimeout(timer);
    }, [open]);

    return { mounted, closing };
}

/**
 * The last non-empty value, so a closing dialog can keep showing its content
 * while it animates out after the parent has already cleared it.
 */
export function useLatest(value) {
    const latest = useRef(value);
    if (value !== null && value !== undefined) latest.current = value;
    return latest.current;
}
