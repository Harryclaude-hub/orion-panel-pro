/* Vergleicht die BEREICHSTABELLEN beider Spiegel Eintrag fuer Eintrag.
 *
 * ANLASS (22.8.2026): beim Nachtragen neuer Polymarket-Tags wurde nur
 * js/zuordnung.js getroffen, die Server-Fassung nicht - und
 * spiegel.test.js blieb GRUEN. Er prueft bereichPm nur mit einem
 * einzigen Beispiel ('soccer'). Die ganze Tabelle war ungeprueft.
 *
 * Das ist die Fehlerklasse "Drift zwischen zwei Fassungen" an genau der
 * Stelle, die die Bereichstrennung traegt: ein Tag, den nur der Browser
 * kennt, laesst den Server bei karteOk scheitern und Kalshi still
 * ungepaart - oder schlimmer, umgekehrt.
 *
 * Aufruf:  node pruefung/tagtabelle.test.js
 */
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const Z = require(path.join(WURZEL, 'js', 'zuordnung.js'));
const tsQuelle = fs.readFileSync(
  path.join(WURZEL, 'supabase', 'functions', 'orion-lauf', 'zuordnung.ts'), 'utf8');

/* Die Tabelle aus der Server-Fassung herausschneiden und einlesen.
 * Kommentare fallen weg, damit erlaeuternde Zeilen nicht als Eintrag
 * gelesen werden. */
function serverTabelle() {
  const start = tsQuelle.indexOf('const PM_BEREICH');
  if (start < 0) throw new Error('PM_BEREICH in der Server-Fassung nicht gefunden');
  const auf = tsQuelle.indexOf('{', start);
  const zu = tsQuelle.indexOf('\n};', auf);
  if (auf < 0 || zu < 0) throw new Error('Tabellenklammern nicht gefunden');
  const rumpf = tsQuelle.slice(auf + 1, zu).replace(/\/\*[\s\S]*?\*\//g, '');

  const tabelle = {};
  for (const m of rumpf.matchAll(/(?:'([^']+)'|([A-Za-z_][\w-]*))\s*:\s*'([^']+)'/g)) {
    tabelle[(m[1] || m[2]).toLowerCase()] = m[3];
  }
  return tabelle;
}

/* Dieselbe Tabelle aus der Browser-Fassung, ueber die oeffentliche
 * Funktion statt ueber den Quelltext - so wird geprueft, was WIRKT. */
function browserTabelle(namen) {
  const t = {};
  for (const n of namen) {
    const b = Z.bereichPm(n);
    if (b) t[n] = b;
  }
  return t;
}

const server = serverTabelle();
const namen = Object.keys(server);
const browser = browserTabelle(namen);

let fehler = 0;
console.log('\nTags in der Server-Fassung: ' + namen.length + '\n');

for (const tag of namen.sort()) {
  const s = server[tag], b = browser[tag] || null;
  if (s === b) continue;
  console.log('  DRIFT  ' + tag.padEnd(20) + 'Server: ' + String(s).padEnd(12) + 'Browser: ' + String(b));
  fehler++;
}

/* Auch die Gegenrichtung: kennt der Browser Tags, die dem Server
 * fehlen? Genau das war der Fehler vom 22.8. */
const jsQuelle = fs.readFileSync(path.join(WURZEL, 'js', 'zuordnung.js'), 'utf8');
const jsStart = jsQuelle.indexOf('var PM_BEREICH');
const jsAuf = jsQuelle.indexOf('{', jsStart);
const jsZu = jsQuelle.indexOf('\n  };', jsAuf);
const jsRumpf = jsQuelle.slice(jsAuf + 1, jsZu).replace(/\/\*[\s\S]*?\*\//g, '');
const nurBrowser = [];
for (const m of jsRumpf.matchAll(/(?:'([^']+)'|([A-Za-z_][\w-]*))\s*:\s*'([^']+)'/g)) {
  const tag = (m[1] || m[2]).toLowerCase();
  if (!(tag in server)) { nurBrowser.push(tag + ' -> ' + m[3]); fehler++; }
}
for (const z of nurBrowser) console.log('  NUR IM BROWSER  ' + z);

if (fehler === 0) {
  console.log('Tagtabelle: ' + namen.length + ' von ' + namen.length + ' Eintraegen identisch');
  console.log('beide Spiegel kennen dieselben Bereiche\n');
} else {
  console.log('\n' + fehler + ' ABWEICHUNGEN\n');
}
process.exit(fehler ? 1 : 0);
