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

  /* ---------- Wer ist Seite 1, wer Seite 2? ----------
   *
   * Bis zum 10.8.2026 war Seite 1 IMMER Polymarket, deshalb stand das Wort
   * hier ueberall fest im Text. Seit dem Umbau auf "jedes Buch gegen jedes"
   * kann dort auch Betfair oder Smarkets stehen — eine Zeile
   * smarkets → polymarket mit der Aufschrift "Polymarket" auf der
   * Smarkets-Seite waere schlicht falsch beschriftet.
   *
   * Alle Angaben kommen aus KONFIG.buecher, damit ein viertes Buch nur dort
   * eingetragen werden muss. */
  var UNBEKANNT = { name: 'unbekanntes Buch', kurz: '??', chip: '', art: 'quote', konto: '' };

  function buchInfo(name) {
    var k = welt.KONFIG || {};
    return (k.buecher && k.buecher[name]) || UNBEKANNT;
  }
  function buch1(f) { return buchInfo(f.buch_1 || 'polymarket'); }
  function buch2(f) { return buchInfo(f.buch || 'betfair'); }

  /* Preis oder Quote? Ein Anteilspreis hat drei Nachkommastellen und liegt
   * unter 1, eine Dezimalquote hat zwei und liegt darueber. Beides gleich
   * zu formatieren macht die Karte unlesbar. */
  function wertText(info, wert) {
    var n = Number(wert);
    if (!isFinite(n)) return '—';
    return info.art === 'preis' ? n.toFixed(3) : n.toFixed(2);
  }
  function wertName(info) {
    return info.art === 'preis' ? 'Anteilspreis' : 'Quote';
  }

  /* Beide Links sind Pflicht (Uebergabe 8, Punkt 3): jede Zeile, auch die
   * knappste, traegt beide und sie treffen denselben Markt. Fehlt einer,
   * wird das gesagt statt still einen toten Knopf anzuzeigen. */
  function linkKnopf(url, info) {
    /* Betfair ist aus Oesterreich gesperrt, deshalb der Umweg ueber Orbit.
     * Alle anderen Buecher werden direkt geoeffnet. */
    var beschriftung = info.ueberBroker ? (info.name + ' über Orbit') : (info.name + ' öffnen');
    if (!url) {
      return '<span class="knopf gesperrt" title="Kein ' + txt(info.name) +
             '-Link im Fund">' + txt(info.name) + ' fehlt</span>';
    }
    return '<a class="knopf" target="_blank" rel="noopener" href="' + txt(url) + '">' +
             txt(beschriftung) + '</a>' +
           '<button class="knopf kopieren" data-link="' + txt(url) +
             '" title="' + txt(info.name) + '-Link kopieren">Link kopieren</button>';
  }

  function aktionen(f) {
    return '<div class="aktionen">' +
             linkKnopf(f.pm_link, buch1(f)) +
             linkKnopf(f.bf_link, buch2(f)) +
           '</div>';
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
  /* Effektivquote EINER Seite, nach Gebuehr. Welche Formel gilt, haengt am
   * Buch und an der Seite — nicht mehr an der Annahme, Seite 1 sei
   * Polymarket:
   *   Polymarket   Gebuehr = s * min(p, 1-p)
   *   Kalshi       Gebuehr = s * p * (1-p)
   *   Boerse Back  qE = 1 + (q-1) * (1-s)
   *   Boerse Lay   qE = 1 + (1-s) / (q-1) */
  function qeSeiteWert(buchName, info, wert, satz, seiteText) {
    var x = Number(wert), s = Number(satz);
    if (!isFinite(x) || !isFinite(s)) return null;
    if (info.art === 'preis') {
      if (!(x > 0 && x < 1)) return null;
      var g = buchName === 'kalshi' ? s * x * (1 - x) : s * Math.min(x, 1 - x);
      var qe = (1 - g) / x;
      return qe > 1 ? qe : null;
    }
    if (!(x > 1)) return null;
    return String(seiteText || '').toLowerCase() === 'lay'
      ? 1 + (1 - s) / (x - 1)
      : 1 + (x - 1) * (1 - s);
  }
  function qeEinsWert(f) {
    return qeSeiteWert(f.buch_1 || 'polymarket', buch1(f), f.pm_preis, f.pm_gebuehr, f.pm_seite);
  }
  function qeZweiWert(f) {
    return qeSeiteWert(f.buch || 'betfair', buch2(f), f.bf_quote, f.bf_gebuehr, f.bf_seite);
  }
  function qeEins(f) { var x = qeEinsWert(f); return x === null ? '?' : x.toFixed(3); }
  function qeZwei(f) { var x = qeZweiWert(f); return x === null ? '?' : x.toFixed(3); }

  /* ---------- Puffer ----------
   *
   * Wie weit darf sich ein Kurs bewegen, bevor die Arbitrage kippt? Bei
   * 0,3 % Rendite reicht ein Tick, bei 3 % hat man Luft. Ohne diese Zahl
   * sieht eine knappe Chance genauso aus wie eine belastbare.
   *
   * Gerechnet wird auf SEITE 1: wie weit darf ihr Kurs sich bewegen, bis die
   * Kehrwertsumme 1 erreicht? Das ist die Seite, die man zuerst kauft.
   *
   * In welche RICHTUNG das schlechter wird, haengt vom Buch ab und darf
   * nicht geraten werden:
   *   Anteilspreis  teurer = schlechter  -> er darf STEIGEN
   *   Back-Quote    kleiner = schlechter -> sie darf FALLEN
   *   Lay-Quote     groesser = schlechter (mehr Haftung) -> sie darf STEIGEN
   */
  function puffer(f) {
    var qe2 = qeZweiWert(f);
    var s = Number(f.pm_gebuehr);
    var x = Number(f.pm_preis);
    var info = buch1(f);
    if (qe2 === null || !isFinite(s) || !isFinite(x)) return null;

    var rest = 1 - 1 / qe2;                 // so viel Kehrwert darf Seite 1 hoechstens haben
    if (!(rest > 0)) return null;
    var qeNoetig = 1 / rest;                // ... also mindestens diese Effektivquote

    var grenze, richtung;
    if (info.art === 'preis') {
      if (!(x > 0 && x < 1)) return null;
      /* qe = (1 - s*min(p,1-p))/p. Unterhalb 0,5 ist min(p,1-p) = p, also
       * qe = 1/p - s  ->  p = 1/(qe+s). */
      grenze = 1 / (qeNoetig + s);
      richtung = 'steigen';
    } else if (String(f.pm_seite || '').toLowerCase() === 'lay') {
      if (!(x > 1)) return null;
      /* qe = 1 + (1-s)/(q-1)  ->  q = 1 + (1-s)/(qe-1) */
      if (!(qeNoetig > 1)) return null;
      grenze = 1 + (1 - s) / (qeNoetig - 1);
      richtung = 'steigen';
    } else {
      if (!(x > 1)) return null;
      /* qe = 1 + (q-1)(1-s)  ->  q = 1 + (qe-1)/(1-s) */
      if (!(1 - s > 0)) return null;
      grenze = 1 + (qeNoetig - 1) / (1 - s);
      richtung = 'fallen';
    }
    if (!(grenze > 0)) return null;

    /* Puffer ist immer der Abstand IN DIE ERLAUBTE RICHTUNG. */
    var prozent = richtung === 'steigen' ? (grenze - x) / x * 100 : (x - grenze) / x * 100;
    return { grenze: grenze, prozent: prozent, richtung: richtung, art: info.art, name: info.name };
  }

  function pufferText(f) {
    var pu = puffer(f);
    if (!pu) return '<span>Puffer unbekannt</span>';
    var stellen = pu.art === 'preis' ? 3 : 2;
    var gegen = pu.richtung === 'steigen' ? 'fallen' : 'steigen';
    if (pu.prozent <= 0) {
      return '<span>kein Puffer &mdash; ' + txt(pu.name) + ' müsste um ' +
             Math.abs(pu.prozent).toFixed(1) + ' % <b>' + gegen + '</b>, damit es aufgeht</span>';
    }
    return '<span>Puffer: ' + txt(pu.name) + ' darf bis <b>' + pu.grenze.toFixed(stellen) + '</b> ' +
           pu.richtung + ' (' + pu.prozent.toFixed(1) + ' %), dann ist es aufgebraucht</span>';
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
  /* Zahlt diese Seite, wenn das Ereignis EINTRITT?
   *
   * Gilt fuer JEDES Buch und JEDE Seite, denn seit dem Umbau kann auf Seite 1
   * auch "Back" oder "Lay" stehen und nicht nur "JA"/"NEIN":
   *   zahlt beim Eintreten   JA · ÜBER · Ja · Back
   *   zahlt beim Ausbleiben  NEIN · UNTER · Nein · Lay
   * Alles andere ergibt null — und null heisst "unbekannt", nicht "nein".
   * Eine Seite, die man nicht einordnen kann, darf nicht als gedeckt gelten. */
  function zahltBeiEintritt(seiteText) {
    var s = String(seiteText || '').trim().toUpperCase();
    if (s === 'JA' || s === 'ÜBER' || s === 'UBER' || s === 'BACK') return true;
    if (s === 'NEIN' || s === 'UNTER' || s === 'LAY') return false;
    return null;
  }

  function ausgaenge(f) {
    var name = f.mannschaft || 'diese Seite';
    var einsZahltWenn = zahltBeiEintritt(f.pm_seite);
    var zweiZahltWenn = zahltBeiEintritt(f.bf_seite);

    return { name: name, pm: einsZahltWenn, gegen: zweiZahltWenn,
             gedeckt: einsZahltWenn !== null && zweiZahltWenn !== null && einsZahltWenn !== zweiZahltWenn };
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

    var wennEin = a.pm ? buch1(f).name : buch2(f).name;
    var wennAus = a.pm ? buch2(f).name : buch1(f).name;

    return '<div class="gegenprobe">' +
      '<div class="gp-zeile"><span class="gp-fall">Wenn <b>' + txt(a.name) + '</b> eintritt</span>' +
        '<span class="gp-wer">' + wennEin + ' zahlt</span>' +
        '<span class="gp-zahl">' + aus.toFixed(2) + '</span></div>' +
      '<div class="gp-zeile"><span class="gp-fall">Wenn <b>' + txt(a.name) + '</b> NICHT eintritt</span>' +
        '<span class="gp-wer">' + wennAus + ' zahlt</span>' +
        '<span class="gp-zahl">' + aus.toFixed(2) + '</span></div>' +
      '<div class="gp-fuss">Beide Ausgänge zahlen <b>denselben</b> Betrag — genau dafür ist die ' +
        'Aufteilung <b>' + (100 * e1 / gesamt).toFixed(1) + ' % ' + txt(buch1(f).name) + ' / ' +
        (100 * e2 / gesamt).toFixed(1) + ' % ' + txt(buch2(f).name) + '</b> und nicht 50/50.</div>' +
      '</div>';
  }

  /* ---------- Was passiert, wenn WEDER noch eintritt? ----------
   *
   * Spiel abgesagt, abgebrochen, Spieler tritt nicht an. Die Gegenprobe
   * darueber zeigt nur die zwei SPIELausgaenge — aber es gibt einen dritten
   * Fall, und der ist der gefaehrlichste, weil er in keiner Rendite steht.
   *
   * Gibt ein Buch den Einsatz zurueck und das andere wertet, ist aus der
   * abgesicherten Wette eine offene geworden. Beispiel gerechnet auf
   * regelwerk.html: Einsatz 100, zurueck 90.
   *
   * Deshalb steht auf JEDER Karte, was jedes der beiden Buecher tut — und
   * ob das belegt ist oder nur im einzelnen Markt steht. */
  function absageZeile(f) {
    var b1 = buch1(f), b2 = buch2(f);
    if (!b1.absage && !b2.absage) return '';

    function eine(info) {
      var sicher = info.absage_sicher === true;
      return '<div class="gp-zeile">' +
        '<span class="gp-fall"><b>' + txt(info.name) + '</b></span>' +
        '<span class="gp-wer">' + txt(info.absage || 'unbekannt') + '</span>' +
        '<span class="gp-zahl">' +
          (sicher ? '<span class="chip gut">belegt</span>'
                  : '<span class="chip acht">je Markt prüfen</span>') +
        '</span></div>';
    }

    /* Ein Buch zahlt zurueck, das andere nicht: genau dann kippt die
     * Absicherung. Das wird ausdruecklich gesagt, nicht nur angedeutet. */
    var beideBelegt = b1.absage_sicher === true && b2.absage_sicher === true;
    var warnung = beideBelegt ? '' :
      '<div class="gp-fuss"><b>Vor dem Handeln beide Marktregeln lesen.</b> ' +
      'Wenn eine Seite annulliert und die andere wertet, ist die Absicherung weg — ' +
      'dann hängt das Ergebnis an einem Ereignis, das gar kein Spielausgang ist. ' +
      '<a href="regelwerk.html" target="_blank" rel="noopener">Regelwerk der Bücher</a></div>';

    return '<div class="gegenprobe absage">' +
      '<div class="gp-fuss" style="margin:0 0 6px">Wenn <b>weder noch</b> eintritt ' +
        '(Absage, Abbruch, Spieler tritt nicht an):</div>' +
      eine(b1) + eine(b2) + warnung +
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
      pmG + ' % bei ' + buch1(f).name + ', ' + ggG + ' % bei ' + buch2(f).name + '. ' +
      (schuld || '') + '</div>';
  }

  /* Was bliebe ohne jede Gebühr? Nur so laesst sich sagen, ob die Gebuehren
   * schuld sind oder ob die beiden Buecher einfach gleich teuer stehen.
   *
   * Welche Formel gilt, haengt am BUCH und an der SEITE, nicht mehr an der
   * Annahme "Seite 1 ist Polymarket":
   *   preis  Anteil zwischen 0 und 1        qE = 1/p
   *   quote  Back                           qE = q
   *   quote  Lay (dagegenhalten)            qE = 1 + 1/(q-1) */
  function qeOhneGebuehr(info, wert, seiteText) {
    var x = Number(wert);
    if (info.art === 'preis') {
      if (!(x > 0 && x < 1)) return null;
      return 1 / x;
    }
    if (!(x > 1)) return null;
    return String(seiteText || '').toLowerCase() === 'lay' ? 1 + 1 / (x - 1) : x;
  }

  function renditeOhneGebuehren(f) {
    var qe1 = qeOhneGebuehr(buch1(f), f.pm_preis, f.pm_seite);
    var qe2 = qeOhneGebuehr(buch2(f), f.bf_quote, f.bf_seite);
    if (qe1 === null || qe2 === null) return null;
    var inv = 1 / qe1 + 1 / qe2;
    if (!(inv > 0)) return null;
    return (1 / inv - 1) * 100;
  }

  /* ---------- Was die Gebühren KOSTEN ----------
   *
   * Bis zum 10.8.2026 war der Gebührensatz sichtbar, der Betrag nie. Wer
   * "+0,71 %" las, sah nicht, dass davon vorher 2 % Kommission abgezogen
   * wurden und wie viel das in Geld ist. Jedes Buch nimmt anders:
   *
   *     Polymarket   je Anteil, preisabhängig, am höchsten bei p ≈ 0,50
   *     Kalshi       je Kontrakt, preisabhängig
   *     Smarkets     Kommission auf den Nettogewinn je Markt
   *
   * Deshalb steht die Gebühr jetzt auf JEDER Karte: je Buch der Satz, der
   * Betrag, und ob der Satz gemessen oder nur übernommen ist. Dazu die
   * Hochrechnung auf den handelbaren Einsatz — das ist die Zahl, die man
   * tatsächlich zahlt, nicht die auf den Musterlauf über 100.
   *
   * Vorrang haben die Werte, die der Scanner ausgerechnet und gespeichert
   * hat. Für Zeilen von vor der Umstellung steht dort null; die werden hier
   * nachgerechnet, aus denselben Formeln. */
  function gebuehrForm(info, buchName, seiteText) {
    if (info.art === 'preis') return buchName === 'kalshi' ? 'kontrakt' : 'anteil';
    return String(seiteText || '').toLowerCase() === 'lay' ? 'lay' : 'back';
  }

  /* Betrag einer Seite. gespeichert hat Vorrang, sonst wird gerechnet.
   * null heisst "nicht ausrechenbar" — nicht null Euro. */
  function gebuehrBetragSeite(f, welcheSeite) {
    var gespeichert = welcheSeite === 1 ? f.pm_gebuehr_betrag : f.bf_gebuehr_betrag;
    if (gespeichert !== null && gespeichert !== undefined && isFinite(Number(gespeichert))) {
      return Number(gespeichert);
    }
    if (!welt.Rechnung || !welt.Rechnung.gebuehrBetrag) return null;
    var info    = welcheSeite === 1 ? buch1(f) : buch2(f);
    var name    = welcheSeite === 1 ? (f.buch_1 || 'polymarket') : (f.buch || 'betfair');
    var roh     = welcheSeite === 1 ? f.pm_preis : f.bf_quote;
    var seite   = welcheSeite === 1 ? f.pm_seite : f.bf_seite;
    var einsatz = Number(welcheSeite === 1 ? f.einsatz_1 : f.einsatz_2);
    var qe      = welcheSeite === 1 ? qeEinsWert(f) : qeZweiWert(f);
    if (qe === null || !isFinite(einsatz)) return null;
    return welt.Rechnung.gebuehrBetrag(gebuehrForm(info, name, seite), einsatz, Number(roh), qe);
  }

  function gebuehrZeile(f) {
    var b1 = buch1(f), b2 = buch2(f);
    var s1 = Number(f.pm_gebuehr), s2 = Number(f.bf_gebuehr);
    var g1 = gebuehrBetragSeite(f, 1), g2 = gebuehrBetragSeite(f, 2);

    /* Gemessen oder übernommen. Ein übernommener Satz ist kein Fehler, aber
     * er ist auch kein Messwert — und darf nicht so aussehen. */
    function herkunft(echt) {
      return echt === true
        ? '<span class="chip gut" title="Satz kommt vom Buch selbst mit.">gemessen</span>'
        : '<span class="chip acht" title="Satz ist der dokumentierte Standardtarif, nicht am Konto nachgemessen. Ein höherer Tarif macht dünne Funde zu Verlusten.">angenommen</span>';
    }

    /* Die Bezugsgroesse gehoert dazu, sonst ist der Satz nicht lesbar:
     * 2 % auf den Nettogewinn und 7 % je Kontrakt sind voellig verschiedene
     * Dinge. Kalshi handelt KONTRAKTE, Polymarket ANTEILE — das ist keine
     * Wortklauberei, es sind die Einheiten, in denen die Buecher rechnen. */
    function eine(info, satz, betrag, echt, seiteText, form, einsatz) {
      var art = form === 'kontrakt' ? 'je Kontrakt'
              : form === 'anteil'   ? 'je Anteil'
              : 'auf den Nettogewinn';

      /* WAS MAN TATSAECHLICH ZAHLT, in Prozent VOM EINSATZ.
       *
       * Der nackte Satz ist irrefuehrend: Kalshis "7 %" und Polymarkets
       * "5 %" stecken in VERSCHIEDENEN Formeln und sind nicht vergleichbar.
       * Gemessen an einer echten Zeile (Goias EC, 10.8.2026):
       *     Polymarket  Satz 5 %  bei Preis 0,16  ->  5,00 % vom Einsatz
       *     Kalshi      Satz 7 %  bei Preis 0,84  ->  1,12 % vom Einsatz
       * Die 7 % kosten also weniger als ein Viertel der 5 %. Deshalb steht
       * der effektive Satz vorn und der nackte dahinter. */
      var eff = (betrag !== null && isFinite(einsatz) && einsatz > 0)
        ? (betrag / einsatz * 100) : null;
      return '<div class="gp-zeile">' +
        '<span class="chip ' + txt(info.chip) + '">' + txt(info.name) + '</span> ' +
        '<b>' + (eff === null ? '?' : eff.toFixed(2) + ' %') + '</b> vom Einsatz' +
        ' &middot; <b>' + (betrag === null ? 'nicht ausrechenbar' : betrag.toFixed(3)) + '</b>' +
        (betrag === null ? '' : ' von ' + Number(einsatz).toFixed(2)) +
        ' <span class="leise" title="Der nackte Satz aus dem Tarif. Er steckt in einer Formel und ist zwischen Büchern NICHT vergleichbar — deshalb steht vorne, was tatsächlich anfällt.">(Tarif ' +
        (isFinite(satz) ? (satz * 100).toFixed(2) + ' %' : '?') + ' ' + art + ')</span> ' +
        herkunft(echt) +
      '</div>';
    }

    var summe = (g1 === null || g2 === null) ? null : g1 + g2;

    /* Was die Gebühren die Rendite kosten. Ohne diese Zahl bleibt der Betrag
     * eine Nebenbemerkung; mit ihr sieht man, ob die Gebühr der Grund ist,
     * dass sich etwas nicht lohnt. */
    var ohne = renditeOhneGebuehren(f);
    var r = Number(f.rendite);
    var kostet = (ohne === null || !isFinite(r)) ? null : ohne - r;

    /* Hochrechnung auf das, was wirklich hineinpasst. */
    var max = f.max_einsatz;
    var hoch = '';
    if (summe !== null && max !== null && max !== undefined && isFinite(Number(max)) && Number(max) > 0) {
      var faktor = Number(max) / 100;
      /* ACHTUNG bei der Beschriftung: `rendite` ist bereits NACH Gebühr.
       * Der Gewinn hier ist also das, was ÜBRIG BLEIBT — nicht der Ertrag,
       * von dem die Gebühr noch abginge. Wer das verwechselt, zieht die
       * Gebühr zweimal ab und hält gute Funde für schlechte. */
      var gewinnNach = Number(max) * r / 100;
      var gebuehrEcht = summe * faktor;
      hoch = '<div class="gp-fuss">Auf den handelbaren Einsatz von ' + Number(max).toFixed(2) +
             ' hochgerechnet: <b>' + gebuehrEcht.toFixed(3) + '</b> Gebühr &middot; ' +
             '<b>' + (gewinnNach >= 0 ? '+' : '') + gewinnNach.toFixed(3) + '</b> Gewinn, ' +
             'der davon übrig bleibt' +
             (gewinnNach > 0 && gebuehrEcht > gewinnNach
               ? ' — die Gebühr ist damit <b>größer als der Gewinn</b>.'
               : '.') +
             '</div>';
    } else if (summe !== null) {
      hoch = '<div class="gp-fuss">Wie viel Gebühr tatsächlich anfällt, hängt am Einsatz. ' +
             'Der ist hier <b>nicht bekannt</b> — die Menge im Orderbuch fehlt, ' +
             'deshalb wird nicht hochgerechnet.</div>';
    }

    return '<div class="gegenprobe">' +
      '<div class="gp-fuss" style="margin:0 0 6px">Was die <b>Gebühren</b> kosten — ' +
        'jedes Buch nimmt anders, und der Satz steckt bereits in beiden Effektivquoten:</div>' +
      eine(b1, s1, g1, f.pm_gebuehr_echt, f.pm_seite,
           gebuehrForm(b1, f.buch_1 || 'polymarket', f.pm_seite), Number(f.einsatz_1)) +
      eine(b2, s2, g2, f.bf_gebuehr_echt, f.bf_seite,
           gebuehrForm(b2, f.buch || 'betfair', f.bf_seite), Number(f.einsatz_2)) +
      '<div class="gp-zeile"><b>Zusammen ' +
        (summe === null ? 'nicht ausrechenbar' : summe.toFixed(3) + ' bei 100 Einsatz') + '</b>' +
        (kostet === null ? '' : ' &middot; sie kosten <b>' + kostet.toFixed(2) +
           ' Prozentpunkte</b> Rendite') +
      '</div>' + hoch +
    '</div>';
  }

  /* ---------- Smarkets: der Link zeigt auf die PARTIE, nicht auf den Markt
   *
   * Gemessen am 11.8.2026: alle 16 Maerkte einer Partie tragen bei Smarkets
   * denselben Link. Er fuehrt auf die Spielseite, und die zeigt IHREN
   * Standardmarkt - meist den Sieger. Bei Sieger-Wetten faellt das nicht
   * auf, bei den anderen acht Fragearten landet man systematisch falsch.
   *
   * Der saubere Fix waere ein Link auf den Markt. Die Markt-Slugs liefert
   * Smarkets (winner, over-under-0.5, both-teams-score), und die URL-Form
   * scheint "Punkt wird zu Bindestrich, Schraegstrich am Ende" zu sein
   * (over-under-0.5 -> /over-under-0-5/). NACHGEPRUEFT IST DAS NICHT:
   * smarkets.com antwortet auf JEDEN Pfad mit 200 und rendert erst im
   * Browser, und der Browser ist hier gesperrt. Ein falsch geratener Slug
   * fuehrt auf eine leere Seite - schlechter als die Spielseite.
   *
   * Bis das gemessen ist, steht hier der ehrliche Hinweis: WELCHER Markt
   * es ist. Das ist keine Vermutung, das steht in der Zeile. */
  function smarketsHinweis(f) {
    var b1 = f.buch_1 || 'polymarket', b2 = f.buch || 'betfair';
    if (b1 !== 'smarkets' && b2 !== 'smarkets') return '';
    var art = welt.Filter && welt.Filter.artVon ? welt.Filter.artVon(f) : 'sieger';
    if (art === 'sieger') return '';        // dort stimmt der Standardmarkt

    var name = { unentschieden: 'Full-time result (Unentschieden)',
                 hz_sieger: 'Half-time result',
                 hz_unentschieden: 'Half-time result (Unentschieden)',
                 btts: 'Both teams to score',
                 ueber_unter: 'Over/under',
                 hz1_ueber_unter: 'First half over/under',
                 hz2_ueber_unter: 'Second half over/under',
                 ecken_ueber_unter: 'Corners over/under' }[art] || art;
    var linie = String(f.mannschaft || '').match(/(\d+(?:\.\d+)?)\s*$/);

    return '<div class="gegenprobe absage">' +
      '<div class="gp-fuss" style="margin:0">' +
        '<b>Achtung beim Smarkets-Link:</b> er führt auf die <b>Partie</b>, ' +
        'nicht auf diesen Markt — Smarkets zeigt dort seinen Standardmarkt. ' +
        'Du musst dort selbst wechseln auf: <b>' + txt(name) +
        (linie ? ' ' + txt(linie[1]) : '') + '</b>.' +
      '</div>' +
    '</div>';
  }

  function analyse(f, imVerlauf) {
    var gewinn = Number(f.auszahlung) - 100;
    return '<div class="analyse">' +
      '<span><b>' + Number(f.rendite).toFixed(2) + ' %</b> Rendite</span>' +
      menge(f) +
      /* DIE ZAHL, DIE ZAEHLT. Eine Rendite ist ein Verhaeltnis, ausgezahlt
       * wird ein Betrag. "+1,03 %" und "3 Cent" sind beide wahr — aber nur
       * das zweite beantwortet die Frage, ob sich das lohnt. Deshalb steht
       * es hier neben der Rendite und nicht irgendwo weiter unten. */
      (f.echter_gewinn === null
        ? '<span class="acht" title="Im Orderbuch steht keine Menge. Unbekannt heisst nicht unbegrenzt — es heisst, dass niemand weiss, ob hier 3 Cent oder 300 Euro zu holen sind.">Gewinn <b>unbekannt</b> — keine Menge im Buch</span>'
        : '<span' + (f.echter_gewinn >= welt.KONFIG.mindestGewinn ? ' class="gut"' : ' class="acht"') +
          '><b>' + (f.echter_gewinn >= 0 ? '+' : '') + Number(f.echter_gewinn).toFixed(2) +
          '</b> tatsächlicher Gewinn' +
          (f.echter_gewinn < welt.KONFIG.mindestGewinn
            ? ' — unter ' + Number(welt.KONFIG.mindestGewinn).toFixed(2) + ', keine Chance'
            : '') + '</span>') +
      (f.max_einsatz === null || f.max_einsatz === undefined
        ? '<span class="acht">Liquidität nicht messbar</span>'
        : '<span>Liquidität: hier passen <b>' + Number(f.max_einsatz).toFixed(2) +
          '</b> hinein' +
          (Number(f.max_einsatz) < 100 ? ' — das ist die reale Tiefe des dünneren Buches, keine Skala' : '') +
          '</span>') +
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
      marke(f.pm_link_ok, buch1(f).name + '-Link lebt', buch1(f).name + '-Link tot', buch1(f).name + '-Link nicht pruefbar') +
      marke(f.gegen_link_ok, 'Gegenlink lebt', 'Gegenlink tot', 'Gegenlink nicht pruefbar') +
      '<span class="chip">geprueft vor ' + seit(f.geprueft_am) + '</span>' +
      (f.rechnung_ok === false && f.rechnung_grund ? ' <span class="chip rot">' + txt(f.rechnung_grund) + '</span>' : '') +
      '</div>';
  }

  function karte(f, imVerlauf) {
    /* Eine Chance ist eine Zeile, die GELD bringt — nicht eine mit guter
     * Prozentzahl. Dieselben drei Bedingungen wie in daten.js. */
    var K0 = welt.KONFIG;
    var chance = f.rendite >= K0.mindestRendite && !f.zu_duenn &&
                 f.echter_gewinn !== null && f.echter_gewinn >= K0.mindestGewinn;
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
          '<span class="chip ' + txt(buch1(f).chip) + '">' + txt(buch1(f).name) + '</span> ' +
          '<span class="chip leise">gegen</span> ' +
          '<span class="chip ' + txt(buch2(f).chip) + '">' + txt(buch2(f).name) +
            (buch2(f).konto ? ' · ' + txt(buch2(f).konto) : '') + '</span> ' +
          (f.veraltet ? '<span class="chip rot">Kurse veraltet</span> ' : '') +
          (f.zu_duenn ? '<span class="chip rot" title="Der beste Kurs im Orderbuch traegt fast kein Volumen. Rendite ohne Menge ist keine Chance.">zu dünn — max. ' +
             (f.max_einsatz == null ? '?' : Number(f.max_einsatz).toFixed(2)) + ' Einsatz</span> ' : '') +
          '<span class="chip">' + txt(f.sportart) + '</span> ' +
          '<span class="chip">' + (imVerlauf ? 'beendet vor ' + seit(f.vorbei_seit) : 'endet in ' + bis(f.endet_am)) + '</span> ' +
          '<span class="chip' + (Number(f.zuordnung) >= 0.99 ? ' gut' : ' acht') + '">Zuordnung ' + Number(f.zuordnung).toFixed(2) + '</span> ' +
          '<span class="chip' + (chance ? ' gut' : '') + '">Rendite ' + Number(f.rendite).toFixed(2) + ' %</span> ' +
          '<span class="chip">beste ' + Number(f.beste_rendite == null ? f.rendite : f.beste_rendite).toFixed(2) + ' %</span> ' +
          '<span class="chip">gesehen seit ' + seit(f.zuerst_gesehen) + '</span>' +
          (imVerlauf && f.vorbei_grund ? ' <span class="chip rot">' + txt(f.vorbei_grund) + '</span>' : '') +
        '</div>' +
        '<div class="seiten">' +
          '<div class="seite ' + txt(buch1(f).chip) + '">' +
            '<div class="quelle">' + txt(buch1(f).name) + '</div>' +
            '<div class="zahl">' + txt(f.pm_seite) + ' ' + wertText(buch1(f), f.pm_preis) + '</div>' +
            '<div class="leise">' + txt(f.mannschaft) + '</div>' +
            '<div class="leise">' + wertName(buch1(f)) + ' &middot; Effektivquote <b>' + qeEins(f) + '</b></div>' +
          '</div>' +
          '<div class="seite ' + txt(buch2(f).chip) + '">' +
            '<div class="quelle">' + txt(buch2(f).name) + '</div>' +
            '<div class="zahl">' + txt(f.bf_seite) + ' ' + wertText(buch2(f), f.bf_quote) + '</div>' +
            '<div class="leise">' + txt(f.bf_name) + '</div>' +
            '<div class="leise">' + wertName(buch2(f)) +
              ' &middot; Effektivquote <b>' + qeZwei(f) + '</b></div>' +
          '</div>' +
        '</div>' +
        renditeText(f) +
        smarketsHinweis(f) +
        gebuehrZeile(f) +
        gegenprobe(f) +
        absageZeile(f) +
        pruefzeile(f) +
        analyse(f, imVerlauf) +
        '<div class="unter leise">Bei 100 Einsatz: ' + Number(f.einsatz_1).toFixed(2) + ' auf ' +
          txt(buch1(f).name) + ', ' + Number(f.einsatz_2).toFixed(2) + ' auf ' + txt(buch2(f).name) +
          ' &middot; Kehrwertsumme ' + Number(f.inv).toFixed(4) +
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

  /* Welche BUCHPAARUNGEN laufen gerade?
   *
   * Eine Arbitrage besteht immer aus genau zwei Buechern. Bei vier Buechern
   * gibt es zwoelf gerichtete Paarungen — und es ist ein Unterschied, ob
   * gerade nur Polymarket gegen Betfair laeuft oder auch Kalshi gegen
   * Smarkets. Ohne diese Zeile sieht man nur die Summe und merkt nicht,
   * wenn eine ganze Paarung stillsteht. */
  function paarungenZeile(p) {
    if (!p) return '';
    var namen = Object.keys(p);
    if (!namen.length) return '';
    namen.sort(function (a, b) { return (p[b].live || 0) - (p[a].live || 0); });
    var teile = namen.map(function (n) {
      var x = p[n];
      var beste = x.beste == null ? null : Number(x.beste);
      return '<span class="chip' + (x.chancen > 0 ? ' gut' : '') + '">' + txt(n) +
             ' &middot; ' + x.live +
             (beste === null ? '' : ' &middot; beste ' + beste.toFixed(2) + ' %') + '</span>';
    });
    return '<div class="tafel-fuss">Laufende Paarungen (je genau zwei Bücher): ' +
           teile.join(' ') + '</div>';
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

    var sm = u.smarkets || {}, sst = sm.stats || {};
    var live = function (b) { return f[b] ? f[b].live : 0; };
    var verlauf = function (b) { return f[b] ? f[b].verlauf : 0; };

    /* Die Buecher werden nach UMFANG sortiert, das KLEINSTE zuerst.
     *
     * Das kleinste Buch ist die Engstelle: was dort nicht liegt, kann
     * nirgends gepaart werden, denn eine Arbitrage braucht immer genau zwei
     * Buecher. Die grossen stehen unten — sie bringen die Partien, die es
     * sonst nirgends gibt, aber sie helfen nur, soweit ein zweites Buch
     * mitzieht.
     *
     * Die Reihenfolge steht in KONFIG.buecher.umfang und ist gemessen, nicht
     * geschaetzt. Sortiert wird trotzdem nach der LIVE gemeldeten Zahl, wo
     * es eine gibt — die gemessene ist nur der Rueckfall. */
    var reihen = [
      { buch: 'kalshi', name: 'Kalshi',
        zahl: kst.maerkte,
        zustand: isFinite(Number(ka.alter_s)) && Number(ka.alter_s) < K.kalshiMaxAlterS ? 'gruen' : 'rot',
        alter: dauer(ka.alter_s),
        umfang: (kst.maerkte == null ? '?' : kst.maerkte) + ' Märkte aus ' +
          (kst.serien_mit_inhalt == null ? '?' : kst.serien_mit_inhalt) + ' von ' +
          (kst.serien_geprueft == null ? '?' : kst.serien_geprueft) + ' Serien',
        funde: live('kalshi'),
        tempo: kst.dauer_ms == null ? '?' : Math.round(kst.dauer_ms / 1000) + ' s je Durchlauf',
        hinweis: 'öffentlich, kein Konto' },

      { buch: 'polymarket', name: 'Polymarket',
        zahl: pm.maerkte,
        zustand: isFinite(Number(pm.alter_s)) && Number(pm.alter_s) < K.laufMaxAlterS ? 'gruen' : 'rot',
        alter: dauer(pm.alter_s),
        umfang: (pm.maerkte == null ? '?' : pm.maerkte) + ' Märkte im Fenster',
        funde: live('polymarket'),
        tempo: pm.dauer_ms == null ? '?' : (pm.dauer_ms / 1000).toFixed(1) + ' s je Lauf',
        hinweis: 'öffentlich, kein Konto' },

      { buch: 'smarkets', name: 'Smarkets',
        zahl: sst.mit_quoten,
        zustand: isFinite(Number(sm.alter_s)) && Number(sm.alter_s) < K.smarketsMaxAlterS ? 'gruen' : 'rot',
        alter: dauer(sm.alter_s),
        umfang: (sst.mit_quoten == null ? '?' : sst.mit_quoten) + ' Märkte mit Quoten aus ' +
          (sst.spiele == null ? '?' : sst.spiele) + ' Spielen',
        funde: live('smarkets'),
        tempo: sst.dauer_ms == null ? '?' : Math.round(sst.dauer_ms / 1000) + ' s je Durchlauf',
        hinweis: 'öffentlich, kein Konto, kein Heim-PC' },

      { buch: 'betfair', name: 'Betfair über Bridge',
        zahl: bf.im_fenster,
        zustand: !isFinite(Number(bf.alter_s)) ? 'rot'
                 : (Number(bf.alter_s) < K.bridgeMaxAlterS ? 'gruen' : 'rot'),
        /* Rohwert getrennt aufheben: wenn das Buch abgeschaltet ist, wird
         * `alter` geleert, aber der Hinweis will noch wissen, ob die Bridge
         * ueberhaupt noch laeuft. */
        rohAlter: bf.alter_s,
        alter: dauer(bf.alter_s),
        umfang: (bf.im_fenster == null ? '?' : bf.im_fenster) + ' im Fenster, ' +
          (bf.hochgeladen == null ? '?' : bf.hochgeladen) + ' von ' +
          (bf.katalog == null ? '?' : bf.katalog) + ' hochgeladen',
        funde: live('betfair'),
        tempo: 'Build ' + (bf.build == null ? '?' : bf.build),
        hinweis: null }
    ];

    reihen.forEach(function (r) {
      var k = (K.buecher || {})[r.buch] || {};
      /* Gemeldete Zahl schlaegt gemessene, gemessene schlaegt gar nichts. */
      r.groesse = isFinite(Number(r.zahl)) ? Number(r.zahl) : (k.umfang || 0);
      if (r.buch === 'betfair' && r.hinweis === null) {
        r.hinweis = r.zustand === 'rot' ? 'Bridge steht — Heim-PC' : 'läuft auf dem Heim-PC';
      }
      /* ABGESCHALTET ist nicht KAPUTT. Ein rotes Licht wuerde behaupten,
       * da sei etwas ausgefallen — dabei ist es eine Entscheidung.
       *
       * Und die AKTUALITAET wird geleert. Sie war zwar wahr — die Bridge auf
       * dem Heim-PC laedt weiter hoch, auch wenn der Scanner sie nicht mehr
       * liest — aber eine frische Zahl neben "abgeschaltet" liest sich wie
       * ein Widerspruch. Am 10.8.2026 genau so missverstanden: Betfair
       * zeigte 20 s, waehrend Smarkets und Kalshi bei 2 min standen, und das
       * sah nach einem Fehler aus. Es war keiner.
       *
       * Dass die Bridge noch laeuft, gehoert trotzdem gesagt — nur in den
       * Hinweis, wo es hingehoert, statt in eine Spalte, die Frische
       * verspricht. */
      if (k.aktiv === false) {
        var laeuftNoch = isFinite(Number(r.rohAlter)) && Number(r.rohAlter) < K.bridgeMaxAlterS;
        r.zustand = 'aus';
        r.funde = 0;
        r.alter = '—';
        r.tempo = 'wird nicht gelesen';
        r.hinweis = '<b>abgeschaltet</b> · ' + txt(k.grund || '') +
          (laeuftNoch ? ' · <b>deine Bridge lädt noch hoch</b> (vor ' +
                        dauer(r.rohAlter) + '), der Scanner ignoriert es — du kannst sie ausmachen'
                      : '');
      }
    });
    reihen.sort(function (a, b) { return a.groesse - b.groesse; });

    reihen.forEach(function (r, i) {
      zeilen += anbieterZeile(
        (i === 0 ? '① ' : '') + r.name + ' · ' + r.groesse,
        r.zustand, r.alter, r.umfang, r.funde, r.tempo,
        (i === 0 ? '<b>kleinstes Buch — die Engstelle</b> · ' : '') + (r.hinweis || ''));
    });

    /* Supabase selbst: die Antwortzeit dieser einen Abfrage ist das
     * ehrlichste Mass. Wenn sie kommt, ist die Verbindung da. */
    zeilen += anbieterZeile('Supabase',
      u.antwort_ms < 1500 ? 'gruen' : 'gelb',
      u.antwort_ms + ' ms',
      (u.takte || []).filter(function (t) { return t.aktiv; }).length + ' von ' +
        (u.takte || []).length + ' Takten aktiv',
      verlauf('polymarket'),
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
      paarungenZeile(u.paarungen) +
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
    var betfairAn = (((welt.KONFIG.buecher || {}).betfair || {}).aktiv !== false);
    var kalshiLaeuft = s.kalshi_alter_s !== null && s.kalshi_alter_s < welt.KONFIG.kalshiMaxAlterS;
    var smarketsLaeuft = s.smarkets_alter_s !== null && s.smarkets_alter_s < welt.KONFIG.smarketsMaxAlterS;
    return [
      { name: 'Chancen live', wert: s.chancen, farbe: s.chancen > 0 ? 'var(--gruen)' : 'var(--text-leise)' },
      { name: 'Knappe Paare', wert: s.knapp },
      { name: 'Im Verlauf', wert: s.verlauf },
      { name: 'Scanner', wert: dauer(s.lauf_alter_s), farbe: scannerLaeuft ? 'var(--gruen)' : 'var(--rot)' },
      { name: 'Kalshi · ohne Konto', wert: dauer(s.kalshi_alter_s),
        farbe: kalshiLaeuft ? 'var(--tuerkis)' : 'var(--rot)' },
      { name: 'Smarkets · ohne Konto', wert: dauer(s.smarkets_alter_s),
        farbe: smarketsLaeuft ? 'var(--gold)' : 'var(--rot)' },
      /* Betfair ist abgeschaltet: die Kachel zeigt das, statt ein Alter zu
       * melden, das niemanden mehr interessiert. */
      betfairAn
        ? { name: 'Bridge · Heim-PC', wert: dauer(s.bf_alter_s), farbe: bridgeLaeuft ? 'var(--gruen)' : 'var(--rot)' }
        : { name: 'Betfair', wert: 'aus', farbe: 'var(--text-leise)' },
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
    /* Ueber ein ABGESCHALTETES Buch wird nicht gewarnt. Eine Warnung, dass
     * die Bridge steht, waere jetzt schlicht falsch: sie soll stehen. */
    var bfAn = (((K.buecher || {}).betfair || {}).aktiv !== false);
    if (bfAn && (s.bf_alter_s === null || s.bf_alter_s > K.bridgeMaxAlterS)) {
      warn += '<div class="warnung"><b>Betfair-Daten sind ' + dauer(s.bf_alter_s) + ' alt.</b> ' +
              'Die Bridge auf dem Heim-PC lädt normalerweise im Minutentakt hoch. ' +
              'Betfair-Zeilen zählen deshalb gerade nicht als Chance.</div>';
    }
    if (s.kalshi_alter_s === null || s.kalshi_alter_s > K.kalshiMaxAlterS) {
      warn += '<div class="warnung"><b>Kalshi-Daten sind ' + dauer(s.kalshi_alter_s) + ' alt.</b> ' +
              'Gesammelt wird alle 5 Minuten, ein Durchlauf dauert rund 52 Sekunden.</div>';
    }
    if (s.smarkets_alter_s === null || s.smarkets_alter_s > K.smarketsMaxAlterS) {
      warn += '<div class="warnung"><b>Smarkets-Daten sind ' + dauer(s.smarkets_alter_s) + ' alt.</b> ' +
              'Gesammelt wird alle 5 Minuten, ein Durchlauf dauert rund 17 Sekunden.</div>';
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
    /* Der Filter blendet NUR aus. Was er versteckt, wird darunter gezaehlt —
     * sonst sieht "0 Chancen" mit gesetztem Filter genauso aus wie "0
     * Chancen" ohne, und das waere eine Falle. */
    var F = welt.Filter;
    function gefiltert(liste, imVerlauf) {
      return F ? F.anwenden(liste, imVerlauf) : { sichtbar: liste, weg: 0 };
    }
    function versteckt(n) {
      if (!n) return '';
      return '<p class="leise"><b>' + n + (n === 1 ? ' Fund ist' : ' Funde sind') +
             ' durch den Filter ausgeblendet.</b> Gesucht wurde trotzdem danach — ' +
             'der Filter ändert nur die Anzeige, nicht den Scan.</p>';
    }

    /* NICHT in e hineinschreiben: app.js merkt sich genau dieses Objekt als
     * welt.letztesErgebnis. Wer hier e.chancen ersetzt, filtert beim
     * naechsten Zeichnen eine bereits gefilterte Liste noch einmal — die
     * Liste wuerde bei jedem Klick weiter schrumpfen. */
    var gChancen = gefiltert(e.chancen, false);
    var gKnapp   = gefiltert(e.knapp, false);
    var gVerlauf = gefiltert(e.verlauf, true);
    var zChancen = gChancen.sichtbar, zKnapp = gKnapp.sichtbar, zVerlauf = gVerlauf.sichtbar;

    var chancenHtml = versteckt(gChancen.weg);
    if (zChancen.length) {
      chancenHtml += zChancen.map(function (f) { return karte(f, false); }).join('');
    } else if (gChancen.weg) {
      chancenHtml += '<div class="warnung">Alle Chancen sind gerade ausgefiltert. ' +
        'Setz den Filter zurück, wenn du alles sehen willst.</div>';
    } else {
      chancenHtml += '<div class="warnung">Gerade keine handelbare Chance über ' +
        K.mindestRendite.toFixed(2) + ' %. Das ist der Normalfall: zwei Börsen mit vielen ' +
        'Teilnehmern liegen selten weit auseinander. Unter <b>Knappste Paare</b> siehst du, ' +
        'wie nah es dran ist.</div>';
    }

    /* Funde ueber der Schwelle auf VERALTETEN Kursen. Die gehoeren weder zu
     * den Chancen noch zu den knappen Paaren. Vorher landeten sie unter
     * "Knappste Paare" und standen dort mit +16 % zwischen lauter
     * Minuswerten, ohne dass irgendwo stand warum. */
    if (e.veraltetHoch && e.veraltetHoch.length && !gChancen.weg) {
      chancenHtml = '<div class="warnung"><b>' + e.veraltetHoch.length +
        (e.veraltetHoch.length === 1 ? ' Fund liegt' : ' Funde liegen') +
        ' über der Schwelle, aber auf veralteten Kursen.</b> ' +
        'Nicht handelbar: die Gegenquote ist Stunden alt, in Wirklichkeit steht dort längst ' +
        'ein anderer Kurs. Je höher die Rendite auf alten Daten, desto wahrscheinlicher ' +
        'ist sie nur der Beweis, dass die Zahl alt ist.</div>' +
        e.veraltetHoch.map(function (f) { return karte(f, false); }).join('') +
        (zChancen.length ? '<h2>Handelbar</h2>' : '') +
        chancenHtml;
    }
    setzeWennAnders(document.getElementById('chancen'), chancenHtml);

    var knappHtml = versteckt(gKnapp.weg);
    if (zKnapp.length) {
      knappHtml += '<p class="leise">Knapp daneben: richtig zugeordnet, nachgerechnet, aber unter ' +
        K.mindestRendite.toFixed(2) + ' % Rendite. Die Kehrwertsumme sagt alles: ' +
        '<b>unter 1</b> heißt Gewinn unabhängig vom Ausgang, <b>über 1</b> heißt Verlust. ' +
        'Alle ' + zKnapp.length + ', beste zuerst. Alles unter ' + K.rauschGrenze.toFixed(1) +
        ' % wird nicht mehr gezeigt und auch nicht mehr aufbewahrt' +
        (s.rauschen ? ' — gerade ' + s.rauschen + ' Zeilen' : '') + '.</p>' +
        zKnapp.map(function (f) { return karte(f, false); }).join('');
    } else {
      knappHtml += '<p class="leise">Keine Paare. Entweder liegen gerade keine gemeinsamen ' +
        'Partien an, eine Quelle ist stehengeblieben, oder der Filter lässt nichts durch.</p>';
    }
    setzeWennAnders(document.getElementById('knapp'), knappHtml);

    var verlaufHtml = '<p class="leise"><b>Nur Funde, die im Plus waren.</b> Was nie eine Rendite über ' +
      K.verlaufMinRendite.toFixed(0) + ' % erreicht hat, wird gelöscht statt aufbewahrt. ' +
      'Ein Fund landet hier, wenn er nicht mehr gefunden wird, wenn seine Partie vorbei ist, ' +
      'oder wenn er eine Stunde lang nicht mehr bestätigt wurde. Sortiert nach Beendigung, ' +
      'mit der besten je gesehenen Rendite.</p>' + versteckt(gVerlauf.weg);
    if (!zVerlauf.length) {
      verlaufHtml += '<p class="leise">Noch nichts im Plus beendet.</p>';
    } else {
      verlaufHtml += zVerlauf.map(function (f) { return karte(f, true); }).join('');
    }
    setzeWennAnders(document.getElementById('verlauf'), verlaufHtml);

    reiterZeichnen({ chancen: zChancen, knapp: zKnapp, verlauf: zVerlauf,
                     veraltetHoch: e.veraltetHoch || [] });
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
