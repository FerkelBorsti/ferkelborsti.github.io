/* KC Knüppeldick – Service Worker
   Zweck: Die App startet auch ohne Netz. Die Daten selbst liegen nicht hier,
   sondern im lokalen Speicher der App – hier liegt nur die Hülle.
   Bei jeder neuen Fassung die Versionsnummer erhöhen.

   Änderung 27.08.2026 (1.7.2): Die Hülle wird jetzt zuerst aus dem Netz geholt
   und nur bei fehlendem Empfang aus dem Zwischenspeicher. Vorher galt umgekehrt
   "Zwischenspeicher zuerst" – dadurch startete die App auch mit Netz noch tagelang
   in der alten Fassung. Offline funktioniert unverändert, nur eben als Rückfall. */
const VERSION = 'kc-v1.10.1';
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

/* Ist die Anfrage die App-Hülle selbst? Dann zählt Aktualität mehr als Tempo. */
function istHuelle(request, url) {
  if (request.mode === 'navigate') return true;
  return /\/$|\/index\.html$|\/sw\.js$/.test(url.pathname);
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Anfragen ans Backend nie zwischenspeichern – veraltete Strafen wären schlimmer
  // als gar keine.
  if (url.hostname.indexOf('script.google') === 0 ||
      url.hostname.indexOf('script.googleusercontent') === 0) return;
  if (e.request.method !== 'GET') return;

  if (istHuelle(e.request, url)) {
    // Netz zuerst, Zwischenspeicher als Rückfall.
    e.respondWith(
      fetch(e.request).then(antwort => {
        if (antwort && antwort.status === 200 && antwort.type === 'basic') {
          const kopie = antwort.clone();
          caches.open(VERSION).then(c => c.put(e.request, kopie));
        }
        return antwort;
      }).catch(() =>
        caches.match(e.request).then(treffer => treffer || caches.match('./index.html'))
      )
    );
    return;
  }

  // Alles andere (Symbole, Manifest): Zwischenspeicher zuerst, im Hintergrund
  // auffrischen. Das ändert sich praktisch nie und soll nicht bremsen.
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
