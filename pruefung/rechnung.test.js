/* Pruefstand fuer js/rechnung.js
 *
 * Regel aus Fehlerklasse 8: fuer jede Schutzregel gibt es einen Test,
 * der sie AUSLOEST. Eine Grenze, die nie anschlaegt, sieht aus wie eine,
 * die nichts zu tun hat.
 *
 * Aufruf:  node pruefung/rechnung.test.js
 */

var R = require('../js/rechnung.js');

var gut = 0, schlecht = 0;
var offen = [];

function ok(name, bedingung, gemessen) {
  if (bedingung) { gut++; return; }
  schlecht++;
  offen.push('  ' + name + (gemessen !== undefined ? '   gemessen: ' + gemessen : ''));
}
function nah(name, a, b, toleranz) {
  var t = toleranz === undefined ? 1e-9 : toleranz;
  ok(name, typeof a === 'number' && Math.abs(a - b) <= t, a + ' statt ' + b);
}

/* ---------- Gebuehren-Rueckfall: die Regel muss wirklich anschlagen ---------- */

nah('Gebuehr unbekannt (undefined) faellt auf 7 %', R.gebuehrSicher(undefined), 0.07);
nah('Gebuehr null faellt auf 7 %',                  R.gebuehrSicher(null), 0.07);
nah('Gebuehr NaN faellt auf 7 %',                   R.gebuehrSicher(NaN), 0.07);
nah('Gebuehr Text faellt auf 7 %',                  R.gebuehrSicher('0.05'), 0.07);
nah('Gebuehr negativ faellt auf 7 %',               R.gebuehrSicher(-0.02), 0.07);
nah('Gebuehr 1.0 faellt auf 7 %',                   R.gebuehrSicher(1), 0.07);
nah('Gebuehr 2.0 faellt auf 7 %',                   R.gebuehrSicher(2), 0.07);
nah('Gebuehr 0 bleibt 0 (ausdruecklich gesetzt)',   R.gebuehrSicher(0), 0);
nah('Gebuehr 0.05 bleibt 0.05',                     R.gebuehrSicher(0.05), 0.05);

/* ---------- Betfair Back ---------- */

nah('Back q=3 bei 5 % -> 2.90',   R.qeBack(3, 0.05), 2.9);
nah('Back q=2 bei 2 % -> 1.98',   R.qeBack(2, 0.02), 1.98);
nah('Back q=2 bei 7 % -> 1.93',   R.qeBack(2, 0.07), 1.93);
nah('Back q=2 ohne Gebuehr -> 2', R.qeBack(2, 0), 2);
nah('Back q=2 mit unbekannter Gebuehr rechnet mit 7 %', R.qeBack(2, undefined), 1.93);

ok('Back q=1 wird abgewiesen',      R.qeBack(1, 0.05) === null);
ok('Back q=0.5 wird abgewiesen',    R.qeBack(0.5, 0.05) === null);
ok('Back q=0 wird abgewiesen',      R.qeBack(0, 0.05) === null);
ok('Back q negativ abgewiesen',     R.qeBack(-3, 0.05) === null);
ok('Back q NaN abgewiesen',         R.qeBack(NaN, 0.05) === null);
ok('Back q Text abgewiesen',        R.qeBack('3', 0.05) === null);
ok('Back q undefined abgewiesen',   R.qeBack(undefined, 0.05) === null);
ok('Back q Unendlich abgewiesen',   R.qeBack(Infinity, 0.05) === null);

/* ---------- Betfair Lay ---------- */

nah('Lay L=3 bei 5 % -> 1.475',  R.qeLay(3, 0.05), 1.475);
nah('Lay L=2 bei 5 % -> 1.95',   R.qeLay(2, 0.05), 1.95);
nah('Lay L=1.5 bei 5 % -> 2.90', R.qeLay(1.5, 0.05), 2.9);
nah('Lay L=2 ohne Gebuehr -> 2', R.qeLay(2, 0), 2);
nah('Lay mit unbekannter Gebuehr rechnet mit 7 %', R.qeLay(2, undefined), 1.93);

ok('Lay L=1 wird abgewiesen',    R.qeLay(1, 0.05) === null);
ok('Lay L=0.9 wird abgewiesen',  R.qeLay(0.9, 0.05) === null);
ok('Lay L NaN wird abgewiesen',  R.qeLay(NaN, 0.05) === null);

