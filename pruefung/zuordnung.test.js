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

/* ---------- Zuordnung gegen eine Betfair-Liste ----------
 *
 * SEIT 19.8.2026 ist die Zeit PFLICHT (Huerde 4 der Vollpruefung). Die
 * Faelle hier tragen deshalb beiderseitig eine Anstosszeit — sonst
 * pruefen sie nur noch die Zeitsperre statt der Namensregeln, fuer die
 * sie gebaut wurden. Genau das war hier passiert: der Pruefstand stand
 * seit der Zeitpflicht rot und niemand hat es gemerkt. */

var ST = '2026-08-19T15:00:00Z';

var bfListe = [
  { k: 'Cruz Azul vs New York City vs The Draw', ev: 'Cruz Azul v New York City', st: ST,
    r: [{ n: 'Cruz Azul', b: 2.48, l: 2.55 }, { n: 'New York City', b: 2.92, l: 3.0 }, { n: 'The Draw', b: 3.55, l: 3.7 }] },
  { k: 'Chicago Fire vs Santos Laguna vs The Draw', ev: 'Chicago Fire v Santos Laguna', st: ST,
    r: [{ n: 'Chicago Fire', b: 1.63, l: 1.68 }, { n: 'Santos Laguna', b: 5.6, l: 5.9 }, { n: 'The Draw', b: 4.8, l: 5.0 }] },
  { k: 'Liverpool vs Monaco vs The Draw', ev: 'Liverpool v Monaco', st: ST,
    r: [{ n: 'Liverpool', b: 1.51, l: 1.55 }, { n: 'Monaco', b: 6.2, l: 6.6 }, { n: 'The Draw', b: 4.9, l: 5.1 }] }
];

var t1 = Z.besterTreffer('cruz azul', 'new york city', bfListe, 0.5, ST);
ok('exakte Partie wird gefunden',      t1 !== null);
nah('und zwar mit Score 1.0',          t1 ? t1.score : NaN, 1);
ok('richtige Betfair-Partie',          t1 !== null && t1.bf.k.indexOf('Cruz Azul') === 0);
ok('nicht als getauscht markiert',     t1 !== null && t1.getauscht === false);

var t2 = Z.besterTreffer('new york city', 'cruz azul', bfListe, 0.5, ST);
ok('vertauschte Reihenfolge wird gefunden', t2 !== null);
ok('und als getauscht markiert',            t2 !== null && t2.getauscht === true);

var t3 = Z.besterTreffer('chicago fire', 'club santos laguna', bfListe, 0.5, ST);
ok('Namenszusatz "club" stoert nicht',  t3 !== null && t3.bf.k.indexOf('Chicago Fire') === 0);

var t4 = Z.besterTreffer('austin', 'club puebla total corners', bfListe, 0.5, ST);
ok('Partie ohne Betfair-Gegenstueck wird abgewiesen', t4 === null);

var t5 = Z.besterTreffer('bayern muenchen', 'borussia dortmund', bfListe, 0.5, ST);
ok('voellig fremde Partie wird abgewiesen', t5 === null);

/* Die Zeitpflicht selbst: OHNE Zeit darf nichts mehr durchgehen. */
ok('ohne beiderseitige Zeit wird NICHT gepaart',
   Z.besterTreffer('cruz azul', 'new york city', bfListe) === null);

ok('leere Betfair-Liste gibt null',   Z.besterTreffer('a', 'b', []) === null);
ok('fehlende Liste gibt null',        Z.besterTreffer('a', 'b', null) === null);
ok('fehlender Name gibt null',        Z.besterTreffer('', 'b', bfListe) === null);
ok('null als Name gibt null',         Z.besterTreffer(null, 'b', bfListe) === null);

/* Die Schwelle muss wirklich greifen, nicht nur dastehen */
var streng = Z.besterTreffer('liverpool', 'monaco', bfListe, 0.99, ST);
ok('strenge Schwelle 0.99 laesst den echten Treffer durch', streng !== null);
var unmoeglich = Z.besterTreffer('liverpool', 'monaco', bfListe, 1.01, ST);
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
/* Der Halbzeitstand wurde bis zum 10.8.2026 abgewiesen, weil es keine
 * Zuordnungsregel gab. Seit Smarkets HALF_TIME_WINNER_3_WAY liefert, gibt
 * es eine — ohne Teilnamen bleibt es aber weiterhin unbrauchbar. */
ok('Halbzeitstand OHNE Teilnamen ergibt keinen brauchbaren Markt',
   Z.marktArt('Motherwell FC leading at halftime?') === 'hz_sieger');
ok('und mit Teilnamen ist es ein Halbzeit-Sieger',
   Z.marktArt('Motherwell FC leading at halftime?', 'Motherwell FC') === 'hz_sieger');
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

