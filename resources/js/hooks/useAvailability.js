import { useEffect, useState } from 'react';

/**
 * Ask the server whether an email or phone is already registered, once the
 * value looks complete and the person pauses typing.
 * Returns 'idle' | 'checking' | 'available' | 'taken' | 'error'.
 */
export default function useAvailability(field, value, ready) {
    const [status, setStatus] = useState('idle');

    useEffect(() => {
        if (!ready) {
            setStatus('idle');
            return undefined;
        }

        setStatus('checking');
        const controller = new AbortController();
        const timer = setTimeout(() => {
            window.axios
                .get(route('register.availability'), { params: { field, value }, signal: controller.signal })
                .then(({ data }) => setStatus(data.available ? 'available' : 'taken'))
                // A failed check (offline, rate limit) never blocks the form; submit still validates.
                .catch((error) => {
                    if (!window.axios.isCancel(error)) setStatus('error');
                });
        }, 450);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [field, value, ready]);

    return status;
}
