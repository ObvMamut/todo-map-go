// Debug version of service-worker.js
const VERSION = 'v1';
console.log('Service Worker Loaded');

let ws = null;
let intervalId = null;

function connectWebSocket() {
    // Use the same host as the page, but with ws:// protocol
    const wsUrl = `ws://${self.location.host}/ws`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('WebSocket connected');
        startPeriodicMessages();
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
        // Try to reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
        console.log('Received message from server:', event.data);
    };
}

async function startPeriodicMessages() {
    if (intervalId) return;

    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        const ip = data.ip;

        intervalId = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(`HELLO SERVER ${ip}`);
            }
        }, 2000);

        console.log('Started periodic messages');
    } catch (error) {
        console.error('Error getting IP:', error);
    }
}

self.addEventListener('install', (event) => {
    console.log('Service Worker installing.');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activated.');
    event.waitUntil(Promise.all([
        clients.claim(),
        connectWebSocket()
    ]));
});

self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});