/* Orion Panel Pro — die Bühne
 *
 * REINES AUSSEHEN, eigene Datei (wie melder.js): liest nur
 * welt.letztesErgebnis, kennt keine Logik, darf jederzeit gelöscht werden.
 *
 * Zwei Aufgaben:
 *
 * 1. DIE FLANKEN. Auf breiten Bildschirmen bleiben links und rechts der
 *    Seite leere Ränder. Dort steht seit dem 20.08. DIE WACHT: ein
 *    Radarturm mit drehender Antenne und Funkwellen im Lage-Takt, eine
 *    Peilrose mit Suchzeiger, die Jet-Staffel und Raketen, die starten
 *    und das Bild nach OBEN verlassen (ehrliche Physik, nichts fliegt
 *    rückwärts). Die Flanken füllen den Rand bis zum Inhalt und neigen
 *    sich der Maus leicht entgegen (nur Stufe 3). Kein Text.
 *
 *    Entfernt am 18.08. auf des Auftraggebers Vorgabe: das Lagewort (fl-wort), die
 *    Funkzeilen samt Motivationssprüchen (fl-funk) und das Schlachtfeld
 *    mit Panzer und Mündungsfeuer (fl-feld). Der Rand soll ruhig sein,
 *    nicht reden.
 *
 *    Die LAGE bleibt und färbt weiter: ruhig / wachsam / alarm steuern
 *    Farbe und Tempo. Ein Ausfall ist also weiter sichtbar — er wird nur
 *    nicht mehr vorgelesen; im Klartext steht er ohnehin oben im
 *    Warnungsblock, wo er hingehört.
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
        /* Das Gitter bleibt als ganz feine Tiefenzeichnung im Hintergrund.
         * AUSGEBAUT am 18.08. (zweite Runde): die Scan-Saeule (fl-scan),
         * das Tick-Lineal (fl-ticks) und das Mini-Radar (fl-radar) —
         * der Auftraggeber: "dieser seitliche Scanner soll weg". Der Rand ist jetzt
         * Himmel, kein Messgeraet. */
        '<div class="fl-gitter"></div>' +
        '<div class="fl-sterne"></div>' +
        /* DIE WACHT (20.08., Karams Vorgabe: "die Planeten sind zu
         * langweilig, ich will ein Militaerdesign"): oben ein
         * Radar-Wachturm mit drehender Balkenantenne und auslaufenden
         * Funkwellen, unten eine Peilrose mit gegenlaeufigem
         * Suchzeiger. Beides dreht per transform auf der Grafikkarte —
         * gleiche Kostenklasse wie die alten Planeten, und die LAGE
         * faerbt weiter mit (ruhig/wachsam/alarm ueber --fl-farbe). */
        '<div class="fl-wacht">' +
          '<i class="fl-turm">' +
            '<svg class="fl-mast" viewBox="0 0 60 96" aria-hidden="true">' +
              '<path fill="currentColor" d="M27 34 L33 34 L36 88 L40 88 L40 92 L20 92 L20 88 L24 88 Z"/>' +
              '<path fill="currentColor" opacity=".55" d="M24 62 L10 88 L14 88 L27 66 Z M36 62 L50 88 L46 88 L33 66 Z"/>' +
              '<circle cx="30" cy="30" r="4.5" fill="currentColor"/>' +
            '</svg>' +
            '<b class="fl-antenne"><svg viewBox="0 0 76 18" aria-hidden="true">' +
              '<path fill="currentColor" d="M4 9 C20 1 56 1 72 9 C56 11 20 11 4 9 Z"/>' +
              '<rect x="34" y="8" width="8" height="4" fill="currentColor"/>' +
            '</svg></b>' +
            '<b class="fl-welle w1"></b><b class="fl-welle w2"></b><b class="fl-welle w3"></b>' +
          '</i>' +
          '<i class="fl-rose">' +
            '<svg viewBox="0 0 100 100" aria-hidden="true">' +
              '<circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".7"/>' +
              '<circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="1" opacity=".4"/>' +
              '<g stroke="currentColor" stroke-width="1.4" opacity=".8">' +
                '<path d="M50 4 v9 M50 87 v9 M4 50 h9 M87 50 h9"/>' +
                '<path opacity=".5" d="M17.5 17.5 l6.4 6.4 M76.1 76.1 l6.4 6.4 M82.5 17.5 l-6.4 6.4 M23.9 76.1 l-6.4 6.4"/>' +
              '</g>' +
            '</svg>' +
            '<b class="fl-zeiger"></b>' +
          '</i>' +
        '</div>' +
        /* DIE LUFTWAFFE (Vorgabe 14.8. nachts): erkennbare Silhouetten in
         * Draufsicht — Nurfluegel-Bomber (B-2-Klasse), Doppelleitwerk-
         * Jaeger (F-15-Klasse), Delta-Canard (Eurofighter-Klasse) und
         * eine Langfluegel-Drohne. Jede fliegt ihre eigene Bahn die
         * Flanke entlang, links abwaerts, rechts aufwaerts. */
        '<div class="fl-staffel">' +
          '<i class="flug f1"><svg class="jet-b2" viewBox="0 0 48 20" aria-hidden="true">' +
            '<path fill="currentColor" d="M24 0 L46 15 L38 15 L32 11 L28 15 L20 15 L16 11 L10 15 L2 15 Z"/>' +
          '</svg></i>' +
          '<i class="flug f2"><svg class="jet-f15" viewBox="0 0 44 30" aria-hidden="true">' +
            '<path fill="currentColor" d="M21 0 L23 0 L25 7 L25 11 L40 18 L40 21 L25 17 L25 21 L31 26 L31 28 L24 26 L20 26 L13 28 L13 26 L19 21 L19 17 L4 21 L4 18 L19 11 L19 7 Z"/>' +
          '</svg></i>' +
          '<i class="flug f3"><svg class="jet-euro" viewBox="0 0 44 30" aria-hidden="true">' +
            '<path fill="currentColor" d="M21 0 L23 0 L24 6 L31 8 L31 10 L24 10 L25 15 L42 23 L42 26 L24 22 L22 28 L20 22 L2 26 L2 23 L19 15 L20 10 L13 10 L13 8 L20 6 Z"/>' +
          '</svg></i>' +
          '<i class="flug f4"><svg class="jet-drohne" viewBox="0 0 48 28" aria-hidden="true">' +
            '<path fill="currentColor" d="M24 0 C21.5 0 21.5 4 21.5 6 L2 8 L2 10 L21.5 10 L21.5 19 L16 24 L17 26 L24 21 L31 26 L32 24 L26.5 19 L26.5 10 L46 10 L46 8 L26.5 6 C26.5 4 26.5 0 24 0 Z"/>' +
          '</svg></i>' +
        '</div>' +
        /* RAKETEN (20.08., ehrliche Physik): lange Ruhe auf der Rampe,
         * Zuendung mit Startstaub, Aufstieg, Abgang nach OBEN aus dem
         * Bild — nichts setzt rueckwaerts wieder auf. Jede laeuft ihren
         * eigenen langen Takt, damit nie zwei gleichzeitig zuenden. */
        '<div class="fl-raketen">' +
          '<i class="fl-rakete r1">' +
            '<svg viewBox="0 0 14 40" aria-hidden="true">' +
              '<path fill="currentColor" d="M7 0 C10 6 11 12 11 20 L11 31 L3 31 L3 20 C3 12 4 6 7 0 Z"/>' +
              '<path fill="currentColor" d="M3 24 L0 33 L3 31 Z M11 24 L14 33 L11 31 Z"/>' +
            '</svg>' +
            '<b class="fl-flamme"></b>' +
          '</i>' +
          '<i class="fl-rakete r2">' +
            '<svg viewBox="0 0 14 40" aria-hidden="true">' +
              '<path fill="currentColor" d="M7 0 C10 6 11 12 11 20 L11 31 L3 31 L3 20 C3 12 4 6 7 0 Z"/>' +
              '<path fill="currentColor" d="M3 24 L0 33 L3 31 Z M11 24 L14 33 L11 31 Z"/>' +
            '</svg>' +
            '<b class="fl-flamme"></b>' +
          '</i>' +
          '<i class="fl-staub"></i>' +
        '</div>' +
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
    });
  }

  /* ---------- Das Funkgeraet ist AUSGEBAUT (Vorgabe 18.08.) ----------
   *
   * der Auftraggeber: "diese Kenner und diesen Text entfernen". Damit fallen weg:
   * das Lagewort an der Flanke (fl-wort) und die Funkzeilen darunter
   * (fl-funk) samt Motivationsspruechen — und mit ihnen der einzige
   * Grund, warum die Buehne ueberhaupt Text schrieb.
   *
   * Die LAGE selbst bleibt: lage() liefert weiter ruhig/wachsam/alarm,
   * und die Flanke traegt den Zustand als Klasse. Er faerbt und taktet
   * jetzt nur noch, statt zu reden — ein Ausfall bleibt also sichtbar,
   * er wird nur nicht mehr vorgelesen. Die ausfuehrliche Meldung stand
   * ohnehin immer im Warnungsblock oben, dort wo sie hingehoert. */

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

    /* Die Flanken feuern mit: Blitz und Druckwelle von beiden Seiten. */
    ['flanke-l', 'flanke-r'].forEach(function (id) {
      var fl = document.getElementById(id);
      if (!fl) return;
      fl.classList.remove('boom');
      void fl.offsetWidth;
      fl.classList.add('boom');
      setTimeout(function () { fl.classList.remove('boom'); }, 1600);
    });
  }

  /* ---------- PARALLAX (20.08., Karams Vorgabe: "die Sidebars ein
   * bisschen interaktiver") ----------
   *
   * Die Flanken neigen sich der Maus minimal entgegen: Wacht, Staffel
   * und Raketen tragen je eine eigene Tiefe, dadurch entsteht beim
   * Bewegen ein leiser Raumeindruck. KOSTENRAHMEN: nur transform
   * (Grafikkarte), gerechnet hoechstens einmal je Bild ueber
   * requestAnimationFrame, NUR bei echter Maus (pointer: fine) und NUR
   * in Animationsstufe 3 — Stufe 1 und 2 bleiben unberuehrt, wie es
   * die Stufenregel verlangt. pointer-events bleibt aus: die Flanke
   * faengt weiterhin keinen einzigen Klick ab. */
  function parallaxStart() {
    if (!window.matchMedia || !matchMedia('(pointer: fine)').matches) return;
    var wartend = false;
    document.addEventListener('mousemove', function (ev) {
      if (wartend) return;
      wartend = true;
      requestAnimationFrame(function () {
        wartend = false;
        var wurzel = document.documentElement;
        if (wurzel.classList.contains('anim-1') || wurzel.classList.contains('anim-2')) return;
        var dx = (ev.clientX / window.innerWidth - 0.5);
        var dy = (ev.clientY / window.innerHeight - 0.5);
        ['flanke-l', 'flanke-r'].forEach(function (id) {
          var f = document.getElementById(id);
          if (!f) return;
          var wacht = f.querySelector('.fl-wacht');
          var staffel = f.querySelector('.fl-staffel');
          var raketen = f.querySelector('.fl-raketen');
          if (wacht) wacht.style.transform = 'translate3d(' + (dx * 10) + 'px,' + (dy * 8) + 'px,0)';
          if (staffel) staffel.style.transform = 'translate3d(' + (dx * 16) + 'px,' + (dy * 12) + 'px,0)';
          if (raketen) raketen.style.transform = 'translate3d(' + (dx * 6) + 'px,' + (dy * 4) + 'px,0)';
        });
      });
    }, { passive: true });
  }

  function start() {
    baue();
    flankenTakt();
    parallaxStart();
    setInterval(function () {
      flankenTakt(); kinoTakt();
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
