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

  function knopf() { return document.getElementById('melder-knopf'); }
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
          tag: 'orion-probe'
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
          tag: 'orion-' + f.schluessel     // dieselbe Chance meldet sich nur einmal
        });
      }
    }
    bekannt = jetzt;
  }

  function start() {
    var k = knopf();
    if (k) k.addEventListener('click', umschalten);
    beschrifte();
    setInterval(pruefe, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})(typeof globalThis !== 'undefined' ? globalThis : this);