/* ---------- TENNIS-MATCHSIEGER (19.8.2026) ----------
 *
 * Gemessen an 4063 handelbaren Tennis-Maerkten: der reine Siegermarkt
 * ("Cincinnati Open: Iga Swiatek vs Diane Parry") traegt KEINEN Teilnamen;
 * jeder Nebenmarkt traegt einen UND unterscheidet sich in der Form.
 * Die Regel gilt NUR im Bereich tennis — Tennis kennt kein Unentschieden;
 * im Fussball waere dieselbe Titelform als Zwei-Ausgangs-Frage falsch. */

ok('Tennis-Matchsieger wird erkannt',
   Z.marktArt('Cincinnati Open: Iga Swiatek vs Diane Parry', null, 'tennis') === 'sieger');
ok('Tennis-Doppel wird erkannt',
   Z.marktArt('Prague 2 (Doubles): Cerny/Martin vs Latinovic/Loof', null, 'tennis') === 'sieger');
ok('Turnier mit Zusatz im Namen wird erkannt',
   Z.marktArt('ITF W35 Krakow Women: Amelia Paszun vs Radka Zelnickova', null, 'tennis') === 'sieger');
ok('OHNE Bereich tennis wird dieselbe Frage NICHT erkannt',
   Z.marktArt('Cincinnati Open: Iga Swiatek vs Diane Parry', null) === null);
ok('im Bereich fussball wird dieselbe Titelform NICHT erkannt',
   Z.marktArt('Premier League: Arsenal vs Chelsea', null, 'fussball') === null);
ok('Completed Match ist eine ANDERE Frage (zwei Doppelpunkte + Teilname)',
   Z.marktArt('Cancun: Completed Match: Rodrigo Pacheco vs Tomas Barrios', 'Completed Match', 'tennis') === null);
ok('Completed Match faellt auch OHNE Teilname (zweiter Doppelpunkt haelt)',
   Z.marktArt('Cancun: Completed Match: Rodrigo Pacheco vs Tomas Barrios', null, 'tennis') === null);
ok('Satzsieger ist keine Marktart (Blockwort haelt auch ohne Teilname)',
   Z.marktArt('Set 1 Winner: Siegemund vs Samsonova', null, 'tennis') === null);
ok('Satz-Handicap ist keine Marktart',
   Z.marktArt('Set Handicap: Samsonova (-1.5) vs Siegemund (+1.5)', null, 'tennis') === null);
ok('Saetze-Ueber/Unter ist keine Marktart (Partie steht VOR dem Doppelpunkt)',
   Z.marktArt('Siegemund vs. Samsonova: Total Sets O/U 2.5',
              'Australian Open Women\'s: Laura Siegemund vs Liudmila Samsonova Total Sets: O/U 2.5', 'tennis') === null);
ok('Games im Match sind keine Marktart',
   Z.marktArt('Pacheco vs. Barrios: Match O/U 21.5', 'Cancun: Rodrigo Pacheco vs Tomas Barrios Match O/U 21.5', 'tennis') === null);
ok('Games je Satz sind keine Marktart',
   Z.marktArt('Pacheco vs. Barrios: Set 1 Games O/U 8.5', 'Cancun: Rodrigo Pacheco vs Tomas Barrios Set 1 O/U 8.5', 'tennis') === null);
ok('Fussball-Siegerform bleibt im Bereich tennis unangetastet',
   Z.marktArt('Will Charlotte FC win on 2026 08 11', 'Charlotte FC', 'tennis') === 'sieger');

/* turnierRein: das Turnier ist Beiwerk, die Partie steht nach dem LETZTEN
 * Doppelpunkt. Ohne den Schnitt traegt "ITF ... Women" die Frauen-Kennung
 * in die Partie und die Kennungssperre verwirft ein RICHTIGES Paar. */
var tp1 = Z.paar('Cincinnati Open: Iga Swiatek vs Diane Parry');
ok('Turnierpraefix wird abgeschnitten',
   tp1 && tp1[0] === 'iga swiatek' && tp1[1] === 'diane parry', JSON.stringify(tp1));
var tp2 = Z.paar('ITF W35 Krakow Women: Amelia Paszun vs Radka Zelnickova');
ok('Frauen-Turnier: Kennung bleibt NICHT an der Partie haengen',
   tp2 && Z.kennung(tp2[0]) === '' && Z.kennung(tp2[1]) === '', JSON.stringify(tp2));
ok('Titel ohne Doppelpunkt bleibt unveraendert',
   JSON.stringify(Z.paar('Italy vs Bahrain')) === JSON.stringify(['italy', 'bahrain']));
ok('Doppelpunkt OHNE vs dahinter schneidet nicht',
   JSON.stringify(Z.paar('Charlotte FC vs. CF Pachuca: Draw at halftime?')) ===
   JSON.stringify(Z.paar('Charlotte FC vs. CF Pachuca Draw at halftime?')));
