/* Orion Panel — Sperrbildschirm
 *
 * Fehlerklasse 1: Beim Entsperren wurde frueher nur das Versteck-CSS entfernt,
 * nicht das Overlay. Es ist bildschirmfuellend mit z-index 2147483647, die
 * Seite sah normal aus, schluckte aber jeden Klick. 49 von 53 Knoepfen
 * unerreichbar. Regel: nach dem Entsperren IMMER das Overlay ENTFERNEN,
 * plus eine Wache, die ein verwaistes Overlay wegraeumt.
 *
 * Fehlerklasse 2: Zugang lag nur im sessionStorage. Bei gesperrtem Speicher
 * landete das "ok" im Arbeitsspeicher, den das folgende reload() loeschte
 * -> Endlosschleife. Regel: localStorage zuerst, und pruefen ob wirklich
 * geschrieben wurde.
 */

(function (welt) {
  'use strict';

  var SCHLUESSEL = 'orion-zugang';
  var imSpeicher = null;   // letzter Ausweg, wenn beide Speicher gesperrt sind

  function schreibe(wert) {
    try {
      localStorage.setItem(SCHLUESSEL, wert);
      if (localStorage.getItem(SCHLUESSEL) === wert) return 'local';
    } catch (e) { /* gesperrt, weiter */ }
    try {
      sessionStorage.setItem(SCHLUESSEL, wert);
      if (sessionStorage.getItem(SCHLUESSEL) === wert) return 'session';
    } catch (e) { /* gesperrt, weiter */ }
    imSpeicher = wert;
    return 'arbeitsspeicher';
  }

  function lies() {
    try { var a = localStorage.getItem(SCHLUESSEL); if (a) return a; } catch (e) {}
    try { var b = sessionStorage.getItem(SCHLUESSEL); if (b) return b; } catch (e) {}
    return imSpeicher;
  }

  /* Das Overlay wird ENTFERNT, nicht versteckt. */
  function entferneOverlay() {
    var o = document.getElementById('sperre');
    if (o && o.parentNode) o.parentNode.removeChild(o);
  }

  /* Wache: raeumt ein verwaistes Overlay weg, falls es je wieder auftaucht,
   * obwohl der Zugang schon erteilt ist. */
  function wache() {
    setInterval(function () {
      if (lies() === 'ok') {
        var o = document.getElementById('sperre');
        if (o) { entferneOverlay(); console.warn('verwaistes Sperr-Overlay entfernt'); }
      }
    }, 2000);
  }

  function start(beiErfolg) {
    if (lies() === 'ok') { entferneOverlay(); wache(); beiErfolg(); return; }

    var feld = document.getElementById('sperrwort');
    var knopf = document.getElementById('entsperren');
    var fehler = document.getElementById('sperrfehler');

    /* Abdruck des eingetippten Wortes rechnen (19.8.2026). Vorher wurde
     * gegen das Wort im Klartext verglichen — das musste dafuer im
     * oeffentlichen Repo stehen. Jetzt liegt dort nur der Abdruck.
     * crypto.subtle gibt es in jedem Browser, der diese Seite ohnehin
     * darstellt; es arbeitet asynchron, deshalb der Umweg ueber then(). */
    function abdruck(wort) {
      var daten = new TextEncoder().encode(wort);
      return crypto.subtle.digest('SHA-256', daten).then(function (puffer) {
        return Array.prototype.map.call(new Uint8Array(puffer), function (b) {
          return ('0' + b.toString(16)).slice(-2);
        }).join('');
      });
    }

    function versuch() {
      if (!feld.value) { fehler.textContent = 'Bitte das Wort eingeben.'; return; }
      abdruck(feld.value).then(function (h) {
        if (h !== welt.KONFIG.sperrwortHash) {
          fehler.textContent = 'Falsch.';
          feld.value = '';
          return;
        }
        weiter();
      }).catch(function () {
        /* Kein crypto.subtle (nur bei unverschluesselten Verbindungen):
         * ehrlich sagen statt still durchlassen. */
        fehler.textContent = 'Pruefung nicht moeglich — bitte die Seite ueber https aufrufen.';
      });
    }

    function weiter() {
      var wo = schreibe('ok');
      if (wo === 'arbeitsspeicher') {
        fehler.textContent = 'Speicher gesperrt, der Zugang gilt nur bis zum Neuladen.';
      }
      entferneOverlay();
      wache();
      beiErfolg();
    }

    knopf.addEventListener('click', versuch);
    feld.addEventListener('keydown', function (e) { if (e.key === 'Enter') versuch(); });
    feld.focus();
  }

  welt.Sperre = { start: start, entferneOverlay: entferneOverlay, lies: lies };

})(typeof globalThis !== 'undefined' ? globalThis : this);
