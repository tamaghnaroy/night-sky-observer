const CACHE_NAME  = 'nso-v2';
const API_CACHE   = 'nso-api-v2';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/planets.js',
    '/stardata.js',
    '/dso-catalog.js',
    '/data/stars.6.json',
    '/data/constellations.lines.json',
    '/sky-worker.js'
];

// ── IndexedDB helpers for last-sync metadata ──────────────────────────────────
const DB_NAME  = 'nso-sync';
const DB_STORE = 'meta';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => {
            if (!e.target.result.objectStoreNames.contains(DB_STORE)) {
                e.target.result.createObjectStore(DB_STORE, { keyPath: 'key' });
            }
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = e => reject(e.target.error);
    });
}
function dbPut(key, value) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put({ key, value, ts: Date.now() });
        tx.oncomplete = resolve;
        tx.onerror    = e => reject(e.target.error);
    }));
}
function dbGet(key) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = e => reject(e.target.error);
    }));
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME && k !== API_CACHE).map(k => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // External hostname: network with empty-body JSON fallback (never empty 503)
    if (url.hostname !== self.location.hostname) {
        event.respondWith(
            fetch(event.request).catch(() =>
                new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
            )
        );
        return;
    }

    // /api/comets: network-first, stale-cache fallback, valid JSON when fully offline
    if (url.pathname === '/api/comets' || url.pathname.startsWith('/api/comets')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        // Cache against bare path so offline lookup always finds it
                        caches.open(API_CACHE).then(c => c.put('/api/comets', clone));
                        dbPut('comets_synced', Date.now()).catch(() => {});
                    }
                    return response;
                })
                .catch(async () => {
                    const cached = await caches.match('/api/comets');
                    if (cached) {
                        const body = await cached.json();
                        body.offline = true;
                        body.stale   = true;
                        const meta = await dbGet('comets_synced').catch(() => null);
                        if (meta) body.lastSynced = meta.value;
                        return new Response(JSON.stringify(body), {
                            status: 200, headers: { 'Content-Type': 'application/json' }
                        });
                    }
                    return new Response(
                        JSON.stringify({ comets: [], offline: true }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } }
                    );
                })
        );
        return;
    }

    // /api/weather: network-first, stale-cache fallback + IndexedDB last-sync
    // Cache key = full request URL (lat/lon-specific); timestamp key is also lat/lon-scoped
    if (url.pathname.startsWith('/api/weather')) {
        const latRaw = url.searchParams.get('lat');
        const lonRaw = url.searchParams.get('lon');
        const latKey = latRaw ? parseFloat(latRaw).toFixed(2) : 'x';
        const lonKey = lonRaw ? parseFloat(lonRaw).toFixed(2) : 'x';
        const tsKey  = `weather_synced_${latKey}_${lonKey}`;
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(API_CACHE).then(c => c.put(event.request, clone));
                        dbPut(tsKey, Date.now()).catch(() => {});
                    }
                    return response;
                })
                .catch(async () => {
                    const cached = await caches.match(event.request);
                    if (cached) {
                        const body = await cached.json();
                        body.offline   = true;
                        body.stale     = true;
                        const meta = await dbGet(tsKey).catch(() => null);
                        if (meta) body.lastSynced = meta.value;
                        return new Response(JSON.stringify(body), {
                            status: 200, headers: { 'Content-Type': 'application/json' }
                        });
                    }
                    return new Response(
                        JSON.stringify({ offline: true }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } }
                    );
                })
        );
        return;
    }

    // Other /api/ calls: network-first with meaningful JSON fallback (no empty 503)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() =>
                new Response(
                    JSON.stringify({ offline: true }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
            )
        );
        return;
    }

    // Static assets: cache-first, populate cache on network hit
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
