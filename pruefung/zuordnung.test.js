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

/* ---------- partieVon: die Partie, nicht die Laeufer ----------
 *
 * Am 9.8.2026 gemessen: bei MATCH_ODDS steht die Partie in k, bei jedem
 * anderen Markttyp stehen dort die Laeufer. `paar(k) || paar(ev)` fiel
 * deshalb nie auf ev zurueck und ergab 0 Paare bei 849 gegen 865 Maerkten. */

var moMarkt = { k: 'Italy vs Bahrain', ev: 'Italy v Bahrain', mt: 'MATCH_ODDS' };
var ouMarkt = { k: 'Under 3.5 Goals vs Over 3.5 Goals', ev: 'St Gallen v Luzern', mt: 'OVER_UNDER_35' };

var pm1 = Z.partieVon(moMarkt);
ok('MATCH_ODDS: Partie wird erkannt', pm1 && pm1[0] === 'italy' && pm1[1] === 'bahrain', JSON.stringify(pm1));

var pm2 = Z.partieVon(ouMarkt);
ok('OVER_UNDER: Partie kommt aus ev, nicht aus k',
   pm2 && pm2[0] === 'st gallen' && pm2[1] === 'luzern', JSON.stringify(pm2));
ok('OVER_UNDER: die Laeufer landen NICHT als Partie',
   !(pm2[0].indexOf('goals') >= 0 || pm2[1].indexOf('goals') >= 0), JSON.stringify(pm2));

ok('ohne ev wird k genommen',
   JSON.stringify(Z.partieVon({ k: 'Italy vs Bahrain', ev: '' })) === JSON.stringify(['italy', 'bahrain']));
ok('ohne beides gibt null', Z.partieVon({ k: '', ev: '' }) === null);
ok('null gibt null',       Z.partieVon(null) === null);

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

/* ---------- Ueber/Unter: gleiche Frage, aber nur die Gesamtlinie ----------
 *
 * Gemessen am 9.8.2026: 235 Polymarket-Gesamtlinien gegen 865 Betfair-
 * Over/Under im Fenster ergeben 84 zusaetzliche Paare. Ohne die strenge
 * Regel waeren es 174 gewesen, aber die Haelfte davon waere falsch:
 * "CF America O/U 1.5" ist das Torkonto EINER Mannschaft. */

ok('Gesamtlinie wird erkannt',        Z.marktArt('Benevento vs. Ravenna: O/U 2.5', 'O/U 2.5') === 'ueber_unter');
ok('Linie wird gelesen',              Z.ouLinie('O/U 2.5') === 2.5);
ok('halbe Linie 0.5 wird gelesen',    Z.ouLinie('O/U 0.5') === 0.5);
ok('Leerzeichenform wird gelesen',    Z.ouLinie('O/U   3.5') === 3.5);

ok('Mannschaftslinie wird ABGEWIESEN',      Z.ouLinie('CF América O/U 1.5') === null,
   String(Z.ouLinie('CF América O/U 1.5')));
ok('Mannschaftslinie ist keine gueltige Marktart',
   Z.marktArt('CF América vs. Portland: CF América O/U 1.5', 'CF América O/U 1.5') === null);
ok('Halbzeitlinie wird abgewiesen',   Z.ouLinie('1st Half O/U 1.5') === null);
ok('Innings-Linie wird abgewiesen',   Z.ouLinie('1st 5 Innings O/U 4.5') === null);
ok('leerer Teil gibt null',           Z.ouLinie('') === null);
ok('null gibt null',                  Z.ouLinie(null) === null);

ok('OVER_UNDER_25 -> 2.5',  Z.bfOuLinie('OVER_UNDER_25') === 2.5);
ok('OVER_UNDER_05 -> 0.5',  Z.bfOuLinie('OVER_UNDER_05') === 0.5);
ok('MATCH_ODDS gibt null',  Z.bfOuLinie('MATCH_ODDS') === null);
ok('FIRST_HALF_GOALS_15 gibt null', Z.bfOuLinie('FIRST_HALF_GOALS_15') === null);