ok('turnierRein laesst praefixlose Titel in Ruhe',
   Z.turnierRein('Italy vs Bahrain') === 'Italy vs Bahrain');
ok('turnierRein schneidet am LETZTEN Doppelpunkt',
   Z.turnierRein('Roland Garros, Qualification WTA: Sinja Kraus vs Noma Noha Akugue').trim() ===
   'Sinja Kraus vs Noma Noha Akugue');

ok('OVER_UNDER_25 -> 2.5',  Z.bfOuLinie('OVER_UNDER_25') === 2.5);
ok('OVER_UNDER_05 -> 0.5',  Z.bfOuLinie('OVER_UNDER_05') === 0.5);
ok('MATCH_ODDS gibt null',  Z.bfOuLinie('MATCH_ODDS') === null);
ok('FIRST_HALF_GOALS_15 gibt null', Z.bfOuLinie('FIRST_HALF_GOALS_15') === null);

var ouListe = [
  { mt: 'OVER_UNDER_25', ev: 'St Gallen v Luzern', st: ST, k: 'Under 2.5 Goals vs Over 2.5 Goals',
    r: [{ n: 'Under 2.5 Goals', b: 2.6, l: 2.7 }, { n: 'Over 2.5 Goals', b: 1.59, l: 1.62 }] },
  { mt: 'OVER_UNDER_35', ev: 'St Gallen v Luzern', st: ST, k: 'Under 3.5 Goals vs Over 3.5 Goals',
    r: [{ n: 'Under 3.5 Goals', b: 1.64, l: 1.7 }, { n: 'Over 3.5 Goals', b: 2.46, l: 2.5 }] },
  { mt: 'MATCH_ODDS', ev: 'St Gallen v Luzern', st: ST, k: 'St Gallen vs Luzern vs The Draw',
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
var ouTreffer = Z.besterTreffer('st gallen', 'luzern', k25, 0.5, ST);
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
  mt: 'MATCH_ODDS', st: ST,
  r: [{ n: 'Flamengo', b: 1.5, l: 1.6 }, { n: 'EC Vitoria Salvador', b: 6, l: 6.4 }, { n: 'The Draw', b: 6.6, l: 7 }]
}];

ok('"ec" zaehlt nicht als Namensbeleg', Z.woerter('Cruzeiro EC').indexOf('ec') === -1,
   JSON.stringify(Z.woerter('Cruzeiro EC')));
ok('"cr" zaehlt nicht als Namensbeleg', Z.woerter('CR Flamengo').indexOf('cr') === -1,
   JSON.stringify(Z.woerter('CR Flamengo')));
ok('"cruzeiro" bleibt erhalten',        Z.woerter('Cruzeiro EC').indexOf('cruzeiro') !== -1);
ok('"flamengo" bleibt erhalten',        Z.woerter('CR Flamengo').indexOf('flamengo') !== -1);

var fehl = Z.besterTreffer('cruzeiro ec', 'cr flamengo', kuerzelBf, 0.5, ST);
ok('Cruzeiro gegen Flamengo trifft NICHT Flamengo gegen Vitoria', fehl === null,
   fehl ? 'Score ' + fehl.score.toFixed(2) : 'null');

/* Und die richtigen Paare mit demselben Muster muessen erhalten bleiben.
 * Die Schwelle anzuheben haette genau diese mit weggeworfen. */
var medellinBf = [{
  k: 'Ind. Medellin vs Millonarios vs The Draw', ev: 'Ind. Medellin v Millonarios', mt: 'MATCH_ODDS', st: ST,
  r: [{ n: 'Ind. Medellin', b: 2.1, l: 2.2 }, { n: 'Millonarios', b: 3.4, l: 3.6 }, { n: 'The Draw', b: 3.1, l: 3.3 }]
}];
var medellin = Z.besterTreffer('independiente medellin', 'millonarios fc', medellinBf, 0.5, ST);
ok('abgekuerzter Vereinsname wird weiter gefunden', medellin !== null,
   medellin ? 'Score ' + medellin.score.toFixed(2) : 'null');

var zvezdaBf = [{
  k: 'Crvena Zvezda vs Hapoel Beer Sheva vs The Draw', ev: 'Crvena Zvezda v Hapoel Beer Sheva', mt: 'MATCH_ODDS', st: ST,
  r: [{ n: 'Crvena Zvezda', b: 1.7, l: 1.8 }, { n: 'Hapoel Beer Sheva', b: 5, l: 5.4 }, { n: 'The Draw', b: 3.9, l: 4.1 }]
}];
ok('Crvena Zvezda trotz "FK" und "MH" gefunden',
   Z.besterTreffer('fk crvena zvezda', "mh hapoel be'er sheva", zvezdaBf, 0.5, ST) !== null);

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
  k: 'Under 3.5 Goals vs Over 3.5 Goals', ev: '', mt: 'OVER_UNDER_35', st: ST,
  r: [{ n: 'Under 3.5 Goals', b: 1.6, l: 1.7 }, { n: 'Over 3.5 Goals', b: 2.4, l: 2.5 }]
}];
ok('fremde Partie trifft NICHT ueber die Over/Under-Laeufer',
   Z.besterTreffer('under 3.5 goals', 'over 3.5 goals', ouOhneEv, 0.5, ST) === null);

