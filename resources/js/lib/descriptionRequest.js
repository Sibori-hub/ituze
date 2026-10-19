/**
 * Helpers for the "write description" buttons, which call the server with
 * fetch() rather than Inertia. They turn an expired sign-in or too many
 * attempts into a clear message instead of a generic failure.
 */
export class DescriptionRequestError extends Error {
    constructor(reason) {
        super(reason);
        this.reason = reason;
    }
}

/** Throws when the answer is not a usable description response. */
export function checkDescriptionResponse(res) {
    // Signed out: a JSON request gets 401; a redirect lands on the login page.
    if (res.status === 401 || res.status === 419 || (res.redirected && /\/login(\?|$)/.test(res.url))) {
        throw new DescriptionRequestError('session');
    }
    if (res.status === 429) {
        throw new DescriptionRequestError('busy');
    }
    if (!res.ok) {
        throw new DescriptionRequestError('failed');
    }
}

export function descriptionErrorMessage(error, t) {
    if (error?.reason === 'session') {
        return t('Your sign-in has expired. Refresh the page and sign in again, then try once more.');
    }
    if (error?.reason === 'busy') {
        return t('Too many descriptions in a short time. Wait a minute and try again.');
    }
    return t('The description could not be written right now. You can type it yourself.');
}
