/* Orion Panel — Ablauf */

(function (welt) {
  'use strict';

  var laeuft = false;
  var letzterLauf = 0;

  function laden(grund) {
    if (laeuft) { welt.Anzeige.stand('läuft schon', 'acht'); return; }
    laeuft = true;
    welt.Anzeige.stand('lädt ' + (grund || '') + ' ...', 'acht');
    var t0 = Date.now();

    welt.Daten.ladeAlles()
      .then(function (ergebnis) {
        welt.Anzeige.zeichne(ergebnis);
        letzterLauf = Date.now();
        welt.Anzeige.stand('fertig in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s', 'gut');
        welt.letztesErgebnis = ergebnis;   // fuer die Konsole, zum Nachmessen
      })
      .catch(function (e) {
        welt.Anzeige.stand('Fehler: ' + e.message, 'rot');
        var l = document.getElementById('liste');
        if (l) l.innerHTML = '<div class="warnung">Laden fehlgeschlagen: ' + e.message +
          '<br>Das ist keine Schoenfaerberei: wenn hier nichts steht, kamen keine Daten.</div>';
      })
      .then(function () { laeuft = false; });
  }

  function start() {
    document.getElementById('neuladen').addEventListener('click', function () {
      laden('von Hand');
    });
    laden('zum Start');
    // Der Server macht die Arbeit, der Browser fragt nur nach.
    setInterval(function () { laden('automatisch'); }, 60000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    welt.Sperre.start(start);
  });

})(typeof globalThis !== 'undefined' ? globalThis : this);
