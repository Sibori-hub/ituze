// Sends browser errors to the server log (storage/logs/laravel.log), so a blank
// screen on someone's computer can be diagnosed without their console.
let sent = 0;

export function reportClientError(error, extra = {}) {
    if (sent >= 10) return;
    sent += 1;

    const body = JSON.stringify({
        message: String(error?.message || error || 'Unknown error'),
        stack: String(error?.stack || ''),
        url: window.location.href,
        ...extra,
    });

    try {
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/client-errors', new Blob([body], { type: 'application/json' }));
            return;
        }
        fetch('/api/client-errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
    } catch {
        // Reporting must never cause another error.
    }
}

/**
 * Last line of defence: if the page ends up empty after an error, show a
 * plain message with a reload button instead of a blank screen.
 */
export function showFallbackIfBlank() {
    setTimeout(() => {
        const root = document.getElementById('app');
        if (!root || root.childElementCount > 0) return;
        root.innerHTML = `
            <div role="alert" style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F4F6F5;font-family:Inter,system-ui,sans-serif;padding:24px">
                <div style="max-width:420px;background:#fff;border-radius:24px;padding:32px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.08)">
                    <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0">Something went wrong</h1>
                    <p style="color:#4B5563;font-size:14px;margin:8px 0 0">This page could not be shown. Reloading usually fixes it.</p>
                    <button type="button" onclick="location.reload()" style="margin-top:20px;background:#0E3B2E;color:#fff;border:0;border-radius:12px;padding:12px 24px;font-weight:600;cursor:pointer">Reload the page</button>
                </div>
            </div>`;
    }, 300);
}
