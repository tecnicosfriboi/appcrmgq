/* Service Worker — Visita Pós-Venda
   Faz o app abrir sem internet e mantém as bibliotecas (Excel/Word) em cache.
   Sempre que publicar uma versão nova do index.html, troque o número do CACHE
   (ex.: posvenda-v2) para forçar a atualização nos aparelhos. */
const CACHE = 'posvenda-v26';

// Arquivos do próprio app (mesma pasta). São pré-carregados na instalação.
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(SHELL.map(u => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // NUNCA cachear o endpoint do Google Sheets (Apps Script): precisa ir sempre à rede.
  if (url.hostname.indexOf('script.google.com') !== -1 ||
      url.hostname.indexOf('script.googleusercontent.com') !== -1 ||
      url.hostname.indexOf('googleusercontent') !== -1) {
    return; // deixa o navegador tratar normalmente (e falhar offline, como esperado)
  }

  // Navegação (abrir o app): tenta a rede; se falhar, serve o app do cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Demais GET (inclui as bibliotecas do CDN): cache primeiro, com atualização em segundo plano.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(resp => {
        if (resp && (resp.ok || resp.type === 'opaque')) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