/* ---------- Haftung ---------- */

nah('Haftung 10 bei L=3 -> 20',       R.haftung(10, 3), 20);
nah('Haftung 25 bei L=1.5 -> 12.5',   R.haftung(25, 1.5), 12.5);
nah('Max-Haftung laySize 40, L=2.5 -> 60', R.maxHaftung(40, 2.5), 60);

ok('Haftung ohne Einsatz abgewiesen',   R.haftung(0, 3) === null);
ok('Haftung negativ abgewiesen',        R.haftung(-5, 3) === null);
ok('Haftung bei L=1 abgewiesen',        R.haftung(10, 1) === null);
ok('Max-Haftung ohne Volumen abgewiesen', R.maxHaftung(0, 2) === null);

/* ---------- Polymarket-Gebuehr ---------- */

/* Die Formel ist seit dem 11.8.2026 spaet abends BELEGT (Anbieterdoku):
 *     Gebuehr je Anteil = Satz * p * (1 - p)
 * Diese Zeilen rechnen die Tabelle der Anbieterdoku nach, Spalte
 * "Fee for 100 contracts". Sie loesen also die alte Fassung aus, statt sie
 * zu umgehen: mit `Satz * min(p,1-p)` faellt jede einzelne durch. */
nah('PM-Gebuehr p=0.50, 5 % -> 0.0125 (Doku: 1,25 je 100)', R.gebuehrPm(0.50, 0.05), 0.0125);
nah('PM-Gebuehr p=0.20, 5 % -> 0.0080 (Doku: 0,80 je 100)', R.gebuehrPm(0.20, 0.05), 0.008);
nah('PM-Gebuehr p=0.30, 5 % -> 0.0105 (Doku: 1,05 je 100)', R.gebuehrPm(0.30, 0.05), 0.0105);
nah('PM-Gebuehr Krypto p=0.50, 7 % -> 0.0175 (Doku: 1,75 je 100)', R.gebuehrPm(0.50, 0.07), 0.0175);
nah('PM-Gebuehr Politik p=0.50, 4 % -> 0.0100 (Doku: 1,00 je 100)', R.gebuehrPm(0.50, 0.04), 0.01);
nah('PM-Gebuehr Rand p=0.99, 5 % -> 0.000495 (Doku: 0,05 je 100)', R.gebuehrPm(0.99, 0.05), 0.000495);
nah('PM-Gebuehr p=0.80 ist gleich wie p=0.20 (symmetrisch um 0,50)',
    R.gebuehrPm(0.80, 0.05), R.gebuehrPm(0.20, 0.05));
nah('PM-Gebuehr dritter Parameter wird ignoriert (frueher Exponent)',
    R.gebuehrPm(0.30, 0.05, 2), R.gebuehrPm(0.30, 0.05));
nah('PM-Gebuehr unbekannter Satz rechnet mit 7 %', R.gebuehrPm(0.50, undefined), 0.0175);

ok('PM-Gebuehr ist bei p=0.50 am hoechsten',
   R.gebuehrPm(0.50, 0.05) > R.gebuehrPm(0.35, 0.05) &&
   R.gebuehrPm(0.50, 0.05) > R.gebuehrPm(0.65, 0.05));

ok('PM-Gebuehr p=0 abgewiesen',   R.gebuehrPm(0, 0.05) === null);
ok('PM-Gebuehr p=1 abgewiesen',   R.gebuehrPm(1, 0.05) === null);
ok('PM-Gebuehr p=1.5 abgewiesen', R.gebuehrPm(1.5, 0.05) === null);
ok('PM-Gebuehr p negativ abgewiesen', R.gebuehrPm(-0.2, 0.05) === null);

/* Satz je Marktart, aus derselben Doku. Unbekannter Bereich bleibt teuer. */
nah('PM-Satz Sport 5 %',        R.pmSatzFuer('fussball'), 0.05);
nah('PM-Satz Krypto 7 %',       R.pmSatzFuer('krypto'), 0.07);
nah('PM-Satz Politik 4 %',      R.pmSatzFuer('politik'), 0.04);
nah('PM-Satz Technik 4 %',      R.pmSatzFuer('tech'), 0.04);
nah('PM-Satz unbekannter Bereich faellt auf 7 % zurueck', R.pmSatzFuer('quatsch'), 0.07);

