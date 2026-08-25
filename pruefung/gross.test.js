/* ===========================================================================
 * PRUEFUNG: GROSSE CHANCE (25.8.2026)
 * ===========================================================================
 * Anlass: der Sonego-Fall vom 24.8. Eine Zeile mit 7,30 % und 5196 $
 * handelbarer Tiefe stand 212 Minuten im System und wurde nie gemeldet -
 * nicht weil sie falsch war, sondern weil sie ueber dem Plausibilitaets-
 * deckel lag. Der Deckel filtert nach HOEHE; gemeint war BEWEISBARKEIT.
 *
 * Diese Datei haelt beide Richtungen fest:
 *   A) die gesunde grosse Zeile kommt durch (sonst waere die Marke nutzlos)
 *   B) jeder bekannte Fehlfund faellt, und zwar an der RICHTIGEN Bedingung
 *      (sonst faellt er nur zufaellig, und die Begruendung im Panel luegt)
 *
 * js/anzeige.js hat kein module.exports und laeuft im Browser. Deshalb wird
 * hier - wie in melder.test.js - eine schmale Browser-Umgebung gestellt und
 * die echte Datei geladen. Es wird DIE FASSUNG geprueft, die ausgeliefert
 * wird, keine Abschrift. Zwei Fassungen derselben Logik sind eine
 * dokumentierte Fehlerklasse dieses Projekts.
 * =========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const wurzel = path.join(__dirname, '..');

/* ---- schmale Browser-Umgebung ---- */
const nichts = () => {};
const knoten = () => ({
  style: {}, dataset: {}, classList: { add: nichts, remove: nichts, toggle: nichts, contains: () => false },
  appendChild: nichts, removeChild: nichts, setAttribute: nichts, getAttribute: () => null,
  addEventListener: nichts, querySelector: () => null, querySelectorAll: () => [],
  children: [], innerHTML: '', textContent: '', offsetParent: null
});
const sandkasten = {
  console, Date, Math, JSON, Number, String, Boolean, Array, Object, RegExp, isFinite, isNaN,
  parseInt, parseFloat, encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout,
  setInterval, clearInterval, TextEncoder, URL
};
sandkasten.globalThis = sandkasten;
sandkasten.window = sandkasten;
sandkasten.self = sandkasten;
sandkasten.navigator = { userAgent: 'pruefung', clipboard: null, language: 'de' };
sandkasten.location = { href: 'http://pruefung/', search: '', hash: '', protocol: 'http:' };
sandkasten.localStorage = {
  _d: {}, getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; },
  key(i) { return Object.keys(this._d)[i] || null; }, get length() { return Object.keys(this._d).length; }
};
sandkasten.document = {
  documentElement: knoten(), body: knoten(), head: knoten(),
  createElement: knoten, createTextNode: () => ({}),
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  addEventListener: nichts, removeEventListener: nichts,
  visibilityState: 'visible', hidden: false, title: ''
};
sandkasten.addEventListener = nichts;
sandkasten.removeEventListener = nichts;
sandkasten.requestAnimationFrame = (f) => setTimeout(f, 0);
sandkasten.cancelAnimationFrame = nichts;
sandkasten.matchMedia = () => ({ matches: false, addEventListener: nichts, addListener: nichts });
sandkasten.getComputedStyle = () => ({ getPropertyValue: () => '' });
sandkasten.fetch = () => Promise.reject(new Error('keine Netzzugriffe in der Pruefung'));
sandkasten.scrollBy = nichts;
sandkasten.scrollTo = nichts;

vm.createContext(sandkasten);
for (const datei of ['js/konfig.js', 'js/rechnung.js', 'js/zuordnung.js', 'js/anzeige.js']) {
  vm.runInContext(fs.readFileSync(path.join(wurzel, datei), 'utf8'), sandkasten, { filename: datei });
}

const GP = sandkasten.Anzeige && sandkasten.Anzeige.grossPruefung;
const K = sandkasten.KONFIG;

let fehler = 0;
function pruefe(name, bedingung, hinweis) {
  if (bedingung) { console.log('  ok   ' + name); }
  else { console.log('  FEHL ' + name + (hinweis ? '  -> ' + hinweis : '')); fehler++; }
}

console.log('\nGROSSE CHANCE - Pruefung vom 25.8.2026\n');

/* ---- Grundlagen ---- */
pruefe('grossPruefung ist nach aussen gereicht', typeof GP === 'function');
pruefe('KONFIG.gross steht an EINER Stelle', !!(K && K.gross));
if (typeof GP !== 'function' || !K || !K.gross) {
  console.log('\nAbbruch: die Grundlagen fehlen.\n');
  process.exit(1);
}
pruefe('Deckel der Klasse liegt ueber maxPlausibel',
       K.gross.deckel > K.maxPlausibel,
       'sonst kann die Klasse nie greifen');

/* ---- Baukasten: der Sonego-Fall vom 24.8., gesund ---- */
const j = Date.now();
const zeit = (msVersatz) => new Date(j + msVersatz).toISOString();

