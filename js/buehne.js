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
        /* Mini-Radar oben: derselbe Sweep wie am grossen Schirm, nur klein. */
        '<div class="fl-radar"><i></i></div>' +
        '<div class="fl-wort"><span></span></div>' +
        /* Ein Jaeger, der die Flanke entlang zieht. */
        '<svg class="fl-jet" viewBox="0 0 72 24" aria-hidden="true">' +
          '<path fill="currentColor" d="M12 10.6 L20 10 L24 4 L27 4 L25.5 9.6 L40 8.4 ' +
            'L52 3 L55 3 L48 9 L60 9.4 L70 11.4 L72 12 L70 12.6 L60 14.6 L48 15 ' +
            'L55 21 L52 21 L40 15.6 L25.5 14.4 L27 20 L24 20 L20 14 L12 13.4 Z"/>' +
        '</svg>' +
        /* SCHLACHTFELD (Vorgabe 14.8. abends): "keine Scananimationen,
         * sondern Panzer, Flugzeuge, Schuesse und Soldaten." Silhouetten,
         * die die Flanke bevoelkern — alles reine CSS-Bewegung. */
        '<div class="fl-feld">' +
          '<svg class="fl-panzer" viewBox="0 0 64 28" aria-hidden="true">' +
            '<path fill="currentColor" d="M4 20 h56 l-5 6 h-46 z"/>' +
            '<circle cx="14" cy="23" r="2.2" fill="#1D211B"/><circle cx="24" cy="23" r="2.2" fill="#1D211B"/>' +
            '<circle cx="34" cy="23" r="2.2" fill="#1D211B"/><circle cx="44" cy="23" r="2.2" fill="#1D211B"/>' +
            '<path fill="currentColor" d="M16 12 h24 v8 h-28 z"/>' +
            '<path fill="currentColor" d="M24 6 h12 v6 h-12 z"/>' +
            '<rect fill="currentColor" x="36" y="8" width="24" height="2.6"/>' +
          '</svg>' +
          '<svg class="fl-soldat s1" viewBox="0 0 20 34" aria-hidden="true">' +
            '<circle cx="10" cy="5" r="3.6" fill="currentColor"/>' +
            '<rect x="7" y="9" width="6" height="12" rx="2" fill="currentColor"/>' +
            '<rect x="12" y="10" width="7" height="2.4" rx="1.2" fill="currentColor"/>' +
            '<path class="bein b1" d="M8.6 21 L7 32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
            '<path class="bein b2" d="M11.4 21 L13 32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
          '</svg>' +
          '<svg class="fl-soldat s2" viewBox="0 0 20 34" aria-hidden="true">' +
            '<circle cx="10" cy="5" r="3.6" fill="currentColor"/>' +
            '<rect x="7" y="9" width="6" height="12" rx="2" fill="currentColor"/>' +
            '<rect x="12" y="10" width="7" height="2.4" rx="1.2" fill="currentColor"/>' +
            '<path class="bein b1" d="M8.6 21 L7 32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
            '<path class="bein b2" d="M11.4 21 L13 32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
          '</svg>' +
          '<i class="fl-schuss sch1"></i>' +
          '<i class="fl-schuss sch2"></i>' +
          '<i class="fl-muendung"></i>' +
        '</div>' +
        /* Funkgeraet unten: die letzten drei Meldungen vom Gefecht. */
        '<div class="fl-funk"></div>' +
        /* Explosion bei Zielerfassung: Blitz + Druckwelle, per Klasse gezuendet. */
        '<div class="fl-boom"><i class="fb-blitz"></i><i class="fb-welle"></i></div>';
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

  /* ---------- Das Funkgeraet ----------
   *
   * Alle paar Sekunden eine Meldung im Gefechtston, passend zur Lage.
   * Ereignisse (Ziel erfasst) draengen sich sofort dazwischen. Nur die
   * letzten drei Zeilen bleiben stehen — ein Funkgeraet, kein Protokoll. */
  var FUNK = {
    ruhig: ['SEKTOR WIRD ABGETASTET …', 'KEIN KONTAKT — WEITER SUCHEN',
            'ALLE EINHEITEN AUF STATION', 'LAGE RUHIG — AUGEN OFFEN',
            'VIER BÜCHER IM BLICK'],
    wachsam: ['STÖRSIGNAL IM SEKTOR', 'VERBINDUNG WIRD SCHWÄCHER',
              'EINHEIT MELDET SICH VERSPÄTET'],
    alarm: ['NOTRUF ABGESETZT', 'EINHEIT ANTWORTET NICHT',
            'SUCHE LÄUFT AUF RESTVERBINDUNG']
  };

  function funken(text) {
    ['flanke-l', 'flanke-r'].forEach(function (id) {
      var f = document.getElementById(id);
      var funk = f && f.querySelector('.fl-funk');
      if (!funk) return;
      var z = document.createElement('div');
      z.textContent = text;
      funk.insertBefore(z, funk.firstChild);
      while (funk.childNodes.length > 3) funk.removeChild(funk.lastChild);
    });
  }

  function funkTakt() {
    var pool = FUNK[letzteStufe || 'ruhig'] || FUNK.ruhig;
    var e = welt.letztesErgebnis;
    /* Ab und zu eine echte Zahl statt Prosa — das Funkgeraet soll berichten,
     * nicht nur Stimmung machen. */
    if (e && Array.isArray(e.chancen) && e.chancen.length && Math.random() < 0.4) {
      funken(e.chancen.length + (e.chancen.length === 1 ? ' ZIEL' : ' ZIELE') + ' IM VISIER');
      return;
    }
    funken(pool[Math.floor(Math.random() * pool.length)]);
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

    /* Die Flanken feuern mit: Blitz und Druckwelle von beiden Seiten,
     * dazu die Funkmeldung. */
    funken('ZIEL ERFASST — FEUER FREI');
    ['flanke-l', 'flanke-r'].forEach(function (id) {
      var fl = document.getElementById(id);
      if (!fl) return;
      fl.classList.remove('boom');
      void fl.offsetWidth;
      fl.classList.add('boom');
      setTimeout(function () { fl.classList.remove('boom'); }, 1600);
    });
  }

  var funkZaehler = 0;
  function start() {
    baue();
    flankenTakt();
    funken('FUNKGERÄT AUF EMPFANG');
    setInterval(function () {
      flankenTakt(); kinoTakt();
      /* Funkspruch alle ~10 s (jeder fuenfte 2-s-Takt), nicht jede Sekunde —
       * ein Funkgeraet, das dauerplappert, hoert niemand mehr. */
      if (++funkZaehler % 5 === 0) funkTakt();
    }, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  /* ---------- ANIMATIONSSTUFEN (Vorgabe 14.8.) ----------
   *
   * Drei Stufen gegen heisse Laptops. Die Stufe steht als Klasse am
   * <html>-Element (anim-1/2/3), die Drosselung passiert KOMPLETT in
   * stil.css - hier wird nur geschaltet und empfohlen. Der Scanner ist
   * davon voellig unberuehrt: er laeuft auf dem Server, die Stufen
   * betreffen NUR die Anzeige-Animationen im Browser.
   *
   *   1 SCHONUNG  - alles Dauerlaufende steht (Gitter, Radar, Flanken)
   *   2 STANDARD  - Radar + LED + Avatar laufen, Bodengitter/Scan stehen
   *   3 VOLLES KINO - alles
   *
   * EMPFEHLUNG statt Bevormundung: aus Kernzahl und Speicher des Geraets
   * wird eine Stufe empfohlen und beim ersten Besuch gesetzt; danach
   * gilt der gespeicherte Wunsch. */
  var ANIM_SCHLUESSEL = 'orion-anim';

  function animEmpfehlung() {
    var kerne = Number(navigator.hardwareConcurrency) || 4;
    var speicher = Number(navigator.deviceMemory) || 4;   // GB; Firefox kennt es nicht -> 4
    if (kerne >= 8 && speicher >= 8) return 3;
    if (kerne >= 4) return 2;
    return 1;
  }

  function animStufe() {
    var s = Number(localStorage.getItem(ANIM_SCHLUESSEL));
    return (s === 1 || s === 2 || s === 3) ? s : animEmpfehlung();
  }

  function animSetzen(stufe) {
    var wurzel = document.documentElement;
    wurzel.classList.remove('anim-1', 'anim-2', 'anim-3');
    wurzel.classList.add('anim-' + stufe);
    /* KURZE Woerter — die langen ragten aus dem Knopf (Rueckmeldung 14.8.). */
    var NAMEN = { 1: 'SCHONUNG', 2: 'STANDARD', 3: 'KINO' };
    var t = document.getElementById('anim-text');
    var k = document.getElementById('anim-klein');
    if (t) t.textContent = 'Stufe ' + stufe + ' · ' + NAMEN[stufe];
    if (k) {
      var e = animEmpfehlung();
      k.textContent = (stufe === e ? '✓ Empfehlung für dieses Gerät'
                                   : 'Empfehlung: Stufe ' + e);
    }
  }

  function animStart() {
    animSetzen(animStufe());
    var knopf = document.getElementById('anim-knopf');
    if (knopf) knopf.addEventListener('click', function () {
      var neu = animStufe() % 3 + 1;
      localStorage.setItem(ANIM_SCHLUESSEL, String(neu));
      animSetzen(neu);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', animStart);
  else animStart();

  /* Fuer den Pruefstand von aussen anstossbar. */
  welt.Buehne = { spiele: spiele, lage: lage, animStufe: animStufe };

})(typeof globalThis !== 'undefined' ? globalThis : this);