/* Und der normale Weg muss weiter funktionieren. */
var ouMitEv = [{
  k: 'Under 3.5 Goals vs Over 3.5 Goals', ev: 'St Gallen v Luzern', mt: 'OVER_UNDER_35', st: ST,
  r: [{ n: 'Under 3.5 Goals', b: 1.6, l: 1.7 }, { n: 'Over 3.5 Goals', b: 2.4, l: 2.5 }]
}];
ok('mit ev wird die Partie weiterhin gefunden',
   Z.besterTreffer('st gallen', 'luzern', ouMitEv, 0.5, ST) !== null);

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
/* BTTS wird seit dem 10.8.2026 benutzt — siehe eigener Abschnitt unten. */
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

/* ---------- BTTS: der Anker MUSS exakt sein ----------
 * Am 10.8.2026 gemessen: im selben Ereignis, unter demselben Titel, stehen
 * "Both Teams to Score" (44), "... in First Half" (44) und
 * "... in Second Half" (44). Sie unterscheiden sich NUR im Teilnamen.
 * Ein Teilstring-Test haette alle drei gegen denselben Smarkets-Markt
 * gepaart — Halbzeit gegen Endergebnis, Regel 1 gebrochen. */

ok('"Both Teams to Score" wird erkannt',
   Z.marktArt('Seattle Sounders FC vs. CD Guadalajara: Both Teams to Score', 'Both Teams to Score') === 'btts');
ok('Kleinschreibung stoert nicht',
   Z.marktArt('x', 'both teams to score') === 'btts');
ok('Leerzeichen am Rand stoeren nicht',
   Z.marktArt('x', '  Both Teams to Score  ') === 'btts');

ok('ERSTE HALBZEIT wird NICHT als BTTS gepaart',
   Z.marktArt('x', 'Both Teams to Score in First Half') === null,
   String(Z.marktArt('x', 'Both Teams to Score in First Half')));
ok('ZWEITE HALBZEIT wird NICHT als BTTS gepaart',
   Z.marktArt('x', 'Both Teams to Score in Second Half') === null,
   String(Z.marktArt('x', 'Both Teams to Score in Second Half')));
ok('Zusatz vorne wird NICHT als BTTS gepaart',
   Z.marktArt('x', 'First Half Both Teams to Score') === null);
ok('leerer Teilname ergibt kein BTTS',  Z.marktArt('x', '') === null);
ok('null als Teilname ergibt kein BTTS', Z.marktArt('x', null) === null);
ok('BTTS verdraengt Ueber/Unter nicht', Z.marktArt('x', 'O/U 2.5') === 'ueber_unter');

/* Smarkets-Seite */
ok('Smarkets BTTS wird als btts erkannt',
   Z.smMarktArt({ name: 'BTTS' }).art === 'btts');
ok('BTTS hat keine Linie',
   Z.smMarktArt({ name: 'BTTS' }).linie === null);
ok('BTTS_AND_OVER wird NICHT als BTTS genommen',
   Z.smMarktArt({ name: 'BTTS_AND_OVER', param: '2.5' }) === null);
ok('WINNER_AND_BTTS wird NICHT als BTTS genommen',
   Z.smMarktArt({ name: 'WINNER_AND_BTTS' }) === null);
/* HALF_TIME_WINNER_3_WAY wird seit dem 10.8.2026 benutzt, eigener Abschnitt unten. */

/* Vertragswahl: die JA-Seite ist YES, gemessene Namen aus der API. */
var vBtts = [
  { n: 'Yes', typ: 'YES' },
  { n: 'No',  typ: 'NO' }
];
var lB = Z.smLaeufer('btts', null, null, vBtts, false, 0.8);
ok('BTTS nimmt den YES-Vertrag als JA-Seite',
   lB !== null && lB.laeufer.typ === 'YES', lB && lB.laeufer.n);
ok('und meldet den Weg als Struktur', lB !== null && lB.weg === 'struktur');
ok('fehlt YES, gibt es kein Paar',
   Z.smLaeufer('btts', null, null, [{ n: 'No', typ: 'NO' }], false, 0.8) === null);
ok('BTTS zieht NICHT den HOME-Vertrag an',
   Z.smLaeufer('btts', null, null, vSieger, false, 0.8) === null);
ok('ein Siegermarkt zieht NICHT den YES-Vertrag an',
   Z.smLaeufer('sieger', 'Yes', ['a', 'b'], vBtts, false, 0.8) === null);

