/* Orion Panel Pro — Ablauf
 *
 * Der Takt hier ist NUR das Ablesen. Gesucht und gerechnet wird auf dem
 * Server in orion-lauf, jede Minute, auch wenn kein Browser offen ist.
 * Deshalb sind zwei Sekunden hier billig: es ist eine kleine Abfrage,
 * kein Scan.
 */

(function (welt) {
  'use strict';

  var laeuft = false;
  var fehlerInFolge = 0;

  function laden(still) {
    if (laeuft) return;
    laeuft = true;
    if (!still) welt.Anzeige.stand('lädt ...', 'acht');
    var t0 = Date.now();

    welt.Daten.ladeAlles()
      .then(function (e) {
        welt.Anzeige.zeichne(e);
        fehlerInFolge = 0;
        welt.letztesErgebnis = e;
        welt.Anzeige.stand('live · ' + (Date.now() - t0) + ' ms', 'gut');
      })
      .catch(function (err) {
        fehlerInFolge++;
        welt.Anzeige.stand('Fehler (' + fehlerInFolge + '): ' + err.message, 'rot');
        if (fehlerInFolge === 1) {
          var w = document.getElementById('warnungen');
          if (w) w.innerHTML = '<div class="warnung">Laden fehlgeschlagen: ' + err.message +
            '<br>Das ist keine Schönfärberei: wenn hier nichts steht, kamen keine Daten.</div>';
        }
      })
      .then(function () { laeuft = false; });
  }

  function start() {
    var knopf = document.getElementById('neuladen');
    if (knopf) knopf.addEventListener('click', function () { laden(false); });

    /* Erst nach dem Entsperren: vorher gibt es die Knoepfe noch nicht. */
    if (welt.Filter) welt.Filter.start();

    laden(false);
    setInterval(function () { laden(true); }, welt.KONFIG.taktMs);

    /* Beim Zurueckkommen auf den Tab sofort auffrischen, nicht bis zum
     * naechsten Takt warten. */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) laden(true);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    welt.Sperre.start(start);
  });

})(typeof globalThis !== 'undefined' ? globalThis : this);
