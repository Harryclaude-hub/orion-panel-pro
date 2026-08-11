/* Orion Panel — Rechnung
 *
 * Reines Rechenmodul. Kein DOM, kein fetch, keine Nebenwirkungen.
 * Laeuft im Browser und im Node-Pruefstand aus derselben Datei.
 *
 * Grundlagen (aus der Uebergabe, Abschnitt 2):
 *   Effektivquote nach Gebuehr:   qE  = 1 + (q - 1) * (1 - Gebuehr)
 *   Summe der Kehrwerte:          inv = 1/qE1 + 1/qE2
 *   Arbitrage, wenn               inv < 1
 *   Aufteilung von Einsatz S:     S1  = S * (1/qE1)/inv,   S2 = S - S1
 *   Auszahlung bei beiden Ausgaengen gleich:  S/inv
 *   Rendite:                      (1/inv - 1) * 100 %
 */

(function (welt) {
  'use strict';

  // Unbekannte Gebuehr niemals als 0 durchgehen lassen (Uebergabe 2).
  // Rueckfall auf den unguenstigsten bekannten Satz.
  var GEBUEHR_UNBEKANNT = 0.07;

  function istZahl(x) {
    return typeof x === 'number' && isFinite(x);
  }

  /* Gebuehrensatz absichern: alles was keine brauchbare Zahl ist, wird zum
   * unguenstigsten bekannten Satz. Das ist die Regel, an der frueher
   * reihenweise Scheinchancen entstanden sind. */
  function gebuehrSicher(satz) {
    if (!istZahl(satz)) return GEBUEHR_UNBEKANNT;
    if (satz < 0) return GEBUEHR_UNBEKANNT;
    if (satz >= 1) return GEBUEHR_UNBEKANNT;
    return satz;
  }

  /* Betfair, Back-Seite.
   * Kommission faellt auf den Nettogewinn an, also auf (q - 1).
   * Satz steht je Markt in description.marketBaseRate, 2 bis 7 Prozent. */
  function qeBack(quote, gebuehr) {
    if (!istZahl(quote) || quote <= 1) return null;
    var g = gebuehrSicher(gebuehr);
    return 1 + (quote - 1) * (1 - g);
  }

  /* Betfair, Lay-Seite (dagegenhalten).
   * qE = 1 + (1 - Gebuehr) / (L - 1)
   * Der Schluessel fuer Maerkte mit vielen Teilnehmern, wo Polymarket
   * binaer fragt "Gewinnt X?". */
  function qeLay(layQuote, gebuehr) {
    if (!istZahl(layQuote) || layQuote <= 1) return null;
    var g = gebuehrSicher(gebuehr);
    return 1 + (1 - g) / (layQuote - 1);
  }

  /* Haftung beim Dagegenhalten: was man hinlegen muss, nicht was man setzt. */
  function haftung(einsatz, layQuote) {
    if (!istZahl(einsatz) || einsatz <= 0) return null;
    if (!istZahl(layQuote) || layQuote <= 1) return null;
    return einsatz * (layQuote - 1);
  }

  /* Groesstmoeglicher Einsatz gegen das vorhandene Lay-Volumen. */
  function maxHaftung(laySize, layQuote) {
    if (!istZahl(laySize) || laySize <= 0) return null;
    if (!istZahl(layQuote) || layQuote <= 1) return null;
    return laySize * (layQuote - 1);
  }

  /* ---------- Polymarket ----------
   *
   * BELEGT am 11.8.2026 spaet abends aus der Anbieterdoku (docs.polymarket.com
   * /Fees), damit ist der monatelange Widerspruch AUFGELOEST:
   *
   *     Gebuehr = C * Satz * p * (1 - p)          je Anteil: Satz * p * (1-p)
   *
   * KEIN Exponent, und NICHT min(p, 1-p). Bis heute rechnete das Programm
   * `Satz * min(p,1-p)` — bei p = 0,50 also 0,025 je Anteil statt der
   * echten 0,0125. Das war rund die DOPPELTE Gebuehr; die Sekundaerquellen,
   * die "die Haelfte" nannten, hatten recht. Gegenprobe an der Tabelle der
   * Anbieterdoku: Sport, 100 Anteile zu 0,50 -> 1,25 USD. 0,05*0,5*0,5*100
   * = 1,25. Stimmt. Auch die Randwerte stimmen (0,99 -> 0,05).
   *
   * Danach wie gehabt: qE = (1 - Gebuehr) / p
   * Nur TAKER zahlen; wer zum Briefkurs kauft, IST Taker.
   *
   * Der dritte Parameter (frueher `exponent`) wird ABSICHTLICH ignoriert und
   * nur noch angenommen, damit alte Aufrufe nicht still etwas anderes
   * bedeuten. Die API meldet zwar weiterhin exponent: 1, in der Formel des
   * Anbieters kommt er aber nicht vor. */
  function gebuehrPm(preis, satz) {
    if (!istZahl(preis) || preis <= 0 || preis >= 1) return null;
    var s = gebuehrSicher(satz);
    return s * preis * (1 - preis);
  }

  function qePm(preis, satz) {
    if (!istZahl(preis) || preis <= 0 || preis >= 1) return null;
    var g = gebuehrPm(preis, satz);
    if (g === null) return null;
    var qe = (1 - g) / preis;
    return qe > 1 ? qe : null;
  }

  /* Die Taker-Saetze je Marktart, aus derselben Quelle. Sie gelten, wenn
   * ein Markt keinen eigenen feeSchedule.rate mitliefert — vorher fiel ein
   * solcher Markt auf 7 % zurueck, was fuer Sport um 40 % zu hoch war.
   * Geopolitik ist ausdruecklich GEBUEHRENFREI. */
  var PM_SATZ = {
    krypto: 0.07,
    sport: 0.05, wirtschaft: 0.05, kultur: 0.05, wetter: 0.05, sonst: 0.05,
    finanz: 0.04, politik: 0.04, tech: 0.04,
    geopolitik: 0
  };

  /* Bereich des Scanners -> Marktart bei Polymarket. */
  var PM_ART_JE_BEREICH = {
    fussball: 'sport', tennis: 'sport', basketball: 'sport', baseball: 'sport',
    football: 'sport', eishockey: 'sport', golf: 'sport', cricket: 'sport',
    mma: 'sport', motorsport: 'sport', spielerwetten: 'sport',
    lol: 'sport', valorant: 'sport', esport: 'sport',
    krypto: 'krypto', politik: 'politik', wirtschaft: 'wirtschaft',
    tech: 'tech', kultur: 'kultur', wetter: 'wetter', welt: 'sonst'
  };

  function pmSatzFuer(bereich) {
    var art = PM_ART_JE_BEREICH[String(bereich || '')];
    if (!art) return GEBUEHR_UNBEKANNT;          // unbekannt bleibt teuer
    return PM_SATZ[art];
  }

  /* ---------- Kalshi ----------
   *
   * BELEGT aus der Gebuehrenordnung (PDF, Stand 7. Juli 2026):
   *
   *     Taker: fees = round up(M * 0.07 * C * P * (1-P))
   *     Maker: fees = round up(M * 0.0175 * C * P * (1-P)),  M dort 0
   *
   * M ist der Multiplikator der Serie; ohne Eintrag in der Sondertabelle
   * gilt 1. Unsere Sport-Serien (KXCLUBFGAME, KXLOLGAME, KXMLBGAME, …)
   * stehen NICHT in der Tabelle, also M = 1 und Satz 7 %. Das bestaetigt,
   * womit hier bisher gerechnet wurde.
   *
   * NEU und wertvoll: NEUN Serien haben M = 0, sind also GEBUEHRENFREI.
   * Ein Buch ohne Gebuehr ist bei 1,3 % Abstand kein weiteres Buch, sondern
   * ein anderer Rechenfall — deshalb stehen sie hier namentlich.
   *
   * Kalshi rundet je Order AUF. Wir rechnen ungerundet weiter: das ist
   * minimal zu guenstig, aber der Fehler liegt unter einem Cent je Order
   * und waere bei einer Rundung je Anteil grob falsch. */
  var KALSHI_SATZ = 0.07;
  var KALSHI_MAKER_SATZ = 0.0175;
  var KALSHI_OHNE_GEBUEHR = [
    'KXBTCY', 'KXETHY', 'KXCITRINI', 'KXDOED', 'KXELECTIRAN',
    'KXGAMBLINGREPEAL', 'KXGREENLAND', 'KXLAYOFFSYINFO', 'KXPAHLAVIHEAD'
  ];

  function kalshiSatzFuer(serie) {
    var s = String(serie || '').toUpperCase();
    for (var i = 0; i < KALSHI_OHNE_GEBUEHR.length; i++) {
      if (s.indexOf(KALSHI_OHNE_GEBUEHR[i]) === 0) return 0;
    }
    return KALSHI_SATZ;
  }

  function gebuehrKalshi(preis, satz) {
    if (!istZahl(preis) || preis <= 0 || preis >= 1) return null;
    var s = istZahl(satz) && satz >= 0 && satz < 1 ? satz : KALSHI_SATZ;
    return s * preis * (1 - preis);
  }

  function qeKalshi(preis, satz) {
    if (!istZahl(preis) || preis <= 0 || preis >= 1) return null;
    var g = gebuehrKalshi(preis, satz);
    if (g === null) return null;
    var qe = (1 - g) / preis;
    return qe > 1 ? qe : null;
  }

  /* ---------- Boersen: Kommission auf den Nettogewinn ----------
   *
   * SMARKETS, belegt aus der Anbieterdoku (Commission FAQ):
   *   Standard 2 % auf den Nettogewinn JE MARKT. Bei Verlust in einem Markt
   *   faellt keine Kommission an.
   *   1 % Pro-Tarif:    ab 1500 Wetten ODER 1 Mio GBP Einsatz je Monat
   *                     (muss ausdruecklich gewaehlt werden)
   *   3 % Select-Tarif: fuer sehr profitable Konten ab 25 000 GBP
   *                     Nettogewinn in den vorangegangenen 12 Monaten
   *   Wer in einen anderen Tarif rutscht, aendert KONFIG.smarketsGebuehr.
   *
   * ORBIT EXCHANGE, belegt: pauschal 3 % auf den Nettogewinn je Markt,
   *   keine Premium-Gebuehr, 0 % auf verlorene Wetten.
   *
   *   Das ist der Satz, der fuer UNS gilt: betfair.com ist aus Oesterreich
   *   gesperrt, alle Betfair-Links dieser Seite fuehren auf Orbit, und dort
   *   wird gesetzt. Betfairs eigener marketBaseRate (2 bis 7 %) gilt nur
   *   fuer ein direktes Betfair-Konto und ist deshalb nur noch Anzeige.
   *   Bis heute rechnete das Programm die Betfair-Seite mit 7 % Rueckfall —
   *   also mehr als das Doppelte des echten Satzes. */
  var SMARKETS_SATZ = 0.02;
  var SMARKETS_PRO = 0.01;
  var SMARKETS_SELECT = 0.03;
  var ORBIT_SATZ = 0.03;

  /* Zwei binaere Boersenmaerkte auf GEGENSAETZLICHE Ausgaenge desselben
   * Ereignisses. Polymarket "Gewinnt X?" JA gegen Kalshi "Gewinnt X?" NEIN.
   * Zusammen decken sie beide Ausgaenge ab, ohne dass irgendwo gelegt
   * werden muss. */
  function pmGegenKalshi(opt) {
    var qeP = qePm(opt.pmPreis, opt.pmSatz, opt.pmExponent);
    var qeK = qeKalshi(opt.kalshiPreis, opt.kalshiSatz);
    if (qeP === null || qeK === null) return null;
    var e = pruefe(qeP, qeK, opt.einsatz);
    if (e) { e.seite1 = 'polymarket'; e.seite2 = 'kalshi'; }
    return e;
  }

  /* Smarkets.
   * Echte Boerse. Kommission auf den NETTOGEWINN JE MARKT — dieselbe Form
   * wie bei Betfair, deshalb gelten qeBack und qeLay unveraendert und es
   * braucht keine eigene Formel.
   *
   * Der Satz ist NICHT gemessen. Es gibt kein Konto, und die oeffentliche
   * API gibt ihn nicht heraus. 2 % ist der dokumentierte Standard-Tarif.
   * Daneben bestehen 1 % (Pro) und 3 % (Select) — Letzterer trifft genau
   * die besonders profitablen Konten. Deshalb wird jeder Fund mit
   * gebuehr_echt = false gekennzeichnet: die Zahl ist uebernommen,
   * nicht nachgemessen. Wer auf Select rutscht, muss hier 0.03 eintragen,
   * sonst rechnen sich duenne Funde still ins Plus. */
  var SMARKETS_SATZ = 0.02;

  /* Preis -> Quote. Gemessen am 10.8.2026:
   *   price ist die implizite Wahrscheinlichkeit in Hundertstel-Prozent,
   *   4032 = 40,32 % = Quote 2,48.
   * Dreifach belegt: Quotenleiter, Kehrwertsumme (Back 101,0 % / Lay 98,7 %)
   * und der Endpunkt last_executed_prices, der fuer 2899 den Wert "28.99"
   * meldet.
   * Gueltig ist nur die Leiter 1,01 bis 1000. Ausserhalb liegen die
   * Randmarken 1 und 9999, hinter denen kein handelbares Volumen steht. */
  var SM_PREIS_MIN = 10;
  var SM_PREIS_MAX = 9901;

  function smQuote(preis) {
    if (!istZahl(preis)) return null;
    if (preis < SM_PREIS_MIN || preis > SM_PREIS_MAX) return null;
    return 10000 / preis;
  }

  /* Menge -> Geld.
   * Die API meldet quantity als AUSZAHLUNG, nicht als Einsatz: laut
   * offiziellem SDK ist "quantity = 400000" gleich 40,0000 GBP Auszahlung.
   * Der Einsatz ist also Auszahlung * Wahrscheinlichkeit:
   *     Geld = quantity * price / 10^8
   * Wer das verwechselt, liegt bei Quote 5,0 um den Faktor 5 daneben.
   *
   * 2147483646 (2^31 - 2) ist eine Platzhaltermarke, keine Menge. Sie
   * steht nur an den Randpreisen. Unbekannt ist nicht unbegrenzt: null. */
  var SM_PLATZHALTER = 2147483646;

  function smGeld(menge, preis) {
    if (!istZahl(menge) || menge <= 0) return null;
    if (menge === SM_PLATZHALTER) return null;
    if (smQuote(preis) === null) return null;
    return menge * preis / 1e8;
  }

  /* Wie viel Geld passt wirklich hinein?
   *
   * Eine Rendite ohne Menge ist keine Chance, sondern eine Zahl: wenn auf
   * einer Seite 12 Euro liegen, sind auch 3 % nur 36 Cent. Begrenzend ist
   * immer die duennere der beiden Seiten, gemessen an ihrem ANTEIL am
   * Gesamteinsatz.
   *
   * geld1/geld2 sind bereits in Waehrung:
   *   Polymarket   Anteile * Preis
   *   Kalshi       Kontrakte * Preis
   *   Betfair back verfuegbarer Betrag
   *   Betfair lay  Haftung = Volumen * (Quote - 1)
   *   Smarkets     smGeld(), bei Lay die Haftung
   *
   * Fehlt eine der beiden Mengen, gibt es KEINE Schaetzung:
   * null heisst "nicht bekannt", nicht "unbegrenzt". */
  function maxEinsatz(e, geld1, geld2) {
    if (!e || !istZahl(geld1) || !istZahl(geld2)) return null;
    if (geld1 <= 0 || geld2 <= 0) return 0;
    var a1 = e.s1 / e.einsatz;
    var a2 = e.s2 / e.einsatz;
    if (!(a1 > 0) || !(a2 > 0)) return null;
    return Math.min(geld1 / a1, geld2 / a2);
  }

  /* ---------- Was die Gebuehr in GELD kostet ----------
   *
   * Bis zum 10.8.2026 steckte die Gebuehr nur in qe. Sichtbar war der SATZ,
   * nie der BETRAG. Wer 0,71 % Rendite liest, soll auch sehen, wie viel
   * Kommission vorher abgezogen wurde — sonst ist die Zahl zwar richtig,
   * aber nicht nachvollziehbar. Und jedes Buch nimmt anders: Polymarket je
   * Anteil und preisabhaengig, Kalshi je Kontrakt, die Boersen als
   * Kommission auf den Nettogewinn.
   *
   * EINE Formel fuer alle vier Gebuehrenarten:
   *
   *     Betrag = Einsatz * (Quote OHNE Gebuehr - Quote MIT Gebuehr)
   *
   * Das ist exakt die Differenz der beiden Auszahlungen, denn die Auszahlung
   * ist immer Einsatz * qe. Sie braucht weder den Satz noch den Exponenten
   * noch eine Fallunterscheidung in der Rechnung selbst — nur die Auskunft,
   * wie die Quote OHNE Gebuehr aussaehe:
   *
   *     anteil    Polymarket   1/Preis        Gebuehr je Anteil
   *     kontrakt  Kalshi       1/Preis        Gebuehr je Kontrakt
   *     back      Boerse Back  Quote          Kommission auf den Nettogewinn
   *     lay       Boerse Lay   L/(L-1)        Kommission auf den Nettogewinn
   *
   * Nachgerechnet fuer jede Form:
   *     anteil    qe = (1-g)/p        -> Differenz g/p       * Einsatz
   *     kontrakt  qe = (1-g)/p        -> Differenz g/p       * Einsatz
   *     back      qe = 1+(q-1)(1-g)   -> Differenz (q-1)g    * Einsatz
   *     lay       qe = 1+(1-g)/(L-1)  -> Differenz g/(L-1)   * Einsatz
   *
   * null heisst NICHT "keine Gebuehr", sondern "nicht ausrechenbar". Eine
   * Gebuehr, die man nicht beziffern kann, wird nicht als 0 gezeigt —
   * das waere dieselbe Luege wie eine unbekannte Menge als "unbegrenzt". */
  function quoteOhneGebuehr(form, roh) {
    if (!istZahl(roh)) return null;
    if (form === 'anteil' || form === 'kontrakt') {
      if (roh <= 0 || roh >= 1) return null;
      return 1 / roh;
    }
    if (form === 'back') {
      if (roh <= 1) return null;
      return roh;
    }
    if (form === 'lay') {
      if (roh <= 1) return null;
      return roh / (roh - 1);
    }
    return null;
  }

  function gebuehrBetrag(form, einsatz, roh, qe) {
    if (!istZahl(einsatz) || einsatz <= 0) return null;
    if (!istZahl(qe) || qe <= 1) return null;
    var ohne = quoteOhneGebuehr(form, roh);
    if (ohne === null) return null;
    var d = ohne - qe;
    /* Kleine negative Werte sind Rundung, nicht Gewinn. Grosse waeren ein
     * Fehler in der Seite — dann lieber null als eine erfundene Zahl. */
    if (d < -1e-9) return null;
    return einsatz * (d < 0 ? 0 : d);
  }

  /* Kern: zwei Effektivquoten gegeneinander.
   * Gibt immer ein Ergebnis zurueck, auch wenn es keine Arbitrage ist,
   * damit der Aufrufer die Zahl sieht statt nur ein "nein". */
  function pruefe(qe1, qe2, einsatz) {
    if (!istZahl(qe1) || qe1 <= 1) return null;
    if (!istZahl(qe2) || qe2 <= 1) return null;

    var inv = 1 / qe1 + 1 / qe2;
    var S = istZahl(einsatz) && einsatz > 0 ? einsatz : 100;

    var s1 = S * (1 / qe1) / inv;
    var s2 = S - s1;
    var auszahlung = S / inv;

    return {
      qe1: qe1,
      qe2: qe2,
      inv: inv,
      istArbitrage: inv < 1,
      einsatz: S,
      s1: s1,
      s2: s2,
      auszahlung: auszahlung,
      gewinn: auszahlung - S,
      rendite: (1 / inv - 1) * 100
    };
  }

  /* Bequemer Weg fuer den haeufigsten Fall:
   * Polymarket-Briefkurs gegen Betfair-Back-Quote. */
  function pmGegenBf(opt) {
    var qePolymarket = qePm(opt.pmPreis, opt.pmSatz, opt.pmExponent);
    var qeBetfair = opt.bfLay
      ? qeLay(opt.bfQuote, opt.bfGebuehr)
      : qeBack(opt.bfQuote, opt.bfGebuehr);
    if (qePolymarket === null || qeBetfair === null) return null;
    var e = pruefe(qePolymarket, qeBetfair, opt.einsatz);
    if (e) {
      e.seite1 = 'polymarket';
      e.seite2 = opt.bfLay ? 'betfair-lay' : 'betfair-back';
    }
    return e;
  }

  /* ---------- Der allgemeine Weg: zwei beliebige Buecher ----------
   *
   * Bis hierher war alles auf Polymarket zugeschnitten: pmGegenBf,
   * pmGegenKalshi. Mit dem dritten Buch reicht das nicht mehr. Zwischen
   * vier Buechern gibt es sechs Paarungen, nicht zwei, und Betfair gegen
   * Smarkets ist genauso eine Arbitrage wie Polymarket gegen Betfair.
   *
   * Eine SEITE ist ein fertig gerechnetes Angebot eines Buches:
   *   { buch: 'smarkets', richtung: 'ja'|'nein', qe: 2.31, geld: 88.40, ... }
   * qe ist bereits NACH Gebuehr. Wer eine Seite baut, hat die Gebuehr
   * schon eingerechnet — hier wird nichts mehr nachgeholt.
   *
   * Regeln, die hier durchgesetzt werden:
   *   - GENAU zwei Buecher. Nicht eins, nicht drei.
   *   - Die beiden Seiten muessen GEGENSAETZLICH sein (ja gegen nein).
   *     Zweimal JA ist keine Absicherung, sondern die doppelte Wette.
   *   - Dasselbe Buch gegen sich selbst ist keine Arbitrage. */
  function chance(a, b, einsatz) {
    if (!a || !b) return null;
    if (!a.buch || !b.buch) return null;
    if (a.buch === b.buch) return null;
    if (a.richtung !== 'ja' || b.richtung !== 'nein') return null;

    var e = pruefe(a.qe, b.qe, einsatz);
    if (!e) return null;

    e.seite1 = a.buch;
    e.seite2 = b.buch;
    e.maxEinsatz = maxEinsatz(e, a.geld, b.geld);
    e.maxGewinn = e.maxEinsatz === null ? null : e.maxEinsatz * e.rendite / 100;
    return e;
  }

  /* Alle Paarungen einer Liste von Seiten, die zum selben Ausgang gehoeren.
   * Aus n Buechern werden bis zu n*(n-1) gerichtete Paare — jedes davon
   * ist eine eigene Anzeige, denn jede hat eigene Links, eigene Einsaetze
   * und eine eigene Rendite.
   *
   * minRendite filtert, was gar nicht erst gezeigt werden soll. Ohne
   * Filter (null) kommt alles zurueck, auch Minus — das braucht die
   * Ansicht "Knappste Paare". */
  function alleChancen(seiten, minRendite, einsatz) {
    var aus = [];
    if (!seiten || !seiten.length) return aus;
    for (var i = 0; i < seiten.length; i++) {
      for (var j = 0; j < seiten.length; j++) {
        if (i === j) continue;
        var e = chance(seiten[i], seiten[j], einsatz);
        if (!e) continue;
        if (istZahl(minRendite) && e.rendite < minRendite) continue;
        aus.push({ ja: seiten[i], nein: seiten[j], ergebnis: e });
      }
    }
    aus.sort(function (x, y) { return y.ergebnis.rendite - x.ergebnis.rendite; });
    return aus;
  }

  var api = {
    GEBUEHR_UNBEKANNT: GEBUEHR_UNBEKANNT,
    SMARKETS_SATZ: SMARKETS_SATZ,
    SM_PREIS_MIN: SM_PREIS_MIN,
    SM_PREIS_MAX: SM_PREIS_MAX,
    SM_PLATZHALTER: SM_PLATZHALTER,
    smQuote: smQuote,
    smGeld: smGeld,
    maxEinsatz: maxEinsatz,
    quoteOhneGebuehr: quoteOhneGebuehr,
    gebuehrBetrag: gebuehrBetrag,
    chance: chance,
    alleChancen: alleChancen,
    gebuehrSicher: gebuehrSicher,
    qeBack: qeBack,
    qeLay: qeLay,
    haftung: haftung,
    maxHaftung: maxHaftung,
    gebuehrPm: gebuehrPm,
    qePm: qePm,
    PM_SATZ: PM_SATZ,
    pmSatzFuer: pmSatzFuer,
    KALSHI_SATZ: KALSHI_SATZ,
    KALSHI_MAKER_SATZ: KALSHI_MAKER_SATZ,
    KALSHI_OHNE_GEBUEHR: KALSHI_OHNE_GEBUEHR,
    kalshiSatzFuer: kalshiSatzFuer,
    SMARKETS_PRO: SMARKETS_PRO,
    SMARKETS_SELECT: SMARKETS_SELECT,
    ORBIT_SATZ: ORBIT_SATZ,
    gebuehrKalshi: gebuehrKalshi,
    qeKalshi: qeKalshi,
    pruefe: pruefe,
    pmGegenBf: pmGegenBf,
    pmGegenKalshi: pmGegenKalshi
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else welt.Rechnung = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
