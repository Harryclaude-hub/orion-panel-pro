/* Orion Panel Pro — Spiegel-Pruefstand
 *
 * Haelt die BROWSER-Fassung gegen die SERVER-Fassung:
 *     js/rechnung.js   gegen  supabase/functions/orion-lauf/rechnung.ts
 *     js/zuordnung.js  gegen  supabase/functions/orion-lauf/zuordnung.ts
 *
 * WARUM ES DIESEN PRUEFSTAND GIBT
 *
 * Die beiden Fassungen sind Kopien voneinander. Am 10.8.2026 liefen sie
 * dreimal auseinander (maxEinsatz, kalshiIndex, Halbzeit) und es fiel jedes
 * Mal nur zufaellig auf. Am Abend des 10.8. war der Zustand schlimmer als
 * gedacht: die im Repo liegende zuordnung.ts kannte weder direktPaare noch
 * ouArt noch die fuenf neuen Fragearten — waehrend die deployte Fassung sie
 * laengst hatte. Ein Re-Deploy aus dem Repo haette den Scanner von neun
 * Fragen auf vier zurueckgeworfen, ohne dass ein einziger Test angeschlagen
 * haette. Denn die 604 bestehenden Pruefungen testen nur die JS-Seite.
 *
 * Dieser Prüfstand schlaegt in DREI Faellen an:
 *   1. Eine Funktion fehlt auf einer Seite      (der Fall vom 10.8.)
 *   2. Eine Konstante hat verschiedene Werte
 *   3. Dieselbe Eingabe liefert verschiedene Ergebnisse
 *
 * Fall 1 ist der wichtigste: er faengt genau das, was still passiert.
 *
 * NICHT geprueft wird die Gleichheit des Quelltextes. Die Fassungen duerfen
 * verschieden AUSSEHEN — TypeScript gegen ES5, Schleifen gegen filter() —
 * sie muessen sich nur gleich VERHALTEN.
 */

'use strict';

const pfad = require('path');
const wurzel = pfad.join(__dirname, '..');

let ok = 0;
const fehler = [];

function pruefe(name, bedingung, hinweis) {
  if (bedingung) { ok++; return; }
  fehler.push(name + (hinweis ? '  —  ' + hinweis : ''));
}

/* Tiefer Vergleich, der die drei Zustaende auseinanderhaelt:
 * null, undefined und NaN sind DREI verschiedene Dinge, nicht eins. */
function gleich(a, b) {
  if (a === null || b === null) return a === b;
  if (a === undefined || b === undefined) return a === b;
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    if (!isFinite(a) || !isFinite(b)) return a === b;
    return Math.abs(a - b) < 1e-12;
  }
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map) || !(b instanceof Map)) return false;
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k)) return false;
      if (!gleich(v, b.get(k))) return false;
    }
    return true;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!gleich(a[k], b[k])) return false;
  }
  return true;
}

function zeig(x) {
  try {
    return JSON.stringify(x, (k, v) => (v === undefined ? '<undefined>' : v));
  } catch { return String(x); }
}

/* ---------- Was absichtlich nur auf EINER Seite steht ----------
 *
 * Jeder Eintrag braucht einen Grund. Eine Ausnahme ohne Grund ist eine
 * Ausnahme, die beim naechsten Mal jemand blind erweitert. */
const NUR_SERVER = {
  'zuordnung:aehnlichkeitW': 'Wortlisten-Variante. Der Scanner vergleicht je Lauf ' +
    'Zehntausende Paare und wuerde dieselben Namen sonst immer wieder zerlegen. ' +
    'Verhalten deckungsgleich mit aehnlichkeit() — unten mit denselben Eingaben geprueft.',
  'zuordnung:namensgleichheitW': 'dito fuer namensgleichheit()',
  'zuordnung:kalshiIndex': 'Wortindex ueber die Kalshi-Maerkte. Reine Beschleunigung ' +
    'des Scanners; die Website haelt nie alle Kalshi-Maerkte im Speicher.',
  'zuordnung:kalshiKandidaten': 'gehoert zu kalshiIndex',
  'zuordnung:bfSatzVon': 'liest den Kommissionssatz aus einem Betfair-Markt. Die ' +
    'Website bekommt den Satz fertig aus der Datenbank.'
};
const NUR_BROWSER = {
  'rechnung:pmGegenBf': 'bequemer Weg fuer den haeufigsten Fall, nur in der Anzeige benutzt',
  'rechnung:pmGegenKalshi': 'dito',
  'rechnung:haftung': 'Anzeigehilfe fuer die Karte',
  'rechnung:maxHaftung': 'Anzeigehilfe fuer die Karte'
};

