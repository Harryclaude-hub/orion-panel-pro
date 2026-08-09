/* Pruefstand fuer js/zuordnung.js
 *
 * Schwerpunkt: die Fehlpaarungen aus Fehlerklasse 11 muessen ABGEWIESEN werden,
 * und jede Schutzregel braucht einen Test, der sie ausloest (Fehlerklasse 8).
 *
 * Aufruf:  node pruefung/zuordnung.test.js
 */

var Z = require('../js/zuordnung.js');

var gut = 0, schlecht = 0, offen = [];
function ok(name, bedingung, gemessen) {
  if (bedingung) { gut++; return; }
  schlecht++;
  offen.push('  ' + name + (gemessen !== undefined ? '   gemessen: ' + gemessen : ''));
}
function nah(name, a, b, tol) {
  var t = tol === undefined ? 1e-9 : tol;
  ok(name, typeof a === 'number' && Math.abs(a - b) <= t, a + ' statt ' + b);
}

/* ---------- Normalisierung ---------- */

ok('Akzente werden entfernt',      Z.norm('Atlético San Luis') === 'atletico san luis', Z.norm('Atlético San Luis'));
ok('Punkte werden zu Leerzeichen', Z.norm('St. Louis') === 'st louis', Z.norm('St. Louis'));
ok('Mehrfache Leerzeichen fallen zusammen', Z.norm('a    b') === 'a b');
ok('null wird zu leerem Text',     Z.norm(null) === '');
ok('undefined wird zu leerem Text', Z.norm(undefined) === '');

/* ---------- Stoppwoerter: die Regel MUSS anschlagen ---------- */

var w1 = Z.woerter('Will the Republican Party win the election');
ok('"will" ist kein Namensbeleg',   w1.indexOf('will') === -1, w1.join(','));
ok('"the" ist kein Namensbeleg',    w1.indexOf('the') === -1);
ok('"win" ist kein Namensbeleg',    w1.indexOf('win') === -1);
ok('"republican" bleibt erhalten',  w1.indexOf('republican') !== -1, w1.join(','));

var w2 = Z.woerter('200 - 250m');
ok('reine Zahlen sind kein Namensbeleg', w2.indexOf('200') === -1 && w2.indexOf('250') === -1, w2.join(','));

var w3 = Z.woerter('Chicago Fire FC');
ok('"fc" ist kein Namensbeleg',     w3.indexOf('fc') === -1, w3.join(','));
ok('"chicago" bleibt erhalten',     w3.indexOf('chicago') !== -1);
ok('"fire" bleibt erhalten',        w3.indexOf('fire') !== -1);

/* Die zwei echten Fehlpaarungen aus Fehlerklasse 11 */
nah('"200 - 250m" trifft NICHT "Bitcoin $200,000"',
    Z.aehnlichkeit('200 - 250m', 'Bitcoin $200,000'), 0);
nah('"Will Jacks" trifft NICHT "Will the Republican Party win"',
    Z.aehnlichkeit('Will Jacks', 'Will the Republican Party win'), 0);

/* ---------- Aehnlichkeit ---------- */

nah('gleicher Name -> 1.0',          Z.aehnlichkeit('Cruz Azul', 'Cruz Azul'), 1);
nah('Zusatz stoert nicht',           Z.aehnlichkeit('Austin', 'Austin FC'), 1);
nah('Akzentunterschied stoert nicht', Z.aehnlichkeit('Atlético San Luis', 'Atletico San Luis'), 1);
nah('voellig verschieden -> 0',      Z.aehnlichkeit('Liverpool', 'Real Madrid'), 0);
nah('leerer Name -> 0',              Z.aehnlichkeit('', 'Liverpool'), 0);
nah('nur Stoppwoerter -> 0',         Z.aehnlichkeit('the of and', 'Liverpool'), 0);
ok('Teiltreffer liegt zwischen 0 und 1',
   Z.aehnlichkeit('Manchester United', 'Manchester City') > 0 &&
   Z.aehnlichkeit('Manchester United', 'Manchester City') < 1.01);

/* ---------- Paar zerlegen ---------- */

var p1 = Z.paar('Italy vs Bahrain');
ok('"vs" wird zerlegt', p1 && p1[0] === 'italy' && p1[1] === 'bahrain', JSON.stringify(p1));

var p2 = Z.paar('Cruz Azul vs New York City vs The Draw');
ok('"vs The Draw" wird abgeschnitten',
   p2 && p2[0] === 'cruz azul' && p2[1] === 'new york city', JSON.stringify(p2));

var p3 = Z.paar('Italy v Bahrain');
ok('"v" wird zerlegt', p3 && p3[0] === 'italy' && p3[1] === 'bahrain', JSON.stringify(p3));

ok('Text ohne Trenner gibt null',  Z.paar('Ballon d Or Winner') === null);
ok('leerer Text gibt null',        Z.paar('') === null);
ok('null gibt null',               Z.paar(null) === null);