var ouListe = [
  { mt: 'OVER_UNDER_25', ev: 'St Gallen v Luzern', k: 'Under 2.5 Goals vs Over 2.5 Goals',
    r: [{ n: 'Under 2.5 Goals', b: 2.6, l: 2.7 }, { n: 'Over 2.5 Goals', b: 1.59, l: 1.62 }] },
  { mt: 'OVER_UNDER_35', ev: 'St Gallen v Luzern', k: 'Under 3.5 Goals vs Over 3.5 Goals',
    r: [{ n: 'Under 3.5 Goals', b: 1.64, l: 1.7 }, { n: 'Over 3.5 Goals', b: 2.46, l: 2.5 }] },
  { mt: 'MATCH_ODDS', ev: 'St Gallen v Luzern', k: 'St Gallen vs Luzern vs The Draw',
    r: [{ n: 'St Gallen', b: 2.1, l: 2.2 }, { n: 'Luzern', b: 3.4, l: 3.5 }, { n: 'The Draw', b: 3.3, l: 3.4 }] }
];

var k25 = Z.ouKandidaten(ouListe, 2.5);
ok('nur die passende Linie kommt infrage', k25.length === 1 && k25[0].mt === 'OVER_UNDER_25', k25.length);
ok('falsche Linie findet nichts',          Z.ouKandidaten(ouListe, 9.5).length === 0);
ok('MATCH_ODDS ist nie ein O/U-Kandidat',
   Z.ouKandidaten(ouListe, 2.5).every(function (b) { return b.mt !== 'MATCH_ODDS'; }));

var ol = Z.ouLaeufer(ouListe[0].r);
ok('Over-Laeufer wird gefunden',  ol && ol.laeufer.n === 'Over 2.5 Goals', ol && ol.laeufer.n);
ok('NICHT der Under-Laeufer',     ol.laeufer.n.indexOf('Under') === -1);
ok('ohne Over gibt null',         Z.ouLaeufer([{ n: 'Under 2.5 Goals', b: 2 }]) === null);
ok('leere Liste gibt null',       Z.ouLaeufer([]) === null);

/* Die Partie muss auch bei O/U aus ev kommen */
var ouTreffer = Z.besterTreffer('st gallen', 'luzern', k25, 0.5);
ok('O/U-Markt wird der Partie zugeordnet', ouTreffer !== null && ouTreffer.bf.mt === 'OVER_UNDER_25');

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

/* ---------- Vereinskuerzel: die Fehlpaarung vom 10.8.2026 ----------
 *
 * Echter Fall aus dem laufenden Betrieb. Gemeldet wurden 16,02 % Rendite.
 *
 *   Polymarket:  Cruzeiro EC vs. CR Flamengo
 *   Betfair:     Flamengo v EC Vitoria Salvador     <- ANDERES Spiel
 *
 * Verbunden allein durch "ec" und "flamengo" ueber Kreuz. */

var kuerzelBf = [{
  k: 'Flamengo vs EC Vitoria Salvador vs The Draw',
  ev: 'Flamengo v EC Vitoria Salvador',
  mt: 'MATCH_ODDS',
  r: [{ n: 'Flamengo', b: 1.5, l: 1.6 }, { n: 'EC Vitoria Salvador', b: 6, l: 6.4 }, { n: 'The Draw', b: 6.6, l: 7 }]
}];

ok('"ec" zaehlt nicht als Namensbeleg', Z.woerter('Cruzeiro EC').indexOf('ec') === -1,
   JSON.stringify(Z.woerter('Cruzeiro EC')));
ok('"cr" zaehlt nicht als Namensbeleg', Z.woerter('CR Flamengo').indexOf('cr') === -1,
   JSON.stringify(Z.woerter('CR Flamengo')));
ok('"cruzeiro" bleibt erhalten',        Z.woerter('Cruzeiro EC').indexOf('cruzeiro') !== -1);
ok('"flamengo" bleibt erhalten',        Z.woerter('CR Flamengo').indexOf('flamengo') !== -1);

var fehl = Z.besterTreffer('cruzeiro ec', 'cr flamengo', kuerzelBf, 0.5);
ok('Cruzeiro gegen Flamengo trifft NICHT Flamengo gegen Vitoria', fehl === null,
   fehl ? 'Score ' + fehl.score.toFixed(2) : 'null');

