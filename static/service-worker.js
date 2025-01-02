// service-worker.js
console.log('Service Worker file loaded');

// Register periodic sync
const PERIODIC_SYNC_TAG = 'location-sync';
const LOCATION_CACHE_NAME = 'location-cache';

self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', async (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            registerPeriodicSync()
        ])
    );
});

async function registerPeriodicSync() {
    try {
        if ('periodicSync' in self.registration) {
            // Request permission for periodic background sync
            await self.registration.periodicSync.register(PERIODIC_SYNC_TAG, {
                minInterval: 2000 // Minimum 2 seconds
            });
            console.log('Periodic background sync registered');
        }
    } catch (error) {
        console.error('Error registering periodic sync:', error);
    }
}

// Handle periodic sync events
self.addEventListener('periodicsync', (event) => {
    if (event.tag === PERIODIC_SYNC_TAG) {
        event.waitUntil(getAndSendLocation());
    }
});

// Handle background sync fallback
self.addEventListener('sync', (event) => {
    if (event.tag === 'location-sync') {
        event.waitUntil(getAndSendLocation());
    }
});

async function getAndSendLocation() {
    try {
        const clients = await self.clients.matchAll();
        const client = clients[0];
        if (client) {
            // Request location from the client
            client.postMessage({type: 'GET_LOCATION'});
        }
    } catch (error) {
        console.error('Error in getAndSendLocation:', error);
    }
}

// Handle messages from the main thread
self.addEventListener('message', async (event) => {
    if (event.data.type === 'LOCATION_UPDATE') {
        try {
            await sendLocationToServer(event.data.location);
        } catch (error) {
            // Cache failed location updates for retry
            const cache = await caches.open(LOCATION_CACHE_NAME);
            await cache.put(
                new Request(`/location-${Date.now()}`),
                new Response(JSON.stringify(event.data.location))
            );
            // Register for background sync to retry later
            await self.registration.sync.register('location-sync');
        }
    }
});

async function sendLocationToServer(location) {
    const response = await fetch('/location', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(location),
    });

    if (!response.ok) {
        throw new Error('Failed to send location');
    }
}