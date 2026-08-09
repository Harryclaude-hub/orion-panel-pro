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

nah('PM-Gebuehr p=0.50, 5 %, exp 1 -> 0.025', R.gebuehrPm(0.50, 0.05, 1), 0.025);
nah('PM-Gebuehr p=0.20, 5 %, exp 1 -> 0.010', R.gebuehrPm(0.20, 0.05, 1), 0.010);
nah('PM-Gebuehr p=0.80 ist gleich wie p=0.20 (min(p,1-p))',
    R.gebuehrPm(0.80, 0.05, 1), R.gebuehrPm(0.20, 0.05, 1));
nah('PM-Gebuehr p=0.49, 4 % -> 0.0196', R.gebuehrPm(0.49, 0.04, 1), 0.0196);
nah('PM-Gebuehr ohne Exponent nimmt 1',  R.gebuehrPm(0.30, 0.05, undefined), 0.015);
nah('PM-Gebuehr unbekannter Satz rechnet mit 7 %', R.gebuehrPm(0.50, undefined, 1), 0.035);

ok('PM-Gebuehr ist bei p=0.50 am hoechsten',
   R.gebuehrPm(0.50, 0.05, 1) > R.gebuehrPm(0.35, 0.05, 1) &&
   R.gebuehrPm(0.50, 0.05, 1) > R.gebuehrPm(0.65, 0.05, 1));

ok('PM-Gebuehr p=0 abgewiesen',   R.gebuehrPm(0, 0.05, 1) === null);
ok('PM-Gebuehr p=1 abgewiesen',   R.gebuehrPm(1, 0.05, 1) === null);
ok('PM-Gebuehr p=1.5 abgewiesen', R.gebuehrPm(1.5, 0.05, 1) === null);
ok('PM-Gebuehr p negativ abgewiesen', R.gebuehrPm(-0.2, 0.05, 1) === null);

/* ---------- Polymarket Effektivquote ---------- */

nah('PM p=0.50 bei 5 % -> 1.95',   R.qePm(0.50, 0.05, 1), 1.95);
nah('PM p=0.25 bei 5 % -> 3.95',   R.qePm(0.25, 0.05, 1), 3.95);
nah('PM p=0.50 ohne Gebuehr -> 2', R.qePm(0.50, 0, 1), 2);

ok('PM p=0 abgewiesen',    R.qePm(0, 0.05, 1) === null);
ok('PM p=1 abgewiesen',    R.qePm(1, 0.05, 1) === null);
ok('PM p=0.999 bei 7 % ergibt keine Quote ueber 1 und wird abgewiesen',
   R.qePm(0.999, 0.07, 1) === null || R.qePm(0.999, 0.07, 1) > 1);

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
 * Das ist der Beweis, dass feePm = 0 reihenweise Scheinchancen erzeugt. */

var ohne = R.pmGegenBf({ pmPreis: 0.49, pmSatz: 0, pmExponent: 1, bfQuote: 2.03, bfGebuehr: 0.05 });
var mit4 = R.pmGegenBf({ pmPreis: 0.49, pmSatz: 0.04, pmExponent: 1, bfQuote: 2.03, bfGebuehr: 0.05 });

nah('Scheinchance ohne PM-Gebuehr: +0.46 %', ohne.rendite, 0.46, 0.01);
ok('... und wird faelschlich als Arbitrage gemeldet', ohne.istArbitrage === true);
nah('Mit 4 % PM-Gebuehr: -0.52 %',           mit4.rendite, -0.52, 0.01);
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

/* Die Kalshi-Gebuehr ist bei Zweikaempfen kleiner als die von Polymarket,
 * weil p*(1-p) schneller faellt als min(p,1-p). Das gehoert gewusst. */
ok('bei p=0.50 ist Kalshi guenstiger als Polymarket bei gleichem Satz',
   R.gebuehrKalshi(0.50, 0.05) < R.gebuehrPm(0.50, 0.05, 1),
   R.gebuehrKalshi(0.50, 0.05) + ' gegen ' + R.gebuehrPm(0.50, 0.05, 1));

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

/* ---------- Ergebnis ---------- */

console.log('\nRechnung: ' + gut + ' von ' + (gut + schlecht) + ' Pruefungen bestanden');
if (schlecht) {
  console.log('\nNICHT bestanden:');
  console.log(offen.join('\n'));
  process.exit(1);
}
console.log('alles gruen\n');