/* Und die richtigen Paare mit demselben Muster muessen erhalten bleiben.
 * Die Schwelle anzuheben haette genau diese mit weggeworfen. */
var medellinBf = [{
  k: 'Ind. Medellin vs Millonarios vs The Draw', ev: 'Ind. Medellin v Millonarios', mt: 'MATCH_ODDS',
  r: [{ n: 'Ind. Medellin', b: 2.1, l: 2.2 }, { n: 'Millonarios', b: 3.4, l: 3.6 }, { n: 'The Draw', b: 3.1, l: 3.3 }]
}];
var medellin = Z.besterTreffer('independiente medellin', 'millonarios fc', medellinBf, 0.5);
ok('abgekuerzter Vereinsname wird weiter gefunden', medellin !== null,
   medellin ? 'Score ' + medellin.score.toFixed(2) : 'null');

var zvezdaBf = [{
  k: 'Crvena Zvezda vs Hapoel Beer Sheva vs The Draw', ev: 'Crvena Zvezda v Hapoel Beer Sheva', mt: 'MATCH_ODDS',
  r: [{ n: 'Crvena Zvezda', b: 1.7, l: 1.8 }, { n: 'Hapoel Beer Sheva', b: 5, l: 5.4 }, { n: 'The Draw', b: 3.9, l: 4.1 }]
}];
ok('Crvena Zvezda trotz "FK" und "MH" gefunden',
   Z.besterTreffer('fk crvena zvezda', "mh hapoel be'er sheva", zvezdaBf, 0.5) !== null);

/* ---------- Sportbegriffe und der Rueckfallweg ----------
 *
 * Am 10.8.2026 gemessen: von den Sportbegriffen kommen in 800 Namensfeldern
 * nur "goals" und "over" vor, beide in Betfairs Over/Under-Laeufernamen.
 * Gefaehrlich wird das erst im Rueckfallweg von partieVon. */

ok('"goals" zaehlt nicht als Namensbeleg', Z.woerter('Over 3.5 Goals').indexOf('goals') === -1,
   JSON.stringify(Z.woerter('Over 3.5 Goals')));
ok('"over" zaehlt nicht als Namensbeleg',  Z.woerter('Over 3.5 Goals').indexOf('over') === -1);
ok('"under" zaehlt nicht als Namensbeleg', Z.woerter('Under 3.5 Goals').indexOf('under') === -1);
ok('Over/Under-Laeufername ergibt gar keinen Namensbeleg mehr',
   Z.woerter('Under 3.5 Goals').length === 0, JSON.stringify(Z.woerter('Under 3.5 Goals')));

/* Der eigentliche Zweck: zwei VERSCHIEDENE Partien duerfen sich nicht ueber
 * ihre Over/Under-Laeufernamen finden, wenn ev einmal fehlt. */
var ouOhneEv = [{
  k: 'Under 3.5 Goals vs Over 3.5 Goals', ev: '', mt: 'OVER_UNDER_35',
  r: [{ n: 'Under 3.5 Goals', b: 1.6, l: 1.7 }, { n: 'Over 3.5 Goals', b: 2.4, l: 2.5 }]
}];
ok('fremde Partie trifft NICHT ueber die Over/Under-Laeufer',
   Z.besterTreffer('under 3.5 goals', 'over 3.5 goals', ouOhneEv, 0.5) === null);

/* Und der normale Weg muss weiter funktionieren. */
var ouMitEv = [{
  k: 'Under 3.5 Goals vs Over 3.5 Goals', ev: 'St Gallen v Luzern', mt: 'OVER_UNDER_35',
  r: [{ n: 'Under 3.5 Goals', b: 1.6, l: 1.7 }, { n: 'Over 3.5 Goals', b: 2.4, l: 2.5 }]
}];
ok('mit ev wird die Partie weiterhin gefunden',
   Z.besterTreffer('st gallen', 'luzern', ouMitEv, 0.5) !== null);

/* ouLaeufer arbeitet auf dem normalisierten Namen, nicht ueber woerter().
 * Die neuen Stoppwoerter duerfen es deshalb NICHT kaputtmachen. */