/* ---------- Kalshi-Zeit aus dem Ticker ----------
 * Zwei Formen, beide am 10.8.2026 in echten Daten gemessen. */

var z1 = Z.kalshiZeit('KXEFLCUPGAME-26AUG10PAEXC');
ok('Ticker ohne Uhrzeit wird gelesen', z1 !== null);
ok('und als Datum ohne Uhrzeit gekennzeichnet', z1 && z1.genau === false);
ok('das Datum stimmt (2026-08-10)',
   z1 && new Date(z1.zeit).toISOString().slice(0, 10) === '2026-08-10',
   z1 && new Date(z1.zeit).toISOString());

var z2 = Z.kalshiZeit('KXLOLGAME-26AUG110400DNFHLE');
ok('Ticker mit Uhrzeit wird gelesen', z2 !== null);
ok('und als genau gekennzeichnet', z2 && z2.genau === true);
ok('Datum und Uhrzeit stimmen (2026-08-11 04:00)',
   z2 && new Date(z2.zeit).toISOString().slice(0, 16) === '2026-08-11T04:00',
   z2 && new Date(z2.zeit).toISOString());

ok('unbekannter Monat wird abgewiesen', Z.kalshiZeit('KXX-26XYZ10ABC') === null);
ok('unsinnige Stunde wird abgewiesen',  Z.kalshiZeit('KXX-26AUG109999ABC') === null);
ok('Ticker ohne Datum ergibt null',     Z.kalshiZeit('KXNOPE-ABCDEF') === null);
ok('null ergibt null',                  Z.kalshiZeit(null) === null);

/* ---------- Direkte Paarung: EINDEUTIGKEIT ist die Absicherung ---------- */

/* SEIT 19.8.2026 laeuft direktPaare durch dieselbe Vollpruefung wie
 * besterTreffer (UEBERGABE 8m): Zeit ist PFLICHT, Toleranz 180 Minuten.
 * Die Faelle hier tragen deshalb beiderseitig passende Zeiten. Auch
 * dieser Block stand seit der Umstellung rot, ohne dass es jemand sah. */
var DZ = Date.UTC(2026, 7, 10, 19, 0);

var A = [
  { id: 'a1', partie: ['plymouth', 'exeter'],  zeit: DZ },
  { id: 'a2', partie: ['caracas', 'la guaira'], zeit: Date.UTC(2026, 7, 10, 22, 0) }
];
var B = [
  { id: 'b1', partie: ['plymouth', 'exeter'],  zeit: DZ },
  { id: 'b2', partie: ['caracas', 'la guaira'], zeit: Date.UTC(2026, 7, 10, 22, 0) }
];
var r1 = Z.direktPaare(A, B, 0.5);
ok('zwei saubere Partien ergeben zwei Paare', r1.paare.length === 2, r1.paare.length);
ok('keine davon mehrdeutig', r1.mehrdeutig === 0);

/* DIE Regel muss ausgeloest werden: zwei gleiche Partien auf einer Seite. */
var Bdoppelt = B.concat([{ id: 'b3', partie: ['plymouth', 'exeter'], zeit: DZ }]);
var r2 = Z.direktPaare(A, Bdoppelt, 0.5);
ok('MEHRDEUTIG wird NICHT gepaart', r2.paare.length === 1, r2.paare.length);
ok('und die Mehrdeutigkeit wird gezaehlt', r2.mehrdeutig === 2, r2.mehrdeutig);
ok('das eindeutige Paar ueberlebt trotzdem',
   r2.paare.length === 1 && r2.paare[0].a.id === 'a2');

/* Gekreuzte Reihenfolge muss erkannt werden. */
var r3 = Z.direktPaare(
  [{ id: 'x', partie: ['juventus turin', 'palermo'], zeit: DZ }],
  [{ id: 'y', partie: ['palermo', 'juventus turin'], zeit: DZ }], 0.5);
ok('gekreuzte Partie wird gefunden', r3.paare.length === 1);
ok('und als getauscht gekennzeichnet', r3.paare.length === 1 && r3.paare[0].getauscht === true);

/* Zeitschranke: grob, aber vorhanden. */
var weit = Z.direktPaare(
  [{ id: 'x', partie: ['plymouth', 'exeter'], zeit: Date.UTC(2026, 7, 10) }],
  [{ id: 'y', partie: ['plymouth', 'exeter'], zeit: Date.UTC(2026, 7, 25) }], 0.5);
ok('15 Tage Abstand wird abgewiesen', weit.paare.length === 0, weit.paare.length);
ok('und als zu weit gezaehlt', weit.zuWeit === 1);

