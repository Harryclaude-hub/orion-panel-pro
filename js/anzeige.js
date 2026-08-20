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

  /* ---------- LISTEN RUHIG SCHREIBEN (16.8.) ----------
   *
   * Beschwerde des Auftraggebers: "wenn ich einen Vorschlag oeffne,
   * teleportiert es mich beim Scrollen herum". Ursache: die Listen
   * werden alle zwei Sekunden KOMPLETT neu geschrieben (innerHTML).
   * Aendert sich dabei irgendwo oberhalb die Hoehe — und das tut sie
   * staendig, weil Zeilen kommen, gehen und aufgeklappte Karten hoch
   * sind —, rutscht der ganze Inhalt unter dem Finger weg.
   *
   * Zwei Regeln beheben das, ohne einen einzigen Wert zu aendern:
   *
   *   1. RUHE: waehrend der Nutzer scrollt oder gerade geklickt hat
   *      (letzte 1,2 s), wird gar nicht geschrieben. Der naechste Takt
   *      kommt in zwei Sekunden ohnehin mit frischen Daten.
   *   2. ANKER: muss geschrieben werden, merkt sich die Anzeige die
   *      oberste sichtbare Karte und ihren Abstand zum Fensterrand —
   *      und rueckt danach die Seite so zurecht, dass genau diese Karte
   *      wieder an derselben Stelle steht. Man bleibt an seiner Zeile
   *      kleben, egal was oben passiert. */
  var letzteUnruhe = 0;
  ['scroll', 'wheel', 'touchmove', 'pointerdown', 'keydown'].forEach(function (art) {
    window.addEventListener(art, function () { letzteUnruhe = Date.now(); },
      { passive: true, capture: true });
  });

  function listeSetzen(el, html) {
    if (!el) return false;
    if (el.dataset.stand === html) return false;

    /* Regel 1 — der Nutzer ist gerade dabei: nicht anfassen. */
    if (Date.now() - letzteUnruhe < 1200) return false;

    /* Regel 2 — Anker suchen: ALLE Karten im Fenster merken, nicht nur
     * die oberste. Verschwindet ausgerechnet die oberste im neuen Stand
     * (Chance läuft aus, Zeile wandert in den Verlauf — der Normalfall,
     * nicht die Ausnahme!), gab es bisher KEINEN Halt mehr, und genau
     * dann sprang die Seite (Restbeschwerde vom 17.8.). Jetzt hält die
     * nächste überlebende Karte die Seite fest. */
    var anker = [];
    var karten = el.querySelectorAll('.fund[data-schluessel]');
    for (var i = 0; i < karten.length; i++) {
      var r = karten[i].getBoundingClientRect();
      if (r.top >= window.innerHeight || anker.length >= 12) break;
      if (r.bottom > 0) {
        anker.push({ s: karten[i].getAttribute('data-schluessel'), oben: r.top });
      }
    }

    el.dataset.stand = html;
    el.innerHTML = html;

    for (var a = 0; a < anker.length; a++) {
      var neu = el.querySelector('.fund[data-schluessel="' + anker[a].s.replace(/"/g, '\\"') + '"]');
      if (neu) {
        var abweichung = neu.getBoundingClientRect().top - anker[a].oben;
        if (Math.abs(abweichung) > 1) window.scrollBy(0, abweichung);
        break;
      }
    }
    return true;
  }

  function txt(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------- GELD: nie eine Zahl ohne Einheit ----------
   *
   * Alle Betraege im System stehen in USD: Polymarket und Kalshi rechnen so,
   * Smarkets wird an der Quelle von GBP nach USD umgerechnet. Angezeigt wurde
   * bisher die nackte Zahl — "max. Einsatz 94" liess offen, ob das Euro,
   * Dollar oder eine Skala ist. Genau danach wurde gefragt.
   *
   * Den Kurs holt die Datenbank selbst (pg_net im Waechter); der Browser darf
   * es nicht, api.frankfurter.dev sendet keinen CORS-Header.
   *
   * DREI ZUSTAENDE, nie zwei:
   *   Kurs bekannt      ->  "81,40 € ($ 94,00)"   BEIDE Waehrungen, unuebersehbar
   *   kein Kurs         ->  "94,00 $"             ehrlich in USD, mit Einheit
   *   Betrag unbekannt  ->  "unbekannt"           nicht 0, nicht leer
   *
   * SEIT 19.8. STEHEN IMMER BEIDE WAEHRUNGEN DA (Vorgabe des Auftraggebers):
   * zwei Buecher fuehren Dollar (Polymarket, Kalshi), die Gegenseite fuehrt
   * bei ihm Euro. Ein Betrag mit nur einem Zeichen laesst sich verwechseln,
   * und ein verwechselter Betrag ist ein falscher Betrag.
   *
   * Ein erfundener Kurs waere schlimmer als eine fremde Waehrung: er sieht
   * aus wie eine Zahl, auf die man sich verlassen kann. */
  var fxKurs = null;          // { kurs, stand, quelle } oder null
  function setzeKurs(k) { fxKurs = (k && isFinite(Number(k.kurs))) ? k : null; }

  function geld(betragUsd, stellen) {
    var n = Number(betragUsd);
    if (betragUsd === null || betragUsd === undefined || !isFinite(n)) return 'unbekannt';
    var s = (stellen === undefined) ? 2 : stellen;
    var z = function (x) { return Math.abs(x) >= 1000 ? Math.round(x).toLocaleString('de-AT') : x.toFixed(s); };
    if (fxKurs) return z(n * Number(fxKurs.kurs)) + ' € ($ ' + z(n) + ')';
    return z(n) + ' $';
  }
  /* Nur die Einheit, fuer Zeilen die selbst rechnen. */
  function einheit() { return fxKurs ? '€' : '$'; }
  function inEur(betragUsd) {
    var n = Number(betragUsd);
    if (!isFinite(n)) return null;
    return fxKurs ? n * Number(fxKurs.kurs) : n;
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

  /* Seit wann ein Kurs unverändert so steht (Vorgabe 17.8.). Ein Kurs,
   * der sehr lange starr steht, während drumherum gehandelt wird, ist
   * ein Warnzeichen: stehengebliebene Kurse waren die häufigste Quelle
   * von Scheinchancen (Messungen vom 13.8.). Fehlt der Zeitpunkt, wird
   * NICHTS angezeigt statt etwas Erfundenem. */
  function kursStehtZeile(iso) {
    if (!iso || isNaN(Date.parse(iso))) return '';
    return '<div class="leise" title="Seit wann dieser Kurs unverändert so steht. Je frischer, desto lebendiger der Markt. Ein Kurs, der seit langem starr steht, ist eher ein stehengebliebener Kurs als ein Geschenk.">' +
           'Kurs unverändert seit ' + seit(iso) + '</div>';
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

  /* EIGENE SEITE JE FUND (20.8., Karams Vorgabe: "dass man auf eine eigene
   * Page kommt, dass man sich nicht dafuer durchscrollen muss"). Eine Karte
   * fuellt eine Bildschirmhoehe; in einer Liste von zwanzig verliert man
   * die Zeile, die man ansehen wollte. Der Knopf fuehrt auf beitrag.html,
   * die GENAU diese eine Karte zeigt, mit Zurueck-Knopf.
   *
   * Auf beitrag.html selbst ist er sinnlos (man ist schon dort) und faellt
   * weg. Die Erkennung laeuft ueber den Pfad, nicht ueber eine Fahne, die
   * jemand zu setzen vergessen kann. */
  var AUF_BEITRAG = /beitrag\.html$/i.test(String(location.pathname || ''));

  function eigeneSeite(f) {
    if (AUF_BEITRAG) return '';
    return '<a class="knopf eigen" href="beitrag.html?fund=' +
             encodeURIComponent(String(f.schluessel || '')) + '"' +
             ' title="Öffnet genau diese Karte auf ihrer eigenen Seite: kein Scrollen, kein Suchen, mit Zurück-Knopf.">' +
             '▤ Eigene Seite</a>';
  }

  function aktionen(f) {
    return '<div class="aktionen">' +
             eigeneSeite(f) +
             linkKnopf(f.pm_link, buch1(f)) +
             linkKnopf(f.bf_link, buch2(f)) +
           '</div>';
  }

  /* Heute: nur die Uhrzeit, gross und oben rechts. Aelter als heute: NUR
   * noch das Datum (Vorgabe 20.8.) — sonst liest man 23:14 und denkt
   * \"gerade eben\", obwohl es von vorgestern ist. Die volle Angabe mit
   * Uhrzeit steht weiter im Tooltip (zeitpunkt). */
  function uhrzeit(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '?';
    var d = new Date(t);
    function zwei(n) { return (n < 10 ? '0' : '') + n; }
    var heute = new Date();
    var gleicherTag = d.getDate() === heute.getDate() &&
                      d.getMonth() === heute.getMonth() &&
                      d.getFullYear() === heute.getFullYear();
    return gleicherTag ? zwei(d.getHours()) + ':' + zwei(d.getMinutes())
                       : zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.';
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
    /* MIT EINHEIT. Vorher stand hier "max. 94 Einsatz möglich" — die nackte
     * Zahl liess offen, ob das Euro, Dollar oder eine Skala ist. Seit dem
     * 19.8. zeigt geld() beide Waehrungen — auch hier. */
    return '<span><b>max. ' + geld(e) + '</b> Einsatz möglich' + (g === null ? '' :
             ' &rarr; ' + (g >= 0 ? '+' + geld(g) + ' Gewinn'
                                  : geld(g) + ' Verlust')) + '</span>';
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
   *   Anteilspreis (Polymarket UND Kalshi)   Gebuehr = s * p * (1-p)
   *   Boerse Back  qE = 1 + (q-1) * (1-s)
   *   Boerse Lay   qE = 1 + (1-s) / (q-1)
   *
   * KORRIGIERT 17.8.2026 (Fund des Auftraggebers): hier stand fuer
   * Polymarket noch `s * min(p, 1-p)` — die alte, DOPPELTE Gebuehr. Nur
   * Kalshi war seinerzeit umgestellt worden. Belegt richtig ist fuer
   * BEIDE Preis-Buecher `s * p * (1-p)`: Anbieterdoku
   * (docs.polymarket.com/Fees) `fee = C x feeRate x p x (1-p)`, so
   * rechnen auch js/rechnung.js (gebuehrPm) und der Server
   * (orion-lauf/rechnung.ts), siehe UEBERGABE Abschnitt 8f.
   * Es war reiner ANZEIGE-Drift: der Server rechnete immer richtig, aber
   * die Karte zeigte fuer Polymarket-Seiten eine zu niedrige
   * Effektivquote — und widersprach damit der Formel-Zeile im selben
   * Bericht, die (in formelSeite) schon mit p*(1-p) rechnet. */
  function qeSeiteWert(buchName, info, wert, satz, seiteText) {
    var x = Number(wert), s = Number(satz);
    if (!isFinite(x) || !isFinite(s)) return null;
    if (info.art === 'preis') {
      if (!(x > 0 && x < 1)) return null;
      var g = s * x * (1 - x);
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

  /* Nach aussen gereicht, denn seit dem 13.8. ist Deckung die FUENFTE
   * Chancen-Bedingung (daten.js): eine Zeile, deren zwei Seiten nicht
   * nachweislich GEGENSAETZLICHE Ausgaenge decken, zaehlt nicht — egal wie
   * die Rendite aussieht. Zwei Wetten auf denselben Ausgang sind kein
   * Schutz, sondern doppeltes Risiko, und eine Seite, die sich nicht
   * einordnen laesst, ist "unbekannt" und faellt ebenso durch. */
  function istGedeckt(f) { return ausgaenge(f).gedeckt; }

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
      /* DIE UNENTSCHIEDEN-FRAGE, ausdruecklich (13.8.2026). Ein Fussballspiel
       * hat drei Ergebnisse, aber DIESE Wette hat zwei Ausgaenge: gewettet
       * wird nicht "A oder B", sondern "A gewinnt - ja oder nein". Ein
       * Unentschieden IST der Fall "nein" und ist damit gedeckt, nicht
       * offen. Gefaehrlich waere nur ein Paar A-gewinnt gegen B-gewinnt -
       * und genau das faengt die Deckungspruefung oben ab. */
      (welt.Filter && welt.Filter.artVon && /sieger/.test(String(welt.Filter.artVon(f)))
        ? '<div class="gp-fuss">Und das Unentschieden? Das Spiel hat drei Ergebnisse, die <b>Wette</b> hat ' +
          'zwei Ausgänge: „<b>' + txt(a.name) + '</b>" tritt ein oder nicht. Ein Unentschieden ist ' +
          'der Fall „<b>tritt nicht ein</b>" — dann zahlt ' + txt(a.pm ? buch2(f).name : buch1(f).name) +
          '. Es gibt keinen dritten Fall, in dem beide verlieren.</div>'
        : '') +
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
      hoch = '<div class="gp-fuss">Auf den handelbaren Einsatz von ' + geld(max) +
             ' hochgerechnet: <b>' + geld(gebuehrEcht, 3) + '</b> Gebühr &middot; ' +
             '<b>' + (gewinnNach >= 0 ? '+' : '') + geld(gewinnNach, 3) + '</b> Gewinn, ' +
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

    /* Smarkets nennt Back/Lay NICHT so. Es ist ein Prediction Market und
     * spricht von BUY und SELL. Gemessen am 11.8.2026: im Orderbuch eines
     * Siegermarktes stehen auf BEIDEN Seiten echte Mengen (Kairat back 10,6
     * Mio / lay 19,4 Mio Einheiten). Dagegenhalten geht dort also sehr wohl —
     * es heisst nur anders. Wer nach "Lay" sucht, findet nichts und haelt
     * den Markt faelschlich fuer einseitig. */
    var seiteHier = (b1 === 'smarkets' ? f.pm_seite : f.bf_seite);
    var buySell = String(seiteHier || '').toLowerCase() === 'lay'
      ? ' Diese Seite ist ein <b>Lay</b> — bei Smarkets heißt das <b>SELL</b>, nicht "Lay".'
      : ' Diese Seite ist ein <b>Back</b> — bei Smarkets heißt das <b>BUY</b>.';

    return '<div class="gegenprobe absage">' +
      '<div class="gp-fuss" style="margin:0">' +
        '<b>Achtung beim Smarkets-Link:</b> er führt auf die <b>Partie</b>, ' +
        'nicht auf diesen Markt — Smarkets zeigt dort seinen Standardmarkt. ' +
        'Du musst dort selbst wechseln auf: <b>' + txt(name) +
        (linie ? ' ' + txt(linie[1]) : '') + '</b>.' + buySell +
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
          '><b>' + (f.echter_gewinn >= 0 ? '+' : '') + geld(f.echter_gewinn) +
          '</b> tatsächlicher Gewinn' +
          (f.echter_gewinn < welt.KONFIG.mindestGewinn
            ? ' — unter ' + geld(welt.KONFIG.mindestGewinn) + ', keine Chance'
            : '') + '</span>') +
      (f.max_einsatz === null || f.max_einsatz === undefined
        ? '<span class="acht">Liquidität nicht messbar</span>'
        : '<span title="Gezaehlt wird NUR das Geld auf der BESTEN Preisstufe beider Buecher. Dahinter liegt mehr, aber zu schlechteren Kursen - und mit jeder Stufe faellt die Rendite. Wer mehr setzt, setzt zu einem anderen Preis.">' +
          'Liquidität: <b>' + geld(f.max_einsatz) + '</b> zur gezeigten Rendite' +
          (f.engstelle
            ? ' &middot; Engstelle: <b>' + txt(f.engstelle.name) + '</b> mit ' + geld(f.engstelle.geld) +
              ' auf der besten Stufe'
            : '') +
          '</span>' +
          /* Die Frage "warum nur ein paar hundert Euro?" beantwortet sich
           * nicht aus der Zahl allein — sie braucht den Satz dazu. */
          '<span class="acht" title="Beispiel: liegen auf der besten Stufe 200 EUR und eine Stufe tiefer 5000, kannst du die 5000 zwar setzen, aber nicht mehr zu dieser Rendite - die naechste Stufe ist teurer.">' +
          'nur erste Preisstufe — dahinter mehr Geld, aber schlechtere Kurse</span>') +
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
    /* Die Buchprobe gehoert MIT in diese Zeile: jede Wette traegt damit
     * vier Pruefungen — Rechnung, beide Links, Buchstimmigkeit — jede mit
     * drei Zustaenden. "Nicht messbar" heisst: keine Seite ist Smarkets
     * oder Betfair mit auffindbarem Markt; bei Polymarket und Kalshi ist
     * die Probe nicht definiert (je Frage ein eigenes Buch). */
    var summe = (f.buch_summe === null || f.buch_summe === undefined) ? null : Number(f.buch_summe) >= 1;
    var summeText = summe === null ? '' : ' (' + Number(f.buch_summe).toFixed(4) + ')';
    return '<div class="unter">' +
      marke(f.rechnung_ok, 'Rechnung nachgeprueft', 'Rechnung beanstandet', 'Rechnung offen') +
      marke(f.pm_link_ok, buch1(f).name + '-Link lebt', buch1(f).name + '-Link tot', buch1(f).name + '-Link nicht pruefbar') +
      marke(f.gegen_link_ok, 'Gegenlink lebt', 'Gegenlink tot', 'Gegenlink nicht pruefbar') +
      marke(summe, 'Buch stimmig' + summeText, 'Buch UNSTIMMIG' + summeText, 'Buchprobe nicht messbar') +
      '<span class="chip">geprueft vor ' + seit(f.geprueft_am) + '</span>' +
      (f.rechnung_ok === false && f.rechnung_grund ? ' <span class="chip rot">' + txt(f.rechnung_grund) + '</span>' : '') +
      '</div>';
  }

  /* Der BEREICH einer Zeile, als deutscher Name aus dem Filter-Register.
   * Seit dem Bereichs-Scanner stammt jede Zeile aus GENAU EINEM Bereich —
   * in der Sammelansicht "Alle Bereiche" ist das die erste Frage an eine
   * Karte. Faellt fuer Altzeilen auf die Sportart-Ableitung zurueck. */
  function bereichText(f) {
    var F = welt.Filter;
    if (!F || !F.bereichVon) return String(f.sportart || '?');
    var b = F.bereichVon(f);
    if (!b) return String(f.sportart || '?');
    for (var i = 0; i < (F.BEREICHE || []).length; i++) {
      if (F.BEREICHE[i].id === b) return F.BEREICHE[i].name;
    }
    return b;
  }

  /* ---------- KARTEN NACH BEREICH GEBÜNDELT (Vorgabe 17.8. spät, "c") ----
   * Innerhalb der Gruppe bleibt die Rendite-Reihenfolge; die Gruppen selbst
   * stehen nach ihrer besten Zeile (die Liste kommt rendite-sortiert an,
   * also gewinnt die Gruppe der ersten Karte). Nur für die LIVE-Listen —
   * Verlauf und Falsch bleiben chronologisch, dort erzählt die Reihenfolge
   * die Geschichte. Bei nur EINER Gruppe entfällt die Überschrift: eine
   * Gliederung mit einem einzigen Fach ist keine. */
  function kartenGruppiert(liste, imVerlauf) {
    var reihen = [], je = {};
    liste.forEach(function (f) {
      var schl = (welt.Filter && welt.Filter.bereichVon)
        ? (welt.Filter.bereichVon(f) || String(f.sportart || '?'))
        : String(f.sportart || '?');
      if (!je[schl]) { je[schl] = { name: bereichText(f), karten: [] }; reihen.push(schl); }
      je[schl].karten.push(f);
    });
    if (reihen.length < 2) {
      return liste.map(function (f) { return karte(f, imVerlauf); }).join('');
    }
    var z = '';
    reihen.forEach(function (schl) {
      var g = je[schl];
      z += '<h2 class="gruppe-kopf">' + txt(g.name) +
           ' <span class="leise">(' + g.karten.length + ')</span></h2>' +
           g.karten.map(function (f) { return karte(f, imVerlauf); }).join('');
    });
    return z;
  }

  /* ---------- SCANSTAND: alle Bereiche mit ehrlichem Zustand (17.8., "c") --
   * Je Bereich eine Zeile: läuft (grün, mit Alter), STEHT (rot, Wächter-
   * Maßstab Takt × 3), aus (grau, mit Grund). Die Daten kommen alle 30 s
   * aus orion_scanstand(); gezeichnet wird nur bei Änderung. */
  function scanstandBlock(liste) {
    if (!liste || !liste.length) return '';
    var GRUPPEN = { sport: 'Sport', esport: 'E-Sport', welt: 'Welt' };
    var je = {}, reihen = [];
    liste.forEach(function (b) {
      var g = b.gruppe || '?';
      if (!je[g]) { je[g] = []; reihen.push(g); }
      je[g].push(b);
    });
    var z = '<div class="scan-kopf">Scanstand — alle ' + liste.length +
            ' Bereiche <span class="leise">(alle 30 s frisch)</span></div>';
    reihen.forEach(function (g) {
      z += '<div class="scan-gruppe">' + txt(GRUPPEN[g] || g) + '</div><div class="scan-zeilen">';
      je[g].forEach(function (b) {
        var zustand, klasse;
        if (!b.aktiv) { zustand = 'aus'; klasse = 'aus'; }
        else if (b.lauf_alter_s == null) { zustand = 'noch kein Lauf'; klasse = 'acht'; }
        else if (b.lauf_alter_s > b.takt_sek * 3) { zustand = 'STEHT seit ' + dauer(b.lauf_alter_s); klasse = 'rot'; }
        else { zustand = 'vor ' + dauer(b.lauf_alter_s); klasse = 'gut'; }
        var titel = !b.aktiv
          ? 'Bewusst abgeschaltet — keine zweite Quelle mit derselben Frage. Kein Fehler, eine Entscheidung.'
          : 'Takt: alle ' + dauer(b.takt_sek) + ' · letzter Lauf: ' +
            (b.lauf_alter_s == null ? 'nie' : 'vor ' + dauer(b.lauf_alter_s)) +
            (b.fehler ? ' · letzter Fehler: ' + String(b.fehler).slice(0, 80) : '');
        z += '<span class="scan-zeile ' + klasse + '" title="' + txt(titel) + '">' +
             txt(b.name) + ' <b>' + txt(zustand) + '</b>' +
             (Number(b.live) ? ' · ' + b.live + ' live' : '') + '</span>';
      });
      z += '</div>';
    });
    return z;
  }

  /* ---------- ABSCHNITTE ----------
   *
   * Eine Karte trug bis zum 13.8.2026 alles in einer Reihe: Chips, Seiten,
   * Rendite in Worten, Gebuehren, Gegenprobe, Absageregeln, Smarkets-Hinweis,
   * Pruefzeile, Analyse, Fusszeile. Alles davon ist richtig und keines davon
   * war wegzulassen — aber ohne Ueberschriften liest man es nicht, man
   * ueberfliegt es. Deshalb jetzt benannte Abschnitte, und alles, was man
   * NUR VOR DEM HANDELN braucht, hinter einem Aufklapper.
   *
   * Die Reihenfolge folgt der Frage, in der man hinsieht:
   *   1. Um welche Partie geht es, wie viel bringt sie
   *   2. WANN ist das (neu am 13.8.)
   *   3. Welche zwei Kurse
   *   4. Was heisst das in Geld
   *   5. Feinheiten, zugeklappt
   */
  /* ---------- WAS PASSIERT BEI ABSAGE? IN GELD. ---------- (13.8.2026)
   *
   * Schlechtes Wetter, Abbruch, Spieler tritt nicht an: der dritte Fall,
   * der in keiner Rendite steht. Bisher stand auf der Karte nur, WAS jedes
   * Buch dann tut. Jetzt wird es AUSGERECHNET, mit den echten Einsaetzen
   * dieser Zeile:
   *
   *   einsatz_zurueck  -> voller Einsatz zurueck
   *   anteil_50        -> 0,50 je Anteil; Anteile = Einsatz / Kaufpreis.
   *                       JA fuer 0,37: aus 37 werden 50  -> Gewinn.
   *                       NEIN fuer 0,62: aus 62 werden 50 -> Verlust.
   *   letzter_preis / unbekannt -> im SCHLIMMSTEN Fall 0. Nicht, weil das
   *                       wahrscheinlich ist, sondern weil niemand das
   *                       Gegenteil belegen kann. Drei Zustaende, nie zwei.
   *
   * Ergebnis je Zeile: 'sicher' (Absage kostet nichts oder bringt sogar),
   * 'verlust' (Absage kostet rechnerisch Geld — KEINE Chance mehr, siehe
   * KONFIG.absageStreng) oder 'unbekannt' (eine Seite nicht berechenbar —
   * Chance mit Pflichthinweis). Warum das die erste Prioritaet ist: bei
   * 2 % Gewinn je Wette frisst EIN Absage-Verlust von 20 % zwanzig
   * gewonnene Wetten. */
  function absageBilanz(f) {
    var e1 = Number(f.einsatz_1), e2 = Number(f.einsatz_2);
    if (!isFinite(e1) || !isFinite(e2) || !(e1 + e2 > 0)) return null;

    function seite(info, einsatz, kurs) {
      var form = info.absage_form || 'unbekannt';
      if (form === 'einsatz_zurueck') return { v: einsatz, bekannt: true, belegt: info.absage_sicher === true };
      if (form === 'anteil_50') {
        var p = Number(kurs);
        if (!(p > 0) || p >= 1) return { v: 0, bekannt: false, belegt: false };
        /* Anteile = Einsatz / Preis, jeder zahlt 0,50. Die Regel steht JE
         * MARKT — gerechnet wird sie, belegt ist sie nicht. */
        return { v: 0.5 * einsatz / p, bekannt: true, belegt: false };
      }
      return { v: 0, bekannt: false, belegt: false };
    }

    var s1 = seite(buch1(f), e1, f.pm_preis);
    var s2 = seite(buch2(f), e2, f.bf_quote);
    var delta = s1.v + s2.v - (e1 + e2);      // je 100 Gesamteinsatz
    var art = (s1.bekannt && s2.bekannt) ? (delta >= -1e-9 ? 'sicher' : 'verlust') : 'unbekannt';
    return { delta: delta, art: art, belegt: s1.belegt && s2.belegt };
  }

  /* ---------- SO SETZT DU ---------- (Wunsch vom 13.8.2026)
   *
   * "Ich verstehe nicht irgendwelche mysteriösen Zahlen. Sag einfach: das
   * sind die zwei, das ist der Einsatz, so viel setzt du dahin, so viel aufs
   * andere."
   *
   * Genau das steht hier, in zwei nummerierten Schritten und einem Satz zum
   * Ergebnis. Jede Zahl auf der Karte hat ab hier einen Satz daneben, der
   * sagt, was sie bedeutet.
   *
   * WAS KANN MAN BEI DIESER WETTE ÜBERHAUPT? Das ist bei jedem Buch anders,
   * und es ist der Grund, warum eine Seite "JA" heisst und die andere "Lay":
   *   Polymarket / Kalshi  Anteile KAUFEN. Es gibt zwei Sorten, JA und NEIN.
   *                        Beide kann man kaufen — "NEIN kaufen" IST das
   *                        Dagegenhalten. Ein Verkaufen gibt es nicht.
   *   Smarkets / Betfair   Eine Wette ANNEHMEN (Back) oder eine Wette
   *                        ANBIETEN (Lay). Lay heisst bei Smarkets SELL.
   * Deshalb steht auf jeder Seite im Klartext, was zu tun ist, statt nur
   * "JA" oder "Lay". */
  function tuWas(info, seiteText, name) {
    var s = String(seiteText || '').toLowerCase();
    var n = txt(name || 'diesen Ausgang');
    if (s === 'ja' || s === 'über' || s === 'ueber') {
      return 'kaufe <b>JA</b> auf „' + n + '"';
    }
    if (s === 'nein' || s === 'unter') {
      return 'kaufe <b>NEIN</b> auf „' + n + '" (du hältst dagegen)';
    }
    if (s === 'back') {
      return 'setze <b>' + (info.name === 'Smarkets' ? 'BUY (Back)' : 'BACK') + '</b> auf „' + n + '"';
    }
    if (s === 'lay') {
      return 'setze <b>' + (info.name === 'Smarkets' ? 'SELL (Lay)' : 'LAY') + '</b> gegen „' + n + '"' +
             ' — du hältst dagegen, dass das eintritt';
    }
    return txt(seiteText) + ' auf „' + n + '"';
  }

  function soSetztDu(f) {
    var b1 = buch1(f), b2 = buch2(f);
    var e1 = Number(f.einsatz_1), e2 = Number(f.einsatz_2);
    var aus = Number(f.auszahlung);
    if (!isFinite(e1) || !isFinite(e2) || !isFinite(aus)) return '';

    /* GERECHNET WIRD AUF DEN GRUNDEINSATZ (Vorgabe: 1000 €), nicht auf
     * abstrakte 100. Die AUFTEILUNG ist bei jedem Betrag dieselbe — nur so
     * zahlen beide Ausgaenge denselben Betrag zurueck. einsatz_1/_2 kommen
     * je 100 aus der Datenbank, skala rechnet sie hoch. */
    var grund = Number((welt.KONFIG || {}).grundEinsatz) || 1000;
    var skala = grund / 100;
    function betrag(x) {
      var n = x * skala;
      return (n >= 1000 ? Math.round(n).toLocaleString('de-AT') : n.toFixed(2)) + ' ' + einheit();
    }
    var gewinn = (aus - 100) * skala;

    /* Wie viel WIRKLICH hineinpasst, steht in max_einsatz (USD, wird in €
     * umgerechnet). Wer 1000 setzen will, wo 140 im Buch liegen, bekommt
     * den Rest nur zu schlechteren Kursen. */
    var deckel = (f.max_einsatz === null || f.max_einsatz === undefined) ? null : inEur(Number(f.max_einsatz));
    var deckelText;
    if (deckel === null) {
      deckelText = '<div class="setz-deckel acht">Wie viel wirklich hineinpasst, ist <b>unbekannt</b> — ' +
        'eines der beiden Bücher nennt keine Menge. Unbekannt heißt nicht unbegrenzt.</div>';
    } else if (deckel < grund) {
      deckelText = '<div class="setz-deckel acht"><b>Achtung:</b> zu diesen Kursen passen nur ' +
        '<b>' + geld(f.max_einsatz) + '</b> hinein (dann ' +
        (f.max_gewinn === null || f.max_gewinn === undefined ? 'Gewinn unbekannt' : '<b>+' + geld(f.max_gewinn) + '</b> Gewinn') +
        '). Die Aufteilung ' + (100 * e1 / (e1 + e2)).toFixed(1) + ' / ' + (100 * e2 / (e1 + e2)).toFixed(1) +
        ' bleibt dieselbe — nur der Betrag schrumpft. Mehr geht nur zu schlechteren Kursen.</div>';
    } else {
      deckelText = '<div class="setz-deckel">Zu diesen Kursen passen <b>' + geld(f.max_einsatz) +
        '</b> hinein — die ' + betrag(100) + ' gehen sich also aus.</div>';
    }

    /* Der Absage-Ausgang, in Geld. Die Zeile, wegen der es diesen ganzen
     * Abschnitt gibt: sie beantwortet "was, wenn WEDER noch eintritt?". */
    var a = absageBilanz(f);
    var absageText = '';
    if (a) {
      var d = a.delta * skala;
      if (a.art === 'sicher') {
        absageText = '<div class="setz-absage gut">Wird abgesagt oder abgebrochen: ' +
          (d > 0.005 ? 'du bekommst sogar <b>+' + betrag(a.delta) + '</b> heraus' : 'du bekommst dein Geld zurück') +
          ' — <b>kein Verlust möglich</b>' +
          (a.belegt ? '.' : ' <i>(gerechnet nach der üblichen Regel; sie steht je Markt — einmal nachlesen)</i>.') +
        '</div>';
      } else if (a.art === 'verlust') {
        var frisst = Math.max(1, Math.round(-d / Math.max(gewinn, 0.01)));
        absageText = '<div class="setz-absage rot"><b>Wird abgesagt, verlierst du ' + betrag(-a.delta) + '.</b> ' +
          'Deshalb zählt diese Zeile NICHT als Chance: ein einziger solcher Verlust frisst ' +
          (frisst === 1 ? 'den ganzen Gewinn einer gewonnenen Wette' : frisst + ' gewonnene Wetten') +
          '. Nicht setzen.</div>';
      } else {
        absageText = '<div class="setz-absage acht"><b>Vor dem Setzen die Absage-Regel dieses Marktes lesen.</b> ' +
          'Eine Seite (' + txt((buch1(f).absage_form === 'einsatz_zurueck' ? buch2(f) : buch1(f)).name) + ') hat keine belegte ' +
          'Rückzahlungsregel — im schlimmsten Fall wertet sie die Wette, während die andere Seite zurückzahlt. ' +
          'Dann wäre bis zu <b>' + betrag(-a.delta) + '</b> weg. ' +
          '<a href="regelwerk.html" target="_blank" rel="noopener">Regelwerk der Bücher</a></div>';
      }
    }

    return '<div class="setz">' +
      '<div class="setz-schritt">' +
        '<span class="setz-nr">1</span>' +
        '<span class="setz-buch ' + txt(b1.chip) + '">' + txt(b1.name) + '</span>' +
        '<span class="setz-geld">' + betrag(e1) + '</span>' +
        '<span class="setz-text">' + tuWas(b1, f.pm_seite, f.mannschaft) + '</span>' +
      '</div>' +
      '<div class="setz-schritt">' +
        '<span class="setz-nr">2</span>' +
        '<span class="setz-buch ' + txt(b2.chip) + '">' + txt(b2.name) + '</span>' +
        '<span class="setz-geld">' + betrag(e2) + '</span>' +
        '<span class="setz-text">' + tuWas(b2, f.bf_seite, f.bf_name) + '</span>' +
      '</div>' +
      '<div class="setz-summe">' +
        'Zusammen <b>' + betrag(100) + '</b> Einsatz. Es gibt genau <b>zwei</b> Ausgänge, ' +
        'und beide zahlen dasselbe: <b>' + betrag(aus) + '</b> zurück — also ' +
        '<b class="' + (gewinn > 0 ? 'gut' : 'rot') + '">' +
        (gewinn >= 0 ? '+' : '') + gewinn.toFixed(2) + ' ' + einheit() + '</b> sicher.' +
      '</div>' +
      deckelText +
      absageText +
    '</div>';
  }

  function abschnitt(name, inhalt, klasse) {
    if (!inhalt) return '';
    return '<div class="ab ' + (klasse || '') + '">' +
             '<div class="ab-kopf">' + txt(name) + '</div>' + inhalt +
           '</div>';
  }

  /* ════════════════════════════════════════════════════════════════════
     FRISTEN — was gemessen ist und was nicht (Stand 15.08.2026)
     ════════════════════════════════════════════════════════════════════
     Nachgemessen an 59 Live-Zeilen:
       endet_am    liegt bei 59 von 59 vor
       beginnt_am  liegt bei 39 von 59 vor, IMMER gleich endet_am
     Die Werte sind runde Zeiten (13:30, 14:00) — das sind ANPFIFFE.
     Der Name "endet_am" taeuscht: die Spalte haelt den Anpfiff, nicht
     das Spielende. Die echte AUFLOESUNGSZEIT steht nirgends in der
     Datenbank.

     Deshalb wird hier getrennt:
       "Letzter Einsatz" = harte Zahl aus der Datenbank.
       "Auflösung"       = SCHAETZUNG, und zwar nur fuer Fussball, wo die
                           Dauer bekannt ist (~2 h mit Halbzeit und
                           Nachspiel). Ueberall sonst steht ehrlich
                           "nicht hinterlegt".
     Eine erfundene Frist waere hier besonders gefaehrlich: es geht um
     die Frage, ob man noch setzen darf.
     ════════════════════════════════════════════════════════════════════ */
  var SPIELDAUER_MIN = { fussball: 120 };

  function fristenZeile(f, imVerlauf) {
    var anpfiff = Date.parse(f.beginnt_am || f.endet_am || '');
    if (!isFinite(anpfiff)) {
      return '<div class="fristen fehlt">' +
               '<span class="fr-block">' +
                 '<span class="fr-name">Einsatz bis</span>' +
                 '<span class="fr-wert">nicht hinterlegt</span>' +
                 '<span class="fr-dazu">kein Buch nennt einen Anpfiff</span>' +
               '</span>' +
             '</div>';
    }

    var jetzt = Date.now();
    var restMin = Math.round((anpfiff - jetzt) / 60000);
    var zustand = imVerlauf ? 'alt' : (restMin < 0 ? 'zu' : (restMin <= 15 ? 'knapp' : 'offen'));

    var einsatzText;
    if (imVerlauf)        einsatzText = 'vorbei';
    else if (restMin < 0) einsatzText = 'nicht mehr möglich';
    else                  einsatzText = 'noch ' + bis(f.beginnt_am || f.endet_am);

    /* Wann kommt das Geld zurueck? Nur schaetzen, wo die Spieldauer
     * wirklich bekannt ist. Die Boerse zahlt aus, sobald sie den Markt
     * abrechnet — wie lange DAS dauert, ist nicht gemessen und wird
     * deshalb auch nicht als Zahl behauptet. */
    var dauer = SPIELDAUER_MIN[f.bereich];
    var zurueckText, zurueckDazu, sicherheit;
    if (dauer) {
      zurueckText = '≈ ab ' + uhrzeit(new Date(anpfiff + dauer * 60000).toISOString());
      zurueckDazu = 'Spielende geschätzt, dann rechnet die Börse ab';
      sicherheit = ' geschaetzt';
    } else {
      zurueckText = 'nicht hinterlegt';
      zurueckDazu = 'keine Spieldauer für diesen Bereich bekannt';
      sicherheit = ' unbekannt';
    }

    return '<div class="fristen ' + zustand + '">' +
      '<span class="fr-block">' +
        '<span class="fr-name">Einsatz bis</span>' +
        '<span class="fr-wert">' + txt(uhrzeit(f.beginnt_am || f.endet_am)) + '</span>' +
        '<span class="fr-dazu">' + txt(einsatzText) + '</span>' +
      '</span>' +
      '<span class="fr-block">' +
        '<span class="fr-name">Geld zurück</span>' +
        '<span class="fr-wert' + sicherheit + '">' + txt(zurueckText) + '</span>' +
        '<span class="fr-dazu">' + txt(zurueckDazu) + '</span>' +
      '</span>' +
    '</div>';
  }

  function zeitZeile(was, wann, dazu, quelle) {
    return '<div class="zt">' +
      '<span class="zt-was">' + txt(was) + '</span>' +
      '<span class="zt-wann">' + txt(wann) + '</span>' +
      '<span class="zt-dazu">' + txt(dazu) + '</span>' +
      '<span class="zt-quelle">' + (quelle ? txt(quelle) : '') + '</span>' +
    '</div>';
  }

  /* ---------- WANN ---------- (Wunsch vom 13.8.2026)
   *
   * Drei verschiedene Zeitpunkte, die bis dahin auf der Karte durcheinander
   * gingen: wann WIR den Fund gesehen haben, wann das EREIGNIS anfaengt und
   * wann die WETTE endet.
   *
   * Der Anpfiff kommt aus dem Gegenbuch (Betfair marketStartTime, Smarkets
   * start_datetime) und wird in der Datenbank nachgetragen. Polymarkets
   * gameStartTime ist dafuer gemessen unbrauchbar: nur 78 von 594
   * Fussballmaerkten tragen ihn, und er widerspricht teils dem Wettende.
   * Nennt ihn kein Buch, steht hier "nicht angegeben" — nicht geraten.
   *
   * GEMESSEN dazu: bei 59 von 64 Zeilen liegt das WETTENDE innerhalb einer
   * Stunde am Anpfiff. Polymarket schliesst den Markt also zum Anpfiff, nicht
   * zum Abpfiff. Wo das so ist, steht es ausdruecklich dabei — sonst liest
   * man zwei Zeilen und haelt sie fuer zwei verschiedene Termine. */
  function zeitenBlock(f, imVerlauf) {
    var z = '';
    z += zeitZeile('Gefunden', zeitpunkt(f.zuerst_gesehen), 'vor ' + seit(f.zuerst_gesehen), '');

    /* Die Zahl, die vor dem Setzen zählt (Vorgabe 17.8.): wann hat der
     * Scanner BEIDE Seiten zuletzt genau so gesehen. */
    if (f.zuletzt_gesehen) {
      z += zeitZeile('Zuletzt bestätigt', zeitpunkt(f.zuletzt_gesehen), 'vor ' + seit(f.zuletzt_gesehen),
                     'der Scanner hat beide Seiten zuletzt so gesehen');
    }

    var anpfiff = Date.parse(f.beginnt_am || '');
    if (isFinite(anpfiff)) {
      var laeuft = anpfiff <= Date.now();
      z += zeitZeile('Anpfiff', zeitpunkt(f.beginnt_am),
                     laeuft ? 'läuft seit ' + seit(f.beginnt_am) : 'in ' + bis(f.beginnt_am),
                     f.beginnt_quelle ? 'laut ' + f.beginnt_quelle : '');
    } else {
      z += zeitZeile('Anpfiff', 'nicht angegeben', 'kein Buch nennt ihn', '');
    }

    var ende = Date.parse(f.endet_am || '');
    var gleich = isFinite(anpfiff) && isFinite(ende) && Math.abs(ende - anpfiff) < 90 * 60000;
    z += zeitZeile('Wette endet', zeitpunkt(f.endet_am),
                   isFinite(ende) && ende < Date.now() ? 'vorbei' : 'in ' + bis(f.endet_am),
                   gleich ? 'entspricht dem Anpfiff' : '');

    if (imVerlauf && f.vorbei_seit) {
      z += zeitZeile('Beendet', zeitpunkt(f.vorbei_seit), 'vor ' + seit(f.vorbei_seit),
                     f.vorbei_grund ? String(f.vorbei_grund) : '');
    }
    return z;
  }

  /* ---------- WARNUNGEN ----------
   * Alles, was gegen die Zeile spricht, an EINER Stelle statt verstreut
   * zwischen den Chips. Ist nichts da, steht hier auch nichts. */
  function warnungen(f) {
    var w = [];
    if (f.fehlpaarung) {
      w.push('<span class="chip rot" title="Die Titel beider Seiten teilen kein einziges unterscheidendes Wort. Das ist die Fehlerklasse der Faelle vom 10. und 11.08. — dort stand die Zuordnung ebenfalls auf 1,00.">FEHLPAARUNG? kein gemeinsames Wort</span>');
    }
    if (f.veraltet) w.push('<span class="chip rot">Kurse veraltet</span>');
    /* Die Default-Nachprüfung (früher Funker) schlägt Alarm, wenn die
     * unabhängige Zweitrechnung der gespeicherten Zeile widerspricht. */
    if (f.nachpruefung && f.nachpruefung.pruefbar &&
        f.nachpruefung.abweichungen && f.nachpruefung.abweichungen.length) {
      w.push('<span class="chip rot" title="' + txt(f.nachpruefung.abweichungen.join(' · ')) +
             '">RECHNUNG WEICHT AB — unabhängige Nachrechnung widerspricht</span>');
    }
    /* Bedingung 6: unplausibel hoch. Gemessen an 26 geprueften Zeilen —
     * richtig 2,07 bis 3,27 Prozent, falsch ueber 4,48, JEDE Zeile ueber 5
     * war ein Kleber oder eine Fehlpaarung. */
    var K1 = welt.KONFIG || {};
    var rMax = Math.max(Number(f.rendite) || 0, Number(f.beste_rendite) || 0);
    if (K1.maxPlausibel && rMax > K1.maxPlausibel) {
      w.push('<span class="chip rot" title="Zwei Boersen mit echten Teilnehmern liegen nicht so weit auseinander. Gemessen: jede Zeile ueber 5 Prozent war bisher ein stehengebliebener Kurs oder eine Fehlpaarung - hier widersprechen sich die Buecher, und eines von beiden ist alt. Keine Chance, nicht setzen.">' +
        'UNPLAUSIBEL HOCH — Bücher widersprechen sich, eines klebt</span>');
    }
    if (f.zu_duenn) {
      w.push('<span class="chip rot" title="Der beste Kurs im Orderbuch traegt fast kein Volumen. Rendite ohne Menge ist keine Chance.">zu dünn — max. ' +
        (f.max_einsatz == null ? '?' : Number(f.max_einsatz).toFixed(2)) + ' Einsatz</span>');
    }
    /* Stimmigkeitsprobe des Gegenbuchs, seit 13.8.2026. Siehe die Erklaerung
     * an orion_zeiten_stimmigkeit() in der Datenbank. */
    if (f.buch_summe !== null && f.buch_summe !== undefined && Number(f.buch_summe) < 1) {
      w.push('<span class="chip rot" title="Die Summe der Gegenwahrscheinlichkeiten aller Ausgaenge dieses Marktes liegt unter 1,00. Dann koennte man bei diesem einen Buch alle Ausgaenge gleichzeitig backen und sicher gewinnen - das gibt es nicht. Also ist der Schnappschuss dieses Marktes in sich unstimmig, meist weil ein Kurs stehengeblieben ist. Gemessen am 13.8.: solche Zeilen zeigen fuenfmal so oft ueber 2 Prozent wie stimmige.">' +
        'Gegenbuch unstimmig (' + Number(f.buch_summe).toFixed(4) + ')</span>');
    }
    /* Deckung: die beiden Seiten muessen nachweislich GEGENSAETZLICHE
     * Ausgaenge decken. Wenn nicht, ist es keine Absicherung — die rote
     * Erklaerung dazu steht gross in der Gegenprobe weiter unten. */
    if (!istGedeckt(f)) {
      w.push('<span class="chip rot" title="Beide Seiten zahlen im selben Fall - oder eine Seite laesst sich nicht einordnen. Das ist keine Absicherung, sondern doppeltes Risiko. Details unter Beide Ausgaenge.">NICHT GEDECKT — keine Chance</span>');
    }
    /* Der Absage-Ausgang als Warnung, wenn er Geld kostet oder offen ist.
     * Die Rechnung dazu steht ausfuehrlich in "So setzt du". */
    var ab = f.absage;
    if (ab && ab.art === 'verlust') {
      w.push('<span class="chip rot" title="Wird die Partie abgesagt oder abgebrochen, kostet diese Zeile rechnerisch Geld - die Rueckzahlungsregeln der beiden Buecher passen nicht zusammen. Details im Abschnitt So setzt du.">' +
        'Bei Absage VERLUST — keine Chance</span>');
    } else if (ab && ab.art === 'unbekannt') {
      w.push('<span class="chip acht" title="Eine Seite hat keine belegte Rueckzahlungsregel. Vor dem Setzen die Regel dieses Marktes lesen - Details im Abschnitt So setzt du.">' +
        'Absage-Regel je Markt prüfen</span>');
    }
    if (K1.bewaehrungS && Number(f.rendite) >= K1.mindestRendite &&
        (Date.parse(f.zuletzt_gesehen) - Date.parse(f.zuerst_gesehen)) < K1.bewaehrungS * 1000 &&
        f.status !== 'vorbei') {
      w.push('<span class="chip acht" title="Frisch gefunden - die Zeile muss erst mehrere Scanner-Laeufe ueberleben, bevor sie Chance heisst. Kleber sterben binnen Sekunden; was die Bewaehrung uebersteht, ist belastbar.">IN PRÜFUNG — ' +
        Math.max(0, Math.ceil((K1.bewaehrungS * 1000 - (Date.parse(f.zuletzt_gesehen) - Date.parse(f.zuerst_gesehen))) / 1000)) + ' s Bewährung offen</span>');
    }
    if (!w.length) return '';
    return '<div class="warnzeile">' + w.join(' ') + '</div>';
  }

  /* Welche Karten sind aufgeklappt? Muss ueber das Neuzeichnen hinweg
   * erhalten bleiben — die Anzeige schreibt jede Sekunde neu, und ein
   * Aufklapper, der dabei zufaellt, ist schlimmer als keiner. */
  var aufgeklappt = {};
  /* Klick IRGENDWO auf eine ZUGEKLAPPTE Karte oeffnet die vollstaendige
   * Rechnung (Vorgabe 13.8. nachts). Knoepfe, Links und Eingaben bleiben
   * davon unberuehrt; geschlossen wird ueber die Aufklappzeile. */
  document.addEventListener('click', function (ev) {
    var fund = ev.target && ev.target.closest ? ev.target.closest('.fund') : null;
    if (!fund) return;
    if (ev.target.closest('a, button, summary, input, select, label, details[open]')) return;
    var d = fund.querySelector('details.voll');
    if (!d || d.open) return;
    d.open = true;
    var s = d.querySelector('summary');
    if (s) aufgeklappt[s.getAttribute('data-schluessel')] = true;
  });
  document.addEventListener('click', function (ev) {
    var s = ev.target && ev.target.closest ? ev.target.closest('summary[data-schluessel]') : null;
    if (!s) return;
    var k = s.getAttribute('data-schluessel');
    if (aufgeklappt[k]) delete aufgeklappt[k]; else aufgeklappt[k] = true;
  });

  /* ---------- Der Rechenweg — zum Selbst-Nachrechnen (Vorgabe 17.8.) ----------
   * des Auftraggebers Ansage: „dass wir das auch nachrechnen können." Hier wird
   * NICHTS neu gerechnet: jede Zahl steht in der Zeile oder kommt aus
   * denselben Helfern wie die übrige Anzeige. Angezeigt wird gerundet —
   * wer nachtippt und in der letzten Stelle abweicht, sieht Rundung,
   * keinen Fehler. */
  /* Die Formel je Seite, mit den ECHTEN Zahlen eingesetzt — des Auftraggebers
   * Stichrechnung (17.8. abends). Beim Dagegenhalten (Lay) in seiner
   * Schreibweise mit dem Risikofaktor:
   *   Risikofaktor = Quote − 1 · Effektivquote = 1 + (1 − Gebühr) ÷ Risikofaktor
   * Ohne Gebühr ist das exakt seine Form „1/Risikofaktor + 1". Die
   * Effektivquote selbst kommt weiter aus rechnung.js — hier wird nur
   * ihr Weg gezeigt, nichts Neues entschieden. */
  function formelSeite(info, seiteText, roh, satz, qeText) {
    var s = Number(satz); if (!isFinite(s) || s < 0) s = 0;
    var st = String(seiteText || '').toUpperCase();
    var n = Number(roh);
    if (info.art === 'preis') {
      if (!(n > 0 && n < 1)) return '';
      var anteil = s * n * (1 - n);
      return 'Gebührenanteil = Satz × Preis × (1 − Preis) = ' + (s * 100).toFixed(1) + ' % × ' +
             n.toFixed(3) + ' × ' + (1 - n).toFixed(3) + ' = ' + anteil.toFixed(4) +
             ' → Effektivquote = (1 − ' + anteil.toFixed(4) + ') ÷ ' + n.toFixed(3) + ' = ' + qeText;
    }
    if (!(n > 1)) return '';
    if (st === 'LAY') {
      return 'Risikofaktor = Quote − 1 = ' + (n - 1).toFixed(2) +
             ' → Effektivquote = 1 + (1 − Gebühr) ÷ Risikofaktor = 1 + ' + (1 - s).toFixed(2) +
             ' ÷ ' + (n - 1).toFixed(2) + ' = ' + qeText;
    }
    return 'Effektivquote = 1 + (Quote − 1) × (1 − Gebühr) = 1 + ' + (n - 1).toFixed(2) +
           ' × ' + (1 - s).toFixed(2) + ' = ' + qeText;
  }

  function rechenweg(f) {
    var b1 = buch1(f), b2 = buch2(f);
    var qe1 = qeEins(f), qe2 = qeZwei(f);
    var inv = Number(f.inv), r = Number(f.rendite);
    var g1 = Number(f.pm_gebuehr) * 100, g2 = Number(f.bf_gebuehr) * 100;
    var K2 = welt.KONFIG || {};
    var f1 = formelSeite(b1, f.pm_seite, f.pm_preis, f.pm_gebuehr, qe1);
    var f2 = formelSeite(b2, f.bf_seite, f.bf_quote, f.bf_gebuehr, qe2);
    var z = '<ol class="leise rechenweg">';
    z += '<li>' + txt(b1.name) + ' — ' + wertName(b1) + ' <b>' + wertText(b1, f.pm_preis) + '</b>' +
         ', Gebühr <b>' + (isFinite(g1) ? g1.toFixed(1) : '?') + ' %</b> → Effektivquote <b>' + qe1 + '</b>' +
         (f1 ? '<br><span class="formel">' + f1 + '</span>' : '') + '</li>';
    z += '<li>' + txt(b2.name) + ' — ' + wertName(b2) + ' <b>' + wertText(b2, f.bf_quote) + '</b>' +
         ', Gebühr <b>' + (isFinite(g2) ? g2.toFixed(1) : '?') + ' %</b> → Effektivquote <b>' + qe2 + '</b>' +
         (f2 ? '<br><span class="formel">' + f2 + '</span>' : '') + '</li>';
    z += '<li>Kehrwertsumme: 1/' + qe1 + ' + 1/' + qe2 + ' = <b>' +
         (isFinite(inv) ? inv.toFixed(4) : '?') + '</b></li>';
    z += '<li>Rendite: (1 / ' + (isFinite(inv) ? inv.toFixed(4) : '?') + ' − 1) × 100 = <b>' +
         (isFinite(r) ? ((r >= 0 ? '+' : '') + r.toFixed(2)) : '?') + ' %</b> — nach allen Gebühren</li>';
    if (fxKurs) {
      z += '<li>Geldbeträge: immer BEIDE Währungen — Euro zuerst (EZB-Kurs <b>' +
           Number(fxKurs.kurs).toFixed(4) + '</b>, Stand ' + txt(fxKurs.stand) +
           '), der Dollar-Ursprungsbetrag in Klammern. Polymarket und Kalshi führen $, ' +
           'Betfair/Orbit und Smarkets führen bei dir €.</li>';
    } else {
      z += '<li>Kein Wechselkurs verfügbar — alle Geldbeträge stehen ehrlich in $.</li>';
    }
    z += '</ol>';
    if (K2.externerRechner) {
      z += '<div class="unter leise">Extern gegenprüfen: <a href="' + txt(K2.externerRechner) +
           '" target="_blank" rel="noopener">Surebet-Rechner (BetBurger)</a> — dort die beiden Effektivquoten ' +
           qe1 + ' und ' + qe2 + ' als Quoten eintragen und die Gebühr auf 0 stellen (sie steckt hier schon drin).</div>';
    }
    return z;
  }

  /* ---------- KOPIEREN STATT RECHNUNGSNUMMER (des Auftraggebers Befehl 17.08. nachts) --
   * Ein Knopf je Karte kopiert den KOMPLETTEN Gedankengang als Text in die
   * Zwischenablage: Spiel, Anbieter, Links, Kurse, Gebühren, Effektivquoten
   * samt Formeln, Kehrwertsumme, Rendite, Einsätze, Zeiten, Absage-Bilanz,
   * Nachprüfung — alles, womit das Ergebnis zustande kam, prüfbar in jedem
   * fremden Programm. Reine Wiedergabe vorhandener Werte, nichts Neues. */
  function kopierText(f) {
    var b1 = buch1(f), b2 = buch2(f);
    var T = '----------------------------------------';
    var z = [];
    function zeile(s) { z.push(s); }
    zeile('ORION PANEL PRO — vollständiger Prüfbericht einer Zeile');
    zeile('Kopiert am ' + zeitpunkt(new Date().toISOString()));
    zeile(T);
    zeile('SPIEL/FRAGE: ' + (f.titel || '?'));
    zeile('Bereich: ' + bereichText(f) + (f.sportart ? ' (Tag: ' + f.sportart + ')' : ''));
    if (f.bf_partie) zeile('Partie beim zweiten Buch: ' + f.bf_partie);
    zeile('Zuordnung (wie sicher dieselbe Partie gemeint ist): ' + Number(f.zuordnung).toFixed(2));
    zeile(T);
    function seite(nr, info, seiteText, roh, satz, satzEcht, menge, kursSeit, link, laeuferName, qeText) {
      zeile('SEITE ' + nr + ' — ' + info.name + ': ' + (seiteText || '') + ' · ' +
            wertName(info) + ' ' + wertText(info, roh));
      if (laeuferName) zeile('  Ausgang: ' + laeuferName);
      zeile('  Gebühr: ' + (Number(satz) * 100).toFixed(1) + ' % ' +
            (satzEcht === true ? '(vom Buch gemessen)' : '(dokumentierter Standardtarif, nicht am Konto gemessen)'));
      zeile('  Effektivquote (nach Gebühr): ' + qeText);
      var fo = formelSeite(info, seiteText, roh, satz, qeText);
      if (fo) zeile('  Formel: ' + fo);
      zeile('  Kurs unverändert seit: ' + (kursSeit ? seit(kursSeit) : 'nicht hinterlegt'));
      zeile('  Handelbare Menge (beste Preisstufe): ' + (menge == null ? 'unbekannt — nicht null!' : geld(menge)));
      zeile('  Link: ' + (link || 'fehlt'));
    }
    seite(1, b1, f.pm_seite, f.pm_preis, f.pm_gebuehr, f.pm_gebuehr_echt, f.pm_menge, f.pm_preis_seit, f.pm_link, f.mannschaft, qeEins(f));
    seite(2, b2, f.bf_seite, f.bf_quote, f.bf_gebuehr, f.bf_gebuehr_echt, f.gegen_menge, f.bf_quote_seit, f.bf_link, f.bf_name, qeZwei(f));
    zeile(T);
    zeile('DIE RECHNUNG (so kam das Ergebnis zustande):');
    zeile('  Kehrwertsumme = 1/' + qeEins(f) + ' + 1/' + qeZwei(f) + ' = ' + Number(f.inv).toFixed(4));
    zeile('  Rendite = (1 / ' + Number(f.inv).toFixed(4) + ' - 1) x 100 = ' +
          (Number(f.rendite) >= 0 ? '+' : '') + Number(f.rendite).toFixed(2) + ' % — nach allen Gebühren');
    /* AUFTEILUNG OHNE KURSDREHUNG (19.8.): einsatz_1/_2 sind ANTEILE einer
     * 100er-Basis und damit waehrungsfrei. Vorher lief geld() darueber und
     * drehte die Anteile durch den Wechselkurs — "bei 100 € Einsatz:
     * 38,80 € + 47,20 €" ergab 86 statt 100. Genau die Mischfalle, vor der
     * dieses Projekt sonst warnt: Basis in der einen, Teile in der anderen
     * Waehrung. Jetzt konsequent in $ (der Waehrung der Datenbank), mit dem
     * ausdruecklichen Hinweis, dass die Aufteilung prozentual ist. */
    zeile('  Aufteilung bei 100 $ Einsatz: ' + Number(f.einsatz_1).toFixed(2) + ' $ auf ' + b1.name +
          ', ' + Number(f.einsatz_2).toFixed(2) + ' $ auf ' + b2.name +
          ' (prozentual, gilt in € genauso)');
    zeile('  Auszahlung bei BEIDEN Ausgängen: ' + Number(f.auszahlung).toFixed(2) + ' $ je 100 $ Einsatz');
    zeile('  Max. Einsatz (beide Seiten zusammen): ' + (f.max_einsatz == null ? 'unbekannt' : geld(f.max_einsatz)) +
          ' · tatsächlicher Gewinn: ' + (f.echter_gewinn == null ? 'unbekannt' : geld(f.echter_gewinn)));
    if (f.beste_rendite != null) zeile('  Beste je gesehene Rendite: ' + Number(f.beste_rendite).toFixed(2) + ' %');
    if (f.buch_summe != null) zeile('  Buchprobe Gegenbuch: ' + Number(f.buch_summe).toFixed(4) +
          (Number(f.buch_summe) < 1 ? ' — UNSTIMMIG, ein Kurs klebt vermutlich' : ' — stimmig'));
    if (fxKurs) zeile('  Währung: Dollar-Beträge mit EZB-Kurs ' + Number(fxKurs.kurs).toFixed(4) +
          ' (Stand ' + fxKurs.stand + ') in Euro umgerechnet');
    else zeile('  Währung: kein Wechselkurs verfügbar — Beträge in $');
    zeile(T);
    zeile('ZEITEN:');
    zeile('  Gefunden: ' + zeitpunkt(f.zuerst_gesehen) + ' (vor ' + seit(f.zuerst_gesehen) + ')');
    zeile('  Zuletzt bestätigt (beide Seiten so gesehen): ' + zeitpunkt(f.zuletzt_gesehen) +
          ' (vor ' + seit(f.zuletzt_gesehen) + ')');
    zeile('  Anpfiff: ' + (f.beginnt_am ? zeitpunkt(f.beginnt_am) +
          (f.beginnt_quelle ? ' (laut ' + f.beginnt_quelle + ')' : '') : 'kein Buch nennt ihn'));
    zeile('  Wette endet: ' + (f.endet_am ? zeitpunkt(f.endet_am) : 'nicht hinterlegt') +
          ' — Achtung: das ist meist der Anpfiff, nicht das Spielende');
    if (f.vorbei_seit) zeile('  Beendet: ' + zeitpunkt(f.vorbei_seit) +
          (f.vorbei_grund ? ' (' + f.vorbei_grund + ')' : ''));
    zeile(T);
    if (f.absage === undefined) f.absage = absageBilanz(f);
    zeile('ABSAGE-BILANZ (der dritte Ausgang): ' + (!f.absage ? 'nicht berechenbar' :
          f.absage.art === 'sicher' ? 'kostet nichts — Rückzahlungsregeln belegt' :
          f.absage.art === 'verlust' ? 'KOSTET GELD — die Rückzahlungsregeln der Bücher passen nicht zusammen' :
          'nicht voll belegt — die Regel des Marktes VOR dem Setzen lesen'));
    var n = f.nachpruefung;
    if (n && n.pruefbar) {
      zeile('UNABHÄNGIGE NACHRECHNUNG (dieselben Formeln, zweiter Weg): ' +
            (n.abweichungen && n.abweichungen.length
              ? 'WEICHT AB — ' + n.abweichungen.join(' · ')
              : 'deckt sich — Rendite, Kehrwertsumme, beide Einsätze, Auszahlung (Toleranz 0,005)'));
    }
    zeile('Extern nachrechnen: ' + ((welt.KONFIG && welt.KONFIG.externerRechner) || '') +
          ' — beide Effektivquoten als Quoten eintragen, Gebühr dort 0 (steckt schon drin).');
    if (f.nr) zeile('Interne Nummer der Zeile: #' + f.nr);
    return z.join('\n');
  }

  function fundFinden(schluessel) {
    var e = welt.letztesErgebnis;
    if (!e) return null;
    var listen = [e.chancen, e.veraltetHoch, e.knapp, e.knappArchiv, e.verlauf, e.falsch];
    for (var i = 0; i < listen.length; i++) {
      var L = listen[i] || [];
      for (var j = 0; j < L.length; j++) {
        if (L[j] && L[j].schluessel === schluessel) return L[j];
      }
    }
    return null;
  }

  document.addEventListener('click', function (ev) {
    var kn = ev.target && ev.target.closest ? ev.target.closest('button.kopier') : null;
    if (!kn) return;
    ev.preventDefault();
    ev.stopPropagation();
    var f = fundFinden(kn.getAttribute('data-schluessel'));
    if (!f) { kn.textContent = 'Zeile nicht mehr da'; return; }
    var text = kopierText(f);
    /* Zweiter Weg, falls die Clipboard-Schnittstelle gesperrt ist
     * (eingebettete Browser, http statt https): unsichtbares Textfeld
     * plus execCommand — funktioniert auf Nutzergeste praktisch überall.
     * KEIN prompt/alert: die gibt es nicht in jeder Umgebung. */
    function vonHand() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e) { return false; }
    }
    function meldung(t) {
      kn.textContent = t;
      setTimeout(function () { kn.textContent = 'Kopieren'; }, 1800);
    }
    var ablage = (navigator.clipboard && navigator.clipboard.writeText)
      ? navigator.clipboard.writeText(text) : Promise.reject(new Error('keine Zwischenablage'));
    ablage.then(function () { meldung('Kopiert ✓'); })
      .catch(function () { meldung(vonHand() ? 'Kopiert ✓' : 'Blockiert — nochmal versuchen'); });
  });

  /* Der grüne Haken der Default-Nachprüfung. Eine ABWEICHUNG steht nicht
   * hier, sondern ROT in den Warnungen — Gutes leise, Schlechtes laut. */
  function nachChip(f) {
    var n = f.nachpruefung;
    if (!n || !n.pruefbar || (n.abweichungen && n.abweichungen.length)) return '';
    return '<span class="chip gut" title="Automatisch unabhängig nachgerechnet (früher der Funker auf Befehl, seit 17.08. Standard bei jedem Takt): Rendite, Kehrwertsumme, beide Einsätze und Auszahlung decken sich mit der gespeicherten Zeile (Toleranz 0,005).">✓ nachgerechnet</span> ';
  }

  function karte(f, imVerlauf) {
    /* Eine Chance ist eine Zeile, die GELD bringt — nicht eine mit guter
     * Prozentzahl. Dieselben Bedingungen wie in daten.js, seit dem 13.8.
     * einschliesslich der Absage-Probe: was bei Absage Geld kostet, ist
     * keine Chance (KONFIG.absageStreng). */
    var K0 = welt.KONFIG;
    if (f.absage === undefined) f.absage = absageBilanz(f);
    var chance = f.rendite >= K0.mindestRendite && !f.zu_duenn &&
                 !(K0.maxPlausibel && f.rendite > K0.maxPlausibel) &&
                 f.echter_gewinn !== null && f.echter_gewinn >= K0.mindestGewinn &&
                 !(K0.absageStreng && f.absage && f.absage.art === 'verlust') &&
                 !(K0.bewaehrungS && (Date.parse(f.zuletzt_gesehen) - Date.parse(f.zuerst_gesehen)) < K0.bewaehrungS * 1000) &&
                 istGedeckt(f);
    /* DER RENDITERING IST WIEDER RAUS (15.8.). Er zeigte die Rendite als
     * Kreisanteil, aber die Zahl steht ohnehin einen Zentimeter daneben
     * im Klartext — er wiederholte sie nur schlechter. Ohne Beschriftung
     * war er nicht lesbar; bei niedriger Rendite sah man fast nur die
     * blasse Leerspur und hielt ihn fuer einen weissen Fleck.
     *
     * Die EINE Aussage, die er hatte, bleibt erhalten: ueber 5 % faerbt
     * sich die Renditezahl selbst um. Messung vom 13.08.2026 — alle
     * nachweislich richtigen Funde lagen zwischen 2,07 und 3,27 %, alle
     * falschen ueber 4,48 %. Eine hohe Zahl ist hier ein Warnzeichen. */
    var rendWert = imVerlauf && f.beste_rendite != null ? f.beste_rendite : f.rendite;
    rendWert = Number(rendWert);
    if (!isFinite(rendWert)) rendWert = 0;
    var unplausibel = rendWert >= 5;

    return '' +
      '<div class="fund' + (chance && !imVerlauf ? ' chance' : '') + (imVerlauf ? ' alt' : '') +
           (unplausibel ? ' rendite-verdacht' : '') + '"' +
           /* Der Schluessel steht seit 16.8. auch an der KARTE: daran haelt
            * sich die Scroll-Verankerung fest, wenn die Liste neu
            * geschrieben wird (siehe listeSetzen ganz oben). */
           ' data-schluessel="' + txt(f.schluessel) + '"' +
           ' data-rendite="' + rendWert.toFixed(2) + '">' +
        '<div class="kopfzeile">' +
          /* Die Rendite DIREKT neben dem Titel (Vorgabe 13.8.): man soll die
           * Zahl sehen, ohne die Zeile darunter lesen zu muessen. Im Verlauf
           * steht die BESTE, denn dort ist das die Frage. */
          '<div class="titel">' + txt(f.titel) +
            ' <span class="titel-rendite' + (chance && !imVerlauf ? ' gut' : '') + '">(' +
            (function () {
              var r = imVerlauf && f.beste_rendite != null ? f.beste_rendite : f.rendite;
              return (r >= 0 ? '+' : '') + Number(r).toFixed(2) + ' %';
            })() + ')</span></div>' +
          /* Uhrzeit oben rechts: WANN dieser Eintrag entstanden ist.
           * Nicht die letzte Sichtung, sondern die erste — das ist die Frage
           * "seit wann gibt es das", nicht "wann habe ich zuletzt hingesehen". */
          /* Zwei Zeiten, zwei Fragen (Vorgabe 17.8.): "vor X" = seit wann
           * es diese Chance gibt; "bestätigt vor Y" = wann der Scanner
           * BEIDE Seiten zuletzt genau so gesehen hat. Die zweite Zahl
           * ist die, die vor dem Setzen zählt. */
          '<div class="stempel" title="Zuerst gesehen am ' + txt(zeitpunkt(f.zuerst_gesehen)) +
               (imVerlauf ? '' : ' · zuletzt bestätigt am ' + txt(zeitpunkt(f.zuletzt_gesehen))) + '">' +
            uhrzeit(f.zuerst_gesehen) +
            (imVerlauf ? '<span class="stempel-zwei">beendet ' + uhrzeit(f.vorbei_seit) + '</span>'
                       : '<span class="stempel-zwei">vor ' + seit(f.zuerst_gesehen) +
                         ' · bestätigt vor ' + seit(f.zuletzt_gesehen) + '</span>') +
          '</div>' +
        '</div>' +

        /* FRISTENZEILE (15.8.) — auf JEDER Karte sichtbar, nicht erst im
         * aufgeklappten Teil. Zwei Fragen, die vor dem Setzen zaehlen:
         * bis wann kann ich ueberhaupt noch setzen, und wann weiss ich,
         * ob es aufgegangen ist. */
        fristenZeile(f, imVerlauf) +

        /* Kurzzeile: nur, was man zum EINORDNEN braucht. Alles Weitere hat
         * jetzt einen eigenen Abschnitt. */
        '<div class="unter">' +
          /* Statt der Rechnungsnummer (17.8. nachts): der Kopieren-Knopf.
           * Die Nummer lebt nur noch IM kopierten Bericht weiter. */
          '<button type="button" class="chip kopier" data-schluessel="' + txt(f.schluessel) +
            '" title="Kopiert den kompletten Gedankengang dieser Zeile als Text: Spiel, Anbieter, Links, Kurse, Gebühren, Effektivquoten samt Formeln, Rendite, Einsätze, Zeiten, Absage-Bilanz — zum Prüfen in jedem anderen Programm.">Kopieren</button> ' +
          /* SPEICHERN (20.8.): legt den Schnappschuss der Zeile in
           * orion_gespeichert ab — nachsehen auf gespeichert.html.
           * Der Klick-Zuhoerer sitzt in js/speicher.js. */
          '<button type="button" class="chip speich" data-schluessel="' + txt(f.schluessel) +
            '" title="Merkt sich diesen Fund als Schnappschuss — auf jedem Gerät abrufbar unter „Gespeichert“. Die Kurse darin bleiben die vom Moment des Speicherns.">☆ Speichern</button> ' +
          nachChip(f) +
          '<span class="chip ' + txt(buch1(f).chip) + '">' + txt(buch1(f).name) + '</span> ' +
          '<span class="chip leise">gegen</span> ' +
          '<span class="chip ' + txt(buch2(f).chip) + '">' + txt(buch2(f).name) +
            (buch2(f).konto ? ' · ' + txt(buch2(f).konto) : '') + '</span> ' +
          '<span class="chip" title="Tag: ' + txt(f.sportart) + '">' + txt(bereichText(f)) + '</span> ' +

          /* Das Geld gleich vorne, nicht erst in der Analyse: was zu diesen
           * Kursen WIRKLICH herauszuholen ist (Menge im Buch x Rendite). */
          (f.echter_gewinn === null || f.echter_gewinn === undefined ? '' :
            '<span class="chip' + (chance ? ' gut' : '') +
            '" title="Was zu diesen Kursen wirklich herauszuholen ist: handelbare Menge mal Rendite. Die Rechnung auf den Grundeinsatz steht unter So setzt du.">holbar ' +
            (f.echter_gewinn >= 0 ? '+' : '') + geld(f.echter_gewinn) + '</span> ') +
          /* 'beste' nur, wenn sie etwas ANDERES sagt als die Rendite im
           * Titel - dieselbe Zahl zweimal ist Laerm. */
          (f.beste_rendite != null && Math.abs(Number(f.beste_rendite) - Number(f.rendite)) > 0.01
            ? '<span class="chip" title="Die hoechste je gesehene Rendite dieser Zeile">beste ' + Number(f.beste_rendite).toFixed(2) + ' %</span> '
            : '') +
          '<span class="chip' + (Number(f.zuordnung) >= 0.99 ? ' gut' : ' acht') + '">Zuordnung ' + Number(f.zuordnung).toFixed(2) + '</span>' +
        '</div>' +
        warnungen(f) +
        /* Die Knöpfe stehen OBEN, nicht am Ende. Vorher musste man an jeder
         * Karte vorbeiscrollen, um den Link zu finden — bei einer Karte, die
         * eine Bildschirmhöhe füllt, ist das der Unterschied zwischen
         * benutzbar und nicht benutzbar. */
        aktionen(f) +
        /* KOMPAKT ALS NORMALFALL (Vorgabe 13.8. nachts: man scrollt zu
         * lange). Die zwei Kopfzeilen tragen alles zum EINORDNEN; die
         * vollstaendige Rechnung klappt auf und bleibt ueber das
         * 2-Sekunden-Neuzeichnen hinweg offen (gleiche Merkliste wie der
         * innere Aufklapper). */
        '<details class="voll"' + (aufgeklappt['@voll:' + f.schluessel] ? ' open' : '') + '>' +
          '<summary data-schluessel="@voll:' + txt(f.schluessel) + '">Vollständige Rechnung ' +
            '<span class="leise">(so setzt du, Zeiten, Kurse, Gebühren, Prüfungen)</span></summary>' +
        abschnitt('So setzt du', soSetztDu(f), 'ab-setz') +
        abschnitt('Wann', zeitenBlock(f, imVerlauf), 'ab-zeit') +
        '<div class="ab"><div class="ab-kopf">Die zwei Kurse, aus denen das entsteht</div>' +
        '<div class="seiten">' +
          '<div class="seite ' + txt(buch1(f).chip) + '">' +
            '<div class="quelle">' + txt(buch1(f).name) + '</div>' +
            '<div class="zahl">' + txt(f.pm_seite) + ' ' + wertText(buch1(f), f.pm_preis) + '</div>' +
            '<div class="leise">' + txt(f.mannschaft) + '</div>' +
            '<div class="leise">' + wertName(buch1(f)) + ' &middot; Effektivquote <b>' + qeEins(f) + '</b></div>' +
            kursStehtZeile(f.pm_preis_seit) +
          '</div>' +
          '<div class="seite ' + txt(buch2(f).chip) + '">' +
            '<div class="quelle">' + txt(buch2(f).name) + '</div>' +
            '<div class="zahl">' + txt(f.bf_seite) + ' ' + wertText(buch2(f), f.bf_quote) + '</div>' +
            '<div class="leise">' + txt(f.bf_name) + '</div>' +
            '<div class="leise">' + wertName(buch2(f)) +
              ' &middot; Effektivquote <b>' + qeZwei(f) + '</b></div>' +
            kursStehtZeile(f.bf_quote_seit) +
          '</div>' +
        '</div></div>' +
        abschnitt('Was dabei herauskommt', renditeText(f) + analyse(f, imVerlauf), 'ab-geld') +
        abschnitt('So wurde gerechnet — zum Nachprüfen', rechenweg(f), 'ab-rechnen') +
        abschnitt('Beide Ausgänge', gegenprobe(f), 'ab-probe') +
        /* Alles, was man erst UNMITTELBAR VOR dem Handeln braucht: Gebuehren,
         * Absageregeln, der Smarkets-Marktwechsel, die Nachkontrolle und die
         * Aufteilung. Zugeklappt, aber vollstaendig — weggelassen wird
         * nichts, es steht nur nicht mehr im Weg. */
        '<details class="mehr"' + (aufgeklappt[f.schluessel] ? ' open' : '') + '>' +
          '<summary data-schluessel="' + txt(f.schluessel) + '">Vor dem Handeln lesen ' +
            '<span class="leise">(Gebühren, Absageregeln, Marktwechsel, Nachkontrolle)</span></summary>' +
          smarketsHinweis(f) +
          gebuehrZeile(f) +
          absageZeile(f) +
          pruefzeile(f) +
          /* Aufteilung OHNE Kursdrehung (19.8.): die Anteile sind
           * waehrungsfrei, siehe Funker-Bericht. */
          '<div class="unter leise">Bei 100 $ Einsatz: ' + Number(f.einsatz_1).toFixed(2) + ' $ auf ' +
            txt(buch1(f).name) + ', ' + Number(f.einsatz_2).toFixed(2) + ' $ auf ' + txt(buch2(f).name) +
            ' (prozentual, gilt in € genauso)' +
            ' &middot; Kehrwertsumme ' + Number(f.inv).toFixed(4) +
            ' (Summe der beiden Gegenwahrscheinlichkeiten; unter 1,0000 heißt: ' +
            'beide Seiten zusammen kosten weniger als die sichere Auszahlung — genau darum geht es)' +
            ' &middot; Partie beim zweiten Buch: ' + txt(f.bf_partie) + '</div>' +
        '</details>' +
        '</details>' +
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
  /* Statt des gruenen Punkts: ein SATELLITEN-EMPFAENGER (Vorgabe 14.8.).
   * Gruen = Schuessel schwenkt und funkt. Rot = Schuessel haengt schief
   * und raucht. Gelb = funkt, aber traege. Aus = abgedeckt. Nur Optik —
   * der Zustand kommt unveraendert aus denselben Messwerten wie vorher. */
  function ampel(zustand) {
    return '<span class="sat ' + zustand + '" aria-hidden="true">' +
      '<svg viewBox="0 0 20 20">' +
        '<path class="sat-fuss" d="M9 18 L11 18 L10.4 13 L9.6 13 Z"/>' +
        '<g class="sat-kopf">' +
          '<path class="sat-schuessel" d="M4 4 A 7 7 0 0 0 12 12 Z"/>' +
          '<line class="sat-arm" x1="8" y1="8" x2="12" y2="4"/>' +
          '<circle class="sat-auge" cx="12.5" cy="3.5" r="1.3"/>' +
        '</g>' +
        '<g class="sat-wellen"><path d="M13 7 q2 1.5 1.5 4"/><path d="M15 5 q3 2.5 2.5 6"/></g>' +
        '<g class="sat-rauch"><circle cx="10" cy="9" r="1.1"/><circle cx="12" cy="6.5" r="1.4"/><circle cx="14" cy="4" r="1.7"/></g>' +
      '</svg></span>';
  }

  /* buchKlasse: das Kennzeichen des Buchs (pm/ka/sm/bf) oder 'supabase' —
   * der Name traegt damit seine Wiedererkennungsfarbe aus der
   * Design-Schicht. Reines Aussehen, keine Logik. */
  function anbieterZeile(name, zustand, aktualitaet, umfang, funde, tempo, hinweis, buchKlasse) {
    return '<tr>' +
      '<td class="an-name"><span class="an-buch ' + txt(buchKlasse || '') + '">' +
        ampel(zustand) + ' ' + txt(name) + '</span></td>' +
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
  /* ---------- Die Paarungsmatrix ----------
   *
   * Vorgabe 13.8.: "16 Kategorien, damit man den Kopf klarer hat." Vier
   * Buecher mal vier Buecher sind sechzehn Felder: die Diagonale ist
   * gesperrt (ein Buch gegen sich selbst ist keine Arbitrage, die Rechnung
   * verweigert das ohnehin), die uebrigen zwoelf sind die gerichteten
   * Paarungen. JEDES Feld steht IMMER an derselben Stelle, auch mit Null —
   * eine Matrix, in der die Felder springen, ist keine Uebersicht.
   *
   * Zeile = das Buch der FUER-Seite, Spalte = das Buch der GEGEN-Seite.
   * Hervorgehoben werden das aktivste Feld und das Feld mit der besten
   * Rendite. Die Daten kommen unveraendert aus orion_uebersicht. */
  var MATRIX_BUECHER = ['polymarket', 'kalshi', 'smarkets', 'betfair'];

  function paarungenZeile(p) {
    p = p || {};
    var K = welt.KONFIG.buecher || {};

    var aktivstes = null, bestes = null;
    MATRIX_BUECHER.forEach(function (a) {
      MATRIX_BUECHER.forEach(function (b) {
        if (a === b) return;
        var x = p[a + ' -> ' + b];
        if (!x) return;
        if (!aktivstes || (x.live || 0) > (p[aktivstes] ? p[aktivstes].live : 0)) {
          if ((x.live || 0) > 0) aktivstes = a + ' -> ' + b;
        }
        if (x.beste != null && (!bestes || Number(x.beste) > Number(p[bestes].beste))) {
          bestes = a + ' -> ' + b;
        }
      });
    });

    var html = '<div class="paarmatrix" title="Zeile: das Buch der FÜR-Seite. Spalte: das Buch der GEGEN-Seite. Zahl: laufende Paare, darunter die beste Rendite des Felds. Die Diagonale ist gesperrt — ein Buch gegen sich selbst ist keine Arbitrage.">' +
      '<div class="pmx-kopf">PAARUNGSMATRIX <span>FÜR ↓ · GEGEN →</span></div>' +
      '<table><tr><th></th>';
    MATRIX_BUECHER.forEach(function (b) {
      html += '<th class="' + txt((K[b] || {}).chip || '') + '" title="' + txt((K[b] || {}).name || b) + '"><i class="buchlogo"></i></th>';
    });
    html += '</tr>';

    MATRIX_BUECHER.forEach(function (a) {
      html += '<tr><th class="' + txt((K[a] || {}).chip || '') + '" title="' + txt((K[a] || {}).name || a) + '"><i class="buchlogo"></i></th>';
      MATRIX_BUECHER.forEach(function (b) {
        if (a === b) { html += '<td class="pmx-sperr">—</td>'; return; }
        var s = a + ' -> ' + b;
        var x = p[s];
        var live = x ? (x.live || 0) : 0;
        var beste = x && x.beste != null ? Number(x.beste) : null;
        var kl = [];
        if (!live) kl.push('pmx-leer');
        if (x && x.chancen > 0) kl.push('pmx-chance');
        if (s === aktivstes) kl.push('pmx-aktiv');
        if (s === bestes && beste !== null && beste >= 2) kl.push('pmx-beste');
        /* Jede Zelle erklaert ihre Zahlen selbst (Vorgabe 15.8.): grosse
         * Zahl = wie viele Paare dieser Richtung GERADE live verglichen
         * werden, kleine Zahl = die beste Rendite darunter. */
        var zellTitel = ((K[a] || {}).name || a) + ' (FÜR) gegen ' + ((K[b] || {}).name || b) + ' (GEGEN): ' +
          (live ? live + (live === 1 ? ' Paar wird' : ' Paare werden') + ' gerade live verglichen' +
                  (beste !== null ? ', das beste rechnet sich auf ' + beste.toFixed(2).replace('.', ',') + ' % Rendite' : '')
                : 'gerade kein gemeinsames Paar in dieser Richtung');
        html += '<td class="' + kl.join(' ') + '" title="' + txt(zellTitel) + '"><b>' + live + '</b>' +
                (beste === null ? '<i>&nbsp;</i>' : '<i>' + beste.toFixed(2) + ' %</i>') + '</td>';
      });
      html += '</tr>';
    });
    html += '</table>' +
      /* Die Erklaerung DIREKT NEBEN der Tafel (Vorgabe 13.8.: keine
       * Riesenluecke, und dazuschreiben, was man sieht). */
      '<div class="pmx-erklaer">' +
        '<b>Lesart:</b> Zeile = das Buch der FÜR-Seite, Spalte = das Buch der ' +
        'GEGEN-Seite. Die große Zahl zählt, wie viele <b>Paare</b> dieser ' +
        'Richtung GERADE live verglichen werden; die kleine ist die beste ' +
        'Rendite dieser Paare. Zeig auf ein Feld, dann sagt es seine Zahlen ' +
        'im Klartext. ' +
        '<b>Paare sind nicht Märkte:</b> Polymarket kann 300 Märkte im Raster ' +
        'haben — ein PAAR entsteht erst, wenn dieselbe Frage auch auf der ' +
        'zweiten Börse existiert (gleiche Partie, gleicher Markt, gleicher ' +
        'Zeitraum, gleicher Bereich) und beide Seiten handelbare Kurse haben. ' +
        'Diese Überlappung ist selten — deshalb sind die Zahlen klein. ' +
        '<b>Warum bei Betfair oft 0 steht:</b> Betfair-Kurse kommen nur von ' +
        'der Bridge auf deinem Heim-PC. Läuft der PC nicht, altern die Kurse, ' +
        'laufende Betfair-Paare enden und neue entstehen nicht — kein ' +
        'frischer Kurs, kein Paar. Das ist Ehrlichkeit, kein Fehler. ' +
        '<b>Die Prozente:</b> negativ heißt, selbst das beste Paar rechnet ' +
        'sich nicht (Normalfall). Auffällig hohe Prozente auf alten ' +
        'Betfair-Kursen sind kein Geschenk, sondern der Beweis, dass die ' +
        'Zahl alt ist — die Chancen-Prüfung wirft genau solche raus. ' +
        'Diagonale gesperrt (ein Buch gegen sich selbst ist keine Arbitrage); ' +
        '<span class="pmx-l1">Khaki-Rand</span> = aktivstes Feld, ' +
        '<span class="pmx-l2">grüner Rand</span> = Feld mit Chance über 2 %.' +
      '</div>' +
      /* Das EMBLEM fuellt den Restraum rechts (Vorgabe 14.8. nachts:
       * "die Luecke wirkt so leer") — reiner Schmuck, Design-Schicht. */
      '<div class="pmx-emblem" aria-hidden="true">' +
        '<svg viewBox="0 0 120 120">' +
          '<circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-width="2"/>' +
          '<circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" stroke-width="1" opacity=".5"/>' +
          '<circle cx="60" cy="60" r="30" fill="none" stroke="currentColor" stroke-width="1" opacity=".35"/>' +
          '<path d="M60 6 v18 M60 96 v18 M6 60 h18 M96 60 h18" stroke="currentColor" stroke-width="2"/>' +
          '<path d="M60 34 L66 52 L84 52 L70 63 L75 81 L60 70 L45 81 L50 63 L36 52 L54 52 Z" fill="currentColor" opacity=".9"/>' +
          '<circle class="pmx-blip" cx="82" cy="42" r="3" fill="currentColor"/>' +
        '</svg>' +
        '<b>OP ORION</b><small>VIER BÖRSEN · EIN RASTER</small>' +
      '</div></div>';
    return html;
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
      var buchInfo = (welt.KONFIG.buecher || {})[r.buch] || {};
      /* Die Zahl hinter dem Namen sind die GELADENEN MAERKTE dieses Buchs
       * (live gemeldet vom Sammler; Rueckfall: gemessener Umfang). Sie
       * traegt jetzt ihr Wort dabei — eine nackte Zahl erklaert nichts. */
      zeilen += anbieterZeile(
        (i === 0 ? '① ' : '') + r.name + ' · ' + r.groesse + ' Märkte',
        r.zustand, r.alter, r.umfang, r.funde, r.tempo,
        (i === 0 ? '<b>kleinstes Buch — die Engstelle</b> · ' : '') + (r.hinweis || ''),
        buchInfo.chip);
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
      'verbunden',
      'supabase');

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
    /* ZWEI KLARE ZEILEN (Vorgabe 14.8. nachts): oben die LAGE, unten die
     * VIER ANBIETER mit ihrem Alter. Jede Kachel traegt eine Erklaerung
     * als Tooltip; der Waechter (die Nachtwache) sagt seine sogar
     * sichtbar dazu, weil sie sich sonst "unerklaert anfuehlt". */
    return [
      /* --- Zeile 1: die Lage --- */
      { name: 'Chancen live', wert: s.chancen, farbe: s.chancen > 0 ? 'var(--gruen)' : 'var(--text-leise)',
        titel: 'Zeilen, die JETZT alle sieben Bedingungen erfüllen — dieselbe Zählung wie auf der Chancen-Karte.' },
      { name: 'Knapp daneben', wert: s.knapp,
        titel: 'Live-Zeilen unter der 2-%-Schwelle. Hängt am Spielplan: nachts wenige, am Fußballabend viele.' },
      { name: 'Im Verlauf', wert: s.verlauf,
        titel: 'Beendete echte Chancen (beste Rendite je über 2 %). Diese Zahl wächst nur.' },
      { name: 'Wächter · Nachtwache', wert: s.wache_alter_s === null ? 'nie' : dauer(s.wache_alter_s),
        farbe: (s.wache_gut === true && s.wache_alter_s !== null && s.wache_alter_s < 1800)
          ? 'var(--gruen)' : 'var(--rot)',
        unter: 'prüft jede Minute die Maschine — auf dem Server, auch ohne Browser',
        titel: 'Die Nachtwache ist der unabhängige Kontrolleur: sie rechnet jede Minute die Zuordnungen nach, ' +
               'repariert Links, beendet Verwaiste, prüft Buchprobe und Anpfiff — serverseitig, rund um die Uhr. ' +
               'Der Wert hier ist ihr Alter: wann sie sich zuletzt gemeldet hat.' },
      /* --- Zeile 2: die vier Anbieter mit ihren Sekunden --- */
      { name: 'Polymarket', wert: dauer(s.lauf_alter_s), farbe: scannerLaeuft ? 'var(--pm)' : 'var(--rot)',
        titel: 'Alter des jüngsten Scanner-Laufs — der Scanner holt Polymarket bei jedem Lauf direkt (Fußball alle 2 Minuten).' },
      { name: 'Kalshi', wert: dauer(s.kalshi_alter_s), farbe: kalshiLaeuft ? 'var(--ka)' : 'var(--rot)',
        titel: 'Alter des Kalshi-Schnappschusses — gesammelt alle 2 Minuten, öffentlich, ohne Konto.' },
      { name: 'Smarkets', wert: dauer(s.smarkets_alter_s), farbe: smarketsLaeuft ? 'var(--sm)' : 'var(--rot)',
        titel: 'Alter des Smarkets-Schnappschusses — gesammelt alle 2 Minuten, öffentlich, ohne Konto.' },
      betfairAn
        ? { name: 'Betfair · Bridge', wert: dauer(s.bf_alter_s), farbe: bridgeLaeuft ? 'var(--bf)' : 'var(--rot)',
            titel: 'Alter der Betfair-Daten von der Bridge auf deinem Heim-PC — lädt normalerweise im Minutentakt hoch.' }
        : { name: 'Betfair', wert: 'aus', farbe: 'var(--text-leise)',
            titel: 'Betfair ist bewusst abgeschaltet — kein Fehler, eine Entscheidung.' }
    ];
  }

  /* Kacheln IN PLACE auffrischen statt alles neu zu schreiben (14.8.):
   * der komplette Neuaufbau alle zwei Sekunden liess jede laufende
   * CSS-Animation von vorn beginnen — das war das Ruckeln. Jetzt wird
   * nur der Text getauscht, der sich wirklich geaendert hat; die
   * geaenderte Zahl bekommt einen kurzen Puls (Klasse frisch). */
  function kachelnSetzen(el, daten) {
    if (!el) return;
    if (el.children.length !== daten.length) {
      el.innerHTML = daten.map(function (k, i) {
        return '<div class="kachel" style="--k-i:' + i + '" title="' + txt(k.titel || '') + '">' +
               '<div class="wert" style="color:' + (k.farbe || 'var(--text)') + '">' + txt(k.wert) +
               '</div><div class="name">' + txt(k.name) + '</div>' +
               '<div class="unter">' + txt(k.unter || '') + '</div></div>';
      }).join('');
      return;
    }
    daten.forEach(function (k, i) {
      var kachel = el.children[i];
      var wert = kachel.children[0], name = kachel.children[1], unter = kachel.children[2];
      var farbe = k.farbe || 'var(--text)';
      if (kachel.getAttribute('title') !== (k.titel || '')) kachel.setAttribute('title', k.titel || '');
      if (wert.getAttribute('style') !== 'color:' + farbe) wert.setAttribute('style', 'color:' + farbe);
      if (name.textContent !== String(k.name)) name.textContent = k.name;
      if (unter && unter.textContent !== String(k.unter || '')) unter.textContent = k.unter || '';
      if (wert.textContent !== String(k.wert)) {
        wert.textContent = k.wert;
        wert.classList.remove('frisch');
        void wert.offsetWidth;               // Animation neu anstossen
        wert.classList.add('frisch');
      }
    });
  }

  /* Welcher Bereich gerade offen ist. Bleibt ueber das Auffrischen hinweg
   * stehen: bei zwei Sekunden Takt waere ein Zuruecksetzen unbenutzbar. */
  var offenerBereich = 'chancen';
  try {
    var gemerkt = localStorage.getItem('orion-bereich');
    if (gemerkt === 'chancen' || gemerkt === 'knapp' || gemerkt === 'verlauf' || gemerkt === 'falsch') offenerBereich = gemerkt;
  } catch (e) { /* Speicher gesperrt, dann eben der Standard */ }

  /* ---------- Ungelesen-Zaehler (Vorgabe 13.8., tief nachts) ----------
   *
   * "Ich seh eine Chance und dann verschwindet sie einfach." Eine Zeile,
   * die in einen anderen Reiter wandert, waehrend man woanders liest, soll
   * dort als UNGELESEN zaehlen — bis man den Reiter oeffnet. Gemerkt wird
   * je Reiter die Menge der gesehenen Schluessel; neu ist, was beim
   * Zeichnen dazukommt, waehrend der Reiter zu ist. Beim ersten Laden wird
   * alles als gesehen gesetzt (sonst waere nach jedem Neuladen alles neu). */
  var gesehen = { chancen: null, knapp: null, verlauf: null, falsch: null };

  function bereichZeigen(name) {
    /* Oeffnen heisst lesen: beim naechsten Zeichnen zaehlt dieser Reiter
     * wieder von null. */
    gesehen[name] = null;
    offenerBereich = name;
    try { localStorage.setItem('orion-bereich', name); } catch (e) {}
    ['chancen', 'knapp', 'verlauf', 'falsch'].forEach(function (b) {
      var el = document.getElementById(b);
      if (el) el.style.display = (b === name) ? '' : 'none';
    });
    var knoepfe = document.querySelectorAll('.reiter-knopf');
    for (var i = 0; i < knoepfe.length; i++) {
      knoepfe[i].classList.toggle('offen', knoepfe[i].getAttribute('data-bereich') === name);
    }
  }

  function reiterZeichnen(e) {
    var listen = { chancen: e.chancen || [], knapp: e.knapp || [],
                   verlauf: e.verlauf || [], falsch: e.falsch || [] };

    /* Ungelesen je Reiter: Schluessel, die seit dem letzten Oeffnen
     * dazugekommen sind. Als GELESEN gilt der offene Reiter nur, wenn die
     * Listen-Seite wirklich offen ist — auf der Uebersicht sammeln ALLE
     * vier Bereiche ihre Neu-Zaehler (Vorgabe 14.8. abends). */
    var aktiv = document.body.classList.contains('ansicht-listen') ? offenerBereich : null;
    var neu = {};
    Object.keys(listen).forEach(function (t) {
      var jetzt = new Set(listen[t].map(function (f) { return f.schluessel; }));
      if (gesehen[t] === null || t === aktiv) { gesehen[t] = jetzt; neu[t] = 0; return; }
      var z = 0;
      jetzt.forEach(function (k) { if (!gesehen[t].has(k)) z++; });
      neu[t] = z;
    });

    /* Die vier grossen Bereichs-Karten der Uebersicht: Gesamtzahl,
     * Ungelesen, Live-Zusatz. */
    var karten = document.querySelectorAll('#bereichs-karten .bereichskarte');
    for (var ci = 0; ci < karten.length; ci++) {
      var kb = karten[ci].getAttribute('data-bereich');
      if (!listen[kb]) continue;
      var zahlEl = karten[ci].querySelector('.bk-zahl');
      var infoEl = karten[ci].querySelector('.bk-info');
      var zahl = String(listen[kb].length);
      var info = [];
      if (neu[kb]) info.push('+' + neu[kb] + ' neu');
      if (kb === 'chancen' && e.veraltetHoch && e.veraltetHoch.length) info.push(e.veraltetHoch.length + ' veraltet');
      if (kb === 'knapp' && e.knappLive) info.push(e.knappLive + ' gerade live');
      var infoText = info.join(' · ') || 'keine neuen';
      if (zahlEl && zahlEl.textContent !== zahl) zahlEl.textContent = zahl;
      if (infoEl && infoEl.textContent !== infoText) infoEl.textContent = infoText;
      karten[ci].classList.toggle('hat-neu', !!neu[kb]);
    }

    function abzeichen(t) { return neu[t] ? ' <b class="neu">+' + neu[t] + '</b>' : ''; }
    var beschriftung = {
      chancen: 'Chancen (' + listen.chancen.length + ')' +
               (e.veraltetHoch && e.veraltetHoch.length ? ' + ' + e.veraltetHoch.length + ' veraltet' : '') +
               abzeichen('chancen'),
      knapp: 'Knappste Paare (' + listen.knapp.length + ')' +
             (e.knappLive ? ' + ' + e.knappLive + ' live' : '') + abzeichen('knapp'),
      verlauf: 'Verlauf (' + listen.verlauf.length + ')' + abzeichen('verlauf'),
      falsch: 'Falsche Rechnungen (' + listen.falsch.length + ')' + abzeichen('falsch')
    };
    var knoepfe = document.querySelectorAll('.reiter-knopf');
    for (var i = 0; i < knoepfe.length; i++) {
      var b = knoepfe[i].getAttribute('data-bereich');
      /* Nur schreiben, wenn sich der Inhalt wirklich geaendert hat: der
       * Knopf kann gerade unter der Maus liegen (Fehlerklasse 6). */
      if (knoepfe[i].innerHTML !== beschriftung[b]) knoepfe[i].innerHTML = beschriftung[b];
    }
    bereichZeigen(offenerBereich);
  }

  document.addEventListener('click', function (ev) {
    var k = ev.target && ev.target.closest ? ev.target.closest('.reiter-knopf') : null;
    if (!k) return;
    bereichZeigen(k.getAttribute('data-bereich'));
  });

  /* ---------- Zwei Ansichten: Uebersicht und Listen-Seite ----------
   * Die Startseite zeigt NUR die Uebersicht (Radar, Bereichs-Karten,
   * Tafel, Kacheln); die vier Listen wohnen auf einer eigenen Ansicht
   * mit Zurueck-Knopf. Die gewaehlte Ansicht ueberlebt das Neuladen. */
  function ansichtZeigen(name) {
    document.body.classList.toggle('ansicht-listen', name === 'listen');
    try { localStorage.setItem('orion-ansicht', name); } catch (e) {}
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', function (ev) {
    var karte = ev.target && ev.target.closest ? ev.target.closest('.bereichskarte') : null;
    if (karte) {
      bereichZeigen(karte.getAttribute('data-bereich'));
      ansichtZeigen('listen');
      return;
    }
    if (ev.target && ev.target.closest && ev.target.closest('#zurueck-knopf')) {
      ansichtZeigen('uebersicht');
    }
  });
  (function () {
    var a = null;
    try { a = localStorage.getItem('orion-ansicht'); } catch (e) {}
    if (a === 'listen') document.body.classList.add('ansicht-listen');
  })();

  function zeichne(e) {
    var K = welt.KONFIG;
    var s = e.statistik;

    /* Kurs zuerst setzen: alles darunter rechnet damit. */
    setzeKurs(e.kurs);

    setzeWennAnders(document.getElementById('tafel'), anbieterTafel(e));
    kachelnSetzen(document.getElementById('kacheln'), kacheln(s));

    /* Verbindungsleiste der LISTEN-Seite: die vier Anbieter mit Alter
     * plus der juengste Scanner-Lauf — dieselben Messwerte wie ueberall,
     * nur kompakt und beim Scrollen oben klebend. */
    (function () {
      var el = document.getElementById('listen-status');
      if (!el) return;
      var bfAn2 = (((K.buecher || {}).betfair || {}).aktiv !== false);
      function eintrag(chip, name, alter, max, aus) {
        var zustand = aus ? 'aus'
          : (alter !== null && isFinite(Number(alter)) && Number(alter) < max ? 'gruen' : 'rot');
        return '<span class="ls-eintrag an-buch ' + chip + '">' + ampel(zustand) +
               txt(name) + ' <b>' + (aus ? 'aus' : dauer(alter)) + '</b></span>';
      }
      setzeWennAnders(el,
        '<span class="ls-wort">VERBINDUNG</span>' +
        eintrag('pm', 'Polymarket', s.lauf_alter_s, K.laufMaxAlterS) +
        eintrag('ka', 'Kalshi', s.kalshi_alter_s, K.kalshiMaxAlterS) +
        eintrag('sm', 'Smarkets', s.smarkets_alter_s, K.smarketsMaxAlterS) +
        eintrag('bf', 'Betfair', s.bf_alter_s, K.bridgeMaxAlterS, !bfAn2) +
        '<span class="ls-eintrag ls-lauf">letzter Scan <b>' +
        (s.lauf_alter_s === null ? 'nie' : 'vor ' + dauer(s.lauf_alter_s)) + '</b></span>');
    })();

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
              'Sie läuft auf dem Server jede Minute, rund um die Uhr — auch ohne offenen Browser.</div>';
    } else if (s.wache_alter_s > 1800) {
      warn += '<div class="warnung"><b>Die Nachtwache meldet sich seit ' + dauer(s.wache_alter_s) + ' nicht.</b> ' +
              'Dann ist auch ihren Angaben nicht mehr zu trauen.</div>';
    } else if (s.wache_gut === false) {
      warn += '<div class="warnung"><b>Die Nachtwache hat etwas beanstandet.</b>' +
              (s.wache_eingriff ? ' Eingegriffen: ' + txt(s.wache_eingriff) : '') + '</div>';
    }
    setzeWennAnders(document.getElementById('warnungen'), warn);
    setzeWennAnders(document.getElementById('scanstand'), scanstandBlock(e.scanstand));

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
    var gKnappA  = gefiltert(e.knappArchiv || [], true);
    var gVerlauf = gefiltert(e.verlauf, true);
    var gFalsch  = gefiltert(e.falsch || [], true);
    var zChancen = gChancen.sichtbar, zKnapp = gKnapp.sichtbar, zVerlauf = gVerlauf.sichtbar;

    var chancenHtml = versteckt(gChancen.weg);
    if (zChancen.length) {
      chancenHtml += kartenGruppiert(zChancen, false);
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
    listeSetzen(document.getElementById('chancen'), chancenHtml);

    /* ZWEI Bloecke (Vorgabe 14.8.): oben das, was GERADE knapp daneben
     * liegt (lebt und schwankt mit dem Spielplan — nachts 2, abends 160,
     * das ist normal), darunter das ARCHIV der beendeten Fast-Treffer.
     * Die Zahl im Reiter zaehlt NUR das Archiv und kann darum nur wachsen. */
    var knappHtml = versteckt(gKnapp.weg + gKnappA.weg);
    knappHtml += '<h2>Gerade knapp daneben — live, ändert sich laufend</h2>';
    if (zKnapp.length) {
      knappHtml += '<p class="leise">Richtig zugeordnet, nachgerechnet, aber unter ' +
        K.mindestRendite.toFixed(2) + ' % Rendite. Die Kehrwertsumme sagt alles: ' +
        '<b>unter 1</b> heißt Gewinn unabhängig vom Ausgang, <b>über 1</b> heißt Verlust. ' +
        'Alle ' + zKnapp.length + ', nach Bereichen gebündelt, in der Gruppe beste zuerst. ' +
        'Diese Zahl hängt am Spielplan und darf ' +
        'springen — das Archiv darunter nicht.</p>' +
        kartenGruppiert(zKnapp, false);
    } else {
      knappHtml += '<p class="leise">Gerade nichts. Entweder liegen keine gemeinsamen ' +
        'Partien an, eine Quelle ist stehengeblieben, oder der Filter lässt nichts durch.</p>';
    }
    knappHtml += '<h2>Archiv — war eine Arbitrage, hat sich nicht gelohnt (' +
      gKnappA.sichtbar.length + ')</h2>' +
      '<p class="leise"><b>Diese Liste kann nur wachsen.</b> Beendete Funde, die je über ' +
      '0 % lagen — rechnerisch eine Arbitrage —, aber nie über die Chancen-Schwelle von ' +
      K.mindestRendite.toFixed(2) + ' % kamen: nach Gebühren zu wenig. Genau diese Zahl ' +
      'steht im Reiter.</p>';
    if (gKnappA.sichtbar.length) {
      knappHtml += gKnappA.sichtbar.map(function (f) { return karte(f, true); }).join('');
    } else {
      knappHtml += '<p class="leise">Noch nichts beendet, das hierher gehört.</p>';
    }
    listeSetzen(document.getElementById('knapp'), knappHtml);

    var verlaufHtml = (s.vorbei_rauschen
        ? '<p class="leise">' + s.vorbei_rauschen + ' weitere beendete Zeilen waren nie eine ' +
          'Arbitrage (beste Rendite unter 0) — sie zählen nirgends und die Datenbank löscht sie ' +
          'binnen 5 Minuten. Mathematik: Verlauf + Falsche Rechnungen (die beendeten' +
          (s.falsch_noch_live ? ', also ohne die ' + s.falsch_noch_live + ' noch live pendelnden' : '') +
          ') + Knapp-Archiv + diese Zahl = alle geladenen Beendeten.</p>'
        : '') +
      /* WIEDERBELEBTE nie stillschweigend: sie sind der einzige erlaubte
       * Grund, warum die Verlaufszahl kurz sinken kann. */
      (s.wiederbelebt
        ? '<div class="warnung"><b>' + s.wiederbelebt +
          (s.wiederbelebt === 1 ? ' Zeile ist' : ' Zeilen sind') +
          ' gerade wieder LIVE:</b> ihr Markt ist zurückgekommen, sie stehen solange nicht ' +
          'im Archiv. Nach dem Ende kehren sie hierher zurück — nur dadurch kann die ' +
          'Verlaufszahl vorübergehend um einzelne Zeilen sinken.</div>'
        : '') +
      '<p class="leise"><b>Nur Funde, die im Plus waren.</b> Was nie eine Rendite über ' +
      K.verlaufMinRendite.toFixed(0) + ' % erreicht hat, wird gelöscht statt aufbewahrt. ' +
      'Ein Fund landet hier, wenn er nicht mehr gefunden wird, wenn seine Partie vorbei ist, ' +
      'oder wenn er eine Stunde lang nicht mehr bestätigt wurde. Sortiert nach Beendigung, ' +
      'mit der besten je gesehenen Rendite.</p>' +
      /* NIE stillschweigend: die aussortierten Fehlpaarungen werden gezaehlt
       * und benannt. Gemessen am 12.8.2026 waren es drei von elf Zeilen ueber
       * 3 % — die beiden "Al"-Faelle und der League-of-Legends-Fall, alle mit
       * Zuordnung 1,00 gespeichert. Ohne diesen Hinweis stuenden genau sie
       * als die besten Funde der Geschichte da. */
      ((e.statistik && e.statistik.verlauf_fehlpaarungen)
        ? '<div class="warnung"><b>' + e.statistik.verlauf_fehlpaarungen +
          ' alte Zeile(n) über der Schwelle sind hier nicht aufgeführt:</b> ihre beiden ' +
          'Titel teilen kein einziges unterscheidendes Wort, sie meinen also nicht dieselbe ' +
          'Partie. Das sind Fehlpaarungen aus der Zeit vor der Bereichstrennung — sie hätten ' +
          'sich nie gelohnt. Gelöscht wird nichts, sie stehen weiter in der Datenbank.</div>'
        : '') +
      versteckt(gVerlauf.weg);
    if (!zVerlauf.length) {
      verlaufHtml += '<p class="leise">Noch nichts im Plus beendet.</p>';
    } else {
      verlaufHtml += zVerlauf.map(function (f) { return karte(f, true); }).join('');
    }
    listeSetzen(document.getElementById('verlauf'), verlaufHtml);

    /* ---------- Falsche Rechnungen (13.8., nachts) ----------
     * Alles, was als Chance angezeigt wurde und sich als falsch
     * herausgestellt hat — zum Analysieren, nicht zum Verstecken. Jede
     * Karte traegt ihren Grund (Pruefurteil, Buchprobe, unplausibel hoch,
     * Fehlpaarung). Ziel ist eine Woche, in der dieser Reiter leer bleibt. */
    var falschHtml = versteckt(gFalsch.weg) +
      '<p class="leise"><b>Zum Analysieren, nicht zum Handeln.</b> Diese Zeilen standen ' +
      'als Chance auf der Seite und waren rechnerisch oder nachweislich falsch: ' +
      'geprüftes Urteil, Buchprobe (Gegenbuch in sich unstimmig), unplausibel hohe ' +
      'Rendite (über ' + Number(K.maxPlausibel || 5).toFixed(0) + ' % — bisher immer ein ' +
      'klebender Kurs) oder Fehlpaarung. Jede Karte nennt ihren Grund. ' +
      '<b>Das Ziel ist eine Woche, in der hier nichts steht.</b>' +
      (s.falsch_noch_live
        ? ' ' + s.falsch_noch_live + ' davon ' + (s.falsch_noch_live === 1 ? 'läuft' : 'laufen') +
          ' gerade noch (oder wieder) live — nachgewiesen falsch bleibt falsch, die Zeile ' +
          'bleibt hier stehen, statt im Minutentakt zu verschwinden und zurückzukommen.'
        : '') + '</p>';
    if (gFalsch.sichtbar.length) {
      falschHtml += gFalsch.sichtbar.map(function (f) { return karte(f, true); }).join('');
    } else {
      falschHtml += '<p class="leise">Nichts — genau so soll es aussehen.</p>';
    }
    listeSetzen(document.getElementById('falsch'), falschHtml);

    /* Der Knapp-Reiter zaehlt das ARCHIV (waechst nur); die Live-Zahl
     * steht heller daneben, wie "veraltet" bei den Chancen. */
    reiterZeichnen({ chancen: zChancen, knapp: gKnappA.sichtbar, verlauf: zVerlauf,
                     falsch: gFalsch.sichtbar, knappLive: zKnapp.length,
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

  /* DOPPELKLICK auf die #Nummer kopiert sie (Vorgabe 14.8.) — der schnelle
   * Weg zum Funker: doppelklicken, im Funker einfügen, prüfen. Derselbe
   * Dokument-Zuhoerer-Trick wie beim Kopieren-Knopf: die Karten werden
   * alle zwei Sekunden neu geschrieben, Einzel-Zuhoerer waeren sofort weg. */
  document.addEventListener('dblclick', function (e) {
    var chip = e.target && e.target.closest ? e.target.closest('.chip.nr') : null;
    if (!chip) return;
    var nr = chip.textContent.trim();
    if (!navigator.clipboard || !navigator.clipboard.writeText) return;
    navigator.clipboard.writeText(nr).then(function () {
      var alt = chip.textContent;
      chip.textContent = '✔ kopiert';
      setTimeout(function () { if (chip.textContent === '✔ kopiert') chip.textContent = alt; }, 900);
    }, function () { /* Fenster nicht im Vordergrund — dann eben nicht */ });
  });

  /* DIREKTSPRUNG AUS DER TELEGRAM-MELDUNG (20.8.2026). Der Beitragslink
   * in der Nachricht endet auf  #fund-<schluessel, url-kodiert>.  Dieser
   * Block sucht nach dem Laden bis zu 30 s lang die Karte mit diesem
   * Schluessel (die Karten entstehen erst nach Sperre und erstem
   * Datenlauf), scrollt hin, klappt sie auf und hebt sie 4 s hervor.
   * Ist der Fund inzwischen weg (vorbei, aussortiert), passiert still
   * GAR nichts — ein Sprungziel ist keine Fehlerquelle.
   * REINE ANZEIGE, loeschbar. */
  (function () {
    var m = String(location.hash || '').match(/^#fund-(.+)$/);
    if (!m) return;
    var schluessel;
    try { schluessel = decodeURIComponent(m[1]); } catch (e) { return; }
    var bis = Date.now() + 30000;
    var takt = setInterval(function () {
      if (Date.now() > bis) { clearInterval(takt); return; }
      var traeger = document.querySelector('[data-schluessel="' + (window.CSS && CSS.escape ? CSS.escape(schluessel) : schluessel) + '"]');
      if (!traeger) return;
      var k = traeger.closest ? traeger.closest('.fund') : null;
      if (!k) return;
      clearInterval(takt);
      k.scrollIntoView({ block: 'center' });
      /* Zuklappte Abschnitte per summary-Klick oeffnen — der bestehende
       * Klick-Zuhoerer merkt sich das in aufgeklappt[], damit es das
       * Neuzeichnen alle 2 s ueberlebt. */
      var zu = k.querySelectorAll('details:not([open]) > summary');
      for (var j = 0; j < zu.length; j++) zu[j].click();
      k.style.outline = '3px solid var(--bf)';
      k.style.outlineOffset = '3px';
      setTimeout(function () { k.style.outline = ''; k.style.outlineOffset = ''; }, 4000);
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* egal */ }
    }, 500);
  })();

  /* karte ist mit herausgereicht, damit der Prüfstand pruefung/karte-probe.html
   * echte Zeilen aus der Datenbank zeichnen kann, ohne die ganze Seite und
   * ohne die Sperre. Eine Karte, die man nur im laufenden Betrieb ansehen
   * kann, wird nicht angesehen. */
  /* absageBilanz mit herausgereicht: daten.js braucht dieselbe Rechnung
   * fuer die Chancen-Zaehlung — zwei Fassungen derselben Formel waeren die
   * Drift-Falle, die dieses Projekt schon kennt. */
  /* setzeKurs mit herausgereicht (20.8.): beitrag.html und
   * gespeichert.html zeichnen einzelne Karten ausserhalb von zeichne()
   * und muessen den EZB-Kurs selbst setzen, sonst stuenden dort nur
   * Dollar-Betraege, waehrend das Panel beide Waehrungen zeigt. */
  /* buch1/buch2 mit herausgereicht (20.8.): beitrag.html braucht denselben
   * Buchnamen und dieselbe Broker-Angabe wie die Karte, wenn sie den
   * Telegram-Besucher zu seinem Anbieter weiterleitet. Zweimal dieselbe
   * Namenstabelle waere genau die Doppelwahrheit, gegen die hier sonst
   * gearbeitet wird. */
  welt.Anzeige = { zeichne: zeichne, stand: stand, dauer: dauer, zeitpunkt: zeitpunkt,
                   setzeWennAnders: setzeWennAnders, karte: karte, setzeKurs: setzeKurs,
                   absageBilanz: absageBilanz, istGedeckt: istGedeckt,
                   buch1: buch1, buch2: buch2 };

})(typeof globalThis !== 'undefined' ? globalThis : this);