var ol2 = Z.ouLaeufer(ouMitEv[0].r);
ok('Over-Laeufer wird trotz Stoppwoertern gefunden', ol2 !== null && ol2.laeufer.n === 'Over 3.5 Goals',
   ol2 ? ol2.laeufer.n : 'null');
ok('drawLaeufer funktioniert weiterhin',
   Z.drawLaeufer([{ n: 'The Draw', b: 3.3 }]) !== null);

/* ---------- Kalshi ----------
 *
 * Alle Titel unten sind echte Kalshi-Titel vom 9.8.2026. */

var kp1 = Z.kalshiPaar('Cruz Azul vs New York City Winner?');
ok('Kalshi-Partie wird gelesen', kp1 && kp1[0] === 'cruz azul' && kp1[1] === 'new york city', JSON.stringify(kp1));

var kp2 = Z.kalshiPaar("Golden State vs Los Angeles women's Pro Basketball game: Winner?");
ok('Ligabeschreibung faellt weg', kp2 && kp2[0] === 'golden state' && kp2[1] === 'los angeles', JSON.stringify(kp2));

var kp3 = Z.kalshiPaar('San Diego FC vs Tijuana de Caliente Winner?');
ok('langer Vereinsname bleibt erhalten', kp3 && kp3[1] === 'tijuana de caliente', JSON.stringify(kp3));

ok('Titel ohne Partie gibt null', Z.kalshiPaar('Ballon d Or Winner?') === null);
ok('leerer Titel gibt null',      Z.kalshiPaar('') === null);

/* Seite bestimmen */
var partie = ['san diego', 'tijuana de caliente'];
ok('Ausgang Heim -> a',            Z.seiteVon('San Diego FC', partie) === 'a', Z.seiteVon('San Diego FC', partie));
ok('Ausgang Auswaerts -> b',       Z.seiteVon('Tijuana de Caliente', partie) === 'b');
ok('Tie -> unentschieden',         Z.seiteVon('Tie', partie) === 'unentschieden');
ok('Draw -> unentschieden',        Z.seiteVon('The Draw', partie) === 'unentschieden');
ok('fremder Name gibt null',       Z.seiteVon('Real Madrid', partie) === null);
ok('leerer Ausgang gibt null',     Z.seiteVon('', partie) === null);
ok('ohne Partie gibt null',        Z.seiteVon('San Diego', null) === null);

/* Der Fall, der einen direkten Namensvergleich scheitern laesst:
 * Polymarket sagt "Club Tijuana", Kalshi sagt "Tijuana de Caliente". */
var pmPartie = ['san diego', 'club tijuana'];
ok('Polymarket-Name findet dieselbe Seite',  Z.seiteVon('Club Tijuana', pmPartie) === 'b');
ok('Kalshi-Name findet dieselbe Seite',      Z.seiteVon('Tijuana de Caliente', partie) === 'b');
ok('direkter Namensvergleich waere zu streng gewesen',
   Z.namensgleichheit('Club Tijuana', 'Tijuana de Caliente') < 0.8,
   Z.namensgleichheit('Club Tijuana', 'Tijuana de Caliente').toFixed(2));

/* Seiten paaren */
ok('gleiche Seite, gleiche Reihenfolge',   Z.gleicheSeite('a', 'a', false) === true);
ok('andere Seite wird abgewiesen',         Z.gleicheSeite('a', 'b', false) === false);
ok('vertauschte Partie: a passt zu b',     Z.gleicheSeite('a', 'b', true) === true);
ok('vertauschte Partie: a passt NICHT zu a', Z.gleicheSeite('a', 'a', true) === false);
ok('Unentschieden nur mit Unentschieden',  Z.gleicheSeite('unentschieden', 'unentschieden', false) === true);
ok('Unentschieden passt nicht zu a',       Z.gleicheSeite('unentschieden', 'a', false) === false);
ok('Unentschieden bleibt auch vertauscht gleich', Z.gleicheSeite('unentschieden', 'unentschieden', true) === true);
ok('null wird abgewiesen',                 Z.gleicheSeite(null, 'a', false) === false);
ok('beides null wird abgewiesen',          Z.gleicheSeite(null, null, false) === false);

