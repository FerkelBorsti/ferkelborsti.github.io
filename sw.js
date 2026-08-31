/* KC Knüppeldick – Service Worker
   Zweck: Die App startet auch ohne Netz. Die Daten selbst liegen nicht hier,
   sondern im lokalen Speicher der App – hier liegt nur die Hülle.
   Bei jeder neuen Fassung die Versionsnummer erhöhen.

   ÄNDERUNG 31.08.2026 (1.31) – der Startvorgang ist umgedreht worden.

   Bis 1.30 galt für die Hülle "Netz zuerst, Zwischenspeicher als Rückfall".
   Das war 1.7.2 gegen ein echtes Problem eingeführt worden: Die App startete
   mit Netz noch tagelang in der alten Fassung. Es hatte nur einen Haken – der
   Rückfall greift erst, wenn fetch ABLEHNT. Ein schlechtes Netz lehnt nicht
   ab, es ist langsam. Vor dem ersten Pixel stand also immer ein voller
   Rundlauf; bei 200 kbit/s waren das über 15 Sekunden weißer Bildschirm,
   obwohl im Gerät eine gültige Kopie lag.

   Jetzt: Hülle sofort aus dem Zwischenspeicher, Erneuerung im Hintergrund.
   Dass eine neue Fassung da ist, meldet der Browser ohnehin über den
   Service-Worker-Wechsel – die App zeigt dann "Neue Version verfügbar" in der
   Leiste. Seit App 1.29 überlebt dieser Hinweis auch jede Zwischenmeldung.

   ZWEI SPEICHER, mit Absicht:
   - VERSION  hält die Hülle. Er wird bei jeder Fassung neu angelegt und der
              alte gelöscht.
   - BILDER   hält die Logos. Der Name trägt KEINE Fassungsnummer, sonst
              lädt jedes Gerät bei jeder Fassung 300 KB Bilder neu, die sich
              nie ändern. Ändert sich ein Logo doch einmal, bekommt die Datei
              einen neuen Namen – dann holt der Browser sie von selbst. */
const VERSION = 'kc-v1.31';
const BILDER  = 'kc-bilder';

/* Was beim Installieren geholt wird. Bewusst knapp:
   - './' steht nicht drin. Das ist dieselbe Datei wie './index.html', und
     zwei Downloads derselben 90 KB beim Installieren sind zwei zu viel. Die
     Navigation darauf wird unten auf './index.html' abgebildet.
   - die beiden 512er-Symbole stehen nicht drin. Die liest das Betriebssystem
     einmal beim Anlegen des App-Symbols; sie landen über den normalen Weg im
     Speicher, wenn sie gebraucht werden. Das spart beim Installieren 133 KB. */
const HUELLE = [
  './index.html',
  './kc-push-konfig.js',
  './manifest.webmanifest',
  './icon-192.png',
  './apple-touch-icon.png'
];

/* ---------------------------------------------------------------- Push */
/* Firebase wird hier direkt geladen, nicht über eine zweite Service-Worker-
   Datei: Zwei Service Worker auf demselben Pfad vertragen sich nicht.

   DAS MUSS AUF OBERSTER EBENE STEHEN, so unangenehm es ist.
   Beim Umbau am 31.08.2026 war der Gedanke, erst beim Eintreffen einer Meldung
   zu laden – der Service Worker wird auf iOS ständig beendet und muss dann
   jedes Mal zwei Skripte von gstatic.com holen, bevor er irgendetwas
   ausliefert. Das geht aus zwei Gründen nicht:
   1. importScripts() ist nach der Installation verboten. Erlaubt ist es nur,
      solange der Worker "parsed" oder "installing" ist – oder wenn die Datei
      schon einmal geladen wurde. Aus einem push-Handler heraus wirft es.
   2. firebase.messaging() hängt seinen EIGENEN push-Empfänger ein. Wer während
      der Zustellung eines Ereignisses einen Empfänger nachträgt, bekommt genau
      dieses Ereignis nicht mehr – die Liste der Empfänger wird beim Zustellen
      kopiert. Die erste Meldung wäre also immer verloren, und auf iOS ist
      jede Meldung die erste.
   Der Ladeaufwand bleibt damit bestehen. Er ist kleiner, als er aussieht: Nach
   dem ersten Mal liegen beide Dateien im HTTP-Zwischenspeicher des Browsers. */
const FIREBASE = 'https://www.gstatic.com/firebasejs/10.12.2/';

