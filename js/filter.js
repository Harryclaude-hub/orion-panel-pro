/* Orion Panel Pro — Filter
 *
 * Ein Feld rechts, das man auf- und zuklappen kann. Es filtert NUR die
 * Anzeige: gesucht und gerechnet wird unveraendert auf dem Server. Wer
 * einen Filter setzt, verliert also keine Funde, er sieht sie nur nicht.
 * Genau deshalb steht unter jedem Reiter, wie viele ausgeblendet sind —
 * ein Filter, der stillschweigend etwas verschluckt, ist eine Falle.
 *
 * Die Einstellung ueberlebt das Auffrischen (alle 2 s) und einen Neustart
 * des Browsers. Ohne das waere das Feld unbenutzbar: bei jedem Takt waere
 * es wieder zurueckgesetzt.
 */

(function (welt) {
  'use strict';

  var SCHLUESSEL = 'orion-filter';

  /* Die Marktart kommt seit dem 10.8.2026 aus der SPALTE `art`, die der
   * Scanner schreibt.
   *
   * Vorher wurde sie aus dem Anzeigetext `mannschaft` abgelesen. Das war
   * nicht nur unsauber, es war falsch: die Ableitung kannte vier Arten,
   * laufen tun neun. "Barcelona führt zur Halbzeit" und "1. Halbzeit
   * Über/Unter 0.5" fielen still in "sieger" bzw. "ueber_unter" — wer nach
   * Sieger filterte, bekam Halbzeit-Wetten mitgeliefert, ohne es zu merken.
   *
   * Der alte Weg bleibt als RUECKFALL fuer Zeilen, die vor der Umstellung
   * geschrieben wurden und deshalb `art = null` tragen. Er bleibt dabei so
   * grob wie er war — das ist kein Mangel, sondern ehrlich: fuer diese alten
   * Zeilen IST die Art nicht besser bekannt. */
  function artVon(f) {
    if (f && f.art) return String(f.art);
    var m = String(f && f.mannschaft || '');
    if (m === 'Unentschieden') return 'unentschieden';
    if (m === 'Unentschieden zur Halbzeit') return 'hz_unentschieden';
    if (m === 'Beide Mannschaften treffen') return 'btts';
    if (m.indexOf('1. Halbzeit Über/Unter') === 0) return 'hz1_ueber_unter';
    if (m.indexOf('2. Halbzeit Über/Unter') === 0) return 'hz2_ueber_unter';
    if (m.indexOf('Ecken Über/Unter') === 0) return 'ecken_ueber_unter';
    if (m.indexOf('Über/Unter') === 0) return 'ueber_unter';
    if (/ führt zur Halbzeit$/.test(m)) return 'hz_sieger';
    return 'sieger';
  }

  /* Alle neun genutzten Fragearten. Die Reihenfolge folgt der Uebergabe. */
  var ARTEN = [
    { id: 'sieger',            name: 'Sieger' },
    { id: 'unentschieden',     name: 'Unentschieden' },
    { id: 'hz_sieger',         name: 'Sieger zur Halbzeit' },
    { id: 'hz_unentschieden',  name: 'Unentschieden zur Halbzeit' },
    { id: 'btts',              name: 'Beide treffen' },
    { id: 'ueber_unter',       name: 'Über/Unter' },
    { id: 'hz1_ueber_unter',   name: 'Über/Unter 1. Halbzeit' },
    { id: 'hz2_ueber_unter',   name: 'Über/Unter 2. Halbzeit' },
    { id: 'ecken_ueber_unter', name: 'Ecken Über/Unter' }
  ];

  var SPORTARTEN = [
    { id: 'soccer', name: 'Fußball' }, { id: 'ucl', name: 'Champions League' },
    { id: 'mlb', name: 'Baseball' },   { id: 'nfl', name: 'Football' },
    { id: 'nba', name: 'Basketball' }, { id: 'tennis', name: 'Tennis' }
  ];

  /* ---------- BEREICH: genau EINER, nie zwei gleichzeitig ----------
   *
   * Anlass ist die Fehlpaarung vom 11.8.2026: ein Fussballspiel wurde gegen
   * ein League-of-Legends-Match derselben Mannschaft gehalten, 5,34 % Rendite,
   * live. Die Namen waren wirklich gleich — nur der Sport nicht.
   *
   * Der Scanner trennt inzwischen selbst (Z.gleicherBereich). Dieser Filter
   * ist die zweite Haelfte: man sieht immer nur EINEN Bereich, nie eine
   * Mischung. Das ist bewusst KEINE Mehrfachauswahl wie bei den anderen
   * Filtern — wer Fussball und E-Sport gleichzeitig sieht, vergleicht
   * irgendwann doch wieder Zeilen, die nichts miteinander zu tun haben.
   *
   * "alle" bleibt moeglich, ist aber ausdruecklich als Sammelansicht
   * gekennzeichnet und nicht die Voreinstellung fuer die Arbeit an einem
   * Bereich. */
  var BEREICHE = [
    /* "Alle Bereiche" ist wieder erlaubt — Vorgabe vom 11.8.2026 spaet
     * abends, und sie ist begruendet: die TRENNUNG passiert seither beim
     * SCANNEN, nicht beim Anschauen. Jeder Bereich hat seinen eigenen
     * Scanner (orion-lauf-<bereich>), der nur die Maerkte seines Themas
     * kennt; Fussball kann gar nicht mehr gegen League of Legends gepaart
     * werden, egal was die Anzeige mischt. Die Sammelansicht zeigt also
     * nur noch Zeilen, die je fuer sich innerhalb EINES Bereichs
     * entstanden sind. */
    { id: null,          name: 'Alle Bereiche', gruppe: '' },
    { id: 'fussball',    name: 'Fußball',            gruppe: 'Sport' },
    { id: 'tennis',      name: 'Tennis',             gruppe: 'Sport' },
    { id: 'basketball',  name: 'Basketball',         gruppe: 'Sport' },
    { id: 'baseball',    name: 'Baseball',           gruppe: 'Sport' },
    { id: 'football',    name: 'American Football',  gruppe: 'Sport' },
    { id: 'eishockey',   name: 'Eishockey',          gruppe: 'Sport' },
    { id: 'golf',        name: 'Golf',               gruppe: 'Sport' },
    { id: 'cricket',     name: 'Cricket',            gruppe: 'Sport' },
    { id: 'mma',         name: 'MMA und Boxen',      gruppe: 'Sport' },
    { id: 'motorsport',  name: 'Motorsport',         gruppe: 'Sport' },
    /* 21. Bereich, Auftrag vom 11.8.2026: Spielerwetten (Wetten auf
     * einzelne Spieler statt auf Mannschaften). Steht im Register und im
     * Filter, der Scanner dazu ist aber AUS: Polymarket fuehrt keinen
     * brauchbaren Tag dafuer (gemessen am 11.8.: player-props, props,
     * goalscorer u.a. — alle 0 Events), und Kalshi/Smarkets-Quellen sind
     * ungemessen. Erst Quelle messen, dann Trockenlauf, dann scannen. */
    { id: 'spielerwetten', name: 'Spielerwetten',    gruppe: 'Sport' },
    { id: 'lol',         name: 'League of Legends',  gruppe: 'E-Sport' },
    { id: 'valorant',    name: 'Valorant',           gruppe: 'E-Sport' },
    { id: 'esport',      name: 'E-Sport übrige',     gruppe: 'E-Sport' },
    { id: 'politik',     name: 'Politik und Wahlen', gruppe: 'Welt' },
    { id: 'krypto',      name: 'Krypto',             gruppe: 'Welt' },
    { id: 'wirtschaft',  name: 'Wirtschaft',         gruppe: 'Welt' },
    { id: 'welt',        name: 'Weltereignisse',     gruppe: 'Welt' },
    { id: 'wetter',      name: 'Wetter',             gruppe: 'Welt' },
    { id: 'tech',        name: 'Technik und KI',     gruppe: 'Welt' },
    { id: 'kultur',      name: 'Popkultur',          gruppe: 'Welt' }
  ];

  /* Bereich eines Fundes. Vorrang hat die Spalte, die der Scanner schreibt.
   * Fuer Zeilen von vor der Umstellung wird er aus der Sportart abgeleitet —
   * das ist derselbe Ruecksfall wie bei der Marktart. */
  var SPORT_BEREICH = {
    soccer: 'fussball', ucl: 'fussball', tennis: 'tennis', nba: 'basketball',
    mlb: 'baseball', nfl: 'football', cfb: 'football', nhl: 'eishockey',
    golf: 'golf', cricket: 'cricket', mma: 'mma', f1: 'motorsport',
    lol: 'lol', valorant: 'valorant', esports: 'esport',
    politics: 'politik', elections: 'politik', geopolitics: 'politik',
    crypto: 'krypto', bitcoin: 'krypto', ethereum: 'krypto',
    economics: 'wirtschaft', inflation: 'wirtschaft', fed: 'wirtschaft',
    world: 'welt', weather: 'wetter',
    tech: 'tech', ai: 'tech', science: 'tech', 'pop-culture': 'kultur'
  };

  function bereichVon(f) {
    if (f && f.bereich) return String(f.bereich);
    var s = String(f && f.sportart || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(SPORT_BEREICH, s) ? SPORT_BEREICH[s] : null;
  }

  /* "alle" ist bewusst der Standard: ein Panel, das beim ersten Oeffnen
   * schon filtert, versteckt Funde, von denen man nichts weiss. */
  var STANDARD = {
    offen: false,
    gefundenMin: 0,     // 0 = alle
    endetStd: 0,        // 0 = alle
    minRendite: null,   // null = keine eigene Grenze
    minEinsatz: 0,
    nurMitMenge: false,
    buecher: null,      // null = alle
    arten: null,
    sportarten: null,
    /* GENAU EIN Bereich, nie mehrere. null = Sammelansicht ueber alle. */
    bereich: null
  };

  var stand = laden();

  function laden() {
    var s = {};
    for (var k in STANDARD) if (Object.prototype.hasOwnProperty.call(STANDARD, k)) s[k] = STANDARD[k];
    try {
      var roh = localStorage.getItem(SCHLUESSEL);
      if (roh) {
        var g = JSON.parse(roh);
        for (var j in g) if (Object.prototype.hasOwnProperty.call(s, j)) s[j] = g[j];
      }
    } catch (e) { /* Speicher gesperrt oder Unsinn drin: dann eben Standard */ }
    return s;
  }
  function sichern() {
    try { localStorage.setItem(SCHLUESSEL, JSON.stringify(stand)); } catch (e) {}
  }

  function anListe(liste, wert) {
    return liste === null || liste.indexOf(wert) >= 0;
  }

  /* Der eigentliche Filter. Gibt zurueck, ob ein Fund gezeigt wird. */
  function passt(f, imVerlauf) {
    var jetzt = Date.now();

    if (stand.gefundenMin > 0) {
      var t = Date.parse(f.zuerst_gesehen || '');
      if (isNaN(t) || (jetzt - t) > stand.gefundenMin * 60000) return false;
    }
    /* Im Verlauf ist "endet in" sinnlos — die Partie ist ja vorbei. */
    if (stand.endetStd > 0 && !imVerlauf) {
      var e = Date.parse(f.endet_am || '');
      if (isNaN(e) || (e - jetzt) > stand.endetStd * 3600000) return false;
    }
    if (stand.minRendite !== null && Number(f.rendite) < stand.minRendite) return false;

    /* Unbekannte Menge ist NICHT null. Wer "nur mit bekannter Menge"
     * anhakt, will genau diese Zeilen loswerden; wer es nicht anhakt,
     * soll sie sehen statt sie stillschweigend zu verlieren. */
    if (stand.nurMitMenge && f.max_einsatz === null) return false;
    if (stand.minEinsatz > 0) {
      if (f.max_einsatz === null) return false;
      if (Number(f.max_einsatz) < stand.minEinsatz) return false;
    }

    if (!anListe(stand.buecher, f.buch_1 || 'polymarket') &&
        !anListe(stand.buecher, f.buch || 'betfair')) return false;
    if (stand.buecher !== null) {
      /* BEIDE Buecher muessen erlaubt sein. Sonst zeigt der Filter "nur
       * Smarkets" auch Zeilen, deren zweite Seite ein abgewaehltes Buch
       * ist — und die kann man nicht handeln, wenn man dort kein Konto hat. */
      if (!anListe(stand.buecher, f.buch_1 || 'polymarket')) return false;
      if (!anListe(stand.buecher, f.buch || 'betfair')) return false;
    }
    if (!anListe(stand.arten, artVon(f))) return false;
    if (!anListe(stand.sportarten, f.sportart)) return false;
    /* BEREICH: genau einer. Ist einer gewaehlt, faellt alles andere weg —
     * auch Zeilen, deren Bereich unbekannt ist. Unbekannt heisst hier nicht
     * "passt schon", sondern "gehoert nicht sicher hierher". */
    if (stand.bereich !== null && bereichVon(f) !== stand.bereich) return false;
    return true;
  }

  function anwenden(liste, imVerlauf) {
    if (!liste || !liste.length) return { sichtbar: liste || [], weg: 0 };
    var s = [];
    for (var i = 0; i < liste.length; i++) if (passt(liste[i], imVerlauf)) s.push(liste[i]);
    return { sichtbar: s, weg: liste.length - s.length };
  }

  function aktiv() {
    return stand.gefundenMin > 0 || stand.endetStd > 0 || stand.minRendite !== null ||
           stand.minEinsatz > 0 || stand.nurMitMenge || stand.bereich !== null ||
           stand.buecher !== null || stand.arten !== null || stand.sportarten !== null;
  }

  /* Name des gewaehlten Bereichs, fuer die Anzeige am Knopf. */
  function bereichName() {
    if (stand.bereich === null) return null;
    for (var i = 0; i < BEREICHE.length; i++) {
      if (BEREICHE[i].id === stand.bereich) return BEREICHE[i].name;
    }
    return stand.bereich;
  }

  /* ---------- Das Feld ---------- */

  function txt(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function kaesten(name, eintraege, gewaehlt) {
    return eintraege.map(function (x) {
      var an = gewaehlt === null || gewaehlt.indexOf(x.id) >= 0;
      return '<label class="f-zeile"><input type="checkbox" data-gruppe="' + name +
             '" data-wert="' + txt(x.id) + '"' + (an ? ' checked' : '') + '> ' + txt(x.name) + '</label>';
    }).join('');
  }

  function knoepfe(name, eintraege, gewaehlt) {
    return '<div class="f-knoepfe">' + eintraege.map(function (x) {
      return '<button type="button" class="f-knopf' + (gewaehlt === x.wert ? ' offen' : '') +
             '" data-feld="' + name + '" data-wert="' + x.wert + '">' + txt(x.name) + '</button>';
    }).join('') + '</div>';
  }

  function bauen() {
    var K = welt.KONFIG || {};
    var buecher = Object.keys(K.buecher || {}).map(function (id) {
      var b = K.buecher[id];
      return { id: id, name: b.name + (b.aktiv === false ? ' (aus)' : '') };
    });

    return '' +
      '<div class="f-kopf"><b>Filter</b>' +
        '<button type="button" class="f-zu" id="f-zu" title="Zuklappen">&times;</button></div>' +
      '<div class="f-koerper">' +

        /* GANZ OBEN, weil es die erste Entscheidung ist: welcher Bereich.
         * Ein Auswahlfeld und keine Kaestchen — man kann genau einen waehlen,
         * und das soll man auch sehen. */
        '<div class="f-gruppe f-bereich"><div class="f-titel">Bereich — nur einer</div>' +
          '<select id="f-bereich">' +
            BEREICHE.map(function (b) {
              var wert = b.id === null ? '' : b.id;
              var an = (stand.bereich === b.id) ? ' selected' : '';
              return '<option value="' + txt(wert) + '"' + an + '>' +
                     (b.gruppe ? txt(b.gruppe) + ' · ' : '') + txt(b.name) + '</option>';
            }).join('') +
          '</select>' +
          '<div class="f-hinweis">Seit dem 11.08. hat jeder Bereich seinen <b>eigenen ' +
          'Scanner</b> — gepaart wird nur noch innerhalb eines Bereichs. ' +
          '„Alle Bereiche" mischt deshalb nur die Anzeige, nie die Suche.</div>' +
        '</div>' +

        '<div class="f-gruppe"><div class="f-titel">Gefunden in den letzten</div>' +
          knoepfe('gefundenMin', [
            { name: 'alle', wert: 0 }, { name: '15 min', wert: 15 },
            { name: '1 h', wert: 60 }, { name: '6 h', wert: 360 }, { name: '24 h', wert: 1440 }
          ], stand.gefundenMin) +
        '</div>' +

        '<div class="f-gruppe"><div class="f-titel">Partie endet in</div>' +
          knoepfe('endetStd', [
            { name: 'alle', wert: 0 }, { name: '3 h', wert: 3 },
            { name: '12 h', wert: 12 }, { name: '24 h', wert: 24 }
          ], stand.endetStd) +
          '<div class="f-hinweis">Gilt nicht im Verlauf — dort ist die Partie vorbei.</div>' +
        '</div>' +

        '<div class="f-gruppe"><div class="f-titel">Mindestrendite</div>' +
          '<input type="number" id="f-rendite" step="0.1" placeholder="ohne Grenze" value="' +
            (stand.minRendite === null ? '' : stand.minRendite) + '"> %' +
        '</div>' +

        '<div class="f-gruppe"><div class="f-titel">Handelbarer Einsatz</div>' +
          '<input type="number" id="f-einsatz" step="1" min="0" value="' + stand.minEinsatz + '"> mindestens' +
          '<label class="f-zeile"><input type="checkbox" id="f-menge"' +
            (stand.nurMitMenge ? ' checked' : '') + '> nur mit bekannter Menge</label>' +
          '<div class="f-hinweis">Unbekannte Menge heißt nicht null. Ohne Haken bleibt sie sichtbar.</div>' +
        '</div>' +

        '<div class="f-gruppe"><div class="f-titel">Bücher</div>' +
          kaesten('buecher', buecher, stand.buecher) +
          '<div class="f-hinweis">Es müssen BEIDE Seiten erlaubt sein — eine Arbitrage braucht zwei.</div>' +
        '</div>' +

        '<div class="f-gruppe"><div class="f-titel">Frage</div>' +
          kaesten('arten', ARTEN, stand.arten) +
        '</div>' +

        '<div class="f-gruppe"><div class="f-titel">Sportart</div>' +
          kaesten('sportarten', SPORTARTEN, stand.sportarten) +
        '</div>' +

        '<button type="button" class="knopf" id="f-zurueck">Alles zurücksetzen</button>' +
      '</div>';
  }

  var gebaut = false;

  function umschalten(auf) {
    stand.offen = (auf === undefined) ? !stand.offen : !!auf;
    sichern();
    zeichnen();
  }

  function gruppeUmschalten(gruppe, wert, an) {
    var alle = gruppe === 'buecher' ? Object.keys((welt.KONFIG || {}).buecher || {})
             : gruppe === 'arten' ? ARTEN.map(function (x) { return x.id; })
             : SPORTARTEN.map(function (x) { return x.id; });
    var jetzt = stand[gruppe] === null ? alle.slice() : stand[gruppe].slice();
    var i = jetzt.indexOf(wert);
    if (an && i < 0) jetzt.push(wert);
    if (!an && i >= 0) jetzt.splice(i, 1);
    /* Alles angehakt ist dasselbe wie kein Filter — dann wieder null, damit
     * die Anzeige "Filter aktiv" nicht luegt. */
    stand[gruppe] = (jetzt.length === alle.length) ? null : jetzt;
    sichern();
    zeichnen();
    neuZeichnenLassen();
  }

  function neuZeichnenLassen() {
    if (welt.letztesErgebnis && welt.Anzeige) welt.Anzeige.zeichne(welt.letztesErgebnis);
  }

  function zeichnen() {
    var panel = document.getElementById('filter-panel');
    var knopf = document.getElementById('filter-knopf');
    if (!panel || !knopf) return;

    if (!gebaut) {
      panel.innerHTML = bauen();
      gebaut = true;
      binden(panel);
    }
    panel.classList.toggle('offen', stand.offen);
    knopf.classList.toggle('an', aktiv());
    /* Der gewaehlte Bereich steht AM KNOPF. Wer nur "Filter aktiv" liest,
     * weiss nicht, dass er gerade ausschliesslich Fussball sieht — und
     * wundert sich, warum nichts kommt. */
    var b = bereichName();
    var text = b ? ('Bereich: ' + b) : (aktiv() ? 'Filter aktiv' : 'Filter');
    /* NICHT knopf.textContent — das loeschte das Militaer-Symbol und die
     * Unterzeile des Knopfs (14.8. entdeckt). Beschriftet wird nur die
     * fette Zeile; gibt es sie nicht, der ganze Knopf wie frueher. */
    var fett = knopf.querySelector('b');
    if (fett) { if (fett.textContent !== text) fett.textContent = text; }
    else if (knopf.textContent !== text) knopf.textContent = text;
  }

  function binden(panel) {
    panel.addEventListener('click', function (ev) {
      var z = ev.target;
      if (z.id === 'f-zu') return umschalten(false);
      if (z.id === 'f-zurueck') {
        for (var k in STANDARD) if (Object.prototype.hasOwnProperty.call(STANDARD, k)) stand[k] = STANDARD[k];
        stand.offen = true;
        gebaut = false;
        sichern();
        zeichnen();
        neuZeichnenLassen();
        return;
      }
      if (z.classList && z.classList.contains('f-knopf')) {
        stand[z.getAttribute('data-feld')] = Number(z.getAttribute('data-wert'));
        sichern();
        var geschwister = z.parentNode.querySelectorAll('.f-knopf');
        for (var i = 0; i < geschwister.length; i++) geschwister[i].classList.remove('offen');
        z.classList.add('offen');
        zeichnen();
        neuZeichnenLassen();
      }
    });

    panel.addEventListener('change', function (ev) {
      var z = ev.target;
      if (z.id === 'f-bereich') {
        stand.bereich = z.value === '' ? null : z.value;
        sichern(); zeichnen(); return neuZeichnenLassen();
      }
      if (z.id === 'f-menge') { stand.nurMitMenge = z.checked; sichern(); zeichnen(); return neuZeichnenLassen(); }
      var g = z.getAttribute && z.getAttribute('data-gruppe');
      if (g) return gruppeUmschalten(g, z.getAttribute('data-wert'), z.checked);
    });

    panel.addEventListener('input', function (ev) {
      var z = ev.target;
      if (z.id === 'f-rendite') {
        var v = z.value.trim();
        stand.minRendite = v === '' ? null : Number(v);
        if (stand.minRendite !== null && !isFinite(stand.minRendite)) stand.minRendite = null;
      } else if (z.id === 'f-einsatz') {
        var w = Number(z.value);
        stand.minEinsatz = isFinite(w) && w > 0 ? w : 0;
      } else return;
      sichern();
      zeichnen();
      neuZeichnenLassen();
    });
  }

  function start() {
    var knopf = document.getElementById('filter-knopf');
    if (knopf) knopf.addEventListener('click', function () { umschalten(); });
    zeichnen();
  }

  welt.Filter = {
    anwenden: anwenden,
    aktiv: aktiv,
    artVon: artVon,
    bereichVon: bereichVon,
    BEREICHE: BEREICHE,
    start: start,
    zeichnen: zeichnen
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
