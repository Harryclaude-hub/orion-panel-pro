/* Orion Panel Pro — die Bühne
 *
 * REINES AUSSEHEN, eigene Datei (wie melder.js): liest nur
 * welt.letztesErgebnis, kennt keine Logik, darf jederzeit gelöscht werden.
 *
 * Zwei Aufgaben:
 *
 * 1. DIE FLANKEN. Auf breiten Bildschirmen bleiben links und rechts der
 *    Seite leere Ränder. Dort laufen jetzt Scan-Säulen, und ihr Zustand
 *    zeigt die VERBINDUNGSLAGE — mit Funksprüchen statt Fehlercodes:
 *
 *      ruhig    alle Bücher frisch          "ALLE EINHEITEN AUF STATION"
 *      wachsam  ein Buch wird alt           "VERBINDUNG SCHWACH — <BUCH>"
 *      alarm    ein Buch meldet sich nicht  "KAMERAD VERLOREN — <BUCH> STUMM"
 *               oder der Scanner steht      "FUNKSTILLE — SCANNER MELDET SICH NICHT"
 *               oder gar keine Daten        "VERBINDUNG ABGERISSEN"
 *
 *    Der Zustand steuert Farbe und Tempo der Animation: ruhig scannt
 *    langsam gruen, wachsam schneller in Bernstein, alarm flackert rot.
 *
 * 2. DAS KINO. Wird eine NEUE Chance erfasst (Vergleich über Schlüssel,
 *    wie im Melder), spielt einmal eine Vollbild-Einblendung: Schleier,
 *    einrastende Zielmarken, Stempel mit Rendite und Partie. Sie fängt
 *    keine Klicks ab (pointer-events: none) und verschwindet von selbst.
 *
 * Alles Bewegte läuft auf transform/opacity. Ein Takt alle 2 Sekunden.
 */
(function (welt) {
  'use strict';

  var K = welt.KONFIG || {};

  /* ---------- Gerüst einmal bauen ---------- */
  function baue() {
    if (document.getElementById('flanke-l')) return;

    function flanke(id, seite) {
      var f = document.createElement('div');
      f.id = id;
      f.className = 'flanke ' + seite;
      f.setAttribute('aria-hidden', 'true');
      f.innerHTML =
        '<div class="fl-gitter"></div>' +
        '<div class="fl-scan"></div>' +
        '<div class="fl-ticks"></div>' +
        '<div class="fl-wort"><span></span></div>';
      document.body.appendChild(f);
      return f;
    }
    flanke('flanke-l', 'links');
    flanke('flanke-r', 'rechts');

    var kino = document.createElement('div');
    kino.id = 'kino';
    kino.setAttribute('aria-hidden', 'true');
    kino.innerHTML =
      '<div class="kino-schleier"></div>' +
      '<div class="kino-ring"></div>' +
      '<div class="kino-ring kino-ring2"></div>' +
      '<i class="kino-marke m1"></i><i class="kino-marke m2"></i>' +
      '<i class="kino-marke m3"></i><i class="kino-marke m4"></i>' +
      '<div class="kino-text"><b>ZIEL ERFASST</b><span id="kino-info"></span></div>';
    document.body.appendChild(kino);
  }

  /* ---------- Verbindungslage bestimmen ---------- */
  function lage() {
    var e = welt.letztesErgebnis;
    if (!e) return { stufe: 'alarm', wort: 'VERBINDUNG ABGERISSEN' };

    var u = e.uebersicht || {};
    var grenzen = {
      polymarket: K.laufMaxAlterS || 180,
      kalshi: K.kalshiMaxAlterS || 600,
      smarkets: K.smarketsMaxAlterS || 900,
      betfair: K.bridgeMaxAlterS || 300
    };

    var verloren = null, muede = null;
    for (var buch in grenzen) {
      var info = (K.buecher || {})[buch] || {};
      if (info.aktiv === false) continue;
      var a = u[buch] && u[buch].alter_s;
      if (typeof a !== 'number' || !isFinite(a)) continue;   // ungemessen ist nicht tot
      if (a > grenzen[buch]) { verloren = info.name || buch; break; }
      if (a > grenzen[buch] * 0.7) muede = info.name || buch;
    }
    if (verloren) return { stufe: 'alarm', wort: 'KAMERAD VERLOREN — ' + verloren.toUpperCase() + ' STUMM' };

    var lauf = e.lauf || {};
    var laufAlter = lauf.gelaufen_am ? (Date.now() - Date.parse(lauf.gelaufen_am)) / 1000 : null;
    if (laufAlter !== null && laufAlter > 120) {
      return { stufe: 'alarm', wort: 'FUNKSTILLE — SCANNER MELDET SICH NICHT' };
    }
    if (muede) return { stufe: 'wachsam', wort: 'VERBINDUNG SCHWACH — ' + muede.toUpperCase() };
    return { stufe: 'ruhig', wort: 'ALLE EINHEITEN AUF STATION' };
  }

  var letzteStufe = null, letztesWort = null;

  function flankenTakt() {
    var l = lage();
    if (l.stufe === letzteStufe && l.wort === letztesWort) return;
    letzteStufe = l.stufe; letztesWort = l.wort;
    ['flanke-l', 'flanke-r'].forEach(function (id) {
      var f = document.getElementById(id);
      if (!f) return;
      f.className = f.className.replace(/\b(ruhig|wachsam|alarm)\b/g, '').trim() + ' ' + l.stufe;
      var w = f.querySelector('.fl-wort span');
      if (w && w.textContent !== l.wort) w.textContent = l.wort;
    });
  }

  /* ---------- Das Kino ---------- */
  var bekannteChancen = null;
  var kinoWecker = null;

  function kinoTakt() {
    var e = welt.letztesErgebnis;
    if (!e || !Array.isArray(e.chancen)) return;
    var jetzt = new Set(e.chancen.map(function (f) { return f.schluessel; }));

    if (bekannteChancen !== null) {
      var neue = e.chancen.filter(function (f) { return !bekannteChancen.has(f.schluessel); });
      if (neue.length) spiele(neue);
    }
    bekannteChancen = jetzt;
  }

  function spiele(neue) {
    var kino = document.getElementById('kino');
    if (!kino) return;
    var f = neue[0];
    var info = '+' + Number(f.rendite).toFixed(2) + ' % · ' + String(f.titel || '') +
               (f.echter_gewinn != null ? ' · holbar ' + Number(f.echter_gewinn).toFixed(2) + ' $' : '') +
               (neue.length > 1 ? '  (+' + (neue.length - 1) + ' weitere)' : '');
    var ziel = document.getElementById('kino-info');
    if (ziel) ziel.textContent = info;

    kino.classList.remove('an');
    void kino.offsetWidth;                     // Animation neu anstossen
    kino.classList.add('an');
    if (kinoWecker) clearTimeout(kinoWecker);
    kinoWecker = setTimeout(function () { kino.classList.remove('an'); }, 3000);
  }

  function start() {
    baue();
    flankenTakt();
    setInterval(function () { flankenTakt(); kinoTakt(); }, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  /* Fuer den Pruefstand von aussen anstossbar. */
  welt.Buehne = { spiele: spiele, lage: lage };

})(typeof globalThis !== 'undefined' ? globalThis : this);
