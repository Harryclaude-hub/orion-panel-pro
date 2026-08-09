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

  /* Polymarket.
   * Gebuehr je Anteil, preisabhaengig:  Gebuehr = Satz * min(p, 1-p)^exponent
   * danach:                             qE = (1 - Gebuehr) / p
   * Wer zum Briefkurs kauft ist immer Taker und zahlt.
   * Die Gebuehr ist bei p rund 0,50 am hoechsten, also genau bei Zweikaempfen. */
  function gebuehrPm(preis, satz, exponent) {
    if (!istZahl(preis) || preis <= 0 || preis >= 1) return null;
    var s = gebuehrSicher(satz);
    var e = istZahl(exponent) && exponent > 0 ? exponent : 1;
    return s * Math.pow(Math.min(preis, 1 - preis), e);
  }

  function qePm(preis, satz, exponent) {
    if (!istZahl(preis) || preis <= 0 || preis >= 1) return null;
    var g = gebuehrPm(preis, satz, exponent);
    if (g === null) return null;
    var qe = (1 - g) / preis;
    return qe > 1 ? qe : null;
  }

  /* Kalshi.
   * Gebuehr je Kontrakt, preisabhaengig, aber anders geformt als bei
   * Polymarket:  Gebuehr = Satz * p * (1 - p)
   * Kalshi rundet je Order auf den naechsten Cent AUF. Das ist zu unseren
   * Ungunsten, also wird nicht abgerundet gerechnet.
   * Veroeffentlichter Regelsatz: 7 %. Einzelne Serien liegen darunter,
   * aber ein zu hoch angesetzter Satz erzeugt hoechstens eine verpasste
   * Chance, ein zu niedriger eine erfundene.
   * Die Gebuehr ist bei p = 0,50 am hoechsten, genau wie bei Polymarket. */
  var KALSHI_SATZ = 0.07;

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

  var api = {
    GEBUEHR_UNBEKANNT: GEBUEHR_UNBEKANNT,
    gebuehrSicher: gebuehrSicher,
    qeBack: qeBack,
    qeLay: qeLay,
    haftung: haftung,
    maxHaftung: maxHaftung,
    gebuehrPm: gebuehrPm,
    qePm: qePm,
    KALSHI_SATZ: KALSHI_SATZ,
    gebuehrKalshi: gebuehrKalshi,
    qeKalshi: qeKalshi,
    pruefe: pruefe,
    pmGegenBf: pmGegenBf,
    pmGegenKalshi: pmGegenKalshi
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else welt.Rechnung = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
