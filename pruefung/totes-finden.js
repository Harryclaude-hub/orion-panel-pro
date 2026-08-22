/* Findet toten Code, OHNE etwas zu aendern.
 *
 * Zweck: vor dem Aufraeumen wissen, was wirklich tot ist. Ein Selektor,
 * der nur dynamisch zusammengesetzt wird ('bk-' + name), sieht tot aus
 * und ist es nicht. Deshalb meldet dieses Werkzeug NUR, es loescht nie,
 * und es trennt SICHER von UNSICHER.
 *
 * Aufruf:  node pruefung/totes-finden.js
 */
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const lies = (p) => { try { return fs.readFileSync(path.join(WURZEL, p), 'utf8'); } catch { return ''; } };

const htmlDateien = fs.readdirSync(WURZEL).filter(f => f.endsWith('.html'));
const jsDateien = fs.readdirSync(path.join(WURZEL, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f);
const cssDateien = fs.readdirSync(path.join(WURZEL, 'css')).filter(f => f.endsWith('.css')).map(f => 'css/' + f);

/* Alles, worin ein Klassenname auftauchen kann. */
const suchraum = [...htmlDateien, ...jsDateien].map(lies).join('\n');

/* ---------- 1. CSS-Klassen, die nirgends vorkommen ---------- */
console.log('\n=== 1. CSS-KLASSEN OHNE FUNDSTELLE ===');
const proDatei = {};
for (const datei of cssDateien) {
  const css = lies(datei);
  /* Klassennamen aus Selektoren. Keyframes, Media-Queries und
   * Pseudo-Elemente werden nicht als Klasse gezaehlt. */
  const klassen = new Set();
  const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of ohneKommentare.matchAll(/\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g)) klassen.add(m[1]);

  const tot = [];
  for (const k of klassen) {
    /* Kommt der Name irgendwo in HTML oder JS vor? Auch als Teil einer
     * laengeren Zeichenkette, denn Klassen werden oft zusammengesetzt. */
    if (!suchraum.includes(k)) tot.push(k);
  }
  proDatei[datei] = { gesamt: klassen.size, tot };
  console.log(`  ${datei}: ${klassen.size} Klassen, davon ${tot.length} ohne Fundstelle`);
  if (tot.length) console.log('     ' + tot.sort().join(' '));
}

/* ---------- 2. @keyframes, die niemand benutzt ---------- */
console.log('\n=== 2. KEYFRAMES OHNE VERWENDUNG ===');
for (const datei of cssDateien) {
  const css = lies(datei);
  const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const namen = new Set();
  for (const m of ohneKommentare.matchAll(/@keyframes\s+([_a-zA-Z][_a-zA-Z0-9-]*)/g)) namen.add(m[1]);
  const tot = [];
  for (const n of namen) {
    /* Verwendung: animation: name ... oder animation-name: name */
    const benutzt = new RegExp('animation(-name)?\\s*:[^;}]*\\b' + n + '\\b').test(ohneKommentare) ||
                    suchraum.includes(n);
    if (!benutzt) tot.push(n);
  }
  console.log(`  ${datei}: ${namen.size} Keyframes, davon ${tot.length} unbenutzt`);
  if (tot.length) console.log('     ' + tot.sort().join(' '));
}

/* ---------- 3. Doppelt definierte Keyframes ---------- */
console.log('\n=== 3. DOPPELT DEFINIERTE KEYFRAMES (die spaetere gewinnt) ===');
for (const datei of cssDateien) {
  const ohneKommentare = lies(datei).replace(/\/\*[\s\S]*?\*\//g, '');
  const zaehler = {};
  for (const m of ohneKommentare.matchAll(/@keyframes\s+([_a-zA-Z][_a-zA-Z0-9-]*)/g)) {
    zaehler[m[1]] = (zaehler[m[1]] || 0) + 1;
  }
  const doppelt = Object.entries(zaehler).filter(([, n]) => n > 1);
  console.log(`  ${datei}: ${doppelt.length} doppelt`);
  for (const [n, c] of doppelt) console.log(`     ${n} (${c}x)`);
}

/* ---------- 4. HTML-Seiten, die niemand verlinkt ---------- */
console.log('\n=== 4. SEITEN OHNE EINGEHENDEN LINK ===');
for (const seite of htmlDateien) {
  let verlinkt = 0;
  for (const andere of htmlDateien) {
    if (andere === seite) continue;
    if (lies(andere).includes(seite)) verlinkt++;
  }
  const ausJs = jsDateien.some(j => lies(j).includes(seite));
  if (verlinkt === 0 && !ausJs && seite !== 'index.html') {
    console.log(`  ${seite}  (${(lies(seite).length / 1024).toFixed(0)} KB)`);
  }
}

/* ---------- 5. Funktionen, die nur einmal vorkommen ---------- */
console.log('\n=== 5. JS-FUNKTIONEN OHNE AUFRUF ===');
for (const datei of jsDateien) {
  const quelle = lies(datei);
  const ohneKommentare = quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const namen = new Set();
  for (const m of ohneKommentare.matchAll(/function\s+([_a-zA-Z][_a-zA-Z0-9]*)\s*\(/g)) namen.add(m[1]);
  const tot = [];
  for (const n of namen) {
    /* Wie oft taucht der Name insgesamt auf? Einmal = nur die Definition. */
    const treffer = (suchraum.match(new RegExp('\\b' + n + '\\b', 'g')) || []).length;
    if (treffer <= 1) tot.push(n);
  }
  if (tot.length) console.log(`  ${datei}: ${tot.sort().join(' ')}`);
}

console.log('\nNICHTS wurde geaendert. Jeder Fund ist von Hand zu pruefen:');
console.log('Klassen koennen dynamisch zusammengesetzt werden.\n');
