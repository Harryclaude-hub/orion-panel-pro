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
  /* Der Funker-Chat hat seinen EIGENEN Schalter (Vorgabe 15.8.): der
   * globale Ton-Knopf regelt nur die Hintergrund-Funksprueche; den
   * Chat-Soldaten schaltet man im Chatfenster selbst stumm. */
  function funkerAn() { return localStorage.getItem('orion-funker-ton') !== 'aus'; }

  /* Gerade spielende Aufnahmen: Ton-AUS muss sie SOFORT stoppen, nicht
   * erst die naechste verhindern (Rueckmeldung 14.8.: "Ton aus bringt
   * nix" — eine laufende 8-Sekunden-Aufnahme plapperte weiter). */
  var laufend = [];
  /* SICHTBARE Bestaetigung am oberen Rand — "ich habe geklickt und
   * nichts ist passiert" soll es nie wieder geben koennen. */
  function tonBanner(text) {
    var b = document.getElementById('ton-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'ton-banner';
      document.body.appendChild(b);
    }
    b.textContent = text;
    b.classList.remove('zeigt');
    void b.offsetWidth;
    b.classList.add('zeigt');
  }
  function allesStumm() {
    laufend.forEach(function (a) { try { a.pause(); } catch (e) {} });
    laufend = [];
    avatarSpricht(false);
  }

  /* Die Sprueche-Pools kommen aus audio/sprueche.json — derselben Datei,
   * aus der die Aufnahmen erzeugt wurden (eine Quelle, kein Drift).
   * 10-20 Varianten je Ereignis; ohne Datei greifen kleine Notpools. */
  var POOLS = null;
  fetch('audio/sprueche.json?v=39').then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { POOLS = j; })
    .catch(function () { /* Notpools unten */ });
  function pool(name, ersatz) {
    return (POOLS && POOLS[name] && POOLS[name].length) ? POOLS[name] : ersatz;
  }

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
    if (!an()) return;
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
    if (!an()) return;
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
    if (!an()) return;
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
    if (!an()) return;
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

  /* Die Browser-Sprachausgabe wurde am 15.8. AUSGEBAUT: seit die echten
   * Aufnahmen jede Zeile abdecken, war sie toter Code — und die einzige
   * Stelle, aus der je wieder eine Roboterstimme haette kommen koennen.
   * Faellt eine Aufnahme aus, bleibt der Soldat lieber still; der Text
   * steht ohnehin im Funker-Log. */

  /* ---------- Echte Sprecher-Aufnahmen (ElevenLabs) ----------
   *
   * Die Aufnahme wird IMMER direkt versucht — frueher stand davor eine
   * Existenz-Liste (liste.json), und wenn die noch nicht geladen oder im
   * Browser-Cache veraltet war, sprang die ROBOTER-Stimme ein. Genau die
   * will der Auftraggeber nie wieder hoeren (Rueckmeldung 14.8. abends).
   * Deshalb: Datei abspielen; schlaegt sie fehl, EIN zweiter Versuch,
   * danach lieber STILL bleiben (der Text steht ohnehin im Funker-Log).
   * Ohne Aufnahme-Kennung wird nur ins Funker-Log geschrieben. */
  function spiel(clip, text, lage, kanal) {
    /* TON AUS = FUNKSTILLE, ohne Ausnahme (Vorgabe 15.8.: "wenn ich Ton
     * ausmache, will ich, dass nix mehr kommt"). Der Chat-Stummknopf
     * wirkt nur ZUSAETZLICH, er kann den Hauptschalter nie umgehen. */
    if (!an()) return;
    if (kanal === 'funker' && !funkerAn()) return;
    /* NIE zwei Stimmen uebereinander (Vorgabe 14.8. nachts): wer neu
     * spricht, bringt zuerst alle anderen zum Schweigen — laufende
     * Aufnahmen UND die Browser-Stimme. */
    laufend.forEach(function (x) { try { x.pause(); } catch (e2) {} });
    laufend = [];
    if (!clip) { funkerLog(text); return; }

    function versuch(nochmal) {
      var a = new Audio('audio/' + clip + '.mp3');
      a.volume = 0.95;
      laufend.push(a);
      avatarSpricht(true);
      a.onended = function () {
        laufend = laufend.filter(function (x) { return x !== a; });
        avatarSpricht(false); klick();
      };
      a.onerror = function () {
        laufend = laufend.filter(function (x) { return x !== a; });
        avatarSpricht(false);
        if (nochmal) setTimeout(function () { versuch(false); }, 400);
      };
      a.play().catch(function () {
        laufend = laufend.filter(function (x) { return x !== a; });
        avatarSpricht(false);
        if (nochmal) setTimeout(function () { versuch(false); }, 400);
      });
    }
    klick();
    versuch(true);
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
    /* Notpools (die ersten drei je Zeit); die grossen 6er-Pools kommen
     * aus sprueche.json. */
    var pool_;
    if (stunde >= 5 && stunde < 11) pool_ = [
      { c: 'gruss-morgen-1', t: 'Guten Morgen, Offizier! Alle Systeme auf Station, der Scanner lief die ganze Nacht durch.' },
      { c: 'gruss-morgen-2', t: 'Guten Morgen, Offizier. Nachtwache ohne Vorkommnisse — vier Börsen im Raster, wir sind auf Empfang.' },
      { c: 'gruss-morgen-3', t: 'Morgenmeldung, Offizier: Gefechtsstand besetzt, alle Takte laufen. Erwarte Befehle.' }
    ];
    else if (stunde >= 11 && stunde < 17) pool_ = [
      { c: 'gruss-tag-1', t: 'Guten Tag, Offizier! Gefechtsstand gefechtsbereit, alle vier Börsen unter Beobachtung.' },
      { c: 'gruss-tag-2', t: 'Mittagsmeldung, Offizier: Scanner im Zwanzig-Sekunden-Takt, Wächter auf Posten. Lage ruhig.' },
      { c: 'gruss-tag-3', t: 'Willkommen zurück, Offizier. Das Raster steht, wir haben nichts durchgelassen.' }
    ];
    else if (stunde >= 17 && stunde < 23) pool_ = [
      { c: 'gruss-abend-1', t: 'Schönen Abend, Offizier! Der Spielplan füllt sich — beste Jagdzeit. Wir sind auf Empfang.' },
      { c: 'gruss-abend-2', t: 'Guten Abend, Offizier. Abendlage: alle Einheiten auf Station, das Sonar läuft heiß.' },
      { c: 'gruss-abend-3', t: 'Abendmeldung, Offizier: vier Börsen, ein Raster, keine Lücke unbeobachtet. Erwarte Befehle.' }
    ];
    else pool_ = [
      { c: 'gruss-nacht-1', t: 'Nachtschicht, Offizier. Die Nachtwache übernimmt — Sie können ruhig schlafen, wir nicht.' },
      { c: 'gruss-nacht-2', t: 'Späte Stunde, Offizier. Der Scanner kennt keine Nacht — alles unter Kontrolle.' },
      { c: 'gruss-nacht-3', t: 'Nachtmeldung: Gefechtsstand besetzt, Takte laufen. Der Gegner schläft — wir beobachten.' }
    ];
    var schluesselName = (stunde >= 5 && stunde < 11) ? 'gruss_morgen'
      : (stunde >= 11 && stunde < 17) ? 'gruss_tag'
      : (stunde >= 17 && stunde < 23) ? 'gruss_abend' : 'gruss_nacht';
    var g = zufall(pool(schluesselName, pool_));
    spiel(g.c, g.t, 'ruhig');
    ping();
  }

  var CHANCE_SPRUECHE = [
    { c: 'chance-1', t: 'Lücke in der feindlichen Verteidigung entdeckt — Angriffsfenster offen. Feuer frei!' },
    { c: 'chance-2', t: 'Ziel erfasst, Offizier! Zwei Bücher weit auseinander — Zugriff empfohlen!' },
    { c: 'chance-3', t: 'Treffer im Raster! Der Gegner hat eine Flanke offen — wir können angreifen!' },
    { c: 'chance-4', t: 'Chance bestätigt, alle sieben Prüfungen bestanden — Angriffsbefehl liegt bei Ihnen, Offizier!' },
    { c: 'chance-5', t: 'Es hat sich geöffnet, Offizier! Die Lücke steht — wir greifen an!' },
    { c: 'chance-6', t: 'Angriffsfenster offen! Auf Ihren Befehl — Zugriff, Zugriff, Zugriff!' }
  ];
  var FEHL_SPRUECHE = [
    { c: 'fehl-1', t: 'Fehlversuch registriert. Rechnung als falsch markiert — geht in die Analyse.' },
    { c: 'fehl-2', t: 'Blindgänger, Offizier. Die Zahlen lügen — aussortiert und dokumentiert.' },
    { c: 'fehl-3', t: 'Falscher Alarm: ein Kurs klebt. Ziel gestrichen, wir bleiben im Raster.' },
    { c: 'fehl-4', t: 'Negativ, Offizier. Der Treffer war ein Trugbild — gestrichen.' }
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
        var w = zufall(pool('chance', CHANCE_SPRUECHE));
        /* Mit echter Aufnahme spricht der Sprecher den Spruch; die Zahlen
         * stehen im Log. Ohne Aufnahme spricht die Browser-Stimme alles. */
        spiel(w.c, w.t + ' Rendite ' +
              Number(f0.rendite).toFixed(2).replace('.', ',') + ' Prozent' +
              (f0.nr ? ', Rechnung Nummer ' + f0.nr : '') + '.', 'alarm');
      }
      /* Fehlversuche sind haeufiger — hoechstens alle 60 Sekunden ein
       * Spruch, sonst redet der Soldat pausenlos dazwischen. */
      var neueF = 0;
      jetztF.forEach(function (k) { if (!bekannteFalsche.has(k)) neueF++; });
      if (neueF && Date.now() - letzterFehlSpruch > 60000) {
        letzterFehlSpruch = Date.now();
        fehl();
        var wf = zufall(pool('fehl', FEHL_SPRUECHE));
        spiel(wf.c, wf.t, 'fehl');
      }
    }
    bekannteChancen = jetztC;
    bekannteFalsche = jetztF;
  }

  /* ---------- Avatar: der Soldat unten rechts am Funker-Knopf ---------- */

  function stummknopfBauen() {
    var kopf = document.querySelector('#funker .fu-kopf');
    if (!kopf || kopf.querySelector('.fu-stumm')) return;
    var k = document.createElement('button');
    k.type = 'button';
    k.className = 'fu-stumm';
    k.title = 'Nur den Funker stumm schalten — die Hintergrundstimmen regelt der Ton-Knopf oben';
    function b() { k.textContent = funkerAn() ? '🔊' : '🔇'; }
    b();
    k.addEventListener('click', function () {
      localStorage.setItem('orion-funker-ton', funkerAn() ? 'aus' : 'an');
      if (!funkerAn()) allesStumm();
      b();
    });
    var zu = kopf.querySelector('.fu-zu');
    kopf.insertBefore(k, zu || null);
  }

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
          /* Brauen (Ausdruecke per CSS: denkt/ernst runter, staunt hoch) */
          '<rect class="av-braue b-l" x="16.5" y="27" width="5" height="1.6" rx="0.8" fill="#2E3428"/>' +
          '<rect class="av-braue b-r" x="26.5" y="27" width="5" height="1.6" rx="0.8" fill="#2E3428"/>' +
          /* Augen (blinzeln per CSS) */
          '<rect class="av-auge" x="17" y="29.5" width="4" height="3" rx="1.5" fill="#2E3428"/>' +
          '<rect class="av-auge" x="27" y="29.5" width="4" height="3" rx="1.5" fill="#2E3428"/>' +
          /* Muender: neutral (Strich), froh (Laecheln), ernst (Bogen runter)
           * — sichtbar ist immer genau einer, per CSS-Klasse am Knopf. */
          '<rect class="av-mund" x="20" y="35.5" width="8" height="1.8" rx="0.9" fill="#7A5B41"/>' +
          '<path class="av-mund-froh" d="M19 34.5 Q24 39 29 34.5" fill="none" stroke="#7A5B41" stroke-width="1.8" stroke-linecap="round"/>' +
          '<path class="av-mund-ernst" d="M19 37.5 Q24 33.5 29 37.5" fill="none" stroke="#7A5B41" stroke-width="1.8" stroke-linecap="round"/>' +
          /* Headset */
          '<rect x="6" y="26" width="5" height="8" rx="2" fill="#2E3428"/>' +
          '<rect x="37" y="26" width="5" height="8" rx="2" fill="#2E3428"/>' +
          '<path d="M10 33 Q13 39 19 38.5" fill="none" stroke="#2E3428" stroke-width="1.8"/>' +
          '<circle class="av-licht" cx="19" cy="38.5" r="1.8" fill="#8FB996"/>' +
        '</svg>' +
      '</span>' +
      '<span class="funker-wort">FUNKER</span>';
  }

  /* Gesichtsausdruck setzen: genau einer zur Zeit, faellt von selbst auf
   * neutral zurueck. */
  var AUSDRUECKE = ['froh', 'ernst', 'denkt', 'staunt'];
  var ausdruckWecker = null;
  function avatarAusdruck(klasse, dauerMs) {
    var k = document.getElementById('funker-knopf');
    if (!k) return;
    AUSDRUECKE.forEach(function (a) { k.classList.remove(a); });
    if (klasse) k.classList.add(klasse);
    if (ausdruckWecker) clearTimeout(ausdruckWecker);
    if (klasse && dauerMs) {
      ausdruckWecker = setTimeout(function () {
        AUSDRUECKE.forEach(function (a) { k.classList.remove(a); });
      }, dauerMs);
    }
  }

  function avatarSpricht(ja) {
    var k = document.getElementById('funker-knopf');
    if (k) k.classList.toggle('spricht', ja);
  }

  function avatarLage(klasse, dauerMs) {
    var k = document.getElementById('funker-knopf');
    if (!k) return;
    k.classList.add(klasse);
    if (dauerMs) setTimeout(function () { k.classList.remove(klasse); }, dauerMs);
  }

  /* ---------- VORLESEN auf Knopfdruck (15.8., letzter Wunsch) ----------
   *
   * Jede Funker-Antwort bekommt einen kleinen Lautsprecher-Knopf. Ein
   * Klick schickt den Text an die Serverfunktion orion-stimme, die mit
   * der echten Liam-Stimme antwortet (Schluessel bleibt auf dem Server).
   * KEIN Automatismus: Vorlesen kostet ~1 Credit je Zeichen, ein voller
   * Bericht ~700 - auf Knopfdruck bleibt das im Gratis-Rahmen. */
  function vorlesen(text, knopf) {
    if (!an() || !funkerAn()) { tonBanner('🔇 Ton ist aus — erst einschalten'); return; }
    var K2 = welt.KONFIG || {};
    knopf.disabled = true; knopf.textContent = '…';
    fetch(K2.supabase + '/functions/v1/orion-stimme', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: text })
    }).then(function (r) {
      var typ = r.headers.get('content-type') || '';
      if (typ.indexOf('audio') === -1) {
        return r.json().then(function (j) {
          knopf.textContent = '⚠';
          knopf.title = j.grund || j.fehler || 'Vorlesen fehlgeschlagen';
          knopf.disabled = false;
        });
      }
      return r.blob().then(function (b) {
        var adresse = URL.createObjectURL(b);
        var a = new Audio(adresse);
        a.volume = 0.95;
        /* dieselben Regeln wie jede Aufnahme: exklusiv + Wachhund-Liste */
        laufend.forEach(function (x) { try { x.pause(); } catch (e2) {} });
        laufend = [a];
        avatarSpricht(true);
        a.onended = function () {
          laufend = laufend.filter(function (x) { return x !== a; });
          avatarSpricht(false); URL.revokeObjectURL(adresse);
          knopf.textContent = '🔈'; knopf.disabled = false;
        };
        a.onerror = function () { avatarSpricht(false); knopf.textContent = '⚠'; knopf.disabled = false; };
        a.play().catch(function () { avatarSpricht(false); knopf.textContent = '⚠'; knopf.disabled = false; });
      });
    }).catch(function () { knopf.textContent = '⚠'; knopf.disabled = false; });
  }

  /* Jede NEUE Funker-Zeile bekommt ihren Lautsprecher. */
  function vorleseKnoepfe() {
    var log = document.getElementById('funker-log');
    if (!log || log.dataset.beobachtet) return;
    log.dataset.beobachtet = '1';
    new MutationObserver(function (aenderungen) {
      aenderungen.forEach(function (a2) {
        Array.prototype.forEach.call(a2.addedNodes, function (z) {
          if (!z.classList || !z.classList.contains('funker') || z.querySelector('.fu-lesen')) return;
          var text = z.textContent;
          var k = document.createElement('button');
          k.type = 'button'; k.className = 'fu-lesen'; k.textContent = '🔈';
          k.title = 'Diese Antwort mit echter Stimme vorlesen (kostet ~1 Credit je Zeichen)';
          k.addEventListener('click', function () { vorlesen(text, k); });
          z.appendChild(k);
        });
      });
    }).observe(log, { childList: true });
  }

  /* ---------- MIKROFON (15.8., letzter Wunsch): mit dem Funker reden ----
   *
   * Eingebaute Spracherkennung des Browsers (Chrome/Edge, Deutsch),
   * kostenlos. Klick auf 🎤 = zuhoeren, das Gesagte landet im Feld und
   * wird beim Verstummen abgeschickt. Browser ohne Erkennung bekommen
   * einen ehrlichen Hinweis statt eines toten Knopfs. */
  function mikroBauen() {
    var form = document.getElementById('funker-form');
    if (!form || form.querySelector('.fu-mikro')) return;
    var R = window.SpeechRecognition || window.webkitSpeechRecognition;
    var k = document.createElement('button');
    k.type = 'button'; k.className = 'fu-mikro'; k.textContent = '🎤';
    form.insertBefore(k, form.querySelector('button[type=submit]') || null);
    if (!R) {
      k.classList.add('geht-nicht');
      k.title = 'Dieser Browser kann keine Spracheingabe — Chrome und Edge können es.';
      k.addEventListener('click', function (ev) { ev.preventDefault(); });
      return;
    }
    k.title = 'Mit dem Funker reden: Klick, sprechen, fertig — der Befehl schickt sich selbst ab.';
    var laeuftM = false, erkenner = null;
    k.addEventListener('click', function () {
      if (laeuftM) { try { erkenner.stop(); } catch (e2) {} return; }
      erkenner = new R();
      erkenner.lang = 'de-DE';
      erkenner.interimResults = true;
      var feld = document.getElementById('funker-frage');
      erkenner.onresult = function (ev) {
        var t = '';
        for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
        if (feld) feld.value = t.trim();
      };
      erkenner.onend = function () {
        laeuftM = false; k.classList.remove('hoert-zu');
        if (feld && feld.value.trim()) {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      };
      erkenner.onerror = function () { laeuftM = false; k.classList.remove('hoert-zu'); };
      laeuftM = true; k.classList.add('hoert-zu');
      try { erkenner.start(); } catch (e2) { laeuftM = false; k.classList.remove('hoert-zu'); }
    });
  }

  /* ---------- Der Funker REDET im Chat (Vorgabe 14.8.) ----------
   *
   * Alles ueber Ereignis-Weiterleitung am Dokument, weil der Funker seine
   * Oberflaeche selbst baut (Reihenfolge egal, Zuhoerer ueberleben):
   *   - Fenster geht auf  -> Begruessung (echte Aufnahme), Avatar salutiert
   *   - Eingabefeld aktiv -> er hoert zu (Augen auf, Kopf geneigt)
   *   - Befehl abgeschickt -> Nicken + "Befehl erhalten" / "Verstanden"
   *   - Antwort beginnt mit "Negativ" -> die Negativ-Aufnahme
   * Die ausfuehrliche Antwort bleibt Text im Fenster - eine feste Aufnahme
   * kann keine wechselnden Zahlen sprechen, und der Bericht ist lang. */
  var letzteChatBegruessung = 0;

  document.addEventListener('click', function (ev) {
    var k = ev.target && ev.target.closest ? ev.target.closest('#funker-knopf') : null;
    if (!k) return;
    var p = document.getElementById('funker');
    if (!p || !p.classList.contains('offen')) return;   // gerade geschlossen
    if (Date.now() - letzteChatBegruessung < 60000) return;
    letzteChatBegruessung = Date.now();
    avatarLage('salut', 1200);
    avatarAusdruck('froh', 2200);
    var wg = zufall(pool('funker_gruss', [{ c: 'funker-gruss-1', t: 'Funker auf Empfang, Offizier. Was liegt an?' }]));
    spiel(wg.c, wg.t, 'ruhig', 'funker');
  });

  document.addEventListener('focusin', function (ev) {
    if (ev.target && ev.target.id === 'funker-frage') avatarLage('hoert');
  });
  document.addEventListener('focusout', function (ev) {
    if (ev.target && ev.target.id === 'funker-frage') {
      var k = document.getElementById('funker-knopf');
      if (k) k.classList.remove('hoert');
    }
  });

  document.addEventListener('submit', function (ev) {
    if (!ev.target || ev.target.id !== 'funker-form') return;
    var feld = document.getElementById('funker-frage');
    var befehl = feld ? feld.value.trim().toLowerCase() : '';
    avatarLage('nickt', 700);
    /* Beim Pruefen: konzentrierter Blick, solange gerechnet wird. */
    if (/pr(ü|ue)f|#\s*\d|check|rechne/.test(befehl)) avatarAusdruck('denkt', 2500);
    /* Kurz warten, bis der Funker seine Antwort geschrieben hat, dann die
     * passende Aufnahme dazu — Negativ klingt anders als Befehl erhalten. */
    setTimeout(function () {
      var zeilen = document.querySelectorAll('#funker-log .fu-zeile.funker');
      var letzte = zeilen.length ? zeilen[zeilen.length - 1].textContent : '';
      /* Sichtbare Reaktion IMMER, auch bei Ton aus: er wackelt kurz —
       * und das Gesicht passt sich der Antwort an. */
      avatarLage('redet', 1600);
      if (letzte.indexOf('Negativ') === 0 || letzte.indexOf('ABWEICHUNG') !== -1 ||
          letzte.indexOf('WEICHT AB') !== -1) {
        avatarAusdruck('ernst', 4000);
      } else if (letzte.indexOf('BESTÄTIGT') !== -1 || letzte.indexOf('BESTAETIGT') !== -1) {
        avatarAusdruck('froh', 4000);
      } else if (letzte.indexOf('Lagebericht') !== -1) {
        avatarAusdruck('staunt', 2500);
      }
      var w2;
      if (letzte.indexOf('Negativ') === 0) {
        w2 = zufall(pool('funker_negativ', [{ c: 'funker-negativ-1', t: 'Negativ, Offizier — Ziel nicht gefunden.' }]));
        spiel(w2.c, w2.t, 'fehl', 'funker');
      } else if (/pr(ü|ue)f|#\s*\d|check|rechne/.test(befehl)) {
        w2 = zufall(pool('funker_bestaetigt', [{ c: 'funker-bestaetigt-1', t: 'Befehl erhalten — Prüfung läuft.' }]));
        spiel(w2.c, w2.t, 'ruhig', 'funker');
      } else {
        w2 = zufall(pool('funker_verstanden', [{ c: 'funker-verstanden-1', t: 'Verstanden, Offizier.' }]));
        spiel(w2.c, w2.t, 'ruhig', 'funker');
      }
    }, 200);
  });

  /* Leerlauf-Leben: alle paar Sekunden ein kurzer Seitenblick. */
  setInterval(function () {
    if (Math.random() < 0.45) avatarLage('schaut', 1100);
  }, 6000);

  /* ---------- Knopf im Kopf ---------- */

  function beschrifte() {
    var t = document.getElementById('ton-text');
    if (t) t.textContent = an() ? '🔊 Ton: AN' : '🔇 Ton: AUS';
  }

  function umschalten() {
    localStorage.setItem(SCHLUESSEL, an() ? 'aus' : 'an');
    beschrifte();
    if (an()) {
      geste = true; klick();
      if (welt.Musik) welt.Musik.start();         // Ambiente zurueck, falls gewollt
      var wt = zufall(pool('ton_an', [{ c: 'ton-an-1', t: 'Ton ist an, Offizier. Sie hören von mir.' }]));
      spiel(wt.c, wt.t, 'ruhig');
      tonBanner('🔊 TON AN — der Funker meldet sich wieder');
    } else {
      allesStumm();
      if (welt.Musik) welt.Musik.stopp();          // AUS erstickt auch die Ambiente
      tonBanner('🔇 FUNKSTILLE — alles stumm, Befehl ausgefuehrt');
    }
  }

  /* ---------- Start ---------- */

  function ersteGeste() {
    if (geste) return;
    geste = true;
    audio();
    if (begruessungOffen && an()) {
      begruessungOffen = false;
      /* Stimmen laden asynchron — kleiner Aufschub macht die Wahl sicher. */
      setTimeout(begruessung, 400);
    }
  }

  function start() {

    var k = document.getElementById('ton-knopf');
    if (k) k.addEventListener('click', function () { ersteGeste(); umschalten(); });
    beschrifte();

    /* Der Entsperr-Klick ist die Geste; sonst die erste Beruehrung. */
    var e = document.getElementById('entsperren');
    if (e) e.addEventListener('click', ersteGeste);
    document.addEventListener('pointerdown', ersteGeste, { once: false });

    /* Tab verdeckt oder geschlossen -> laufende Aufnahmen SOFORT stumm
     * (Vorgabe 15.8.: "auch wenn man die Website schliesst"). */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) allesStumm();
    });
    window.addEventListener('pagehide', allesStumm);

    /* SCHALTER GELTEN IN ALLEN TABS (15.8., der wahre Taeter war ein
     * vergessener Hintergrund-Tab mit altem Code): aendert IRGENDEIN
     * Tab den Ton-Schalter auf aus, verstummt auch dieser hier sofort. */
    window.addEventListener('storage', function (ev) {
      if (ev.key === 'orion-ton' && ev.newValue === 'aus') {
        allesStumm();
        if (welt.Musik) welt.Musik.stopp();
      }
    });

    avatarBauen();
    stummknopfBauen();
    vorleseKnoepfe(); mikroBauen();
    setInterval(function () { avatarBauen(); stummknopfBauen(); vorleseKnoepfe(); mikroBauen(); }, 3000);   // falls der Funker spaeter baut
    setInterval(pruefe, 2000);

    /* DER WACHHUND (15.8., letzte Runde des Ton-Problems): jede Sekunde
     * wird erzwungen, was der Schalter sagt. Selbst wenn irgendein Weg
     * jemals wieder klemmen sollte - laenger als eine Sekunde kann
     * nichts mehr toenen. */
    setInterval(function () {
      if (!an() && laufend.length) allesStumm();
    }, 1000);

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