/* ---------- Polymarket Effektivquote ---------- */

nah('PM p=0.50 bei 5 % -> 1.975',  R.qePm(0.50, 0.05), 1.975);
nah('PM p=0.25 bei 5 % -> 3.9625', R.qePm(0.25, 0.05), 3.9625);
nah('PM p=0.50 ohne Gebuehr -> 2', R.qePm(0.50, 0), 2);

ok('PM p=0 abgewiesen',    R.qePm(0, 0.05) === null);
ok('PM p=1 abgewiesen',    R.qePm(1, 0.05) === null);
ok('PM p=0.999 bei 7 % ergibt keine Quote ueber 1 und wird abgewiesen',
   R.qePm(0.999, 0.07) === null || R.qePm(0.999, 0.07) > 1);

/* ---------- Kalshi: Gebuehrenordnung vom 7.7.2026 ---------- */

nah('Kalshi Taker p=0.50 -> 0.0175 (PDF: 1,75 je 100)', R.gebuehrKalshi(0.50), 0.0175);
nah('Kalshi Taker p=0.20 -> 0.0112 (PDF: 1,12 je 100)', R.gebuehrKalshi(0.20), 0.0112);
nah('Kalshi Taker p=0.65 -> 0.0159 (PDF: 1,60 je 100, ungerundet 1,5925)',
    R.gebuehrKalshi(0.65), 0.015925);
nah('Kalshi Maker-Satz steht bei 1,75 %', R.KALSHI_MAKER_SATZ, 0.0175);
nah('Kalshi Regelsatz 7 % fuer unsere Sport-Serien', R.kalshiSatzFuer('KXCLUBFGAME'), 0.07);
nah('Kalshi Regelsatz 7 % auch fuer LoL', R.kalshiSatzFuer('KXLOLGAME'), 0.07);
nah('Kalshi GEBUEHRENFREI: BTC-Jahresspanne (Multiplikator 0)', R.kalshiSatzFuer('KXBTCY'), 0);
nah('Kalshi GEBUEHRENFREI: ETH-Jahresspanne', R.kalshiSatzFuer('KXETHY-26DEC31'), 0);
nah('Kalshi unbekannte Serie bleibt beim Regelsatz', R.kalshiSatzFuer(''), 0.07);

/* ---------- Boersen-Kommission, belegt ---------- */

nah('Smarkets Standard 2 %', R.SMARKETS_SATZ, 0.02);
nah('Smarkets Pro 1 %',      R.SMARKETS_PRO, 0.01);
nah('Smarkets Select 3 %',   R.SMARKETS_SELECT, 0.03);
nah('Orbit pauschal 3 %',    R.ORBIT_SATZ, 0.03);
ok('Orbit ist guenstiger als der alte 7-%-Rueckfall', R.ORBIT_SATZ < R.GEBUEHR_UNBEKANNT);

/* ---------- Kernrechnung ---------- */

var e = R.pruefe(2.5, 2.5, 100);
nah('inv bei 2.5/2.5 -> 0.8',        e.inv, 0.8);
ok('2.5/2.5 ist Arbitrage',          e.istArbitrage === true);
nah('Aufteilung symmetrisch',        e.s1, e.s2);
nah('Einsatzsumme bleibt 100',       e.s1 + e.s2, 100, 1e-9);
nah('Auszahlung 125',                e.auszahlung, 125);
nah('Rendite 25 %',                  e.rendite, 25);

var f = R.pruefe(2, 2, 100);
nah('inv bei 2/2 -> 1.0',   f.inv, 1);
ok('2/2 ist KEINE Arbitrage (Grenze inv < 1 schlaegt an)', f.istArbitrage === false);
nah('Rendite bei 2/2 ist 0', f.rendite, 0);

var g = R.pruefe(1.8, 2.1, 100);
ok('1.8/2.1 ist keine Arbitrage', g.istArbitrage === false);
ok('Rendite ist negativ',         g.rendite < 0);

