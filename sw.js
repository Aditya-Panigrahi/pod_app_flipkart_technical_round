// Service Worker for POD PWA - Offline Support and Caching
const CACHE_NAME = 'pod-app-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/src/css/styles.css',
    '/src/js/app.js',
    '/manifest.json',
    'https://unpkg.com/quagga@0.12.1/dist/quagga.min.js'
];

// Install - Cache essential resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('PWA resources cached');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch - Serve from cache when offline
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request);
            })
            .catch(() => {
                if (event.request.destination === 'document') {
                    return caches.match('/index.html');
                }
            })
    );
});

// Activate - Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Background sync for future S3 upload features
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('Background sync triggered - Future S3 upload integration');
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    // Placeholder for future S3 upload sync when connection is restored
    console.log('Background sync ready for S3 integration');
}