/* ---------- Marktvarianten abschneiden ---------- */

ok('total corners faellt weg',
   Z.ohneAnhang('Austin vs Club Puebla total corners') === 'austin vs club puebla',
   Z.ohneAnhang('Austin vs Club Puebla total corners'));
ok('halftime result faellt weg',
   Z.ohneAnhang('Motherwell vs Falkirk halftime result') === 'motherwell vs falkirk');
ok('normaler Name bleibt unveraendert',
   Z.ohneAnhang('Motherwell vs Falkirk') === 'motherwell vs falkirk');

/* ---------- Zuordnung gegen eine Betfair-Liste ---------- */

var bfListe = [
  { k: 'Cruz Azul vs New York City vs The Draw', ev: 'Cruz Azul v New York City',
    r: [{ n: 'Cruz Azul', b: 2.48, l: 2.55 }, { n: 'New York City', b: 2.92, l: 3.0 }, { n: 'The Draw', b: 3.55, l: 3.7 }] },
  { k: 'Chicago Fire vs Santos Laguna vs The Draw', ev: 'Chicago Fire v Santos Laguna',
    r: [{ n: 'Chicago Fire', b: 1.63, l: 1.68 }, { n: 'Santos Laguna', b: 5.6, l: 5.9 }, { n: 'The Draw', b: 4.8, l: 5.0 }] },
  { k: 'Liverpool vs Monaco vs The Draw', ev: 'Liverpool v Monaco',
    r: [{ n: 'Liverpool', b: 1.51, l: 1.55 }, { n: 'Monaco', b: 6.2, l: 6.6 }, { n: 'The Draw', b: 4.9, l: 5.1 }] }
];

var t1 = Z.besterTreffer('cruz azul', 'new york city', bfListe);
ok('exakte Partie wird gefunden',      t1 !== null);
nah('und zwar mit Score 1.0',          t1.score, 1);
ok('richtige Betfair-Partie',          t1.bf.k.indexOf('Cruz Azul') === 0);
ok('nicht als getauscht markiert',     t1.getauscht === false);

var t2 = Z.besterTreffer('new york city', 'cruz azul', bfListe);
ok('vertauschte Reihenfolge wird gefunden', t2 !== null);
ok('und als getauscht markiert',            t2.getauscht === true);

var t3 = Z.besterTreffer('chicago fire', 'club santos laguna', bfListe);
ok('Namenszusatz "club" stoert nicht',  t3 !== null && t3.bf.k.indexOf('Chicago Fire') === 0);

var t4 = Z.besterTreffer('austin', 'club puebla total corners', bfListe);
ok('Partie ohne Betfair-Gegenstueck wird abgewiesen', t4 === null);

var t5 = Z.besterTreffer('bayern muenchen', 'borussia dortmund', bfListe);
ok('voellig fremde Partie wird abgewiesen', t5 === null);

ok('leere Betfair-Liste gibt null',   Z.besterTreffer('a', 'b', []) === null);
ok('fehlende Liste gibt null',        Z.besterTreffer('a', 'b', null) === null);
ok('fehlender Name gibt null',        Z.besterTreffer('', 'b', bfListe) === null);
ok('null als Name gibt null',         Z.besterTreffer(null, 'b', bfListe) === null);

/* Die Schwelle muss wirklich greifen, nicht nur dastehen */
var streng = Z.besterTreffer('liverpool', 'monaco', bfListe, 0.99);
ok('strenge Schwelle 0.99 laesst den echten Treffer durch', streng !== null);
var unmoeglich = Z.besterTreffer('liverpool', 'monaco', bfListe, 1.01);
ok('Schwelle ueber 1.0 weist ALLES ab (Grenze schlaegt an)', unmoeglich === null);

/* ---------- marktArt: stellt der Markt DIESELBE Frage wie Betfair? ----------
 *
 * Das ist die Regel, deren Fehlen am 9.8.2026 im ersten echten Lauf
 * 663 Scheinchancen mit bis zu 184 % Rendite erzeugt hat.
 * Jede dieser Marktformen kam in der Messung wirklich vor. */

ok('Siegermarkt wird erkannt',
   Z.marktArt('Will Heart of Midlothian FC win on 2026-08-08?') === 'sieger');
ok('Siegermarkt anderer Verein',
   Z.marktArt('Will Dundee United FC win on 2026-08-08?') === 'sieger');
ok('Unentschieden wird erkannt',
   Z.marktArt('Will Heart of Midlothian FC vs. Dundee United FC end in a draw?') === 'unentschieden');

/* Die Marktformen, die abgewiesen werden MUESSEN */
ok('Exact Score wird abgewiesen',
   Z.marktArt('CSD Municipal vs. CSD Cobán Imperial: CSD Municipal 1 - 3 CSD Cobán Imperial?') === null);