/* Auszahlung muss bei BEIDEN Ausgaengen gleich sein, nicht 50/50 einsetzen */
var h = R.pruefe(3.2, 1.7, 200);
nah('Ausgang 1 zahlt s1 * qe1',  h.s1 * h.qe1, h.auszahlung, 1e-9);
nah('Ausgang 2 zahlt s2 * qe2',  h.s2 * h.qe2, h.auszahlung, 1e-9);
ok('Aufteilung ist ausdruecklich NICHT 50/50', Math.abs(h.s1 - h.s2) > 1);
nah('Einsatzsumme bleibt 200',   h.s1 + h.s2, 200, 1e-9);

ok('Einsatz 0 faellt auf 100 zurueck',        R.pruefe(2.5, 2.5, 0).einsatz === 100);
ok('Einsatz fehlt faellt auf 100 zurueck',    R.pruefe(2.5, 2.5).einsatz === 100);
ok('qe1 = 1 wird abgewiesen',                 R.pruefe(1, 2.5, 100) === null);
ok('qe2 = 1 wird abgewiesen',                 R.pruefe(2.5, 1, 100) === null);
ok('qe unter 1 wird abgewiesen',              R.pruefe(0.8, 2.5, 100) === null);
ok('qe NaN wird abgewiesen',                  R.pruefe(NaN, 2.5, 100) === null);
ok('qe null wird abgewiesen',                 R.pruefe(null, 2.5, 100) === null);

/* ---------- Der teuer bezahlte Fall aus der Uebergabe ----------
 * "0,49 gegen Betfair 2,03 sieht ohne Gebuehr nach +0,46 % aus,
 *  mit 4 % sind es -0,52 %."
 * Das ist der Beweis, dass feePm = 0 reihenweise Scheinchancen erzeugt.
 *
 * NACHGEZOGEN am 11.8.2026 spaet: mit der BELEGTEN Formel (Satz*p*(1-p)
 * statt Satz*min(p,1-p)) ist die Gebuehr rund halb so gross, aus -0,52 %
 * werden -0,04 %. Die REGEL bleibt unveraendert gueltig — die Zeile kippt
 * weiterhin von Plus auf Minus, nur knapper. Der alte Wert war nie falsch
 * gemessen, er stand nur auf der falschen Formel. */

var ohne = R.pmGegenBf({ pmPreis: 0.49, pmSatz: 0, bfQuote: 2.03, bfGebuehr: 0.05 });
var mit4 = R.pmGegenBf({ pmPreis: 0.49, pmSatz: 0.04, bfQuote: 2.03, bfGebuehr: 0.05 });

nah('Scheinchance ohne PM-Gebuehr: +0.46 %', ohne.rendite, 0.46, 0.01);
ok('... und wird faelschlich als Arbitrage gemeldet', ohne.istArbitrage === true);
nah('Mit 4 % PM-Gebuehr: -0.04 %',           mit4.rendite, -0.038, 0.01);
ok('... die Regel traegt weiter: aus Plus wird Minus',
   ohne.rendite > 0 && mit4.rendite < 0);
ok('... und ist korrekt KEINE Arbitrage',    mit4.istArbitrage === false);

var unbekannt = R.pmGegenBf({ pmPreis: 0.49, pmExponent: 1, bfQuote: 2.03, bfGebuehr: 0.05 });
ok('Fehlende PM-Gebuehr ist nie Arbitrage (Rueckfall 7 %)', unbekannt.istArbitrage === false);
ok('Fehlende PM-Gebuehr ist schlechter als 4 %', unbekannt.rendite < mit4.rendite);

/* ---------- pmGegenBf, Lay-Weg und Abweisungen ---------- */

var lay = R.pmGegenBf({ pmPreis: 0.30, pmSatz: 0.05, pmExponent: 1, bfQuote: 1.35, bfGebuehr: 0.05, bfLay: true });
ok('Lay-Weg liefert ein Ergebnis',      lay !== null);
ok('Lay-Weg ist als betfair-lay markiert', lay.seite2 === 'betfair-lay');
ok('Back-Weg ist als betfair-back markiert',
   R.pmGegenBf({ pmPreis: 0.30, pmSatz: 0.05, bfQuote: 3.9, bfGebuehr: 0.05 }).seite2 === 'betfair-back');

ok('pmGegenBf ohne PM-Preis wird abgewiesen',
   R.pmGegenBf({ pmSatz: 0.05, bfQuote: 2.03, bfGebuehr: 0.05 }) === null);
