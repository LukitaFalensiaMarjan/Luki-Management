'use strict';
/**
 * LUKI MANAGEMENT - Service Worker for PWA
 * Caches core app shell while keeping all /api/ traffic strictly live.
 */
const CACHE_NAME = 'luki-cache-v3';
const APP_SHELL = [
  '/',
  '/style.css',
  '/app.js',
  '/personal.js',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-only for API requests, uploads, websockets, and SSE streams
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/') || event.request.method !== 'GET') {
    return;
  }

  // Stale-while-revalidate for local static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