function vergleicheOberflaeche(modul, browser, server) {
  const bF = Object.keys(browser).filter(k => typeof browser[k] === 'function').sort();
  const sF = Object.keys(server).filter(k => typeof server[k] === 'function').sort();

  for (const f of sF) {
    if (bF.includes(f)) continue;
    const schluessel = modul + ':' + f;
    pruefe('Funktion ' + schluessel + ' fehlt in der Browser-Fassung',
           Object.prototype.hasOwnProperty.call(NUR_SERVER, schluessel),
           'Steht nur im Server-Spiegel. Entweder nachziehen oder in NUR_SERVER ' +
           'eintragen — mit Grund.');
  }
  for (const f of bF) {
    if (sF.includes(f)) continue;
    const schluessel = modul + ':' + f;
    pruefe('Funktion ' + schluessel + ' fehlt in der Server-Fassung',
           Object.prototype.hasOwnProperty.call(NUR_BROWSER, schluessel),
           'Steht nur in der Browser-Fassung. Entweder nachziehen oder in ' +
           'NUR_BROWSER eintragen — mit Grund.');
  }

  /* Konstanten: gleicher Name, gleicher Wert. Ein auseinandergelaufener
   * Gebuehrensatz waere der teuerste Fehler ueberhaupt — er erzeugt
   * Scheinrenditen, die auf der Website anders aussehen als im Scanner. */
  for (const k of Object.keys(server)) {
    if (typeof server[k] === 'function') continue;
    if (!Object.prototype.hasOwnProperty.call(browser, k)) continue;
    pruefe('Konstante ' + modul + ':' + k + ' gleich',
           gleich(browser[k], server[k]),
           'Browser ' + zeig(browser[k]) + ' gegen Server ' + zeig(server[k]));
  }
}

function vergleicheAufrufe(modul, browser, server, faelle) {
  for (const [fn, argListen] of Object.entries(faelle)) {
    if (typeof browser[fn] !== 'function' || typeof server[fn] !== 'function') {
      pruefe('Aufrufvergleich ' + modul + ':' + fn + ' moeglich', false,
             'Funktion fehlt auf einer Seite — der Vergleich kann nicht laufen.');
      continue;
    }
    argListen.forEach((args, i) => {
      let a, b, fehlerA = null, fehlerB = null;
      try { a = browser[fn](...args); } catch (e) { fehlerA = String(e && e.message); }
      try { b = server[fn](...args); } catch (e) { fehlerB = String(e && e.message); }
      pruefe(modul + ':' + fn + ' Fall ' + i + ' wirft gleich',
             (fehlerA === null) === (fehlerB === null),
             'Browser ' + (fehlerA || 'ok') + ' gegen Server ' + (fehlerB || 'ok') +
             ' bei ' + zeig(args));
      if (fehlerA !== null || fehlerB !== null) return;
      pruefe(modul + ':' + fn + ' Fall ' + i,
             gleich(a, b),
             'bei ' + zeig(args) + ': Browser ' + zeig(a) + ' gegen Server ' + zeig(b));
    });
  }
}

/* ---------- Eingaben ----------
 *
 * Sie sollen nicht nur den Normalfall treffen, sondern die Raender: null,
 * undefined, NaN, Werte auf der Schwelle, Werte knapp darueber und darunter.
 * Ein Spiegel laeuft selten im Normalfall auseinander — er laeuft am Rand
 * auseinander, wo die eine Fassung null liefert und die andere 0. */
const ZAHLEN = [null, undefined, NaN, Infinity, -1, 0, 0.001, 0.01, 0.5, 0.999, 1, 1.01,
                1.5, 2, 2.5, 3.33, 5, 100, 1000, '0.5', 'abc'];
const SAETZE = [null, undefined, NaN, -0.1, 0, 0.01, 0.02, 0.03, 0.07, 0.5, 0.999, 1, 2];

function paareVon(a, b) {
  const aus = [];
  for (const x of a) for (const y of b) aus.push([x, y]);
  return aus;
}