ok('pmGegenBf ohne BF-Quote wird abgewiesen',
   R.pmGegenBf({ pmPreis: 0.49, pmSatz: 0.05, bfGebuehr: 0.05 }) === null);
ok('pmGegenBf mit PM-Preis 0 wird abgewiesen',
   R.pmGegenBf({ pmPreis: 0, pmSatz: 0.05, bfQuote: 2.03, bfGebuehr: 0.05 }) === null);
ok('pmGegenBf mit BF-Quote 1 wird abgewiesen',
   R.pmGegenBf({ pmPreis: 0.49, pmSatz: 0.05, bfQuote: 1, bfGebuehr: 0.05 }) === null);

/* ---------- echte Chance, damit auch der Ja-Fall geprueft ist ---------- */

var chance = R.pmGegenBf({ pmPreis: 0.45, pmSatz: 0.05, pmExponent: 1, bfQuote: 2.60, bfGebuehr: 0.05, einsatz: 500 });
ok('0.45 gegen 2.60 ist eine echte Chance', chance.istArbitrage === true);
ok('Rendite ueber 1 %',                     chance.rendite > 1);
nah('Auszahlung beidseitig gleich (Seite 1)', chance.s1 * chance.qe1, chance.auszahlung, 1e-9);
nah('Auszahlung beidseitig gleich (Seite 2)', chance.s2 * chance.qe2, chance.auszahlung, 1e-9);
nah('Gewinn = Auszahlung minus Einsatz',      chance.gewinn, chance.auszahlung - 500, 1e-9);

/* ---------- Kalshi ----------
 *
 * Gebuehr = Satz * p * (1-p), anders geformt als bei Polymarket
 * (dort min(p,1-p)^Exponent). Regelsatz 7 %. */

nah('Kalshi p=0.50 bei 7 % -> 0.0175', R.gebuehrKalshi(0.50, 0.07), 0.0175);
nah('Kalshi p=0.20 bei 7 % -> 0.0112', R.gebuehrKalshi(0.20, 0.07), 0.0112);
nah('Kalshi p=0.80 gleich wie p=0.20', R.gebuehrKalshi(0.80, 0.07), R.gebuehrKalshi(0.20, 0.07));
nah('Kalshi ohne Satz nimmt 7 %',      R.gebuehrKalshi(0.50, undefined), 0.0175);
nah('Kalshi Satz 0 wird auch genommen', R.gebuehrKalshi(0.50, 0), 0);

ok('Kalshi-Gebuehr ist bei p=0.50 am hoechsten',
   R.gebuehrKalshi(0.50, 0.07) > R.gebuehrKalshi(0.30, 0.07) &&
   R.gebuehrKalshi(0.50, 0.07) > R.gebuehrKalshi(0.70, 0.07));

ok('Kalshi p=0 abgewiesen',   R.gebuehrKalshi(0, 0.07) === null);
ok('Kalshi p=1 abgewiesen',   R.gebuehrKalshi(1, 0.07) === null);
ok('Kalshi p=1.5 abgewiesen', R.gebuehrKalshi(1.5, 0.07) === null);
ok('Kalshi p NaN abgewiesen', R.gebuehrKalshi(NaN, 0.07) === null);

nah('Kalshi qE p=0.50 -> 1.965', R.qeKalshi(0.50, 0.07), (1 - 0.0175) / 0.5);
nah('Kalshi qE ohne Gebuehr p=0.50 -> 2', R.qeKalshi(0.50, 0), 2);
ok('Kalshi qE p=0 abgewiesen', R.qeKalshi(0, 0.07) === null);
ok('Kalshi qE p=1 abgewiesen', R.qeKalshi(1, 0.07) === null);

/* FRUEHER stand hier: "bei p=0,50 ist Kalshi guenstiger als Polymarket",
 * weil p*(1-p) schneller faellt als min(p,1-p). Das galt nur, solange
 * Polymarket falsch mit min(p,1-p) gerechnet wurde.
 *
 * Seit die Anbieterdoku vorliegt, ist es EINE Formel fuer beide Buecher:
 * Gebuehr = Satz * p * (1-p). Bei gleichem Satz kostet Kalshi also
 * GENAU DASSELBE wie Polymarket; unterschiedlich sind nur die Saetze
 * (Kalshi 7 %, Polymarket 4 bis 7 % je Marktart). */
