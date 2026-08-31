/* KC Knüppeldick – Service Worker
   Zweck: Die App startet auch ohne Netz. Die Daten selbst liegen nicht hier,
   sondern im lokalen Speicher der App – hier liegt nur die Hülle.
   Bei jeder neuen Fassung die Versionsnummer erhöhen.

   Änderung 27.08.2026 (1.7.2): Die Hülle wird jetzt zuerst aus dem Netz geholt
   und nur bei fehlendem Empfang aus dem Zwischenspeicher. Vorher galt umgekehrt
   "Zwischenspeicher zuerst" – dadurch startete die App auch mit Netz noch tagelang
   in der alten Fassung. Offline funktioniert unverändert, nur eben als Rückfall. */
const VERSION = 'kc-v1.25';
const HUELLE = [
  './',
  './index.html',
  './kc-push-konfig.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './icon-maskable-512.png'
];

/* ---------------------------------------------------------------- Push */
/* Firebase wird hier direkt geladen, nicht über eine zweite Service-Worker-
   Datei: Zwei Service Worker auf demselben Pfad vertragen sich nicht. Schlägt
   das Laden fehl (kein Netz beim Installieren), läuft die App normal weiter –
   dann gibt es eben keine Benachrichtigungen. */
const FIREBASE = 'https://www.gstatic.com/firebasejs/10.12.2/';

try {
  importScripts('./kc-push-konfig.js');
  if (self.KC_PUSH && self.KC_PUSH.projectId){
    importScripts(FIREBASE + 'firebase-app-compat.js');
    importScripts(FIREBASE + 'firebase-messaging-compat.js');
    firebase.initializeApp(self.KC_PUSH);
    // Seit Backend 1.16 schickt der Server Titel und Text als "notification"
    // mit – die zeigt das System dann selbst an, in unserem Wortlaut. Dieser
    // Zweig greift nur noch, wenn eine reine Daten-Nachricht ankommt; sonst
    // stünde die Meldung doppelt auf dem Bildschirm.
    firebase.messaging().onBackgroundMessage(m => {
      if (m && m.notification) return;
      const d = (m && m.data) || {};
      return self.registration.showNotification(d.titel || 'KC Knüppeldick', {
        body: d.text || '',
        icon: './icon-192.png',
        badge: './icon-192.png',
        lang: 'de',
        tag: 'kc-' + (d.ziel || 'start'),
        data: { ziel: d.ziel || 'start' }
      });
    });
  }
} catch (e) {
  console.warn('Push nicht verfügbar:', e);
}

/* Tippt jemand auf die Meldung: die schon offene App nach vorn holen und ihr
   das Ziel schicken – sonst die App mit ?zeigen=… neu öffnen. */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  // Bei einer "notification"-Meldung steckt das Ziel in FCMs eigenem Feld.
  const roh = e.notification.data || {};
  const ziel = roh.ziel || (roh.FCM_MSG && roh.FCM_MSG.data && roh.FCM_MSG.data.ziel) || 'start';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(liste => {
      for (const c of liste){
        if (c.url.indexOf(self.registration.scope) === 0 && 'focus' in c){
          c.postMessage({ typ: 'zeigen', ziel: ziel });
          return c.focus();
        }
      }
      return self.clients.openWindow('./?zeigen=' + encodeURIComponent(ziel));
    })
  );
});

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