const NAMEN = [
  null, undefined, '', '   ', 'Palermo FC', 'palermo', 'CD Nacional',
  'Nacional da Madeira', 'Cruzeiro EC vs. CR Flamengo', 'Flamengo v EC Vitoria Salvador',
  'Independiente Medellin', 'Ind. Medellin', 'Minnesota United FC', 'Minnesota Utd',
  'Bayern München', 'Bayern Munchen', 'FK Bodø/Glimt', 'Real Madrid v FC Barcelona',
  'Italy vs Bahrain', 'Under 3.5 Goals vs Over 3.5 Goals', 'A v The Draw',
  'Cruz Azul vs New York City Winner?', 'Palermo vs Juventus Winner?',
  'Charlotte FC vs. CF Pachuca: Draw at halftime?', 'The Draw', 'Draw', 'Tie',
  'Over 2.5 Goals', 'Under 2.5 Goals', 'Yes', 'No', '200', 'will'
];

const TEILE = [
  null, undefined, '', 'O/U 2.5', 'O/U 0.5', 'o/u 2.5', ' O/U 2.5 ',
  '1st Half O/U 0.5', '2nd Half O/U 0.5', 'Total Corners: O/U 7.5',
  '1st Half Total Corners: O/U 3.5', '2nd Half Total Corners: O/U 3.5',
  'FK Bodø/Glimt O/U 0.5', 'Both Teams to Score',
  'Both Teams to Score in First Half', 'Draw', 'draw', 'Palermo FC', 'O/U'
];

const FRAGEN = [
  null, undefined, '', 'Will Palermo FC win on 2026-08-11?',
  'Will the match end in a draw?', 'Charlotte FC leading at halftime?',
  'Charlotte FC to win the second half?',
  'Charlotte FC vs. CF Pachuca: Draw at halftime?',
  'Charlotte FC vs. CF Pachuca: Second half draw?',
  'Will Bitcoin hit $200,000?', 'Will the Republican Party win?'
];

const LAEUFER = [
  [{ n: 'Palermo', b: 2.5, l: 2.6, bs: 100, ls: 80, typ: 'HOME' },
   { n: 'The Draw', b: 3.4, l: 3.5, bs: 50, ls: 40, typ: 'DRAW' },
   { n: 'Juventus', b: 2.9, l: 3.0, bs: 70, ls: 60, typ: 'AWAY' }],
  [{ n: 'Over 2.5 Goals', b: 1.9, l: 1.95, bs: 200, ls: 150, typ: 'OVER' },
   { n: 'Under 2.5 Goals', b: 2.0, l: 2.05, bs: 180, ls: 140, typ: 'UNDER' }],
  [{ n: 'Yes', b: 1.8, l: 1.85, bs: 90, ls: 70, typ: 'YES' },
   { n: 'No', b: 2.2, l: 2.25, bs: 95, ls: 75, typ: 'NO' }],
  [], null, undefined
];

const BF_MAERKTE = [
  { k: 'Italy vs Bahrain', ev: 'Italy v Bahrain', mt: 'MATCH_ODDS', st: '', link: 'market/1.23', sz: 0.05, r: LAEUFER[0] },
  { k: 'Under 3.5 Goals vs Over 3.5 Goals', ev: 'Real Madrid v FC Barcelona', mt: 'OVER_UNDER_35', st: '', link: 'market/1.24', sz: null, r: LAEUFER[1] },
  { k: 'Palermo vs Juventus', ev: 'Palermo v Juventus', mt: 'MATCH_ODDS', st: '', link: 'market/1.25', sz: 0.02, r: LAEUFER[0] }
];

const SM_TYPEN = [
  null, undefined, {}, { name: 'WINNER_3_WAY' }, { name: 'HALF_TIME_WINNER_3_WAY' },
  { name: 'BTTS' }, { name: 'OVER_UNDER', param: '2.5' },
  { name: 'FIRST_HALF_OVER_UNDER', param: '0.5' },
  { name: 'SECOND_HALF_OVER_UNDER', param: '1.5' },
  { name: 'CORNERS_OVER_UNDER', param: '7.5' },
  { name: 'SECOND_HALF_HOME_TEAM_OVER_UNDER', param: '0.5' },
  { name: 'AWAY_CORNERS_OVER_UNDER', param: '3.5' },
  { name: 'CORNERS_HANDICAP', param: '1.5' },
  { name: 'OVER_UNDER', param: 'keine Zahl' }, { name: 'OVER_UNDER' }
];