/* PREIS DER ZEITPFLICHT, festgehalten: die frueher gemessenen 47-h-Faelle
 * (Kalshi-Ticker OHNE Uhrzeit = Mitternacht) werden seit dem 19.8. von
 * der 180-Minuten-Sperre in pruefeSpiel ABGEWIESEN. Das ist die bewusste
 * Haertung "Es bleibt keine Moeglichkeit fuer Verlust" — Verlustschutz
 * schlaegt Abdeckung. DIREKT_MAX_STUNDEN (120 h) ist dadurch nur noch
 * ein aeusseres Fenster hinter einer engeren Sperre. */
var real = Z.direktPaare(
  [{ id: 'sm', partie: ['independiente medellin', 'millonarios'], zeit: Date.UTC(2026, 7, 12, 1, 0) }],
  [{ id: 'ka', partie: ['ind medellin', 'millonarios'], zeit: Date.UTC(2026, 7, 10, 0, 0) }], 0.5);
ok('49 h Abstand wird seit der Zeitpflicht abgewiesen', real.paare.length === 0, real.paare.length);
ok('und als zu weit gezaehlt', real.zuWeit === 1, real.zuWeit);

/* Fehlende Zeit weist seit dem 19.8. AB — vorher galt "ungemessen ist
 * nicht falsch", und genau das war das offene Tor (UEBERGABE 8m). */
var ohneZeit = Z.direktPaare(
  [{ id: 'x', partie: ['plymouth', 'exeter'], zeit: null }],
  [{ id: 'y', partie: ['plymouth', 'exeter'], zeit: Date.UTC(2030, 0, 1) }], 0.5);
ok('fehlende Zeit weist ab (Zeitpflicht)', ohneZeit.paare.length === 0, ohneZeit.paare.length);

/* Verschiedene Partien duerfen sich nicht treffen — Zeiten passen, damit
 * wirklich die NAMENSregel entscheidet. */
var fremd = Z.direktPaare(
  [{ id: 'x', partie: ['plymouth', 'exeter'], zeit: DZ }],
  [{ id: 'y', partie: ['bayern muenchen', 'dortmund'], zeit: DZ }], 0.5);
ok('verschiedene Partien ergeben kein Paar', fremd.paare.length === 0);

ok('leere Listen ergeben nichts', Z.direktPaare([], B, 0.5).paare.length === 0);
ok('null ergibt nichts',          Z.direktPaare(null, null, 0.5).paare.length === 0);

/* Regel 5 gilt auch hier: Vereinskuerzel sind kein Namensbeleg. */
var kuerzel = Z.direktPaare(
  [{ id: 'x', partie: ['cruzeiro ec', 'cr flamengo'], zeit: DZ }],
  [{ id: 'y', partie: ['flamengo', 'ec vitoria salvador'], zeit: DZ }], 0.5);
ok('die Flamengo-Falle greift auch bei direkter Paarung NICHT',
   kuerzel.paare.length === 0, kuerzel.paare.length);

/* ---------- Halbzeit: die Frage entscheidet, nicht der Teilname ----------
 * Am 10.8.2026 gemessen: 243 Halbzeit- gegen 240 Zweite-Halbzeit-Maerkte,
 * mit IDENTISCHEN Teilnamen. Wer nur den Teilnamen ansieht, stellt die
 * Pause gegen die Schlussphase. */

ok('"leading at halftime?" ist ein Halbzeit-Sieger',
   Z.marktArt('Charlotte FC leading at halftime?', 'Charlotte FC') === 'hz_sieger',
   String(Z.marktArt('Charlotte FC leading at halftime?', 'Charlotte FC')));
ok('"Draw at halftime?" ist ein Halbzeit-Unentschieden',
   Z.marktArt('Charlotte FC vs. CF Pachuca: Draw at halftime?', 'Draw') === 'hz_unentschieden');

ok('"to win the second half?" wird NICHT als Halbzeit genommen',
   Z.marktArt('Charlotte FC to win the second half?', 'Charlotte FC') === null,
   String(Z.marktArt('Charlotte FC to win the second half?', 'Charlotte FC')));
ok('"Second half draw?" wird NICHT als Halbzeit genommen',
   Z.marktArt('Charlotte FC vs. CF Pachuca: Second half draw?', 'Draw') === null);
ok('gleicher Teilname, andere Frage -> anderes Ergebnis',
   Z.marktArt('X leading at halftime?', 'Charlotte FC') !== Z.marktArt('X to win the second half?', 'Charlotte FC'));

ok('Halbzeit verdraengt das Endergebnis nicht',
   Z.marktArt('Will Charlotte FC win on 2026 08 11', 'Charlotte FC') === 'sieger');
ok('Halbzeit verdraengt Ueber/Unter nicht',
   Z.marktArt('irgendwas at halftime?', 'O/U 2.5') === 'ueber_unter');

/* Smarkets-Seite: strukturell dasselbe wie das Endergebnis. */
ok('HALF_TIME_WINNER_3_WAY wird erkannt',
   Z.smMarktArt({ name: 'HALF_TIME_WINNER_3_WAY' }).art === 'halbzeit');
