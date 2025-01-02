// Cache name for storing assets
const CACHE_NAME = 'task-app-cache-v1';

// Assets to cache
const CACHE_URLS = [
    '/',
    '/index.html',
    '/manage-tasks.html',
    '/completed-tasks.html',
    '/css/styles.css',
    '/js/manage-tasks.js',
    '/js/completed-tasks.js',
    'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js',
    'https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.js',
    'https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.css'
];

// Install event handler - cache assets and send initial location
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(CACHE_NAME).then((cache) => {
                console.log('Caching app shell and assets...');
                return cache.addAll(CACHE_URLS);
            }),
            // Send initial location
            sendLocationToServer()
        ])
    );
});

// Fetch event handler - serve from cache first, then network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response; // Return cached response
                }
                return fetch(event.request); // Fetch from network
            })
            .catch((error) => {
                console.error('Fetch error:', error);
            })
    );
});

// Activate event handler - clean up old caches and register periodic sync
self.addEventListener('activate', async (event) => {
    console.log('Service Worker activating...');

    // Clean up old caches
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

    // Register periodic sync if supported
    try {
        if ('periodicSync' in self.registration) {
            const status = await navigator.permissions.query({
                name: 'periodic-background-sync',
            });

            if (status.state === 'granted') {
                await self.registration.periodicSync.register('send-location', {
                    minInterval: 15 * 60 * 1000, // 15 minutes
                });
                console.log('Periodic sync registered successfully');
            } else {
                console.log('Periodic sync permission not granted');
            }
        } else {
            console.log('Periodic sync not supported in this browser');
        }
    } catch (error) {
        console.error('Error registering periodic sync:', error);
    }
});

// Periodic sync event handler
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'send-location') {
        console.log('Periodic sync triggered - sending location');
        event.waitUntil(sendLocationToServer());
    }
});

// Function to send location to server
async function sendLocationToServer() {
    try {
        if (!navigator.geolocation) {
            console.log('Geolocation not supported');
            return;
        }

        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            });
        });

        console.log('Got position:', position.coords.latitude, position.coords.longitude);

        const response = await fetch('/location', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                lat: position.coords.latitude,
                lon: position.coords.longitude,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log('Location sent successfully');
    } catch (error) {
        console.error('Error sending location:', error);
        if (error.name === 'GeolocationPositionError') {
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    console.log('User denied geolocation permission');
                    break;
                case error.POSITION_UNAVAILABLE:
                    console.log('Location information unavailable');
                    break;
                case error.TIMEOUT:
                    console.log('Location request timed out');
                    break;
                default:
                    console.log('Unknown geolocation error');
            }
        }
    }
}

// Message event handler for manual location updates
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SEND_LOCATION') {
        console.log('Manual location update requested');
        event.waitUntil(sendLocationToServer());
    }
});