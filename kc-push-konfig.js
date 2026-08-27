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
  apiKey:            'AIzaSyAiHHf-j9rSYL36DEmeRAtue9Xl4tWOVgY',
  authDomain:        'kc-knueppeldick.firebaseapp.com',
  projectId:         'kc-knueppeldick',
  messagingSenderId: '553048498685',
  appId:             '1:553048498685:web:c8b3c26046e30a837bb994',
  vapidKey:          'BJeYO9No8FHnOT7NF1NlcXWMYPkrpMep8XKhT1C_E8UQV99TebBN0HYyVD4zdGE5wNmCjfSlBp6EUm0stw5bAqg'
};