nah('bei gleichem Satz kosten Kalshi und Polymarket exakt gleich viel',
    R.gebuehrKalshi(0.50, 0.05), R.gebuehrPm(0.50, 0.05));
ok('mit den ECHTEN Saetzen ist Polymarket im Sport guenstiger als Kalshi',
   R.gebuehrPm(0.50, R.pmSatzFuer('fussball')) < R.gebuehrKalshi(0.50, R.kalshiSatzFuer('KXCLUBFGAME')),
   R.gebuehrPm(0.50, 0.05) + ' gegen ' + R.gebuehrKalshi(0.50, 0.07));

/* ---------- Polymarket gegen Kalshi ----------
 * Zwei binaere Maerkte auf GEGENSAETZLICHE Ausgaenge desselben Ereignisses. */

var kGut = R.pmGegenKalshi({ pmPreis: 0.45, pmSatz: 0.05, pmExponent: 1, kalshiPreis: 0.50, einsatz: 200 });
ok('0.45 gegen 0.50 ist eine echte Chance', kGut !== null && kGut.istArbitrage === true);
ok('als polymarket/kalshi markiert', kGut.seite1 === 'polymarket' && kGut.seite2 === 'kalshi');
nah('Auszahlung beidseitig gleich (1)', kGut.s1 * kGut.qe1, kGut.auszahlung, 1e-9);
nah('Auszahlung beidseitig gleich (2)', kGut.s2 * kGut.qe2, kGut.auszahlung, 1e-9);
nah('Einsatzsumme bleibt 200', kGut.s1 + kGut.s2, 200, 1e-9);

var kSchlecht = R.pmGegenKalshi({ pmPreis: 0.52, pmSatz: 0.05, pmExponent: 1, kalshiPreis: 0.52 });
ok('0.52 gegen 0.52 ist KEINE Chance', kSchlecht.istArbitrage === false);

/* Die Summe der beiden Preise entscheidet, aber erst NACH Gebuehren.
 * 0.49 + 0.50 = 0.99 sieht gut aus, mit Gebuehren bleibt nichts. */
var knapp = R.pmGegenKalshi({ pmPreis: 0.49, pmSatz: 0.05, pmExponent: 1, kalshiPreis: 0.50 });
ok('0.49 + 0.50 traegt die Gebuehren nicht', knapp.istArbitrage === false,
   'Rendite ' + knapp.rendite.toFixed(3) + ' %');

ok('ohne Polymarket-Preis abgewiesen',
   R.pmGegenKalshi({ pmSatz: 0.05, kalshiPreis: 0.5 }) === null);
ok('ohne Kalshi-Preis abgewiesen',
   R.pmGegenKalshi({ pmPreis: 0.45, pmSatz: 0.05 }) === null);
ok('Kalshi-Preis 0 abgewiesen',
   R.pmGegenKalshi({ pmPreis: 0.45, pmSatz: 0.05, kalshiPreis: 0 }) === null);
ok('Kalshi-Preis 1 abgewiesen',
   R.pmGegenKalshi({ pmPreis: 0.45, pmSatz: 0.05, kalshiPreis: 1 }) === null);

/* ---------- Smarkets: Preiskodierung ----------
 * Alle Werte sind am 10.8.2026 aus der API gemessen, nicht ausgedacht.
 * Jeder Preis traf exakt die Smarkets-Quotenleiter. */

nah('Preis 4032 ergibt Quote 2,48', R.smQuote(4032), 2.4801587301587302, 1e-9);
nah('Preis 2500 ergibt Quote 4,00', R.smQuote(2500), 4);
nah('Preis 5000 ergibt Quote 2,00', R.smQuote(5000), 2);
/* Die eigentliche Aussage ist nicht eine Nachkommastelle, sondern dass
 * jeder gemessene Preis auf der Smarkets-QUOTENLEITER landet. Genau das
 * wurde am 10.8. geprueft: 2,40 / 3,50 / 1,78 / 2,10 / 3,25 — kein
 * einziger Ausreisser. Deshalb wird gegen die Leiter geprueft, mit der
 * Toleranz einer halben Sprosse. */