try {
  importScripts('./kc-push-konfig.js');
  if (self.KC_PUSH && self.KC_PUSH.projectId){
    importScripts(FIREBASE + 'firebase-app-compat.js');
    importScripts(FIREBASE + 'firebase-messaging-compat.js');
    firebase.initializeApp(self.KC_PUSH);
    // Seit Backend 1.16 schickt der Server Titel und Text als "notification"
    // mit – die zeigt Firebase dann selbst an, in unserem Wortlaut. Dieser
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

/* Die Logos werden beim Installieren einmal mitgenommen. Sie liegen im
   fassungslosen Speicher BILDER, kosten also genau EINMAL rund 300 KB und bei
   jeder weiteren Fassung nichts mehr. Ohne das stünde beim ersten Start nach
   einem Wechsel ohne Netz (Flugmodus, Keller im Kegelheim) überall nur der
   Alternativtext – bis 1.30 steckten die Bilder in der Datei selbst und waren
   deshalb immer da. */
const BILDDATEIEN = [
  './logo/standard-dunkel-marke.png',    './logo/standard-dunkel-voll.png',
  './logo/standard-hell-marke.png',      './logo/standard-hell-voll.png',
  './logo/weihnachten-dunkel-marke.png', './logo/weihnachten-dunkel-voll.png',
  './logo/weihnachten-hell-marke.png',   './logo/weihnachten-hell-voll.png',
  './logo/urlaub-dunkel-marke.png',      './logo/urlaub-dunkel-voll.png',
  './logo/urlaub-hell-marke.png',        './logo/urlaub-hell-voll.png',
  './logo/wortmarke-dunkel.png',         './logo/wortmarke-hell.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(HUELLE))
      /* Die Bilder dürfen die Installation NICHT scheitern lassen: Ein
         einziges fehlendes Logo würde sonst die ganze neue Fassung
         verhindern. Fehlt eines, wird es später einzeln nachgeholt. */
      .then(() => caches.open(BILDER)
        .then(c => Promise.all(BILDDATEIEN.map(u => c.add(u).catch(() => {}))))
        .catch(() => {}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      // Der Bilder-Speicher bleibt. Nur alte Hüllen werden geräumt.
      Promise.all(keys.filter(k => k !== VERSION && k !== BILDER).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'uebernehmen') self.skipWaiting();
});

/* Ist die Anfrage die App-Hülle selbst? */
function istHuelle(request, url) {
  if (request.mode === 'navigate') return true;
  return /\/$|\/index\.html$/.test(url.pathname);
}

function istBild(url) {
  return /\/logo\/[^/]+\.png$/.test(url.pathname);
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Anfragen ans Backend nie zwischenspeichern – veraltete Strafen wären schlimmer
  // als gar keine.
  if (url.hostname.indexOf('script.google') === 0 ||
      url.hostname.indexOf('script.googleusercontent') === 0) return;
  if (e.request.method !== 'GET') return;

  /* Die Logos: Zwischenspeicher zuerst, und wenn sie da sind, wird nicht
     einmal nachgefragt. Sie ändern sich nie – ändert sich doch eines, trägt
     die Datei einen neuen Namen. */
  if (istBild(url)) {
    e.respondWith(
      caches.open(BILDER).then(c => c.match(e.request).then(treffer => {
        if (treffer) return treffer;
        /* Das Ergebnis von put() wird MITVERKETTET. put() muss den Rumpf der
           Antwort erst zu Ende lesen; hinge diese Zusage an nichts, dürfte der
           Browser den Worker beenden, sobald die Kopfzeilen da sind – das Bild
           landete dann nie im Speicher und würde bei jedem Start neu geholt. */
        const ausNetz = fetch(e.request).then(antwort => {
          if (antwort && antwort.status === 200 && !antwort.redirected) {
            return c.put(e.request, antwort.clone()).then(() => antwort);
          }
          return antwort;
        // Kein Netz und noch nichts im Speicher: eine leere Antwort statt einer
        // unbehandelten Ablehnung. Das Bild bleibt dann eben leer.
        }).catch(() => new Response('', { status: 504, statusText: 'offline' }));
        e.waitUntil(ausNetz);
        return ausNetz;
      }))
    );
    return;
  }

  if (istHuelle(e.request, url)) {
    /* Zwischenspeicher zuerst, Erneuerung im Hintergrund. Die Navigation auf
       './' wird auf './index.html' abgebildet – beides ist dieselbe Datei, und
       nur eine davon liegt im Speicher. */
    const schluessel = (e.request.mode === 'navigate' || url.pathname.endsWith('/'))
      ? './index.html' : e.request;
    e.respondWith(
      caches.open(VERSION).then(c => c.match(schluessel).then(treffer => {
        const ausNetz = fetch(e.request).then(antwort => {
          /* Nicht speichern, wenn die Antwort aus einer Umleitung kommt –
             cache.put lehnt das ab und würde den ganzen Zweig abbrechen. */
          if (antwort && antwort.status === 200 && antwort.type === 'basic' && !antwort.redirected) {
            /* put() MITVERKETTEN, nicht nur anstoßen: Erst wenn put erfüllt
               ist, sind die 90 KB wirklich geschrieben. Sonst gilt die
               Erneuerung als fertig, sobald die Kopfzeilen da sind, der
               Browser beendet den Worker – und die App startet auch beim
               nächsten Mal noch aus der alten Kopie. */
            return c.put(schluessel, antwort.clone()).then(() => antwort);
          }
          return antwort;
        }).catch(() => treffer);
        /* Die Erneuerung am Leben halten: Sobald respondWith erfüllt ist, darf
           der Browser den Worker beenden – ohne waitUntil käme das cache.put
           womöglich nie an. */
        e.waitUntil(ausNetz);
        // Ist eine Kopie da, geht sie sofort raus; das Netz läuft daneben weiter.
        return treffer || ausNetz;
      }))
    );
    return;
  }

  // Alles andere (Symbole, Manifest): Zwischenspeicher zuerst, im Hintergrund
  // auffrischen.
  e.respondWith(
    caches.match(e.request).then(treffer => {
      const ausNetz = fetch(e.request).then(antwort => {
        if (antwort && antwort.status === 200 && antwort.type === 'basic') {
          const kopie = antwort.clone();
          // Auch hier: erst nach dem Schreiben gilt die Erneuerung als fertig.
          return caches.open(VERSION).then(c => c.put(e.request, kopie)).then(() => antwort);
        }
        return antwort;
      }).catch(() => treffer);
      e.waitUntil(ausNetz);
      return treffer || ausNetz;
    })
  );
});
