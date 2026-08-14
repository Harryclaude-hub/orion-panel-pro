/* Orion Panel Pro — die Stimme (Design-Schicht, 14.8.2026)
 *
 * Die Website ist der Soldat, der Auftraggeber der Offizier: sie begruesst
 * ihn nach Wiener Uhrzeit, meldet Chancen und Fehlversuche per Funkspruch
 * (Sprachausgabe des Browsers) und untermalt beides mit selbst
 * SYNTHETISIERTEN Soundeffekten (WebAudio) — keine fremden Audiodateien:
 * Originalzeilen aus CS:GO oder Call of Duty waeren fremdes Urheberrecht,
 * deshalb sind alle Funksprueche hier selbst geschrieben, im selben Ton.
 *
 * EIGENE DATEI wie melder/buehne/funker: liest nur welt.letztesErgebnis,
 * kennt keine Logik, darf jederzeit geloescht werden — dann fehlt nur der
 * Ton. An/aus ueber den Kopf-Knopf (#ton-knopf), Wunsch in localStorage.
 *
 * BROWSER-REGEL: Ton erst nach einer Nutzer-Geste. Der Entsperr-Klick ist
 * eine; kommt die Seite ohne Klick aus dem Speicher, wartet die Begruessung
 * auf die erste Beruehrung, statt still verschluckt zu werden.
 */
