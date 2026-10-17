// Rwanda-specific formatting shared by sign-up, profile completion and the
// admin account form.

// Mobile numbers after +250: 78/79 = MTN, 72/73 = Airtel.
export const RWANDA_MOBILE_REGEX = /^7[2389]\d{7}$/;

/**
 * Keep only the 9 digits after +250, whether someone types 788..., pastes
 * 0788... or +250 788 ....
 */
export function toLocalDigits(value) {
    let digits = String(value ?? '').replace(/\D/g, '');
    if (digits.startsWith('250')) digits = digits.slice(3);
    if (digits.startsWith('0')) digits = digits.slice(1);
    return digits.slice(0, 9);
}

/** 788123456 -> "788 123 456" */
export function formatPhone(digits) {
    return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean).join(' ');
}

/** 0788123456 -> "+250 788 123 456" (anything else is returned unchanged). */
export function displayPhone(phone) {
    const digits = toLocalDigits(phone);
    return digits.length === 9 ? `+250 ${formatPhone(digits)}` : phone;
}

export function getNetwork(digits) {
    if (/^7[89]/.test(digits)) return 'MTN';
    if (/^7[23]/.test(digits)) return 'Airtel';
    return null;
}

// A Rwandan ID prints as 1 1990 8 0012345 0 12.
const NIDA_GROUPS = [1, 4, 1, 7, 1, 2];

export function formatNida(digits) {
    const parts = [];
    let start = 0;
    for (const size of NIDA_GROUPS) {
        if (start >= digits.length) break;
        parts.push(digits.slice(start, start + size));
        start += size;
    }
    return parts.join(' ');
}
