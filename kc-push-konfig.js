/* KC Knüppeldick – Zugangsdaten für Push-Benachrichtigungen
   ---------------------------------------------------------------------------
   NUR ÖFFENTLICHE WERTE. Alles hier steht ohnehin in jedem Browser, der die App
   lädt – der geheime Teil (das Dienstkonto) liegt in den Skript-Eigenschaften
   des Backends und kommt hier NICHT hinein.

   Auszufüllen aus der Firebase-Konsole:
     apiKey … appId   Projekt-Einstellungen → Allgemein → Meine Apps → Web-App
     vapidKey         Projekt-Einstellungen → Cloud Messaging →
                      Web-Konfiguration → Web-Push-Zertifikate → Schlüsselpaar

   Solange projectId oder vapidKey leer sind, ist Push einfach aus. Die App
   läuft dann unverändert, der Schalter taucht in den Einstellungen nicht auf. */

self.KC_PUSH = {
  apiKey:            '',
  authDomain:        '',
  projectId:         '',
  messagingSenderId: '',
  appId:             '',
  vapidKey:          ''
};
