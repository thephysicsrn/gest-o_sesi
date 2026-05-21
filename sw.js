const CACHE_NAME = 'sesi-gestao-v12';
const ASSETS = [
    './',
    './index.html',
    './login.html',
    './style.css',
    './app.js',
    './logo_sesi.png',
    './manifest.json',
    './admin.html',
    './agendamento.html',
    './atrasos.html',
    './banheiro.html',
    './chaves.html',
    './coordenacao.html',
    './ia.html',
    './monitor.html',
    './pedagogico.html',
    './psicologia.html',
    './supervisao.html',
    './suporte.html',
    './ti.html'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Estratégia: Network first, fallback para cache
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Salva no cache se for um recurso nosso
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
