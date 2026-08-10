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

  /* Nur die Uhrzeit, gross und oben rechts. Datum kommt dazu, wenn der
   * Eintrag nicht von heute ist — sonst liest man 23:14 und denkt \"gerade
   * eben\", obwohl es von vorgestern ist. */
  function uhrzeit(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '?';
    var d = new Date(t);
    function zwei(n) { return (n < 10 ? '0' : '') + n; }
    var heute = new Date();
    var gleicherTag = d.getDate() === heute.getDate() &&
                      d.getMonth() === heute.getMonth() &&
                      d.getFullYear() === heute.getFullYear();
    var uhr = zwei(d.getHours()) + ':' + zwei(d.getMinutes());
    return gleicherTag ? uhr : zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '. ' + uhr;
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
  /* Wie viel Geld passt hinein? Die wichtigste Risikozahl nach der Rendite.
   * Drei Zustaende: bekannt, unbekannt, oder nichts mehr da. \"Unbekannt\"
   * darf nie wie \"unbegrenzt\" aussehen. */
  function menge(f) {
    if (f.max_einsatz === null || f.max_einsatz === undefined) {
      return '<span title="Eine der beiden Seiten meldet keine Menge">Menge unbekannt</span>';
    }
    var e = Number(f.max_einsatz);
    if (!(e > 0)) return '<span class="rot">nichts mehr verfügbar</span>';
    var g = f.max_gewinn === null || f.max_gewinn === undefined ? null : Number(f.max_gewinn);
    /* "-54,68 Gewinn" ist Unsinn. Bei Minus ist es ein Verlust, und genau so
     * muss es dastehen — sonst liest man ueber das Vorzeichen hinweg. */
    return '<span><b>max. ' + (e >= 1000 ? Math.round(e).toLocaleString('de-AT') : e.toFixed(0)) +
           '</b> Einsatz möglich' + (g === null ? '' :
             ' &rarr; ' + (g >= 0 ? '+' + g.toFixed(2) + ' Gewinn'
                                  : g.toFixed(2) + ' Verlust')) + '</span>';
  }

  /* ---------- Effektivquoten ----------
   *
   * Der Grund, warum Nachrechnen von Hand bisher manchmal nicht aufging:
   * in derselben Zeile steht einmal "Lay 4.90" und einmal "Nein 0.810".
   * Optisch dasselbe Feld, inhaltlich voellig Verschiedenes — eine Quote
   * gegen einen Anteilspreis. Wer beide gleich behandelt, kommt zwangslaeufig
   * auf eine andere Zahl als das Programm.
   *
   * Deshalb steht jetzt unter jeder Seite die EFFEKTIVQUOTE. Die sind
   * vergleichbar, und mit ihnen geht die Rechnung von Hand auf:
   *   1/qe1 + 1/qe2 = Kehrwertsumme,  darunter 1 heisst Gewinn.
   */
  function qePmWert(f) {
    var p = Number(f.pm_preis), s = Number(f.pm_gebuehr);
    if (!(p > 0 && p < 1) || !isFinite(s)) return null;
    return (1 - s * Math.min(p, 1 - p)) / p;
  }
  function qeGegenWert(f) {
    var q = Number(f.bf_quote), s = Number(f.bf_gebuehr);
    if (!isFinite(q) || !isFinite(s)) return null;
    if (f.buch === 'kalshi') {
      if (!(q > 0 && q < 1)) return null;
      return (1 - s * q * (1 - q)) / q;
    }
    if (f.bf_seite === 'Lay') {
      if (!(q > 1)) return null;
      return 1 + (1 - s) / (q - 1);
    }
    if (!(q > 1)) return null;
    return 1 + (q - 1) * (1 - s);
  }
  function qeEins(f) { var x = qePmWert(f);   return x === null ? '?' : x.toFixed(3); }
  function qeZwei(f) { var x = qeGegenWert(f); return x === null ? '?' : x.toFixed(3); }

  /* ---------- Puffer ----------
   *
   * Wie weit darf sich ein Kurs bewegen, bevor die Arbitrage kippt? Bei
   * 0,3 % Rendite reicht ein Tick, bei 3 % hat man Luft. Ohne diese Zahl
   * sieht eine knappe Chance genauso aus wie eine belastbare.
   *
   * Gerechnet wird der Polymarket-Preis: wie weit darf er steigen, bis die
   * Kehrwertsumme 1 erreicht? Das ist die Seite, die man zuerst kauft.
   */
  function puffer(f) {
    var qe2 = qeGegenWert(f);
    var s = Number(f.pm_gebuehr);
    var p = Number(f.pm_preis);
    if (qe2 === null || !isFinite(s) || !(p > 0 && p < 1)) return null;
    var rest = 1 - 1 / qe2;                 // so viel Kehrwert darf Seite 1 hoechstens haben
    if (!(rest > 0)) return null;
    var qeNoetig = 1 / rest;                // ... also mindestens diese Effektivquote
    /* qe = (1 - s*min(p,1-p))/p nach p aufloesen. Unterhalb 0,5 ist
     * min(p,1-p) = p, also qe = (1-s*p)/p = 1/p - s  ->  p = 1/(qe+s). */
    var pMax = 1 / (qeNoetig + s);
    if (!(pMax > 0)) return null;
    return { pMax: pMax, prozent: (pMax - p) / p * 100 };
  }

  function pufferText(f) {
    var pu = puffer(f);
    if (!pu) return '<span>Puffer unbekannt</span>';
    if (pu.prozent <= 0) {
      return '<span>kein Puffer &mdash; der Preis müsste um ' + Math.abs(pu.prozent).toFixed(1) +
             ' % <b>fallen</b>, damit es aufgeht</span>';
    }
    return '<span>Puffer: Polymarket darf bis <b>' + pu.pMax.toFixed(3) + '</b> steigen ' +
           '(+' + pu.prozent.toFixed(1) + ' %), dann ist es aufgebraucht</span>';
  }

  /* ---------- Die Gegenprobe ----------
   *
   * Der gefaehrlichste denkbare Fehler ist nicht eine falsche Rendite, sondern
   * zwei Wetten auf DENSELBEN Ausgang. Dann ist es keine Absicherung, sondern
   * doppeltes Risiko — und die Rechnung sieht trotzdem gut aus.
   *
   * Deshalb steht auf jeder Karte im Klartext, was in welchem Fall passiert.
   * Wenn beide Seiten im selben Fall zahlen, wird gewarnt statt gerechnet.
   */
  function ausgaenge(f) {
    var name = f.mannschaft || 'diese Seite';
    var pmJa = String(f.pm_seite || '').toUpperCase();
    var pmZahltWenn, gegenZahltWenn;

    // Polymarket: JA/UEBER zahlt beim Eintreten, NEIN/UNTER beim Ausbleiben.
    if (pmJa === 'JA' || pmJa === 'ÜBER') pmZahltWenn = true;
    else if (pmJa === 'NEIN' || pmJa === 'UNTER') pmZahltWenn = false;
    else pmZahltWenn = null;

    // Gegenbuch: Back und Ja zahlen beim Eintreten, Lay und Nein beim Ausbleiben.
    var gs = String(f.bf_seite || '');
    if (gs === 'Back' || gs === 'Ja') gegenZahltWenn = true;
    else if (gs === 'Lay' || gs === 'Nein') gegenZahltWenn = false;
    else gegenZahltWenn = null;

    return { name: name, pm: pmZahltWenn, gegen: gegenZahltWenn,
             gedeckt: pmZahltWenn !== null && gegenZahltWenn !== null && pmZahltWenn !== gegenZahltWenn };
  }

  function gegenprobe(f) {
    var a = ausgaenge(f);
    var aus = Number(f.auszahlung);
    var e1 = Number(f.einsatz_1), e2 = Number(f.einsatz_2);
    var gesamt = e1 + e2;
    if (!(gesamt > 0)) return '';

    if (!a.gedeckt) {
      return '<div class="warnung"><b>Achtung: beide Seiten zeigen in dieselbe Richtung.</b> ' +
             'Damit wäre nur ein Ausgang gedeckt und der andere gar nicht — das ist keine ' +
             'Absicherung, sondern doppeltes Risiko. Diese Zeile nicht handeln.</div>';
    }

    var wennEin = a.pm ? 'Polymarket' : 'Gegenbuch';
    var wennAus = a.pm ? 'Gegenbuch' : 'Polymarket';

    return '<div class="gegenprobe">' +
      '<div class="gp-zeile"><span class="gp-fall">Wenn <b>' + txt(a.name) + '</b> eintritt</span>' +
        '<span class="gp-wer">' + wennEin + ' zahlt</span>' +
        '<span class="gp-zahl">' + aus.toFixed(2) + '</span></div>' +
      '<div class="gp-zeile"><span class="gp-fall">Wenn <b>' + txt(a.name) + '</b> NICHT eintritt</span>' +
        '<span class="gp-wer">' + wennAus + ' zahlt</span>' +
        '<span class="gp-zahl">' + aus.toFixed(2) + '</span></div>' +
      '<div class="gp-fuss">Beide Ausgänge zahlen <b>denselben</b> Betrag — genau dafür ist die ' +
        'Aufteilung <b>' + (100 * e1 / gesamt).toFixed(1) + ' % Polymarket / ' +
        (100 * e2 / gesamt).toFixed(1) + ' % Gegenbuch</b> und nicht 50/50.</div>' +
      '</div>';
  }

  /* Die Rendite in Worten. Eine Zahl mit Minus davor beantwortet die Frage
   * nicht, die man beim Hinsehen hat: lohnt sich das oder nicht. */
  function renditeText(f) {
    var r = Number(f.rendite);
    var inv = Number(f.inv);
    var schwelle = welt.KONFIG.mindestRendite;
    var pmG = (Number(f.pm_gebuehr) * 100).toFixed(1);
    var ggG = (Number(f.bf_gebuehr) * 100).toFixed(1);

    if (r >= schwelle) {
      return '<div class="urteil gut"><b>Lohnt sich: +' + r.toFixed(2) + ' %.</b> ' +
        'Beide Seiten zusammen kosten ' + (inv * 100).toFixed(2) + ' % dessen, was sie zurückzahlen. ' +
        'Der Rest ist Gewinn, egal wie es ausgeht.</div>';
    }
    if (r >= 0) {
      return '<div class="urteil"><b>Zu knapp: +' + r.toFixed(2) + ' %.</b> ' +
        'Rechnerisch über null, aber unter ' + schwelle.toFixed(2) + ' %. ' +
        'Bis beide Seiten gesetzt sind, ist so ein Vorsprung meist weg.</div>';
    }
    /* Wie viel davon sind die Gebuehren? Ausgerechnet, nicht behauptet.
     * Dieselben Formeln ohne Gebuehrensatz, dann vergleichen. */
    var ohne = renditeOhneGebuehren(f);
    var schuld;
    if (ohne === null) schuld = null;
    else if (ohne > 0.005) {
      schuld = 'Ohne Gebühren wären es +' + ohne.toFixed(2) + ' % — die Gebühren allein ' +
               'machen aus einem Gewinn einen Verlust.';
    } else if (ohne > -0.005) {
      /* Genau null ist kein Gewinn. Beide Buecher stehen exakt gleich, und
       * dann kostet jede Gebuehr unmittelbar Geld. */
      schuld = 'Ohne Gebühren stünde es genau bei null — beide Bücher sind sich einig. ' +
               'Was die Gebühren kosten, ist damit direkt der Verlust.';
    } else {
      schuld = 'Auch ohne Gebühren wären es ' + ohne.toFixed(2) + ' % — hier liegen die ' +
               'beiden Bücher schlicht zu nah beieinander.';
    }

    return '<div class="urteil"><b>Lohnt sich nicht: ' + r.toFixed(2) + ' %.</b> ' +
      'Beide Seiten zusammen kosten ' + (inv * 100).toFixed(2) + ' % dessen, was sie zurückzahlen — ' +
      'also mehr als sie einbringen. Gebühren: ' +
      pmG + ' % bei Polymarket, ' + ggG + ' % beim Gegenbuch. ' +
      (schuld || '') + '</div>';
  }

  /* Was bliebe ohne jede Gebühr? Nur so laesst sich sagen, ob die Gebuehren
   * schuld sind oder ob die beiden Buecher einfach gleich teuer stehen. */
  function renditeOhneGebuehren(f) {
    var p = Number(f.pm_preis), q = Number(f.bf_quote);
    if (!(p > 0 && p < 1)) return null;
    var qe1 = 1 / p;
    var qe2;
    if (f.buch === 'kalshi') {
      if (!(q > 0 && q < 1)) return null;
      qe2 = 1 / q;                       // Kalshi rechnet in Preisen, nicht in Quoten
    } else if (f.bf_seite === 'Lay') {
      if (!(q > 1)) return null;
      qe2 = 1 + 1 / (q - 1);
    } else {
      if (!(q > 1)) return null;
      qe2 = q;
    }
    var inv = 1 / qe1 + 1 / qe2;
    if (!(inv > 0)) return null;
    return (1 / inv - 1) * 100;
  }

  function analyse(f, imVerlauf) {
    var gewinn = Number(f.auszahlung) - 100;
    return '<div class="analyse">' +
      '<span><b>' + Number(f.rendite).toFixed(2) + ' %</b> Rendite</span>' +
      menge(f) +
      pufferText(f) +
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
        '<div class="kopfzeile">' +
          '<div class="titel">' + txt(f.titel) + '</div>' +
          /* Uhrzeit oben rechts: WANN dieser Eintrag entstanden ist.
           * Nicht die letzte Sichtung, sondern die erste — das ist die Frage
           * "seit wann gibt es das", nicht "wann habe ich zuletzt hingesehen". */
          '<div class="stempel" title="Zuerst gesehen am ' + txt(zeitpunkt(f.zuerst_gesehen)) + '">' +
            uhrzeit(f.zuerst_gesehen) +
            (imVerlauf ? '<span class="stempel-zwei">beendet ' + uhrzeit(f.vorbei_seit) + '</span>'
                       : '<span class="stempel-zwei">vor ' + seit(f.zuerst_gesehen) + '</span>') +
          '</div>' +
        '</div>' +
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
            '<div class="leise">Anteilspreis &middot; Effektivquote <b>' + qeEins(f) + '</b></div>' +
          '</div>' +
          '<div class="seite bf">' +
            '<div class="quelle">' + (f.buch === 'kalshi' ? 'Kalshi' : 'Betfair') + '</div>' +
            '<div class="zahl">' + txt(f.bf_seite) + ' ' + Number(f.bf_quote).toFixed(f.buch === 'kalshi' ? 3 : 2) + '</div>' +
            '<div class="leise">' + txt(f.bf_name) + '</div>' +
            '<div class="leise">' + (f.buch === 'kalshi' ? 'Kontraktpreis' : 'Quote') +
              ' &middot; Effektivquote <b>' + qeZwei(f) + '</b></div>' +
          '</div>' +
        '</div>' +
        renditeText(f) +
        gegenprobe(f) +
        pruefzeile(f) +
        analyse(f, imVerlauf) +
        '<div class="unter leise">Bei 100 Einsatz: ' + Number(f.einsatz_1).toFixed(2) + ' auf Polymarket, ' +
          Number(f.einsatz_2).toFixed(2) + ' aufs Gegenbuch &middot; Kehrwertsumme ' + Number(f.inv).toFixed(4) +
          ' &middot; Partie dort: ' + txt(f.bf_partie) + '</div>' +
        aktionen(f) +
      '</div>';
  }

  /* ---------- Anbietertafel ----------
   *
   * Ganz oben, damit man auf einen Blick sieht: wer liefert, wie frisch,
   * wie viel, wie schnell, und ob etwas getrennt ist.
   *
   * Ein Punkt ist gruen, gelb oder rot — und daneben steht IMMER die Zahl,
   * auf der das Urteil beruht. Eine Ampel ohne Messwert ist eine Meinung.
   */
  function ampel(zustand) {
    return '<span class="punkt ' + zustand + '"></span>';
  }

  function anbieterZeile(name, zustand, aktualitaet, umfang, funde, tempo, hinweis) {
    return '<tr>' +
      '<td class="an-name">' + ampel(zustand) + ' ' + txt(name) + '</td>' +
      '<td class="an-zahl">' + aktualitaet + '</td>' +
      '<td class="an-text">' + umfang + '</td>' +
      '<td class="an-zahl">' + funde + '</td>' +
      '<td class="an-text">' + tempo + '</td>' +
      '<td class="an-hinweis">' + (hinweis || '') + '</td>' +
      '</tr>';
  }

  function anbieterTafel(e) {
    var K = welt.KONFIG;
    var u = e.uebersicht;
    if (!u) return '';

    if (u.fehler) {
      return '<div class="warnung"><b>Supabase nicht erreichbar.</b> ' + txt(u.fehler) +
             ' &middot; Versuch dauerte ' + u.antwort_ms + ' ms. ' +
             'Alle Zahlen auf dieser Seite sind damit alt.</div>';
    }

    var f = u.funde || {};
    var pm = u.polymarket || {}, ka = u.kalshi || {}, bf = u.betfair || {};
    var kst = ka.stats || {};
    var zeilen = '';

    /* Polymarket: liefert der Scanner ueberhaupt noch? Seine Frische IST die
     * Frische von Polymarket, denn er holt es bei jedem Lauf neu. */
    var pmAlt = Number(pm.alter_s);
    zeilen += anbieterZeile('Polymarket',
      isFinite(pmAlt) && pmAlt < K.laufMaxAlterS ? 'gruen' : 'rot',
      dauer(pm.alter_s),
      (pm.maerkte == null ? '?' : pm.maerkte) + ' Märkte im Fenster',
      (f.betfair ? f.betfair.live : 0) + (f.kalshi ? f.kalshi.live : 0),
      pm.dauer_ms == null ? '?' : (pm.dauer_ms / 1000).toFixed(1) + ' s je Lauf',
      'öffentlich, kein Konto');

    var kaAlt = Number(ka.alter_s);
    zeilen += anbieterZeile('Kalshi',
      isFinite(kaAlt) && kaAlt < K.kalshiMaxAlterS ? 'gruen' : 'rot',
      dauer(ka.alter_s),
      (kst.maerkte == null ? '?' : kst.maerkte) + ' Märkte aus ' +
        (kst.serien_mit_inhalt == null ? '?' : kst.serien_mit_inhalt) + ' von ' +
        (kst.serien_geprueft == null ? '?' : kst.serien_geprueft) + ' Serien',
      f.kalshi ? f.kalshi.live : 0,
      kst.dauer_ms == null ? '?' : Math.round(kst.dauer_ms / 1000) + ' s je Durchlauf',
      'öffentlich, kein Konto');

    var bfAlt = Number(bf.alter_s);
    var bfZustand = !isFinite(bfAlt) ? 'rot' : (bfAlt < K.bridgeMaxAlterS ? 'gruen' : 'rot');
    zeilen += anbieterZeile('Betfair über Bridge',
      bfZustand,
      dauer(bf.alter_s),
      (bf.im_fenster == null ? '?' : bf.im_fenster) + ' im Fenster, ' +
        (bf.hochgeladen == null ? '?' : bf.hochgeladen) + ' von ' +
        (bf.katalog == null ? '?' : bf.katalog) + ' hochgeladen',
      f.betfair ? f.betfair.live : 0,
      'Build ' + (bf.build == null ? '?' : bf.build),
      bfZustand === 'rot' ? 'Bridge steht — Heim-PC' : 'läuft auf dem Heim-PC');

    /* Supabase selbst: die Antwortzeit dieser einen Abfrage ist das
     * ehrlichste Mass. Wenn sie kommt, ist die Verbindung da. */
    zeilen += anbieterZeile('Supabase',
      u.antwort_ms < 1500 ? 'gruen' : 'gelb',
      u.antwort_ms + ' ms',
      (u.takte || []).filter(function (t) { return t.aktiv; }).length + ' von ' +
        (u.takte || []).length + ' Takten aktiv',
      (f.betfair ? f.betfair.verlauf : 0) + (f.kalshi ? f.kalshi.verlauf : 0),
      'Antwortzeit gerade eben',
      'verbunden');

    var w = u.wache || {};
    var takteAus = (u.takte || []).filter(function (t) { return !t.aktiv; });

    return '<div class="tafel">' +
      '<table>' +
        '<thead><tr><th>Anbieter</th><th>Aktualität</th><th>Umfang</th>' +
        '<th>Funde live</th><th>Tempo</th><th></th></tr></thead>' +
        '<tbody>' + zeilen + '</tbody>' +
      '</table>' +
      '<div class="tafel-fuss">' +
        'Nachtwache ' + (w.alles_gut ? 'meldet alles in Ordnung' : '<b class="rot">hat etwas beanstandet</b>') +
        ', zuletzt vor ' + dauer(w.alter_s) +
        (w.eingriff ? ' &middot; eingegriffen: ' + txt(w.eingriff) : '') +
        (takteAus.length ? ' &middot; <b class="rot">' + takteAus.length + ' Takt(e) abgeschaltet</b>' : '') +
      '</div>' +
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
      { name: 'Bridge · Heim-PC', wert: dauer(s.bf_alter_s), farbe: bridgeLaeuft ? 'var(--gruen)' : 'var(--rot)' },
      { name: 'Nachtwache', wert: s.wache_alter_s === null ? 'nie' : dauer(s.wache_alter_s),
        farbe: (s.wache_gut === true && s.wache_alter_s !== null && s.wache_alter_s < 1800)
          ? 'var(--gruen)' : 'var(--rot)' }
    ].map(function (k) {
      return '<div class="kachel"><div class="wert" style="color:' + (k.farbe || 'var(--text)') + '">' +
             txt(k.wert) + '</div><div class="name">' + txt(k.name) + '</div></div>';
    }).join('');
  }

  /* Welcher Bereich gerade offen ist. Bleibt ueber das Auffrischen hinweg
   * stehen: bei zwei Sekunden Takt waere ein Zuruecksetzen unbenutzbar. */
  var offenerBereich = 'chancen';
  try {
    var gemerkt = localStorage.getItem('orion-bereich');
    if (gemerkt === 'chancen' || gemerkt === 'knapp' || gemerkt === 'verlauf') offenerBereich = gemerkt;
  } catch (e) { /* Speicher gesperrt, dann eben der Standard */ }

  function bereichZeigen(name) {
    offenerBereich = name;
    try { localStorage.setItem('orion-bereich', name); } catch (e) {}
    ['chancen', 'knapp', 'verlauf'].forEach(function (b) {
      var el = document.getElementById(b);
      if (el) el.style.display = (b === name) ? '' : 'none';
    });
    var knoepfe = document.querySelectorAll('.reiter-knopf');
    for (var i = 0; i < knoepfe.length; i++) {
      knoepfe[i].classList.toggle('offen', knoepfe[i].getAttribute('data-bereich') === name);
    }
  }

  function reiterZeichnen(e) {
    var beschriftung = {
      chancen: 'Chancen (' + e.chancen.length + ')' +
               (e.veraltetHoch && e.veraltetHoch.length ? ' + ' + e.veraltetHoch.length + ' veraltet' : ''),
      knapp: 'Knappste Paare (' + e.knapp.length + ')',
      verlauf: 'Verlauf (' + e.verlauf.length + ')'
    };
    var knoepfe = document.querySelectorAll('.reiter-knopf');
    for (var i = 0; i < knoepfe.length; i++) {
      var b = knoepfe[i].getAttribute('data-bereich');
      /* Nur schreiben, wenn sich der Text wirklich geaendert hat: der Knopf
       * kann gerade unter der Maus liegen (Fehlerklasse 6). */
      if (knoepfe[i].textContent !== beschriftung[b]) knoepfe[i].textContent = beschriftung[b];
    }
    bereichZeigen(offenerBereich);
  }

  document.addEventListener('click', function (ev) {
    var k = ev.target && ev.target.closest ? ev.target.closest('.reiter-knopf') : null;
    if (!k) return;
    bereichZeigen(k.getAttribute('data-bereich'));
  });

  function zeichne(e) {
    var K = welt.KONFIG;
    var s = e.statistik;

    setzeWennAnders(document.getElementById('tafel'), anbieterTafel(e));
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
    /* Die Nachtwache prueft die MASCHINE, nicht die Funde. Wenn sie selbst
     * stehenbleibt, merkt niemand mehr einen Stillstand — deshalb wird auch
     * ihr eigenes Alter angezeigt. */
    if (s.wache_alter_s === null) {
      warn += '<div class="warnung"><b>Die Nachtwache hat noch nie gelaufen.</b> ' +
              'Sie sollte alle 10 Minuten nachsehen.</div>';
    } else if (s.wache_alter_s > 1800) {
      warn += '<div class="warnung"><b>Die Nachtwache meldet sich seit ' + dauer(s.wache_alter_s) + ' nicht.</b> ' +
              'Dann ist auch ihren Angaben nicht mehr zu trauen.</div>';
    } else if (s.wache_gut === false) {
      warn += '<div class="warnung"><b>Die Nachtwache hat etwas beanstandet.</b>' +
              (s.wache_eingriff ? ' Eingegriffen: ' + txt(s.wache_eingriff) : '') + '</div>';
    }
    setzeWennAnders(document.getElementById('warnungen'), warn);

    /* Drei getrennte Bereiche statt einer langen Rolle. Der Verlauf stand
     * vorher unter 187 knappen Paaren und war damit unauffindbar. */
    var chancenHtml = '';
    if (e.chancen.length) {
      chancenHtml = e.chancen.map(function (f) { return karte(f, false); }).join('');
    } else {
      chancenHtml = '<div class="warnung">Gerade keine handelbare Chance über ' +
        K.mindestRendite.toFixed(2) + ' %. Das ist der Normalfall: zwei Börsen mit vielen ' +
        'Teilnehmern liegen selten weit auseinander. Unter <b>Knappste Paare</b> siehst du, ' +
        'wie nah es dran ist.</div>';
    }

    /* Funde ueber der Schwelle auf VERALTETEN Kursen. Die gehoeren weder zu
     * den Chancen noch zu den knappen Paaren. Vorher landeten sie unter
     * "Knappste Paare" und standen dort mit +16 % zwischen lauter
     * Minuswerten, ohne dass irgendwo stand warum. */
    if (e.veraltetHoch && e.veraltetHoch.length) {
      chancenHtml = '<div class="warnung"><b>' + e.veraltetHoch.length +
        (e.veraltetHoch.length === 1 ? ' Fund liegt' : ' Funde liegen') +
        ' über der Schwelle, aber auf veralteten Kursen.</b> ' +
        'Nicht handelbar: die Gegenquote ist Stunden alt, in Wirklichkeit steht dort längst ' +
        'ein anderer Kurs. Je höher die Rendite auf alten Daten, desto wahrscheinlicher ' +
        'ist sie nur der Beweis, dass die Zahl alt ist.</div>' +
        e.veraltetHoch.map(function (f) { return karte(f, false); }).join('') +
        (e.chancen.length ? '<h2>Handelbar</h2>' : '') +
        chancenHtml;
    }
    setzeWennAnders(document.getElementById('chancen'), chancenHtml);

    var knappHtml = '';
    if (e.knapp.length) {
      knappHtml = '<p class="leise">Knapp daneben: richtig zugeordnet, nachgerechnet, aber unter ' +
        K.mindestRendite.toFixed(2) + ' % Rendite. Die Kehrwertsumme sagt alles: ' +
        '<b>unter 1</b> heißt Gewinn unabhängig vom Ausgang, <b>über 1</b> heißt Verlust. ' +
        'Alle ' + e.knapp.length + ', beste zuerst. Alles unter ' + K.rauschGrenze.toFixed(1) +
        ' % wird nicht mehr gezeigt und auch nicht mehr aufbewahrt' +
        (s.rauschen ? ' — gerade ' + s.rauschen + ' Zeilen' : '') + '.</p>' +
        e.knapp.map(function (f) { return karte(f, false); }).join('');
    } else {
      knappHtml = '<p class="leise">Keine Paare. Entweder liegen gerade keine gemeinsamen ' +
        'Partien an, oder eine Quelle ist stehengeblieben.</p>';
    }
    setzeWennAnders(document.getElementById('knapp'), knappHtml);

    var verlaufHtml = '<p class="leise"><b>Nur Funde, die im Plus waren.</b> Was nie eine Rendite über ' +
      K.verlaufMinRendite.toFixed(0) + ' % erreicht hat, wird gelöscht statt aufbewahrt. ' +
      'Ein Fund landet hier, wenn er nicht mehr gefunden wird, wenn seine Partie vorbei ist, ' +
      'oder wenn er eine Stunde lang nicht mehr bestätigt wurde. Sortiert nach Beendigung, ' +
      'mit der besten je gesehenen Rendite.</p>';
    if (!e.verlauf.length) {
      verlaufHtml += '<p class="leise">Noch nichts im Plus beendet.</p>';
    } else {
      verlaufHtml += e.verlauf.map(function (f) { return karte(f, true); }).join('');
    }
    setzeWennAnders(document.getElementById('verlauf'), verlaufHtml);

    reiterZeichnen(e);
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