nah('Preis 2857 landet auf Leitersprosse 3,50', R.smQuote(2857), 3.50, 5e-3);
nah('Preis 4167 landet auf Leitersprosse 2,40', R.smQuote(4167), 2.40, 5e-3);
nah('Preis 5618 landet auf Leitersprosse 1,78', R.smQuote(5618), 1.78, 5e-3);
nah('Preis 4762 landet auf Leitersprosse 2,10', R.smQuote(4762), 2.10, 5e-3);
nah('Preis 3077 landet auf Leitersprosse 3,25', R.smQuote(3077), 3.25, 5e-3);

/* Die Randmarken. Dahinter steht kein handelbares Volumen, sondern
 * eine Platzhalterzeile. Wer sie durchlaesst, rechnet mit Quote 10000. */
ok('Randpreis 1 wird abgewiesen',    R.smQuote(1) === null);
ok('Randpreis 9999 wird abgewiesen', R.smQuote(9999) === null);
ok('Preis 0 wird abgewiesen',        R.smQuote(0) === null);
ok('negativer Preis wird abgewiesen', R.smQuote(-4000) === null);
ok('Preis 9902 liegt schon ausserhalb', R.smQuote(9902) === null);
ok('Preis 9901 ist noch gueltig (Quote 1,01)', R.smQuote(9901) !== null);
ok('Preis 10 ist noch gueltig (Quote 1000)',   R.smQuote(10) !== null);
ok('Text als Preis wird abgewiesen', R.smQuote('4032') === null);
ok('null als Preis wird abgewiesen', R.smQuote(null) === null);

/* Kehrwertsumme als Gegenprobe: die Back-Seite eines echten Siegermarktes
 * muss UEBER 100 % liegen, die Lay-Seite darunter. Genau das wurde
 * gemessen (101,03 % / 98,72 %). Waere die Kodierung anders herum,
 * kaeme hier Unsinn heraus. */
var backSumme = 1 / R.smQuote(4132) + 1 / R.smQuote(3030) + 1 / R.smQuote(2941);
var laySumme  = 1 / R.smQuote(4032) + 1 / R.smQuote(2941) + 1 / R.smQuote(2899);
ok('Back-Seite liegt ueber 100 %',  backSumme > 1.0 && backSumme < 1.02, backSumme);
ok('Lay-Seite liegt unter 100 %',   laySumme < 1.0 && laySumme > 0.98, laySumme);

/* ---------- Smarkets: Menge ist AUSZAHLUNG, nicht Einsatz ---------- */

nah('quantity 400000 zu 2500 ergibt 10 GBP Einsatz', R.smGeld(400000, 2500), 10);
nah('quantity 1645980 zu 4032 ergibt 66,37 GBP', R.smGeld(1645980, 4032), 66.36591360000001, 1e-6);
ok('die Platzhaltermarke 2147483646 ist KEINE Menge',
   R.smGeld(2147483646, 4032) === null);
ok('Menge 0 ergibt nichts',        R.smGeld(0, 4032) === null);
ok('negative Menge ergibt nichts', R.smGeld(-100, 4032) === null);
ok('Menge zu einem Randpreis ergibt nichts', R.smGeld(500000, 9999) === null);
ok('Text als Menge ergibt nichts', R.smGeld('400000', 2500) === null);

/* ---------- Smarkets: Gebuehr hat dieselbe Form wie Betfair ---------- */

ok('der Standardsatz ist 2 %', R.SMARKETS_SATZ === 0.02);
nah('Back 3,00 bei 2 % ergibt qE 2,96', R.qeBack(3, R.SMARKETS_SATZ), 2.96);
nah('Lay 3,00 bei 2 % ergibt qE 1,49',  R.qeLay(3, R.SMARKETS_SATZ), 1.49);
/* Wer bei Select landet, zahlt 3 % — und das darf sichtbar weniger sein. */
ok('3 % ergibt eine schlechtere Quote als 2 %',
   R.qeBack(3, 0.03) < R.qeBack(3, 0.02));

/* ---------- Genau zwei Buecher ---------- */

var ja  = { buch: 'polymarket', richtung: 'ja',   qe: 2.20, geld: 500 };
var nein = { buch: 'smarkets',  richtung: 'nein', qe: 2.10, geld: 500 };

