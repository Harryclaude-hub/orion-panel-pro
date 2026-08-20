/* Prueft die Gruppierung "eine Partie, eine Meldung" (21.8.) gegen den
 * ECHTEN Fall vom 20.8. (Botafogo, fuenf Buchpaarungen) und gegen die
 * Faelle, die NICHT zusammengefasst werden duerfen.
 *
 * ZWEI TEILE, aus dem Spiegel-Gedanken dieses Projekts:
 *   Teil A  das VERHALTEN gegen echte Faelle
 *   Teil B  der ABGLEICH: steht in BEIDEN Meldern derselbe Block, und
 *           stimmt er mit dem hier geprueften ueberein?
 *
 * Teil B ist noetig, weil die Funktion unten ein NACHBAU ist. Ein
 * Nachbau, den niemand gegen das Original haelt, ist genau die Drift
 * zwischen zwei Fassungen, die hier schon Geld gekostet hat: der Test
 * bliebe gruen, waehrend der echte Melder etwas anderes tut. */

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const MELDER = [
  'supabase/functions/orion-melder-telegram/index.ts',
  'supabase/functions/orion-melder-knapp/index.ts'
];

function gruppiere(kand) {
  const jePartie = new Map();
  for (const f of kand) {
    const t = String(f.titel ?? '');
    const bisher = jePartie.get(t);
    if (bisher) bisher.push(f); else jePartie.set(t, [f]);
  }
  return [...jePartie.values()].map((gruppe) => {
    const beste = gruppe.reduce((a, b) => Number(b.rendite) > Number(a.rendite) ? b : a);
    beste._weitere = gruppe.length - 1;
    return beste;
  });
}

let fehler = 0;
function pruefe(name, bedingung, gemessen) {
  if (bedingung) { console.log('  ok    ' + name); }
  else { console.log('  FEHLT ' + name + '   gemessen: ' + JSON.stringify(gemessen)); fehler++; }
}

console.log('\nFall 1: der echte Botafogo-Fall vom 20.8. (5 Buchpaare, 1 Partie)');
const botafogo = [
  { titel: 'Botafogo FR vs. CS Cienciano', rendite: -0.13, buch_1: 'betfair', buch: 'polymarket' },
  { titel: 'Botafogo FR vs. CS Cienciano', rendite: -0.21, buch_1: 'kalshi', buch: 'betfair' },
  { titel: 'Botafogo FR vs. CS Cienciano', rendite: -0.47, buch_1: 'kalshi', buch: 'smarkets' },
  { titel: 'Botafogo FR vs. CS Cienciano', rendite: -0.47, buch_1: 'polymarket', buch: 'betfair' },
  { titel: 'Botafogo FR vs. CS Cienciano', rendite: -0.68, buch_1: 'smarkets', buch: 'betfair' }
];
let e = gruppiere(botafogo);
pruefe('aus 5 Meldungen wird 1', e.length === 1, e.length);
pruefe('gemeldet wird die BESTE (-0.13)', e[0].rendite === -0.13, e[0].rendite);
pruefe('nennt 4 weitere Paarungen', e[0]._weitere === 4, e[0]._weitere);

console.log('\nFall 2: verschiedene Partien duerfen NICHT zusammenfallen');
const gemischt = [
  { titel: 'A vs B', rendite: 1.0 },
  { titel: 'C vs D', rendite: 0.5 },
  { titel: 'A vs B', rendite: 1.5 }
];
e = gruppiere(gemischt);
pruefe('2 Partien bleiben 2 Meldungen', e.length === 2, e.length);
pruefe('bei A vs B gewinnt 1.5', e.find(x => x.titel === 'A vs B').rendite === 1.5, e[0].rendite);
pruefe('C vs D nennt 0 weitere', e.find(x => x.titel === 'C vs D')._weitere === 0, e[1]._weitere);

console.log('\nFall 3: Einzelfund bleibt unveraendert');
e = gruppiere([{ titel: 'Solo vs Allein', rendite: 2.5 }]);
pruefe('1 bleibt 1', e.length === 1, e.length);
pruefe('_weitere ist 0 (Zeile faellt weg)', e[0]._weitere === 0, e[0]._weitere);

console.log('\nFall 4: leere Liste stuerzt nicht ab');
e = gruppiere([]);
pruefe('leer bleibt leer', e.length === 0, e.length);

console.log('\nFall 5: gleiche Rendite, keine Endlosschleife, genau eine gewinnt');
e = gruppiere([
  { titel: 'X vs Y', rendite: 1.0, buch_1: 'a' },
  { titel: 'X vs Y', rendite: 1.0, buch_1: 'b' }
]);
pruefe('aus 2 wird 1', e.length === 1, e.length);
pruefe('nennt 1 weitere', e[0]._weitere === 1, e[0]._weitere);

/* ---------------------------------------------------------------------
 * TEIL B: der Abgleich gegen die echten Melder.
 * ------------------------------------------------------------------ */

console.log('\nTeil B: steht derselbe Block wirklich in beiden Meldern?');

/* Der Kern der Gruppierung, so wie er im Melder stehen MUSS. Leerraum
 * wird eingeebnet, damit Einrueckung keinen Fehlalarm ausloest. */
function kern(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}
const ERWARTET = kern(`
  const jePartie = new Map<string, Record<string, unknown>[]>();
  for (const f of kand as Record<string, unknown>[]) {
    const t = String(f.titel ?? '');
    const bisher = jePartie.get(t);
    if (bisher) bisher.push(f); else jePartie.set(t, [f]);
  }
  const zuMelden = [...jePartie.values()].map((gruppe) => {
    const beste = gruppe.reduce((a, b) =>
      Number(b.rendite) > Number(a.rendite) ? b : a);
    beste._weitere = gruppe.length - 1;
    return beste;
  });
`);

const gefunden = [];
for (const rel of MELDER) {
  const voll = path.join(WURZEL, rel);
  let inhalt = '';
  try { inhalt = fs.readFileSync(voll, 'utf8'); }
  catch (e) { pruefe(rel + ' lesbar', false, e.message); continue; }

  const drin = kern(inhalt).indexOf(ERWARTET) >= 0;
  pruefe(rel.split('/').pop() === 'index.ts' ? rel.split('/')[2] + ': Block vorhanden' : rel,
         drin, drin ? '' : 'Block fehlt oder weicht ab');
  gefunden.push(drin);

  /* Markiert werden muessen ALLE geholten Zeilen (kand), nicht nur die
   * gemeldeten. Sonst kommen die zusammengefassten Paarungen im
   * naechsten Takt einzeln nach und die Gruppierung ist wirkungslos. */
  const markiertAlle = /const schluessel = kand\.map/.test(inhalt);
  pruefe(rel.split('/')[2] + ': markiert ALLE geholten Zeilen', markiertAlle, markiertAlle);

  /* Gemeldet werden muss die gruppierte Liste, nicht die rohe. */
  const meldetGruppiert = /const text = zuMelden\.map/.test(inhalt);
  pruefe(rel.split('/')[2] + ': meldet die gruppierte Liste', meldetGruppiert, meldetGruppiert);
}

pruefe('beide Melder tragen denselben Block',
       gefunden.length === 2 && gefunden[0] && gefunden[1],
       gefunden);

console.log('\n' + (fehler ? fehler + ' FEHLER' : 'alles gruen') + '\n');
process.exit(fehler ? 1 : 0);