ok('Over/Under wird abgewiesen',
   Z.marktArt('Cincinnati Reds vs. Washington Nationals: O/U 9.5') === null);
ok('Spread wird abgewiesen',
   Z.marktArt('Spread: Cincinnati Reds (-1.5)') === null);
ok('First 5 Innings wird abgewiesen',
   Z.marktArt('Cincinnati Reds winning after 5 innings?') === null);
ok('Halbzeitstand wird abgewiesen',
   Z.marktArt('Motherwell FC leading at halftime?') === null);
ok('zweite Halbzeit wird abgewiesen',
   Z.marktArt('Falkirk FC to win the second half?') === null);
ok('Torschuetze wird abgewiesen',
   Z.marktArt('Motherwell FC to score first vs. Falkirk FC?') === null);
ok('Extra Innings wird abgewiesen',
   Z.marktArt('Will the game go to extra innings?: Cincinnati Reds vs. Washington Nationals') === null);
ok('leere Frage wird abgewiesen',     Z.marktArt('') === null);
ok('null wird abgewiesen',            Z.marktArt(null) === null);
ok('undefined wird abgewiesen',       Z.marktArt(undefined) === null);

/* ---------- namensgleichheit: symmetrisch, nicht austricksbar ----------
 *
 * Der konkrete Fall, der die 663 Scheinchancen ausgeloest hat. */

nah('gleicher Name -> 1.0', Z.namensgleichheit('CSD Municipal', 'CSD Municipal'), 1);

var falle = Z.namensgleichheit('CSD Municipal 1 - 3 CSD Cobán Imperial', 'CSD Municipal');
ok('Exact-Score-Name trifft den Laeufer NICHT mehr voll', falle < 0.8, falle.toFixed(3));
ok('die alte, austricksbare Aehnlichkeit haette 1.0 gesagt',
   Z.aehnlichkeit('CSD Municipal 1 - 3 CSD Cobán Imperial', 'CSD Municipal') >= 0.99,
   Z.aehnlichkeit('CSD Municipal 1 - 3 CSD Cobán Imperial', 'CSD Municipal').toFixed(3));

ok('namensgleichheit ist symmetrisch',
   Math.abs(Z.namensgleichheit('a b c', 'a b') - Z.namensgleichheit('a b', 'a b c')) < 1e-9);
nah('leerer Name -> 0', Z.namensgleichheit('', 'Liverpool'), 0);
nah('nur Stoppwoerter -> 0', Z.namensgleichheit('the of and', 'Liverpool'), 0);
ok('Vereinszusatz stoert nicht', Z.namensgleichheit('Austin', 'Austin FC') >= 0.99,
   Z.namensgleichheit('Austin', 'Austin FC').toFixed(3));

/* ---------- Laeufer zuordnen ---------- */

var l1 = Z.laeuferZu('Chicago Fire', bfListe[1].r);
ok('Laeufer wird gefunden',        l1 !== null && l1.laeufer.n === 'Chicago Fire');
nah('Back-Quote kommt mit',        l1.laeufer.b, 1.63);

var l2 = Z.laeuferZu('Santos Laguna', bfListe[1].r);
ok('zweiter Laeufer wird gefunden', l2 !== null && l2.laeufer.n === 'Santos Laguna');

var l3 = Z.laeuferZu('Real Madrid', bfListe[1].r);
ok('fremder Laeufer wird abgewiesen', l3 === null);

ok('leere Laeuferliste gibt null',  Z.laeuferZu('Chicago Fire', []) === null);
ok('fehlender Name gibt null',      Z.laeuferZu('', bfListe[1].r) === null);

/* Der Ernstfall: der Exact-Score-Name darf den Laeufer NICHT mehr treffen */
ok('Exact-Score-Name findet keinen Laeufer mehr',
   Z.laeuferZu('CSD Municipal 1 - 3 CSD Cobán Imperial',
               [{ n: 'CSD Municipal', b: 2.1, l: 2.2 }, { n: 'CSD Cobán Imperial', b: 3.4, l: 3.6 }]) === null);

/* ---------- Unentschieden-Laeufer ---------- */

var d1 = Z.drawLaeufer(bfListe[0].r);
ok('The Draw wird gefunden',   d1 !== null && d1.laeufer.n === 'The Draw');
nah('mit Back-Quote 3.55',     d1.laeufer.b, 3.55);
ok('ohne Draw gibt null',      Z.drawLaeufer([{ n: 'Liverpool', b: 1.5 }]) === null);
ok('leere Liste gibt null',    Z.drawLaeufer([]) === null);
ok('null gibt null',           Z.drawLaeufer(null) === null);

/* ---------- Ergebnis ---------- */

console.log('\nZuordnung: ' + gut + ' von ' + (gut + schlecht) + ' Pruefungen bestanden');
if (schlecht) {
  console.log('\nNICHT bestanden:');
  console.log(offen.join('\n'));
  process.exit(1);
}
console.log('alles gruen\n');