/* ---------- Smarkets: Marktart ----------
 * Smarkets liefert die Struktur mit. Genau deshalb darf hier nichts
 * geraten werden: was nicht ausdruecklich dasteht, ist null. */

ok('WINNER_3_WAY ist ein Siegermarkt',
   Z.smMarktArt({ name: 'WINNER_3_WAY' }).art === 'sieger');
ok('Siegermarkt hat keine Linie',
   Z.smMarktArt({ name: 'WINNER_3_WAY' }).linie === null);
ok('OVER_UNDER wird als Ueber/Unter erkannt',
   Z.smMarktArt({ name: 'OVER_UNDER', param: '2.5' }).art === 'ueber_unter');
nah('Linie 2.5 kommt als Zahl an',
   Z.smMarktArt({ name: 'OVER_UNDER', param: '2.5' }).linie, 2.5);
nah('Linie 0.5 kommt als Zahl an',
   Z.smMarktArt({ name: 'OVER_UNDER', param: '0.5' }).linie, 0.5);
ok('OVER_UNDER ohne Linie wird abgewiesen',
   Z.smMarktArt({ name: 'OVER_UNDER' }) === null);
ok('OVER_UNDER mit Unsinn als Linie wird abgewiesen',
   Z.smMarktArt({ name: 'OVER_UNDER', param: 'zwei' }) === null);
ok('CORRECT_SCORE wird NICHT benutzt',
   Z.smMarktArt({ name: 'CORRECT_SCORE' }) === null);
ok('BTTS wird NICHT benutzt',
   Z.smMarktArt({ name: 'BTTS' }) === null);
ok('WINNER_AND_BTTS wird NICHT benutzt (zusammengesetzte Frage)',
   Z.smMarktArt({ name: 'WINNER_AND_BTTS' }) === null);
ok('null wird abgewiesen', Z.smMarktArt(null) === null);
ok('Text statt Objekt wird abgewiesen', Z.smMarktArt('WINNER_3_WAY') === null);

/* ---------- Smarkets: Ueber/Unter nur gleiche Linie gegen gleiche ---------- */

var smOu = [{ linie: 0.5 }, { linie: 2.5 }, { linie: 2.5 }, { linie: 3.5 }];
ok('Linie 2.5 findet beide 2.5-Maerkte', Z.smOuKandidaten(smOu, 2.5).length === 2);
ok('Linie 0.5 findet genau einen',       Z.smOuKandidaten(smOu, 0.5).length === 1);
ok('Linie 4.5 findet keinen',            Z.smOuKandidaten(smOu, 4.5).length === 0);
ok('Linie null findet keinen',           Z.smOuKandidaten(smOu, null).length === 0);
ok('2.5 zieht NICHT 3.5 an',             Z.smOuKandidaten(smOu, 2.5).every(function (m) { return m.linie === 2.5; }));

/* ---------- Smarkets: Laeuferzuordnung ----------
 * Die Vertraege sind echte Faelle aus der Messung vom 10.8.2026. */

var vSieger = [
  { n: 'Santa Clara',         typ: 'HOME' },
  { n: 'Draw',                typ: 'DRAW' },
  { n: 'Nacional da Madeira', typ: 'AWAY' }
];
var pSieger = ['cd santa clara', 'cd nacional'];

/* Der Fall, an dem die strenge Namensregel scheitert: 0,33 statt 0,80. */
ok('Name allein findet "CD Nacional" NICHT',
   Z.laeuferZu('CD Nacional', vSieger, 0.8) === null);
var l1 = Z.smLaeufer('sieger', 'CD Nacional', pSieger, vSieger, false, 0.8);
ok('Struktur findet "CD Nacional" als AWAY',
   l1 !== null && l1.laeufer.typ === 'AWAY', l1 && l1.laeufer.n);
ok('und benennt den Weg als reine Struktur',
   l1 !== null && l1.weg === 'struktur');
var l2 = Z.smLaeufer('sieger', 'CD Santa Clara', pSieger, vSieger, false, 0.8);
ok('Struktur findet "CD Santa Clara" als HOME',
   l2 !== null && l2.laeufer.typ === 'HOME', l2 && l2.laeufer.n);