const TICKER = [
  null, undefined, '', 'KXEFLCUPGAME-26AUG10PAEXC', 'KXLOLGAME-26AUG110400DNFHLE',
  'KXCLUBFGAME-26AUG11PALJUV', 'KX-26FEB29ABC', 'KX-26XXX10ABC', 'KX-26AUG112599ABC'
];

async function main() {
  const bR = require(pfad.join(wurzel, 'js', 'rechnung.js'));
  const bZ = require(pfad.join(wurzel, 'js', 'zuordnung.js'));
  const sR = await import('file://' + pfad.join(wurzel, 'supabase', 'functions', 'orion-lauf', 'rechnung.ts').replace(/\\/g, '/'));
  const sZ = await import('file://' + pfad.join(wurzel, 'supabase', 'functions', 'orion-lauf', 'zuordnung.ts').replace(/\\/g, '/'));

  vergleicheOberflaeche('rechnung', bR, sR);
  vergleicheOberflaeche('zuordnung', bZ, sZ);

  vergleicheAufrufe('rechnung', bR, sR, {
    gebuehrSicher: SAETZE.map(x => [x]),
    smQuote: ZAHLEN.concat([9, 10, 11, 4032, 9901, 9902, 9999]).map(x => [x]),
    smGeld: paareVon([null, undefined, NaN, 0, -1, 67, 3700277, 2147483646, 400000],
                     [null, NaN, 0, 9, 10, 4032, 5291, 9901, 9999]),
    qeBack: paareVon(ZAHLEN, SAETZE),
    qeLay: paareVon(ZAHLEN, SAETZE),
    qePm: paareVon(ZAHLEN, SAETZE).map(([p, s]) => [p, s, 1])
      .concat(paareVon(ZAHLEN, SAETZE).map(([p, s]) => [p, s, 2]))
      .concat([[0.5, 0.02, null], [0.5, 0.02, 0], [0.5, 0.02, -1], [0.5, 0.02, NaN]]),
    gebuehrPm: paareVon(ZAHLEN, SAETZE).map(([p, s]) => [p, s, 1]),
    qeKalshi: paareVon(ZAHLEN, SAETZE),
    gebuehrKalshi: paareVon(ZAHLEN, SAETZE),
    pruefe: paareVon([null, NaN, 1, 1.0001, 1.5, 2, 2.5, 100], [null, NaN, 1, 1.0001, 1.5, 2, 2.5, 100])
      .map(([a, b]) => [a, b, 100])
      .concat([[2, 2, null], [2, 2, 0], [2, 2, -5], [2, 2, 1], [2, 2, 1e6]]),
    quoteOhneGebuehr: [].concat(
      ...['anteil', 'kontrakt', 'back', 'lay', 'unfug'].map(f => ZAHLEN.map(x => [f, x]))),
    gebuehrBetrag: [].concat(
      ...['anteil', 'kontrakt', 'back', 'lay', 'unfug'].map(f =>
        [].concat(...[null, 0, -1, 1, 15.0008, 50, 100].map(s =>
          ZAHLEN.map(r => [f, s, r, 2.0])))))
      .concat([
        ['anteil', 100, 0.5, 1.96], ['kontrakt', 100, 0.84, 1.1735],
        ['back', 100, 6.798, 6.6820], ['lay', 100, 2.5, 1.6533],
        ['back', 100, 2.0, 2.0], ['back', 100, 2.0, 2.5], ['anteil', 100, 0.5, 2.0]
      ]),
    maxEinsatz: [
      [null, 10, 10],
      [{ s1: 15, s2: 85, einsatz: 100 }, 6.65, 918.7],
      [{ s1: 15, s2: 85, einsatz: 100 }, null, 918.7],
      [{ s1: 15, s2: 85, einsatz: 100 }, 6.65, null],
      [{ s1: 15, s2: 85, einsatz: 100 }, 0, 918.7],
      [{ s1: 15, s2: 85, einsatz: 100 }, -1, 918.7],
      [{ s1: 0, s2: 100, einsatz: 100 }, 10, 10],
      [{ s1: 50, s2: 50, einsatz: 100 }, 10, 10]
    ],
    chance: [
      [null, null, 100],
      [{ buch: 'a', richtung: 'ja', qe: 2, geld: 10 }, { buch: 'a', richtung: 'nein', qe: 2, geld: 10 }, 100],
      [{ buch: 'a', richtung: 'ja', qe: 2, geld: 10 }, { buch: 'b', richtung: 'ja', qe: 2, geld: 10 }, 100],
      [{ buch: 'a', richtung: 'nein', qe: 2, geld: 10 }, { buch: 'b', richtung: 'nein', qe: 2, geld: 10 }, 100],
      [{ buch: 'a', richtung: 'ja', qe: 2.1, geld: 10 }, { buch: 'b', richtung: 'nein', qe: 2.1, geld: 10 }, 100],
      [{ buch: 'a', richtung: 'ja', qe: 2.1, geld: null }, { buch: 'b', richtung: 'nein', qe: 2.1, geld: 10 }, 100],
      [{ buch: '', richtung: 'ja', qe: 2.1, geld: 10 }, { buch: 'b', richtung: 'nein', qe: 2.1, geld: 10 }, 100]
    ],
    alleChancen: [
      [null, null, 100], [[], -1, 100],
      [[{ buch: 'pm', richtung: 'ja', qe: 2.1, geld: 10 },
        { buch: 'sm', richtung: 'nein', qe: 2.1, geld: 10 },
        { buch: 'ka', richtung: 'nein', qe: 1.9, geld: 5 }], -1, 100],
      [[{ buch: 'pm', richtung: 'ja', qe: 2.1, geld: 10 },
        { buch: 'sm', richtung: 'nein', qe: 2.1, geld: 10 }], null, 100],
      [[{ buch: 'pm', richtung: 'ja', qe: 2.1, geld: 10 },
        { buch: 'sm', richtung: 'nein', qe: 2.1, geld: 10 }], 99, 100]
    ]
  });

  vergleicheAufrufe('zuordnung', bZ, sZ, {
    norm: NAMEN.map(x => [x]),
    woerter: NAMEN.map(x => [x]),
    aehnlichkeit: paareVon(NAMEN, NAMEN),
    namensgleichheit: paareVon(NAMEN, NAMEN),
    paar: NAMEN.map(x => [x]),
    kalshiPaar: NAMEN.map(x => [x]),
    ohneAnhang: NAMEN.map(x => [x])
      .concat([['Palermo FC total corners'], ['A v B halftime result'],
               ['A v B correct score'], ['A v B double chance'], ['A v B draw no bet']]),
    ouLinie: TEILE.map(x => [x]),
    ouArt: TEILE.map(x => [x]),
    bfOuLinie: [null, undefined, '', 'OVER_UNDER_25', 'OVER_UNDER_05', 'OVER_UNDER_355',
                'MATCH_ODDS', 'over_under_25'].map(x => [x]),
    marktArt: paareVon(FRAGEN, TEILE),
    smMarktArt: SM_TYPEN.map(x => [x]),
    kalshiZeit: TICKER.map(x => [x]),
    partieVon: BF_MAERKTE.map(x => [x]).concat([[null], [undefined]]),
    drawLaeufer: LAEUFER.map(x => [x]),
    ouLaeufer: LAEUFER.map(x => [x]),
    laeuferZu: [].concat(...['Palermo', 'Juventus', 'Yes', 'Over 2.5 Goals', '', null]
      .map(n => LAEUFER.map(l => [n, l, 0.8])))
      .concat([['Palermo', LAEUFER[0], 0], ['Palermo', LAEUFER[0], 1]]),
    ouKandidaten: [[BF_MAERKTE, 3.5], [BF_MAERKTE, 2.5], [BF_MAERKTE, null], [null, 3.5]],
    seiteVon: [].concat(...NAMEN.map(n =>
      [[n, ['palermo', 'juventus']], [n, null], [n, ['real madrid', 'fc barcelona']]])),
    gleicheSeite: [].concat(...['a', 'b', 'unentschieden', null].map(x =>
      ['a', 'b', 'unentschieden', null].map(y => [x, y, false])))
      .concat([].concat(...['a', 'b', 'unentschieden', null].map(x =>
        ['a', 'b', 'unentschieden', null].map(y => [x, y, true])))),
    besterTreffer: [
      ['italy', 'bahrain', BF_MAERKTE, 0.5],
      ['palermo', 'juventus', BF_MAERKTE, 0.5],
      ['real madrid', 'fc barcelona', BF_MAERKTE, 0.5],
      ['unbekannt', 'auchnicht', BF_MAERKTE, 0.5],
      ['italy', 'bahrain', BF_MAERKTE, 1],
      ['italy', 'bahrain', [], 0.5],
      ['', 'bahrain', BF_MAERKTE, 0.5],
      ['italy', 'bahrain', null, 0.5]
    ],
    smOuKandidaten: [
      [[{ linie: 2.5 }, { linie: 3.5 }], 2.5],
      [[{ linie: 2.5 }, { linie: 3.5 }], 9.5],
      [[{ linie: 2.5 }], null], [null, 2.5], [[{ linie: 2.5 }], NaN]
    ],
    smLaeufer: [].concat(...['sieger', 'hz_sieger', 'unentschieden', 'hz_unentschieden',
                             'btts', 'ueber_unter', 'hz1_ueber_unter', 'hz2_ueber_unter',
                             'ecken_ueber_unter', 'unbekannt'].map(art => [
      [art, 'Palermo', ['palermo', 'juventus'], LAEUFER[0], false, 0.8, false],
      [art, 'Palermo', ['palermo', 'juventus'], LAEUFER[0], true, 0.8, false],
      [art, 'Palermo', ['palermo', 'juventus'], LAEUFER[0], false, 0.8, true],
      [art, 'Yes', ['palermo', 'juventus'], LAEUFER[2], false, 0.8, false],
      [art, 'Palermo', null, LAEUFER[0], false, 0.8, false],
      [art, null, ['palermo', 'juventus'], LAEUFER[0], false, 0.8, false],
      [art, 'Palermo', ['palermo', 'juventus'], [], false, 0.8, false]
    ])),
    direktPaare: [
      [null, null, 0.5, 120],
      [[], [], 0.5, 120],
      [[{ id: 'x', partie: ['palermo', 'juventus'], zeit: 1000 }],
       [{ id: 'y', partie: ['palermo', 'juventus'], zeit: 2000 }], 0.5, 120],
      /* Mehrdeutig: EINE Smarkets-Partie trifft ZWEI auf der Gegenseite.
       * Muss auf beiden Seiten gleich verworfen werden — das ist Regel 10. */
      [[{ id: 'x', partie: ['palermo', 'juventus'], zeit: 1000 }],
       [{ id: 'y1', partie: ['palermo', 'juventus'], zeit: 1000 },
        { id: 'y2', partie: ['palermo', 'juventus'], zeit: 1000 }], 0.5, 120],
      /* Zeitlich zu weit auseinander */
      [[{ id: 'x', partie: ['palermo', 'juventus'], zeit: 0 }],
       [{ id: 'y', partie: ['palermo', 'juventus'], zeit: 999 * 3600000 }], 0.5, 120],
      /* Zeit unbekannt auf einer Seite: kein Grund abzuweisen */
      [[{ id: 'x', partie: ['palermo', 'juventus'], zeit: null }],
       [{ id: 'y', partie: ['palermo', 'juventus'], zeit: 999 * 3600000 }], 0.5, 120],
      [[{ id: 'x', partie: ['cruzeiro', 'flamengo'], zeit: 0 }],
       [{ id: 'y', partie: ['flamengo', 'vitoria salvador'], zeit: 0 }], 0.5, 120]
    ]
  });

  /* Die Wortlisten-Varianten sind nur schneller, nicht anders. Wenn das je
   * auseinanderlaeuft, rechnet der Scanner andere Aehnlichkeiten als die
   * Website — und niemand sieht es, weil beide fuer sich stimmig bleiben. */
  for (const [a, b] of paareVon(NAMEN, NAMEN)) {
    const A = sZ.woerter(a), B = sZ.woerter(b);
    pruefe('aehnlichkeitW deckt sich mit aehnlichkeit bei ' + zeig([a, b]),
           gleich(sZ.aehnlichkeitW(A, B), bZ.aehnlichkeit(a, b)));
    pruefe('namensgleichheitW deckt sich mit namensgleichheit bei ' + zeig([a, b]),
           gleich(sZ.namensgleichheitW(A, B), bZ.namensgleichheit(a, b)));
  }

  /* ---------- Die Gebuehr in Geld, gegen die Auszahlung nachgerechnet ----------
   *
   * Kein Spiegelvergleich, sondern eine Rechenprobe: der Betrag MUSS die
   * Differenz der beiden Auszahlungen sein. Wenn diese Probe faellt, ist die
   * angezeigte Gebuehr eine erfundene Zahl. */
  const proben = [
    { form: 'anteil',   roh: 0.5,  satz: 0.02, qe: null },
    { form: 'anteil',   roh: 0.25, satz: 0.07, qe: null },
    { form: 'kontrakt', roh: 0.84, satz: 0.07, qe: null },
    { form: 'kontrakt', roh: 0.5,  satz: 0.07, qe: null },
    { form: 'back',     roh: 2.5,  satz: 0.02, qe: null },
    { form: 'back',     roh: 6.798, satz: 0.02, qe: null },
    { form: 'lay',      roh: 2.5,  satz: 0.02, qe: null },
    { form: 'lay',      roh: 1.5,  satz: 0.05, qe: null }
  ];
  for (const p of proben) {
    const qe = p.form === 'anteil'   ? bR.qePm(p.roh, p.satz, 1)
             : p.form === 'kontrakt' ? bR.qeKalshi(p.roh, p.satz)
             : p.form === 'back'     ? bR.qeBack(p.roh, p.satz)
             :                          bR.qeLay(p.roh, p.satz);
    const einsatz = 100;
    const betrag = bR.gebuehrBetrag(p.form, einsatz, p.roh, qe);
    const ohne = bR.quoteOhneGebuehr(p.form, p.roh);
    pruefe('Gebuehrbetrag ' + p.form + ' bei ' + p.roh + ' ist die Differenz der Auszahlungen',
           betrag !== null && Math.abs(betrag - (einsatz * ohne - einsatz * qe)) < 1e-9,
           'Betrag ' + betrag + ', erwartet ' + (einsatz * ohne - einsatz * qe));
    pruefe('Gebuehrbetrag ' + p.form + ' bei ' + p.roh + ' ist positiv',
           betrag > 0, 'Betrag ' + betrag);
    /* Der Betrag muss sich mit dem Einsatz linear verhalten — sonst stimmt
     * die Hochrechnung auf max_einsatz nicht. */
    const doppelt = bR.gebuehrBetrag(p.form, einsatz * 2, p.roh, qe);
    pruefe('Gebuehrbetrag ' + p.form + ' skaliert linear',
           Math.abs(doppelt - 2 * betrag) < 1e-9);
  }

  /* Ohne Gebuehr darf kein Betrag entstehen. */
  for (const form of ['anteil', 'kontrakt', 'back', 'lay']) {
    const roh = form === 'anteil' || form === 'kontrakt' ? 0.5 : 2.5;
    const qe = bR.quoteOhneGebuehr(form, roh);
    const betrag = bR.gebuehrBetrag(form, 100, roh, qe);
    pruefe('Gebuehrbetrag ' + form + ' ist 0, wenn keine Gebuehr anfaellt',
           betrag !== null && Math.abs(betrag) < 1e-9, 'Betrag ' + betrag);
  }

  /* Unbekannt bleibt unbekannt: eine nicht ausrechenbare Gebuehr wird nicht
   * zu 0. Das ist dieselbe Regel wie bei der unbekannten Menge. */
  pruefe('Gebuehrbetrag bei unbekannter Form ist null',
         bR.gebuehrBetrag('unfug', 100, 0.5, 1.9) === null);
  pruefe('Gebuehrbetrag ohne Einsatz ist null',
         bR.gebuehrBetrag('anteil', null, 0.5, 1.9) === null);
  pruefe('Gebuehrbetrag bei qe unter 1 ist null',
         bR.gebuehrBetrag('anteil', 100, 0.5, 0.5) === null);

  console.log('');
  if (fehler.length) {
    console.log('SPIEGEL LAEUFT AUSEINANDER — ' + fehler.length + ' Abweichungen:');
    console.log('');
    for (const f of fehler.slice(0, 40)) console.log('  ' + f);
    if (fehler.length > 40) console.log('  ... und ' + (fehler.length - 40) + ' weitere');
    console.log('');
    console.log('Spiegel: ' + ok + ' bestanden, ' + fehler.length + ' fehlgeschlagen');
    process.exit(1);
  }
  console.log('Spiegel: ' + ok + ' von ' + ok + ' Pruefungen bestanden');
  console.log('Browser- und Server-Fassung verhalten sich gleich');
}

main().catch(e => { console.error('Pruefstand selbst gescheitert:', e); process.exit(1); });