ok('HALF_TIME_WINNER_3_WAY hat keine Linie',
   Z.smMarktArt({ name: 'HALF_TIME_WINNER_3_WAY' }).linie === null);

var vHz = [
  { n: 'Plymouth Argyle', typ: 'HOME' },
  { n: 'Draw',            typ: 'DRAW' },
  { n: 'Exeter',          typ: 'AWAY' }
];
var hzD = Z.smLaeufer('hz_unentschieden', null, null, vHz, false, 0.8);
ok('Halbzeit-Unentschieden nimmt den DRAW-Vertrag',
   hzD !== null && hzD.laeufer.typ === 'DRAW');

var hzH = Z.smLaeufer('hz_sieger', 'Plymouth Argyle FC', ['plymouth argyle fc', 'exeter city fc'], vHz, false, 0.8);
ok('Halbzeit-Sieger findet HOME ueber dieselbe Struktur',
   hzH !== null && hzH.laeufer.typ === 'HOME', hzH && hzH.laeufer.n);
/* Getauschte Partie: die Struktur zeigt auf HOME, der Name aber eindeutig
 * auf den AWAY-Vertrag "Exeter". Das ist ein echter Widerspruch — und genau
 * dann darf NICHT gepaart werden. Mein erster Test erwartete hier HOME und
 * war schlicht falsch gedacht. */
var hzA = Z.smLaeufer('hz_sieger', 'Exeter City FC', ['plymouth argyle fc', 'exeter city fc'], vHz, true, 0.8);
ok('Widerspruch bei getauschter Halbzeit-Partie wird NICHT gepaart',
   hzA === null, hzA && hzA.laeufer.n);
/* Ohne Widerspruch greift die Drehung: Smarkets fuehrt Exeter als HOME. */
var vHzGedreht = [{ n: 'Exeter', typ: 'HOME' }, { n: 'Draw', typ: 'DRAW' }, { n: 'Plymouth Argyle', typ: 'AWAY' }];
var hzB = Z.smLaeufer('hz_sieger', 'Exeter City FC', ['plymouth argyle fc', 'exeter city fc'], vHzGedreht, true, 0.8);
ok('bei getauschter Partie ohne Widerspruch wird gedreht',
   hzB !== null && hzB.laeufer.typ === 'HOME', hzB && hzB.laeufer.n);
ok('Halbzeit-Sieger zieht keinen YES-Vertrag an',
   Z.smLaeufer('hz_sieger', 'Yes', ['a', 'b'], vBtts, false, 0.8) === null);

/* ---------- Über/Unter in vier Ausfuehrungen ----------
 * Am 10.8.2026 gemessen, was Polymarket im 72h-Fenster fuehrt:
 *     "O/U 2.5"                      276   gesamtes Spiel
 *     "1st Half O/U 0.5"             138   erste Halbzeit
 *     "2nd Half O/U 0.5"             138   zweite Halbzeit
 *     "Total Corners: O/U 7.5"       259   Ecken
 *     "1st Half Total Corners: O/U"  111   ANDERE Frage, keine Regel
 *     "FK Bodo/Glimt O/U 0.5"          9   Torkonto EINER Mannschaft
 * Die Anker vorn und hinten sind der ganze Schutz. */

function ouIst(teil, art, linie) {
  var r = Z.ouArt(teil);
  ok('"' + teil + '" ist ' + art + ' ' + linie,
     r !== null && r.art === art && r.linie === linie, JSON.stringify(r));
}
ouIst('O/U 2.5', 'ueber_unter', 2.5);
ouIst('O/U 0.5', 'ueber_unter', 0.5);
ouIst('1st Half O/U 0.5', 'hz1_ueber_unter', 0.5);
ouIst('1st Half O/U 2.5', 'hz1_ueber_unter', 2.5);
ouIst('2nd Half O/U 1.5', 'hz2_ueber_unter', 1.5);
ouIst('Total Corners: O/U 7.5', 'ecken_ueber_unter', 7.5);
ouIst('Total Corners: O/U 12.5', 'ecken_ueber_unter', 12.5);

/* Die Fallen. Jede MUSS abgewiesen werden. */
ok('Ecken der ERSTEN HALBZEIT sind eine andere Frage',
   Z.ouArt('1st Half Total Corners: O/U 3.5') === null,
   JSON.stringify(Z.ouArt('1st Half Total Corners: O/U 3.5')));
ok('Ecken der ZWEITEN HALBZEIT sind eine andere Frage',
   Z.ouArt('2nd Half Total Corners: O/U 3.5') === null);
ok('Torkonto EINER Mannschaft ist keine Spielsumme',
   Z.ouArt('FK Bodø/Glimt O/U 0.5') === null,
   JSON.stringify(Z.ouArt('FK Bodø/Glimt O/U 0.5')));
