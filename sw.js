const CACHE_NAME = 'aura-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    'https://unpkg.com/lucide@latest',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600&family=Comfortaa:wght@400;700;900&family=Caveat:wght@700&display=swap'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
