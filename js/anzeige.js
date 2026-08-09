/* Orion Panel Pro — Anzeige
 *
 * Fehlerklasse 6: sekuendliches innerHTML auf Elementen unter der Maus
 * zerstoert den Hover-Zustand und laesst Klicks zwischen mousedown und
 * mouseup durchfallen. Bei zwei Sekunden Takt ist das keine Kleinigkeit
 * mehr, sondern der Normalfall. Deshalb wird JEDER Block nur geschrieben,
 * wenn sich sein Inhalt wirklich geaendert hat.
 *
 * Fehlerklasse 4: beide Marktlinks sind echte <a target="_blank">, kein
 * JS-Oeffner. Eine Nutzergeste, die durch asynchrone Arbeit laeuft, gilt
 * nicht mehr.
 *
 * Fehlerklasse 5: kein content-visibility.
 */

(function (welt) {
  'use strict';

  function setzeWennAnders(el, html) {
    if (!el) return false;
    if (el.dataset.stand === html) return false;
    el.dataset.stand = html;
    el.innerHTML = html;
    return true;
  }

  function txt(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function dauer(sekunden) {
    if (sekunden === null || sekunden === undefined) return '?';
    var s = Math.abs(sekunden);
    if (s < 90) return Math.round(s) + ' s';
    if (s < 5400) return Math.round(s / 60) + ' min';
    if (s < 172800) return (s / 3600).toFixed(1) + ' h';
    return (s / 86400).toFixed(1) + ' Tage';
  }

  function bis(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '?';
    var s = (t - Date.now()) / 1000;
    return s < 0 ? 'vorbei' : dauer(s);
  }

  function seit(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '?';
    return dauer((Date.now() - t) / 1000);
  }

  /* Beide Links sind Pflicht (Uebergabe 8, Punkt 3): jede Zeile, auch die
   * knappste, traegt beide und sie treffen denselben Markt. Fehlt einer,
   * wird das gesagt statt still einen toten Knopf anzuzeigen. */
  function aktionen(f) {
    var h = '<div class="aktionen">';
    if (f.pm_link) {
      h += '<a class="knopf" target="_blank" rel="noopener" href="' + txt(f.pm_link) + '">Polymarket öffnen</a>' +
           '<button class="knopf kopieren" data-link="' + txt(f.pm_link) + '" title="Polymarket-Link kopieren">Link kopieren</button>';
    } else {
      h += '<span class="knopf gesperrt" title="Kein Polymarket-Link im Fund">Polymarket fehlt</span>';
    }
    if (f.bf_link) {
      h += '<a class="knopf" target="_blank" rel="noopener" href="' + txt(f.bf_link) + '">' +
             (f.buch === 'kalshi' ? 'Kalshi öffnen' : 'Betfair über Orbit') + '</a>' +
           '<button class="knopf kopieren" data-link="' + txt(f.bf_link) + '" title="Gegenbuch-Link kopieren">Link kopieren</button>';
    } else {
      h += '<span class="knopf gesperrt" title="Kein Link im Fund">Gegenbuch-Link fehlt</span>';
    }
    h += '</div>';
    return h;
  }

  function zeitpunkt(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '?';
    var d = new Date(t);
    function zwei(n) { return (n < 10 ? '0' : '') + n; }
    return zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '. ' + zwei(d.getHours()) + ':' + zwei(d.getMinutes());
  }

  /* Die Analysezeile: was, wie viel, seit wann, bis wann. Alles in einer
   * Zeile, damit man einen Fund beurteilen kann ohne zu rechnen. */
  function analyse(f, imVerlauf) {
    var gewinn = Number(f.auszahlung) - 100;
    return '<div class="analyse">' +
      '<span><b>' + Number(f.rendite).toFixed(2) + ' %</b> Rendite</span>' +
      '<span>' + (gewinn >= 0 ? '+' : '') + gewinn.toFixed(2) + ' auf 100 Einsatz</span>' +
      '<span>beste bisher ' + Number(f.beste_rendite == null ? f.rendite : f.beste_rendite).toFixed(2) + ' %</span>' +
      '<span>gefunden ' + zeitpunkt(f.zuerst_gesehen) + ' (vor ' + seit(f.zuerst_gesehen) + ')</span>' +
      '<span>' + (imVerlauf
        ? 'beendet ' + zeitpunkt(f.vorbei_seit)
        : 'endet ' + zeitpunkt(f.endet_am) + ' (in ' + bis(f.endet_am) + ')') + '</span>' +
      '</div>';
  }

  /* Was die Nachkontrolle zu diesem Fund sagt. Drei Zustaende, nicht zwei:
   * geprueft und gut, geprueft und schlecht, ODER nicht pruefbar. Das dritte
   * wegzulassen waere eine Luege — orbitexch und kalshi weisen Aufrufe aus
   * Rechenzentren ab (403 und 429), das sagt nichts ueber den Link. */
  function marke(zustand, jaText, neinText, offenText) {
    if (zustand === true)  return '<span class="chip gut">' + jaText + '</span> ';
    if (zustand === false) return '<span class="chip rot">' + neinText + '</span> ';
    return '<span class="chip">' + offenText + '</span> ';
  }

  function pruefzeile(f) {
    if (!f.geprueft_am) {
      return '<div class="unter"><span class="chip acht">noch nicht nachgeprueft</span></div>';
    }
    return '<div class="unter">' +
      marke(f.rechnung_ok, 'Rechnung nachgeprueft', 'Rechnung beanstandet', 'Rechnung offen') +
      marke(f.pm_link_ok, 'Polymarket-Link lebt', 'Polymarket-Link tot', 'Polymarket-Link nicht pruefbar') +
      marke(f.gegen_link_ok, 'Gegenlink lebt', 'Gegenlink tot', 'Gegenlink nicht pruefbar') +
      '<span class="chip">geprueft vor ' + seit(f.geprueft_am) + '</span>' +
      (f.rechnung_ok === false && f.rechnung_grund ? ' <span class="chip rot">' + txt(f.rechnung_grund) + '</span>' : '') +
      '</div>';
  }

  function karte(f, imVerlauf) {
    var chance = f.rendite >= welt.KONFIG.mindestRendite;
    return '' +
      '<div class="fund' + (chance && !imVerlauf ? ' chance' : '') + (imVerlauf ? ' alt' : '') + '">' +
        '<div class="titel">' + txt(f.titel) + '</div>' +
        '<div class="unter">' +
          '<span class="chip ' + (f.buch === 'kalshi' ? 'ka' : 'bf') + '">' +
            (f.buch === 'kalshi' ? 'Kalshi · kein Konto' : 'Betfair · Bridge') + '</span> ' +
          (f.veraltet ? '<span class="chip rot">Kurse veraltet</span> ' : '') +
          '<span class="chip">' + txt(f.sportart) + '</span> ' +
          '<span class="chip">' + (imVerlauf ? 'beendet vor ' + seit(f.vorbei_seit) : 'endet in ' + bis(f.endet_am)) + '</span> ' +
          '<span class="chip' + (Number(f.zuordnung) >= 0.99 ? ' gut' : ' acht') + '">Zuordnung ' + Number(f.zuordnung).toFixed(2) + '</span> ' +
          '<span class="chip' + (chance ? ' gut' : '') + '">Rendite ' + Number(f.rendite).toFixed(2) + ' %</span> ' +
          '<span class="chip">beste ' + Number(f.beste_rendite == null ? f.rendite : f.beste_rendite).toFixed(2) + ' %</span> ' +
          '<span class="chip">gesehen seit ' + seit(f.zuerst_gesehen) + '</span>' +
          (imVerlauf && f.vorbei_grund ? ' <span class="chip rot">' + txt(f.vorbei_grund) + '</span>' : '') +
        '</div>' +
        '<div class="seiten">' +
          '<div class="seite pm">' +
            '<div class="quelle">Polymarket</div>' +
            '<div class="zahl">' + txt(f.pm_seite) + ' ' + Number(f.pm_preis).toFixed(3) + '</div>' +
            '<div class="leise">' + txt(f.mannschaft) + '</div>' +
          '</div>' +
          '<div class="seite bf">' +
            '<div class="quelle">' + (f.buch === 'kalshi' ? 'Kalshi' : 'Betfair') + '</div>' +
            '<div class="zahl">' + txt(f.bf_seite) + ' ' + Number(f.bf_quote).toFixed(2) + '</div>' +
            '<div class="leise">' + txt(f.bf_name) + '</div>' +
          '</div>' +
        '</div>' +
        pruefzeile(f) +
        analyse(f, imVerlauf) +
        '<div class="unter">Kehrwertsumme ' + Number(f.inv).toFixed(4) +
          ' &middot; Aufteilung ' + Number(f.einsatz_1).toFixed(2) + ' / ' + Number(f.einsatz_2).toFixed(2) +
          ' &rarr; Auszahlung ' + Number(f.auszahlung).toFixed(2) +
          ' &middot; Partie dort: ' + txt(f.bf_partie) + '</div>' +
        aktionen(f) +
      '</div>';
  }

  function kacheln(s) {
    var scannerLaeuft = s.lauf_alter_s !== null && s.lauf_alter_s < welt.KONFIG.laufMaxAlterS;
    var bridgeLaeuft = s.bf_alter_s !== null && s.bf_alter_s < welt.KONFIG.bridgeMaxAlterS;
    var kalshiLaeuft = s.kalshi_alter_s !== null && s.kalshi_alter_s < welt.KONFIG.kalshiMaxAlterS;
    return [
      { name: 'Chancen live', wert: s.chancen, farbe: s.chancen > 0 ? 'var(--gruen)' : 'var(--text-leise)' },
      { name: 'Knappe Paare', wert: s.knapp },
      { name: 'Im Verlauf', wert: s.verlauf },
      { name: 'Scanner', wert: dauer(s.lauf_alter_s), farbe: scannerLaeuft ? 'var(--gruen)' : 'var(--rot)' },
      { name: 'Kalshi · ohne Konto', wert: dauer(s.kalshi_alter_s),
        farbe: kalshiLaeuft ? 'var(--tuerkis)' : 'var(--rot)' },
      { name: 'Bridge · Heim-PC', wert: dauer(s.bf_alter_s), farbe: bridgeLaeuft ? 'var(--gruen)' : 'var(--rot)' }
    ].map(function (k) {
      return '<div class="kachel"><div class="wert" style="color:' + (k.farbe || 'var(--text)') + '">' +
             txt(k.wert) + '</div><div class="name">' + txt(k.name) + '</div></div>';
    }).join('');
  }

  function zeichne(e) {
    var K = welt.KONFIG;
    var s = e.statistik;

    setzeWennAnders(document.getElementById('kacheln'), kacheln(s));

    var warn = '';
    if (s.lauf_alter_s === null) {
      warn += '<div class="warnung"><b>Der Scanner hat noch nie gelaufen.</b> ' +
              'Er sollte jede Minute von selbst starten.</div>';
    } else if (s.lauf_alter_s > K.laufMaxAlterS) {
      warn += '<div class="warnung"><b>Der Scanner läuft seit ' + dauer(s.lauf_alter_s) + ' nicht mehr.</b> ' +
              'Erwartet wird jede Minute ein Durchlauf.</div>';
    }
    if (s.lauf_fehler) {
      warn += '<div class="warnung"><b>Letzter Lauf mit Fehler:</b> ' + txt(s.lauf_fehler) + '</div>';
    }
    if (s.bf_alter_s === null || s.bf_alter_s > K.bridgeMaxAlterS) {
      warn += '<div class="warnung"><b>Betfair-Daten sind ' + dauer(s.bf_alter_s) + ' alt.</b> ' +
              'Die Bridge auf dem Heim-PC lädt normalerweise im Minutentakt hoch. ' +
              'Betfair-Zeilen zählen deshalb gerade nicht als Chance. ' +
              '<b>Die Kalshi-Seite läuft davon unabhängig weiter</b> — sie braucht weder Konto noch PC.</div>';
    }
    if (s.kalshi_alter_s === null || s.kalshi_alter_s > K.kalshiMaxAlterS) {
      warn += '<div class="warnung"><b>Kalshi-Daten sind ' + dauer(s.kalshi_alter_s) + ' alt.</b> ' +
              'Gesammelt wird alle 5 Minuten, ein Durchlauf dauert rund 52 Sekunden.</div>';
    }
    setzeWennAnders(document.getElementById('warnungen'), warn);

    var live = '';
    if (e.chancen.length) {
      live += '<h2>Chancen (' + e.chancen.length + ')</h2>' +
              e.chancen.map(function (f) { return karte(f, false); }).join('');
    } else {
      live += '<h2>Chancen (0)</h2><div class="warnung">Gerade keine Chance über ' +
              K.mindestRendite.toFixed(2) + ' %. Das ist der Normalfall: zwei Börsen mit vielen ' +
              'Teilnehmern liegen selten weit auseinander.</div>';
    }
    if (e.knapp.length) {
      live += '<h2>Knappste Paare (' + e.knapp.length + ')</h2>' +
              e.knapp.slice(0, 40).map(function (f) { return karte(f, false); }).join('');
    }
    setzeWennAnders(document.getElementById('live'), live);

    var verlauf = '<h2>Verlauf (' + e.verlauf.length + ')</h2>';
    if (!e.verlauf.length) {
      verlauf += '<p class="leise">Noch nichts beendet. Was hier verschwindet, landet hier.</p>';
    } else {
      verlauf += e.verlauf.map(function (f) { return karte(f, true); }).join('');
    }
    setzeWennAnders(document.getElementById('verlauf'), verlauf);
  }

  function stand(text, art) {
    var el = document.getElementById('stand');
    if (!el) return;
    var neu = 'chip' + (art ? ' ' + art : '');
    if (el.className !== neu) el.className = neu;
    if (el.textContent !== text) el.textContent = text;
  }

  /* Kopieren laeuft ueber EINEN Zuhoerer am Dokument, nicht ueber einen je
   * Knopf. Bei zwei Sekunden Takt wird die Liste staendig neu geschrieben;
   * Zuhoerer an einzelnen Knoepfen waeren nach dem naechsten Takt weg. */
  document.addEventListener('click', function (e) {
    var knopf = e.target && e.target.closest ? e.target.closest('.kopieren') : null;
    if (!knopf) return;
    var link = knopf.getAttribute('data-link');
    if (!link) return;

    function gemeldet(text) {
      var alt = knopf.textContent;
      knopf.textContent = text;
      setTimeout(function () { knopf.textContent = alt; }, 1400);
    }

    /* Aelterer Weg. Wird auch gebraucht, wenn die neue Schnittstelle da ist,
     * aber ABLEHNT: das passiert, sobald das Fenster nicht im Vordergrund
     * ist. Ein Rueckfall, der nur bei fehlender Schnittstelle greift, greift
     * dann nie. */
    function ueberFeld() {
      try {
        var feld = document.createElement('textarea');
        feld.value = link;
        feld.setAttribute('readonly', '');
        feld.style.position = 'fixed';
        feld.style.top = '0';
        feld.style.opacity = '0';
        document.body.appendChild(feld);
        feld.select();
        feld.setSelectionRange(0, link.length);
        var ok = document.execCommand('copy');
        document.body.removeChild(feld);
        return ok;
      } catch (err) {
        return false;
      }
    }

    /* Beide Kopierwege verweigern per Browserregel, wenn das Fenster nicht
     * im Vordergrund ist. Gemessen am 9.8.2026: hasFocus false, beide Wege
     * schlagen fehl. Dann ist "Fenster aktivieren" die brauchbare Auskunft,
     * "ging nicht" waere nur eine Sackgasse. */
    function fehlgeschlagen() {
      gemeldet(document.hasFocus() ? 'ging nicht' : 'Fenster aktivieren');
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(
        function () { gemeldet('kopiert'); },
        function () { if (ueberFeld()) gemeldet('kopiert'); else fehlgeschlagen(); }
      );
      return;
    }
    if (ueberFeld()) gemeldet('kopiert'); else fehlgeschlagen();
  });

  welt.Anzeige = { zeichne: zeichne, stand: stand, dauer: dauer, zeitpunkt: zeitpunkt, setzeWennAnders: setzeWennAnders };

})(typeof globalThis !== 'undefined' ? globalThis : this);