ok('zwei verschiedene Buecher ergeben eine Chance', R.chance(ja, nein) !== null);
ok('dasselbe Buch gegen sich selbst ist KEINE Arbitrage',
   R.chance(ja, { buch: 'polymarket', richtung: 'nein', qe: 2.10, geld: 500 }) === null);
ok('zweimal JA ist keine Absicherung',
   R.chance(ja, { buch: 'smarkets', richtung: 'ja', qe: 2.10, geld: 500 }) === null);
ok('zweimal NEIN ist keine Absicherung',
   R.chance({ buch: 'kalshi', richtung: 'nein', qe: 2.2, geld: 5 }, nein) === null);
ok('Seite ohne Buch wird abgewiesen',
   R.chance({ richtung: 'ja', qe: 2.2, geld: 5 }, nein) === null);
ok('fehlende Seite wird abgewiesen', R.chance(ja, null) === null);

var c = R.chance(ja, nein);
ok('die Chance nennt beide Buecher', c.seite1 === 'polymarket' && c.seite2 === 'smarkets');
ok('1/2,20 + 1/2,10 liegt unter 1, also Arbitrage', c.istArbitrage === true, c.inv);
ok('beide Ausgaenge zahlen gleich',
   Math.abs(c.s1 * c.qe1 - c.s2 * c.qe2) < 1e-9, c.s1 * c.qe1 - c.s2 * c.qe2);

/* Menge: die duennere Seite begrenzt, und Unbekanntes bleibt unbekannt. */
var duenn = R.chance(ja, { buch: 'smarkets', richtung: 'nein', qe: 2.10, geld: 12 });
ok('die duennere Seite begrenzt den Einsatz', duenn.maxEinsatz < 30, duenn.maxEinsatz);
var ohneMenge = R.chance(ja, { buch: 'smarkets', richtung: 'nein', qe: 2.10, geld: null });
ok('unbekannte Menge heisst null, nicht unbegrenzt', ohneMenge.maxEinsatz === null);
ok('und dann gibt es auch keinen Maximalgewinn',    ohneMenge.maxGewinn === null);

/* ---------- Alle Kombinationen ---------- */

var seiten = [
  { buch: 'polymarket', richtung: 'ja',   qe: 2.20, geld: 500 },
  { buch: 'polymarket', richtung: 'nein', qe: 1.90, geld: 500 },
  { buch: 'smarkets',   richtung: 'ja',   qe: 2.05, geld: 500 },
  { buch: 'smarkets',   richtung: 'nein', qe: 2.10, geld: 500 },
  { buch: 'betfair',    richtung: 'ja',   qe: 2.15, geld: 500 },
  { buch: 'betfair',    richtung: 'nein', qe: 1.95, geld: 500 }
];
var alle = R.alleChancen(seiten, null);
ok('drei Buecher ergeben sechs gerichtete Paarungen', alle.length === 6, alle.length);
ok('kein Paar nutzt zweimal dasselbe Buch',
   alle.every(function (x) { return x.ja.buch !== x.nein.buch; }));
ok('jedes Paar ist JA gegen NEIN',
   alle.every(function (x) { return x.ja.richtung === 'ja' && x.nein.richtung === 'nein'; }));
ok('die beste Rendite steht vorn',
   alle[0].ergebnis.rendite >= alle[alle.length - 1].ergebnis.rendite);

var nurPlus = R.alleChancen(seiten, 0.5);
ok('mit Mindestrendite bleibt nur uebrig, was sie erreicht',
   nurPlus.every(function (x) { return x.ergebnis.rendite >= 0.5; }));
ok('und es sind weniger als ohne Filter', nurPlus.length < alle.length, nurPlus.length);
ok('leere Liste ergibt keine Paarung', R.alleChancen([], null).length === 0);
ok('null ergibt keine Paarung',        R.alleChancen(null, null).length === 0);
ok('ein einziges Buch ergibt keine Paarung',
   R.alleChancen([seiten[0], seiten[1]], null).length === 0);

/* ---------- Ergebnis ---------- */

console.log('\nRechnung: ' + gut + ' von ' + (gut + schlecht) + ' Pruefungen bestanden');
if (schlecht) {
  console.log('\nNICHT bestanden:');
  console.log(offen.join('\n'));
  process.exit(1);
}
console.log('alles gruen\n');
