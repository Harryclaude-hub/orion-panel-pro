/* Orion Panel Pro — Der Puls
 *
 * Eine Scan-Animation, die zeigt, dass gesucht wird. Kein Zierrat: sie ist
 * an den ECHTEN Zustand gekoppelt.
 *
 *   Der Ring dreht sich, wenn der Scanner frisch gelaufen ist.
 *   Er steht still und wird rot, wenn der Scanner steht.
 *
 * Das ist wichtiger, als es aussieht. Ein Ausfall waere sonst still: die
 * Seite zeigt weiter Zahlen, nur eben alte. Eine Animation, die immer
 * laeuft, waere eine Luege — deshalb haelt diese an, wenn nichts mehr
 * passiert, und sagt es auch.
 *
 * Je Buch ein Punkt in SEINER Farbe. Blitzt einer auf, ist von dort gerade
 * etwas gekommen. So sieht man ohne Text, wer liefert und wer schweigt.
 */

(function (welt) {
  'use strict';

  var K = welt.KONFIG || {};

  /* Wie alt darf der letzte Scan sein, damit "es laeuft" gilt.
   * Der Scanner taktet alle 15 s; 90 s sind also drei verpasste Laeufe. */
  var FRISCH_S = 90;

  function elem() { return document.getElementById('orion-puls'); }

  /* Alter einer Quelle in Sekunden, aus der Uebersicht. Drei Zustaende:
   * Zahl, oder null wenn unbekannt — null ist NICHT "alt". */
  function alterS(zeit) {
    if (!zeit) return null;
    var t = Date.parse(zeit);
    if (isNaN(t)) return null;
    return Math.round((Date.now() - t) / 1000);
  }

  function bauen() {
    var buecher = K.buecher || {};
    var punkte = Object.keys(buecher).map(function (id) {
      var b = buecher[id];
      var aus = b.aktiv === false;
      return '<span class="p-punkt ' + b.chip + (aus ? ' p-aus' : '') + '" ' +
             'data-buch="' + id + '" title="' + b.name + (aus ? ' — abgeschaltet' : '') + '"></span>';
    }).join('');

    return '' +
      '<div class="p-ring">' +
        '<svg viewBox="0 0 120 120" class="p-svg" aria-hidden="true">' +
          '<defs>' +
            '<linearGradient id="p-lauf" x1="0" y1="0" x2="1" y2="1">' +
              '<stop offset="0%" stop-color="var(--pm)"/>' +
              '<stop offset="35%" stop-color="var(--ka)"/>' +
              '<stop offset="70%" stop-color="var(--sm)"/>' +
              '<stop offset="100%" stop-color="var(--bf)"/>' +
            '</linearGradient>' +
          '</defs>' +
          '<circle class="p-bahn" cx="60" cy="60" r="52"/>' +
          '<circle class="p-bogen" cx="60" cy="60" r="52"/>' +
          '<circle class="p-bogen2" cx="60" cy="60" r="40"/>' +
        '</svg>' +
        '<div class="p-mitte">' +
          '<div class="p-zahl" id="p-zahl">—</div>' +
          '<div class="p-wort" id="p-wort">Märkte</div>' +
        '</div>' +
        '<div class="p-welle"></div>' +
      '</div>' +
      '<div class="p-seite">' +
        '<div class="p-kopf"><span class="p-led" id="p-led"></span> <b id="p-status">sucht …</b></div>' +
        '<div class="p-punkte">' + punkte + '</div>' +
        '<div class="p-fuss" id="p-fuss"></div>' +
      '</div>';
  }

  var gebaut = false;
  var letzterLauf = null;

  /* Wird von app.js/anzeige.js nach jedem Ablesen aufgerufen. */
  function auffrischen(e) {
    var w = elem();
    if (!w) return;
    if (!gebaut) { w.innerHTML = bauen(); gebaut = true; }

    var u = (e && e.uebersicht) || {};
    var lauf = (e && e.lauf) || {};

    /* Laeuft der Scanner? Gemessen am Alter des letzten Laufs, nicht geraten. */
    var sAlter = alterS(lauf.gelaufen_am || u.scanner_zeit);
    var laeuft = sAlter !== null && sAlter <= FRISCH_S;

    w.classList.toggle('p-an', laeuft);
    w.classList.toggle('p-tot', sAlter !== null && !laeuft);

    var led = document.getElementById('p-led');
    var status = document.getElementById('p-status');
    var fuss = document.getElementById('p-fuss');
    var zahl = document.getElementById('p-zahl');
    var wort = document.getElementById('p-wort');

    if (zahl) {
      var n = Number(lauf.pm_maerkte);
      zahl.textContent = isFinite(n) && n > 0 ? n : '—';
    }
    if (wort) wort.textContent = 'Märkte';

    if (status && led && fuss) {
      if (sAlter === null) {
        led.className = 'p-led p-grau';
        status.textContent = 'kein Lauf bekannt';
        fuss.textContent = 'Die Uhrzeit des letzten Scans fehlt — ungemessen, nicht "steht".';
      } else if (laeuft) {
        led.className = 'p-led p-gruen';
        status.textContent = 'sucht …';
        fuss.textContent = 'letzter Durchlauf vor ' + sAlter + ' s' +
          (isFinite(Number(lauf.dauer_ms)) ? ' · ' + (Number(lauf.dauer_ms) / 1000).toFixed(1) + ' s' : '') +
          (isFinite(Number(lauf.paare)) ? ' · ' + lauf.paare + ' Paare' : '');
      } else {
        led.className = 'p-led p-rot';
        status.textContent = 'steht seit ' + Math.round(sAlter / 60) + ' min';
        fuss.textContent = 'Der Scanner hat sich länger als ' + FRISCH_S + ' s nicht gemeldet. ' +
                           'Die Zahlen auf dieser Seite sind alt.';
      }
    }

    /* Je Buch aufblitzen lassen, wenn seine Kurse frisch sind. Das ist der
     * eigentliche Nutzen: man sieht, WER liefert, ohne zu lesen. */
    /* orion_uebersicht() liefert das Alter je Buch bereits fertig in
     * Sekunden: uebersicht.<buch>.alter_s. Nicht aus einem Zeitstempel
     * ableiten — der Server hat die Zahl schon, und zwar gegen SEINE Uhr.
     * Die des Browsers kann daneben liegen. */
    function buchAlter(id) {
      var b = u[id];
      if (!b || typeof b.alter_s !== 'number' || !isFinite(b.alter_s)) return null;
      return b.alter_s;
    }
    var alter = {
      polymarket: buchAlter('polymarket') !== null ? buchAlter('polymarket') : sAlter,
      kalshi: buchAlter('kalshi'),
      smarkets: buchAlter('smarkets'),
      betfair: buchAlter('betfair')
    };
    var grenze = { polymarket: FRISCH_S, kalshi: K.kalshiMaxAlterS || 600,
                   smarkets: K.smarketsMaxAlterS || 900, betfair: K.bridgeMaxAlterS || 300 };

    var punkte = w.querySelectorAll('.p-punkt');
    for (var i = 0; i < punkte.length; i++) {
      var id = punkte[i].getAttribute('data-buch');
      var b = (K.buecher || {})[id] || {};
      if (b.aktiv === false) continue;               // abgeschaltet bleibt stumm
      var a = alter[id];
      var frisch = a !== null && a <= grenze[id];
      punkte[i].classList.toggle('p-frisch', frisch);
      punkte[i].classList.toggle('p-alt', a !== null && !frisch);
    }

    /* Ein kurzer Schlag, wenn ein NEUER Lauf angekommen ist. */
    var kennung = lauf.gelaufen_am || null;
    if (kennung && kennung !== letzterLauf) {
      letzterLauf = kennung;
      var welle = w.querySelector('.p-welle');
      if (welle) {
        welle.classList.remove('p-schlag');
        void welle.offsetWidth;                      // Neustart der Animation erzwingen
        welle.classList.add('p-schlag');
      }
    }
  }

  /* Eigener Takt statt eines Eingriffs in anzeige.js.
   *
   * Die Seite legt ihr letztes Ableseergebnis in `welt.letztesErgebnis` ab
   * (dasselbe Objekt, das der Filter benutzt). Von dort holt sich der Puls
   * seinen Zustand. Das koppelt ihn an die echten Daten, ohne dass die
   * Zeichenkette in anzeige.js angefasst werden muss — dort haengt eine
   * Falle, die schon einmal zugeschnappt ist (zeichne(e) darf e.chancen
   * nicht ueberschreiben).
   *
   * Der Takt ist bewusst laenger als der Ablesetakt: die Animation laeuft
   * ohnehin in CSS weiter, hier wird nur der ZUSTAND nachgezogen. */
  var lief = false;
  function takt() {
    try { auffrischen(welt.letztesErgebnis || null); } catch (e) { /* nie die Seite mitreissen */ }
  }
  function start() {
    if (lief) return;
    lief = true;
    takt();
    setInterval(takt, 1000);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  welt.Puls = { auffrischen: auffrischen, start: start };

})(typeof globalThis !== 'undefined' ? globalThis : this);
