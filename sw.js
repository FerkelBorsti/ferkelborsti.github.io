/* KC Knüppeldick – Service Worker
   Zweck: Die App startet auch ohne Netz. Die Daten selbst liegen nicht hier,
   sondern im lokalen Speicher der App – hier liegt nur die Hülle.
   Bei jeder neuen Fassung die Versionsnummer erhöhen. */
const VERSION = 'kc-v1.2.0';
const HUELLE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(HUELLE)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'uebernehmen') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Anfragen ans Backend nie zwischenspeichern – veraltete Strafen wären schlimmer
  // als gar keine.
  if (url.hostname.indexOf('script.google') === 0 ||
      url.hostname.indexOf('script.googleusercontent') === 0) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(treffer => {
      const ausNetz = fetch(e.request).then(antwort => {
        if (antwort && antwort.status === 200 && antwort.type === 'basic') {
          const kopie = antwort.clone();
          caches.open(VERSION).then(c => c.put(e.request, kopie));
        }
        return antwort;
      }).catch(() => treffer);
      return treffer || ausNetz;
    })
  );
});
