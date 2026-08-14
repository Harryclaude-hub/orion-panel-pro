/* Orion Panel Pro — der Melder
 *
 * EINE Aufgabe: eine Browser-Benachrichtigung, sobald eine NEUE Chance
 * erfasst wird, solange die Seite offen ist. An- und abschaltbar über den
 * Knopf im Kopf (#melder-knopf); der Wunsch bleibt in localStorage.
 *
 * Bewusst eine EIGENE Datei: der Melder liest nur welt.letztesErgebnis,
 * genau wie das Sonar. Er kennt weder daten.js noch anzeige.js — wer an
 * der Logik arbeitet, kann diese Datei vollstaendig ignorieren, und wer
 * sie loescht, verliert nur die Benachrichtigung.
 *
 * DREI ZUSTAENDE, ehrlich angezeigt:
 *   AN        Erlaubnis erteilt, Melder eingeschaltet
 *   AUS       ausgeschaltet (oder Erlaubnis nie gefragt)
 *   GESPERRT  der Browser verweigert Benachrichtigungen fuer diese Seite —
 *             dann sagt der Knopf das, statt still nichts zu tun
 */
(function (welt) {
  'use strict';

  var SCHLUESSEL = 'orion-melder';

  function knopf() { return (document.getElementById('melder-text') || document.getElementById('melder-knopf')); }
  function gewollt() { return localStorage.getItem(SCHLUESSEL) === 'an'; }

  function beschrifte() {
    var k = knopf();
    if (!k) return;
    if (!('Notification' in window)) {
      k.textContent = '🔕 Meldungen: geht hier nicht';
      k.classList.add('gesperrt');
      return;
    }
    if (Notification.permission === 'denied') {
      k.textContent = '🔕 Meldungen: vom Browser gesperrt';
      k.title = 'Der Browser verweigert Benachrichtigungen für diese Seite. ' +
                'Freigeben über das Schloss-Symbol in der Adressleiste.';
      return;
    }
    var an = gewollt() && Notification.permission === 'granted';
    k.textContent = an ? '🔔 Meldungen: AN' : '🔕 Meldungen: AUS';
    k.classList.toggle('melder-an', an);
  }

  function umschalten() {
    if (!('Notification' in window) || Notification.permission === 'denied') { beschrifte(); return; }
    if (gewollt()) {
      localStorage.setItem(SCHLUESSEL, 'aus');
      beschrifte();
      return;
    }
    Notification.requestPermission().then(function (erlaubnis) {
      localStorage.setItem(SCHLUESSEL, erlaubnis === 'granted' ? 'an' : 'aus');
      beschrifte();
      if (erlaubnis === 'granted') {
        /* Eine Probe-Meldung, damit man sofort sieht, wie es aussieht. */
        new Notification('Orion Panel Pro', {
          body: 'Meldungen sind an. Du hörst von mir, sobald ein Ziel erfasst wird.',
          tag: 'orion-chance',
          silent: true
        });
      }
    });
  }

  /* Gemeldet wird, wenn die Zahl der CHANCEN steigt — dieselbe Zaehlung
   * wie am Sonar und in der Liste (alle fuenf Bedingungen erfuellt).
   * Der Vergleich laeuft ueber die Schluessel, nicht nur die Anzahl:
   * faellt eine Chance weg und kommt eine andere dazu, ist das eine
   * NEUE Chance und keine Null-Differenz. */
  var bekannt = null;   // Set der Schluessel; null = erster Durchlauf

  function pruefe() {
    var e = welt.letztesErgebnis;
    if (!e || !Array.isArray(e.chancen)) return;
    var jetzt = new Set(e.chancen.map(function (f) { return f.schluessel; }));

    if (bekannt !== null && gewollt() &&
        ('Notification' in window) && Notification.permission === 'granted') {
      var neue = e.chancen.filter(function (f) { return !bekannt.has(f.schluessel); });
      for (var i = 0; i < Math.min(neue.length, 3); i++) {
        var f = neue[i];
        new Notification('Ziel erfasst: +' + Number(f.rendite).toFixed(2) + ' %', {
          body: String(f.titel || '') + '\n' +
                (f.echter_gewinn != null ? 'holbar rund ' + Number(f.echter_gewinn).toFixed(2) + ' $' : ''),
          /* EIN gemeinsames Etikett: die neue Meldung ERSETZT die alte,
           * statt sich in der Benachrichtigungszentrale zu stapeln — und
           * LAUTLOS ist sie auch: Ton macht allein der Ton-Knopf. */
          tag: 'orion-chance',
          silent: true
        });
      }
    }
    bekannt = jetzt;
  }

  /* ---------- E-MAIL-MELDUNGEN (Vorgabe 15.8.) ----------
   *
   * RECHTSKLICK auf den Meldungen-Knopf richtet die E-Mail ein. Die
   * Adresse liegt in der Datenbank (orion_mail), denn VERSCHICKEN muss
   * der Server: Mails sollen auch kommen, wenn kein Browser offen ist.
   * Den eigentlichen Versand macht die Serverfunktion orion-melder-mail
   * im Minutentakt — sie braucht einen RESEND_API_KEY als Supabase-
   * Geheimnis (kostenloses Resend-Konto). Push und Mail schalten sich
   * GETRENNT: Linksklick = Push, Rechtsklick = Mail.  */
  function mailBeschrifte(zeile) {
    var k = document.getElementById('melder-klein');
    if (k) k.textContent = zeile;
  }
  function mailLaden() {
    var K = welt.KONFIG;
    return fetch(K.supabase + '/rest/v1/orion_mail?id=eq.1', {
      headers: { apikey: K.key, authorization: 'Bearer ' + K.key }
    }).then(function (r) { return r.json(); })
      .then(function (z) { return z[0] || null; })
      .catch(function () { return null; });
  }
  function mailSpeichern(email, aktiv) {
    var K = welt.KONFIG;
    return fetch(K.supabase + '/rest/v1/orion_mail?id=eq.1', {
      method: 'PATCH',
      headers: { apikey: K.key, authorization: 'Bearer ' + K.key,
                 'content-type': 'application/json', prefer: 'return=representation' },
      body: JSON.stringify({ email: email, aktiv: aktiv, geaendert_am: new Date().toISOString() })
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }
  function mailDialog() {
    mailLaden().then(function (m) {
      var alt = (m && m.email) || '';
      var eingabe = window.prompt(
        'E-Mail für Meldungen bei jeder neuen Chance.\n' +
        'Leer lassen und OK = Mail-Meldungen AUS.\n' +
        '(Versand läuft auf dem Server — kommt auch, wenn die Seite zu ist.)', alt);
      if (eingabe === null) return;                    // Abbrechen
      var email = eingabe.trim();
      var aktiv = email.length > 3 && email.indexOf('@') !== -1;
      mailSpeichern(email, aktiv).then(function (ok) {
        mailBeschrifte(!ok ? 'Mail: Speichern fehlgeschlagen'
          : aktiv ? 'Mail: AN → ' + email : 'Mail: AUS · Rechtsklick ändert');
      });
    });
  }

  function start() {
    var k = document.getElementById('melder-knopf') || knopf();
    if (k) {
      k.addEventListener('click', umschalten);
      k.addEventListener('contextmenu', function (ev) { ev.preventDefault(); mailDialog(); });
    }
    beschrifte();
    mailLaden().then(function (m) {
      if (m && m.aktiv && m.email) mailBeschrifte('Mail: AN → ' + m.email);
    });
    setInterval(pruefe, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})(typeof globalThis !== 'undefined' ? globalThis : this);