(function (welt) {
  'use strict';

  var SCHLUESSEL = 'orion-ton';
  var ctx = null;                 // AudioContext, erst nach Geste
  var geste = false;              // gab es schon eine Nutzer-Geste?
  var begruessungOffen = true;    // einmal je Seitenaufruf
  var stimme = null;              // gewaehlte deutsche Stimme

  function an() { return localStorage.getItem(SCHLUESSEL) !== 'aus'; }  // Standard: AN

  /* ---------- Soundeffekte, alle selbst erzeugt ---------- */

  function audio() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* Funk-Knacken: kurzes Rauschen durch einen Bandpass — das "Taste
   * gedrueckt"-Geraeusch vor und nach jedem Spruch. */
  function klick() {
    var a = audio(); if (!a) return;
    var n = a.createBufferSource();
    var puffer = a.createBuffer(1, a.sampleRate * 0.06, a.sampleRate);
    var d = puffer.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = puffer;
    var f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 2;
    var g = a.createGain(); g.gain.value = 0.12;
    n.connect(f); f.connect(g); g.connect(a.destination);
    n.start();
  }

  /* Sonar-Ping fuers Hochfahren. */
  function ping() {
    var a = audio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.value = 760;
    g.gain.setValueAtTime(0.10, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.9);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + 0.9);
  }

  /* Alarm bei einer CHANCE: zwei kurze, harte Toene — Signal, kein Neon. */
  function alarm() {
    var a = audio(); if (!a) return;
    [[520, 0], [780, 0.16]].forEach(function (t) {
      var o = a.createOscillator(), g = a.createGain();
      o.type = 'square'; o.frequency.value = t[0];
      g.gain.setValueAtTime(0.0001, a.currentTime + t[1]);
      g.gain.linearRampToValueAtTime(0.09, a.currentTime + t[1] + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t[1] + 0.14);
      o.connect(g); g.connect(a.destination);
      o.start(a.currentTime + t[1]); o.stop(a.currentTime + t[1] + 0.15);
    });
  }

  /* Fehlversuch: ein fallender, dumpfer Ton. */
  function fehl() {
    var a = audio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(340, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(160, a.currentTime + 0.35);
    g.gain.setValueAtTime(0.08, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.4);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + 0.4);
  }

  /* ---------- Sprache ---------- */

  function stimmeWaehlen() {
    if (!('speechSynthesis' in window)) return;
    var alle = window.speechSynthesis.getVoices() || [];
    /* Erst oesterreichisch, dann deutsch, dann irgendwas mit de. */
    stimme = alle.find(function (v) { return /de[-_]AT/i.test(v.lang); }) ||
             alle.find(function (v) { return /de[-_]DE/i.test(v.lang); }) ||
             alle.find(function (v) { return /^de/i.test(v.lang); }) || null;
  }

  function sprich(text) {
    if (!an() || !('speechSynthesis' in window)) return;
    if (!geste) return;                       // Browser wuerde es verschlucken
    klick();
    var u = new SpeechSynthesisUtterance(text);
    if (stimme) u.voice = stimme;
    u.lang = (stimme && stimme.lang) || 'de-DE';
    u.rate = 1.02; u.pitch = 0.82; u.volume = 0.9;   // tiefer = Funkerton
    u.onstart = function () { avatarSpricht(true); };
    u.onend = function () { avatarSpricht(false); klick(); };
    window.speechSynthesis.speak(u);
    funkerLog(text);
  }

  /* Jeder gesprochene Spruch steht auch im Funker-Fenster — nichts nur
   * fluechtig in der Luft. */
  function funkerLog(text) {
    var log = document.getElementById('funker-log');
    if (!log) return;
    var d = document.createElement('div');
    d.className = 'fu-zeile funker';
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  /* ---------- Die Funksprueche (selbst geschrieben, Ton der Truppe) ---------- */

  function zufall(liste) { return liste[Math.floor(Math.random() * liste.length)]; }

  function begruessung() {
    /* NICHT format() + Number(): de-AT liefert "17 Uhr", Number davon ist
     * NaN, und NaN fiel durch alle Zweige in die Nachtschicht — gemessen
     * am 14.8. um 17:38 Wiener Zeit. formatToParts liefert die Stunde
     * als reines Zahlfeld. */
    var teile = new Intl.DateTimeFormat('de-AT', {
      timeZone: 'Europe/Vienna', hour: 'numeric', hourCycle: 'h23'
    }).formatToParts(new Date());
    var stunde = Number((teile.find(function (t) { return t.type === 'hour'; }) || {}).value);
    if (isNaN(stunde)) stunde = new Date().getHours();   // Notnagel: Ortszeit
    var pool;
    if (stunde >= 5 && stunde < 11) pool = [
      'Guten Morgen, Offizier! Alle Systeme auf Station, der Scanner lief die ganze Nacht durch.',
      'Guten Morgen, Offizier. Nachtwache ohne Vorkommnisse — vier Börsen im Raster, wir sind auf Empfang.',
      'Morgenmeldung, Offizier: Gefechtsstand besetzt, alle Takte laufen. Erwarte Befehle.'
    ];
    else if (stunde >= 11 && stunde < 17) pool = [
      'Guten Tag, Offizier! Gefechtsstand gefechtsbereit, alle vier Börsen unter Beobachtung.',
      'Mittagsmeldung, Offizier: Scanner im Zwanzig-Sekunden-Takt, Wächter auf Posten. Lage ruhig.',
      'Willkommen zurück, Offizier. Das Raster steht, wir haben nichts durchgelassen.'
    ];
    else if (stunde >= 17 && stunde < 23) pool = [
      'Schönen Abend, Offizier! Der Spielplan füllt sich — beste Jagdzeit. Wir sind auf Empfang.',
      'Guten Abend, Offizier. Abendlage: alle Einheiten auf Station, das Sonar läuft heiß.',
      'Abendmeldung, Offizier: vier Börsen, ein Raster, keine Lücke unbeobachtet. Erwarte Befehle.'
    ];
    else pool = [
      'Nachtschicht, Offizier. Die Nachtwache übernimmt — Sie können ruhig schlafen, wir nicht.',
      'Späte Stunde, Offizier. Der Scanner kennt keine Nacht — alles unter Kontrolle.',
      'Nachtmeldung: Gefechtsstand besetzt, Takte laufen. Der Gegner schläft — wir beobachten.'
    ];
    sprich(zufall(pool));
    ping();
  }

  var CHANCE_SPRUECHE = [
    'Lücke in der feindlichen Verteidigung entdeckt — Angriffsfenster offen. Feuer frei!',
    'Ziel erfasst, Offizier! Zwei Bücher weit auseinander — Zugriff empfohlen!',
    'Treffer im Raster! Der Gegner hat eine Flanke offen — wir können angreifen!',
    'Chance bestätigt, alle sieben Prüfungen bestanden — Angriffsbefehl liegt bei Ihnen, Offizier!'
  ];
  var FEHL_SPRUECHE = [
    'Fehlversuch registriert. Rechnung als falsch markiert — geht in die Analyse.',
    'Blindgänger, Offizier. Die Zahlen lügen — aussortiert und dokumentiert.',
    'Falscher Alarm: ein Kurs klebt. Ziel gestrichen, wir bleiben im Raster.'
  ];

  /* ---------- Beobachtung: wie der Melder, nur mit Stimme ---------- */

  var bekannteChancen = null;
  var bekannteFalsche = null;
  var letzterFehlSpruch = 0;

  function pruefe() {
    var e = welt.letztesErgebnis;
    if (!e || !Array.isArray(e.chancen)) return;

    var jetztC = new Set(e.chancen.map(function (f) { return f.schluessel; }));
    var jetztF = new Set((e.falsch || []).map(function (f) { return f.schluessel; }));

    if (bekannteChancen !== null && an()) {
      var neueC = e.chancen.filter(function (f) { return !bekannteChancen.has(f.schluessel); });
      if (neueC.length) {
        alarm();
        var f0 = neueC[0];
        sprich(zufall(CHANCE_SPRUECHE) + ' Rendite ' +
               Number(f0.rendite).toFixed(2).replace('.', ',') + ' Prozent' +
               (f0.nr ? ', Rechnung Nummer ' + f0.nr : '') + '.');
      }
      /* Fehlversuche sind haeufiger — hoechstens alle 60 Sekunden ein
       * Spruch, sonst redet der Soldat pausenlos dazwischen. */
      var neueF = 0;
      jetztF.forEach(function (k) { if (!bekannteFalsche.has(k)) neueF++; });
      if (neueF && Date.now() - letzterFehlSpruch > 60000) {
        letzterFehlSpruch = Date.now();
        fehl();
        sprich(zufall(FEHL_SPRUECHE));
      }
    }
    bekannteChancen = jetztC;
    bekannteFalsche = jetztF;
  }

  /* ---------- Avatar: der Soldat unten rechts am Funker-Knopf ---------- */

  function avatarBauen() {
    var k = document.getElementById('funker-knopf');
    if (!k || k.querySelector('.avatar')) return;
    k.innerHTML =
      '<span class="avatar" aria-hidden="true">' +
        '<svg viewBox="0 0 48 48" width="40" height="40">' +
          /* Helm */
          '<path d="M8 22 Q8 8 24 8 Q40 8 40 22 L40 25 L8 25 Z" fill="#4A5240" stroke="#2E3428" stroke-width="1.5"/>' +
          '<rect x="6" y="23" width="36" height="4" rx="2" fill="#3A4133"/>' +
          /* Gesicht */
          '<path d="M12 27 Q12 40 24 40 Q36 40 36 27 Z" fill="#C9A279"/>' +
          /* Augen (blinzeln per CSS) */
          '<rect class="av-auge" x="17" y="29" width="4" height="3" rx="1.5" fill="#2E3428"/>' +
          '<rect class="av-auge" x="27" y="29" width="4" height="3" rx="1.5" fill="#2E3428"/>' +
          /* Mund (spricht per CSS) */
          '<rect class="av-mund" x="20" y="35.5" width="8" height="1.8" rx="0.9" fill="#7A5B41"/>' +
          /* Headset */
          '<rect x="6" y="26" width="5" height="8" rx="2" fill="#2E3428"/>' +
          '<rect x="37" y="26" width="5" height="8" rx="2" fill="#2E3428"/>' +
          '<path d="M10 33 Q13 39 19 38.5" fill="none" stroke="#2E3428" stroke-width="1.8"/>' +
          '<circle class="av-licht" cx="19" cy="38.5" r="1.8" fill="#8FB996"/>' +
        '</svg>' +
      '</span>' +
      '<span class="funker-wort">FUNKER</span>';
  }

  function avatarSpricht(ja) {
    var k = document.getElementById('funker-knopf');
    if (k) k.classList.toggle('spricht', ja);
  }

  /* ---------- Knopf im Kopf ---------- */

  function beschrifte() {
    var t = document.getElementById('ton-text');
    if (t) t.textContent = an() ? '🔊 Ton: AN' : '🔇 Ton: AUS';
  }

  function umschalten() {
    localStorage.setItem(SCHLUESSEL, an() ? 'aus' : 'an');
    beschrifte();
    if (an()) { geste = true; klick(); sprich('Ton ist an, Offizier. Sie hören von mir.'); }
    else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  /* ---------- Start ---------- */

  function ersteGeste() {
    if (geste) return;
    geste = true;
    audio();
    if (begruessungOffen && an()) {
      begruessungOffen = false;
      /* Stimmen laden asynchron — kleiner Aufschub macht die Wahl sicher. */
      setTimeout(function () { stimmeWaehlen(); begruessung(); }, 400);
    }
  }

  function start() {
    if ('speechSynthesis' in window) {
      stimmeWaehlen();
      window.speechSynthesis.onvoiceschanged = stimmeWaehlen;
    }
    var k = document.getElementById('ton-knopf');
    if (k) k.addEventListener('click', function () { ersteGeste(); umschalten(); });
    beschrifte();

    /* Der Entsperr-Klick ist die Geste; sonst die erste Beruehrung. */
    var e = document.getElementById('entsperren');
    if (e) e.addEventListener('click', ersteGeste);
    document.addEventListener('pointerdown', ersteGeste, { once: false });

    avatarBauen();
    setInterval(avatarBauen, 3000);   // falls der Funker spaeter baut
    setInterval(pruefe, 2000);

    /* Wiener Uhr im Hero — reine Anzeige, kein Rechenweg. */
    var uhrFeld = document.getElementById('hero-uhr');
    if (uhrFeld) {
      var uhrFormat = new Intl.DateTimeFormat('de-AT', {
        timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit',
        second: '2-digit', hourCycle: 'h23'
      });
      setInterval(function () {
        var t = uhrFormat.format(new Date());
        if (uhrFeld.textContent !== t) uhrFeld.textContent = t;
      }, 1000);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

})(typeof globalThis !== 'undefined' ? globalThis : this);