ok('Zusatz hinten wird abgewiesen', Z.ouArt('O/U 2.5 Corners') === null);
ok('BTTS ist kein Ueber/Unter',     Z.ouArt('Both Teams to Score') === null);
ok('leerer Teilname ergibt nichts', Z.ouArt('') === null);
ok('null ergibt nichts',            Z.ouArt(null) === null);

/* marktArt muss dieselben Arten liefern. */
ok('marktArt kennt die erste Halbzeit',
   Z.marktArt('X vs Y: 1st Half O/U 0.5', '1st Half O/U 0.5') === 'hz1_ueber_unter');
ok('marktArt kennt die zweite Halbzeit',
   Z.marktArt('X vs Y: 2nd Half O/U 1.5', '2nd Half O/U 1.5') === 'hz2_ueber_unter');
ok('marktArt kennt die Ecken',
   Z.marktArt('X vs Y: O/U 7.5 Total Corners', 'Total Corners: O/U 7.5') === 'ecken_ueber_unter');
ok('das gesamte Spiel bleibt ueber_unter',
   Z.marktArt('X vs Y', 'O/U 2.5') === 'ueber_unter');

/* Smarkets-Seite: exakt beim Typnamen genommen. */
var smOuTyp = [
  ['OVER_UNDER', 'ueber_unter'],
  ['FIRST_HALF_OVER_UNDER', 'hz1_ueber_unter'],
  ['SECOND_HALF_OVER_UNDER', 'hz2_ueber_unter'],
  ['CORNERS_OVER_UNDER', 'ecken_ueber_unter']
];
smOuTyp.forEach(function (p) {
  var r = Z.smMarktArt({ name: p[0], param: '2.5' });
  ok('Smarkets ' + p[0] + ' ist ' + p[1], r !== null && r.art === p[1], JSON.stringify(r));
  ok('und traegt die Linie 2.5', r !== null && r.linie === 2.5);
});

/* Die Smarkets-Fallen: Torkonto einer Mannschaft, Ecken einer Mannschaft,
 * Handicap. Ein Praefix-Vergleich haette alle drei mitgenommen. */
ok('SECOND_HALF_HOME_TEAM_OVER_UNDER wird abgewiesen',
   Z.smMarktArt({ name: 'SECOND_HALF_HOME_TEAM_OVER_UNDER', param: '1.5' }) === null);
ok('SECOND_HALF_AWAY_TEAM_OVER_UNDER wird abgewiesen',
   Z.smMarktArt({ name: 'SECOND_HALF_AWAY_TEAM_OVER_UNDER', param: '1.5' }) === null);
ok('AWAY_CORNERS_OVER_UNDER wird abgewiesen',
   Z.smMarktArt({ name: 'AWAY_CORNERS_OVER_UNDER', param: '3.5' }) === null);
ok('CORNERS_HANDICAP wird abgewiesen',
   Z.smMarktArt({ name: 'CORNERS_HANDICAP', param: '-2.5' }) === null);
ok('FIRST_HALF_ASIAN_HANDICAP wird abgewiesen',
   Z.smMarktArt({ name: 'FIRST_HALF_ASIAN_HANDICAP', param: '-0.5' }) === null);
ok('Ueber/Unter ohne Linie wird abgewiesen',
   Z.smMarktArt({ name: 'CORNERS_OVER_UNDER' }) === null);

/* Alle vier Arten nehmen den OVER-Vertrag. */
var vOu4 = [{ n: 'Under 7.5 corners', typ: 'UNDER' }, { n: 'Over 7.5 corners', typ: 'OVER' }];
['ueber_unter', 'hz1_ueber_unter', 'hz2_ueber_unter', 'ecken_ueber_unter'].forEach(function (a) {
  var l = Z.smLaeufer(a, null, null, vOu4, false, 0.8);
  ok(a + ' nimmt den OVER-Vertrag', l !== null && l.laeufer.typ === 'OVER', l && l.laeufer.n);
});
ok('ohne OVER-Vertrag gibt es kein Paar',
   Z.smLaeufer('ecken_ueber_unter', null, null, [{ n: 'Under', typ: 'UNDER' }], false, 0.8) === null);

/* Gleiche Linie gegen gleiche Linie bleibt Pflicht. */
var smE = [{ linie: 7.5 }, { linie: 8.5 }, { linie: 7.5 }];
ok('Linie 7.5 findet beide', Z.smOuKandidaten(smE, 7.5).length === 2);
ok('Linie 9.5 findet keinen', Z.smOuKandidaten(smE, 9.5).length === 0);

/* ---------- Ergebnis ---------- */

console.log('\nZuordnung: ' + gut + ' von ' + (gut + schlecht) + ' Pruefungen bestanden');
if (schlecht) {
  console.log('\nNICHT bestanden:');
  console.log(offen.join('\n'));
  process.exit(1);
}
console.log('alles gruen\n');
