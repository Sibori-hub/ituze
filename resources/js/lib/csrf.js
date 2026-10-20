/**
 * CSRF protection for requests made with fetch() and axios.
 *
 * The token in the page's <meta> tag is only read when the page first loads.
 * After signing out and in again, or when a phone keeps a tab open for hours,
 * it no longer matches the session and the server answers "CSRF token
 * mismatch" (419). The XSRF-TOKEN cookie is refreshed on every response, so
 * it is read instead; and on a 419 a fresh token is fetched and the request
 * sent once more.
 */

const cookieToken = () => {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
};

const metaToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

/** Headers that carry the current token (the cookie one is encrypted, hence the XSRF header). */
export function csrfHeaders() {
    const cookie = cookieToken();
    return cookie ? { 'X-XSRF-TOKEN': cookie } : { 'X-CSRF-TOKEN': metaToken() };
}

/** Asks the server for a fresh token; the answer also renews the cookie. */
export async function refreshCsrfToken() {
    const res = await fetch('/csrf-token', { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' });
    const { token } = await res.json();
    document.querySelector('meta[name="csrf-token"]')?.setAttribute('content', token);

    return token;
}

const withToken = (headers = {}) => {
    const clean = Object.fromEntries(Object.entries(headers).filter(([key]) => !/^x-(csrf|xsrf)-token$/i.test(key)));

    return { ...clean, ...csrfHeaders() };
};

/** fetch() with the current token, retried once with a fresh one after a 419. */
export async function csrfFetch(url, options = {}) {
    const send = () => fetch(url, { credentials: 'same-origin', ...options, headers: withToken(options.headers) });
    const res = await send();
    if (res.status !== 419) return res;

    try {
        await refreshCsrfToken();
    } catch {
        return res;
    }

    return send();
}

/** Same retry for axios, which Inertia uses for every form and page visit. */
export function installAxiosCsrfRetry(axios) {
    axios.interceptors.response.use(undefined, async (error) => {
        const config = error?.config;
        if (error?.response?.status !== 419 || !config || config.__csrfRetried) {
            return Promise.reject(error);
        }
        config.__csrfRetried = true;
        try {
            await refreshCsrfToken();
        } catch {
            return Promise.reject(error);
        }
        const headers = config.headers || {};
        ['X-CSRF-TOKEN', 'X-XSRF-TOKEN'].forEach((key) => {
            if (typeof headers.delete === 'function') headers.delete(key);
            else delete headers[key];
        });
        Object.entries(csrfHeaders()).forEach(([key, value]) => {
            if (typeof headers.set === 'function') headers.set(key, value);
            else headers[key] = value;
        });
        config.headers = headers;

        return axios.request(config);
    });
}
