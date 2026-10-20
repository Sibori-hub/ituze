/*
 * ITUZE service worker: makes the app installable and quick to open.
 * - App code and fonts (versioned files) are kept on the phone.
 * - Photos are shown from the phone while a fresh copy loads.
 * - Pages and data always come from the server, so nobody sees stale or
 *   someone else's information; without internet an offline page shows.
 */
const VERSION = 'ituze-v3';
const STATIC_CACHE = `${VERSION}-static`;
const IMAGE_CACHE = `${VERSION}-images`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png', '/images/logo.png'];
const MAX_IMAGES = 120;

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
            .then(() => self.clients.claim()),
    );
});

async function trimImages() {
    const cache = await caches.open(IMAGE_CACHE);
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_IMAGES)).map((key) => cache.delete(key)));
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    const sameOrigin = url.origin === self.location.origin;

    // Full page loads: always the server; offline page when there is no connection.
    if (request.mode === 'navigate') {
        event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
        return;
    }

    // Versioned app code and styles never change: keep them.
    if (sameOrigin && url.pathname.startsWith('/build/')) {
        event.respondWith(
            caches.match(request).then((cached) => cached || fetch(request).then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
                }
                return response;
            })),
        );
        return;
    }

    // Fonts from fonts.bunny.net: keep them too.
    if (url.hostname === 'fonts.bunny.net') {
        event.respondWith(
            caches.match(request).then((cached) => cached || fetch(request).then((response) => {
                if (response.ok || response.type === 'opaque') {
                    const copy = response.clone();
                    caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
                }
                return response;
            })),
        );
        return;
    }

    // Building and room photos: show the saved copy at once, refresh it in the background.
    if (sameOrigin && (url.pathname.startsWith('/storage/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/images/'))) {
        event.respondWith(
            caches.open(IMAGE_CACHE).then(async (cache) => {
                const cached = await cache.match(request);
                const network = fetch(request).then((response) => {
                    if (response.ok) {
                        cache.put(request, response.clone()).then(trimImages);
                    }
                    return response;
                }).catch(() => cached);
                return cached || network;
            }),
        );
    }
    // Everything else (Inertia page data, API calls, receipts) goes straight to the server.
});