ok('wo der Name mitzieht, heisst der Weg "beide"',
   l2 !== null && l2.weg === 'beide', l2 && l2.weg);

/* Gekreuzte Partie: Polymarket "Palermo vs Juventus", Smarkets "Juventus vs Palermo". */
var vKreuz = [
  { n: 'Juventus', typ: 'HOME' },
  { n: 'Draw',     typ: 'DRAW' },
  { n: 'Palermo',  typ: 'AWAY' }
];
var lK = Z.smLaeufer('sieger', 'Juventus Turin', ['palermo fc', 'juventus turin'], vKreuz, true, 0.8);
ok('bei getauschter Partie wird die Seite gedreht',
   lK !== null && lK.laeufer.typ === 'HOME', lK && lK.laeufer.n);
var lK2 = Z.smLaeufer('sieger', 'Palermo FC', ['palermo fc', 'juventus turin'], vKreuz, true, 0.8);
ok('und die andere Mannschaft landet auf AWAY',
   lK2 !== null && lK2.laeufer.typ === 'AWAY', lK2 && lK2.laeufer.n);

/* DAS VETO — die Regel muss ausgeloest werden, nicht umgangen.
 * Konstruiert: die Struktur zeigt auf HOME, der Name eindeutig auf AWAY. */
var vWider = [
  { n: 'Bayern Muenchen', typ: 'HOME' },
  { n: 'Draw',            typ: 'DRAW' },
  { n: 'Borussia Dortmund', typ: 'AWAY' }
];
var lW = Z.smLaeufer('sieger', 'Borussia Dortmund', ['borussia dortmund', 'bayern muenchen'], vWider, false, 0.8);
ok('WIDERSPRUCH Struktur gegen Name wird NICHT gepaart',
   lW === null, lW && (lW.laeufer.n + ' ueber ' + lW.weg));

/* Unentschieden und Ueber/Unter: strukturell eindeutig. */
var lD = Z.smLaeufer('unentschieden', null, null, vSieger, false, 0.8);
ok('Unentschieden findet den DRAW-Vertrag',
   lD !== null && lD.laeufer.typ === 'DRAW');
var vOu = [{ n: 'Under 2.5 goals', typ: 'UNDER' }, { n: 'Over 2.5 goals', typ: 'OVER' }];
var lO = Z.smLaeufer('ueber_unter', null, null, vOu, false, 0.8);
ok('Ueber/Unter nimmt IMMER den OVER-Vertrag als JA-Seite',
   lO !== null && lO.laeufer.typ === 'OVER', lO && lO.laeufer.n);
ok('fehlt der DRAW-Vertrag, gibt es kein Unentschieden',
   Z.smLaeufer('unentschieden', null, null, vOu, false, 0.8) === null);

/* Rueckweg auf streng, falls die Lockerung je zurueckgenommen wird. */
ok('mit namePflicht wird "CD Nacional" wieder abgewiesen',
   Z.smLaeufer('sieger', 'CD Nacional', pSieger, vSieger, false, 0.8, true) === null);
ok('mit namePflicht bleibt "CD Santa Clara" erhalten',
   Z.smLaeufer('sieger', 'CD Santa Clara', pSieger, vSieger, false, 0.8, true) !== null);

/* Unbrauchbare Eingaben. */
ok('leere Vertragsliste ergibt nichts', Z.smLaeufer('sieger', 'X', pSieger, [], false, 0.8) === null);
ok('unbekannte Art ergibt nichts',      Z.smLaeufer('quatsch', 'X', pSieger, vSieger, false, 0.8) === null);
ok('Mannschaft, die zu keiner Seite passt, ergibt nichts',
   Z.smLaeufer('sieger', 'FC Erfunden', pSieger, vSieger, false, 0.8) === null);

/* ---------- Ergebnis ---------- */

console.log('\nZuordnung: ' + gut + ' von ' + (gut + schlecht) + ' Pruefungen bestanden');
if (schlecht) {
  console.log('\nNICHT bestanden:');
  console.log(offen.join('\n'));
  process.exit(1);
}
console.log('alles gruen\n');