function sonego(aenderung) {
  const f = {
    schluessel: 'pm>bf:3780822',
    titel: 'Winston-Salem Open: Lorenzo Sonego vs Vit Kopriva',
    bf_partie: 'Lorenzo Sonego v Vit Kopriva',
    rendite: 7.30, rendite_netto: 5.72, beste_rendite: 7.30,
    buch_summe: 1.008524,
    max_einsatz: 5196.51, echter_gewinn: 379.35,
    zu_duenn: false, fehlpaarung: false, veraltet: false, pruefung: null, status: 'live',
    pm_seite: 'ja', pm_preis: 0.510, pm_gebuehr: 0, pm_gebuehr_echt: true,
    bf_seite: 'lay', bf_quote: 1.73, bf_gebuehr: 0.02, bf_gebuehr_echt: true,
    weg: 'pm>bf', buch: 'betfair', buch_1: 'polymarket',
    pm_link: 'https://polymarket.com/x', bf_link: 'https://betfair.com/x',
    pm_preis_seit: zeit(-12 * 1000),
    bf_quote_seit: zeit(-41 * 1000),
    beginnt_am: zeit(28 * 60000),
    endet_am: zeit(28 * 60000),
    zuerst_gesehen: zeit(-212 * 60000),
    zuletzt_gesehen: zeit(0)
  };
  return Object.assign(f, aenderung || {});
}

/* ---- A) die gesunde grosse Zeile kommt durch ---- */
console.log('\nA) Sonego bei LEBENDER Bridge - muss durchkommen');
const gesund = GP(sonego());
pruefe('keine einzige Bedingung gerissen', gesund.raus.length === 0,
       gesund.raus.join(' | '));
pruefe('Netto-Wert wird mitgegeben', Math.abs(gesund.netto - 5.72) < 0.01,
       'netto = ' + gesund.netto);

/* ---- B) wie es wirklich war: die Bridge stand ---- */
console.log('\nB) Sonego wie er WIRKLICH war - Betfair-Kurs 51,6 min alt');
const echt = GP(sonego({ bf_quote_seit: zeit(-3096 * 1000) }));
pruefe('faellt', echt.raus.length === 1, echt.raus.join(' | '));
pruefe('und zwar am Kursalter', /Kurs/.test(echt.raus[0] || ''), echt.raus[0]);

/* ---- C) jeder bekannte Fehlfund faellt an der RICHTIGEN Bedingung ---- */
console.log('\nC) Gegenprobe: bekannte Fehlfunde');
const gegen = [
  ['CSD Municipal, 184 % (9.8.)',        { rendite: 184.0 },                             /Obergrenze/],
  ['Pachuca gegen Pachuca U21 (19.8.)',  { endet_am: zeit((28 + 705) * 60000) },         /auseinander/],
  ['Kleber: Betfair 52 min alt (13.8.)', { bf_quote_seit: zeit(-3096 * 1000) },          /Kurs/],
  ['Anpfiff in 3 Minuten',               { beginnt_am: zeit(3 * 60000), endet_am: zeit(3 * 60000) }, /Anpfiff/],
  ['Cent-Gewinn im duennen Buch',        { max_einsatz: 12, echter_gewinn: 0.88, zu_duenn: true }, /Gewinn/],
  ['Gegenbuch unstimmig (0,9421)',       { buch_summe: 0.9421 },                         /Buchprobe/],
  ['Gebuehrensatz nur geschaetzt',       { bf_gebuehr_echt: false },                     /gesch/],
  ['nach Gebuehren nur 1,9 %',           { rendite_netto: 1.9 },                         /Geb.hren/],
  ['erst 20 s bewaehrt',                 { zuerst_gesehen: zeit(-20 * 1000) },           /bew.hrt/],
  ['vom Pruefer als falsch gestempelt',  { pruefung: 'falsch' },                         /Pr.fer/],
  ['Fehlpaarung',                        { fehlpaarung: true },                          /Fehlpaarung/],
  ['Kurse als veraltet gestempelt',      { veraltet: true },                             /veraltet/],
  ['Anpfiff auf einer Seite unbelegt',   { beginnt_am: null },                           /Anpfiff/]
];
for (const [name, aenderung, muster] of gegen) {
  const r = GP(sonego(aenderung));
  const gefallen = r.raus.length > 0;
  const richtig = r.raus.some((g) => muster.test(g));
  pruefe(name, gefallen && richtig,
         gefallen ? ('faellt, aber an: ' + r.raus.join(' | ')) : 'kommt DURCH - Loch!');
}

/* ---- D) die Klasse aendert nichts an bestehenden Zahlen ---- */
console.log('\nD) Nebenwirkungen');
pruefe('maxPlausibel unveraendert bei 6,5', K.maxPlausibel === 6.5);
pruefe('mindestRendite unveraendert bei 2', K.mindestRendite === 2);
const zweimal = JSON.stringify(GP(sonego()).raus) === JSON.stringify(GP(sonego()).raus);
pruefe('zweimal gerufen, gleiches Ergebnis', zweimal);

/* ---- Ergebnis ---- */
console.log('\n' + (fehler === 0
  ? 'Alles in Ordnung.\n'
  : fehler + ' Pruefung(en) fehlgeschlagen.\n'));
process.exit(fehler === 0 ? 0 : 1);
