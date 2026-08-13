/* Was liefert jeder der 21 Bereiche WIRKLICH?
 *
 * node pruefung/bereiche.js            alle Bereiche
 * node pruefung/bereiche.js tennis     nur einer
 *
 * WOZU. Ein Bereich, der still nichts liefert, sieht im Betrieb genauso aus
 * wie einer, der laeuft: Takt gruen, 0 Fehler, 0 Paare. Am 13.8.2026 hatten
 * 17 von 20 laufenden Bereichen NULL Polymarket-Maerkte — sichtbar wurde das
 * erst, als jemand die Zahl je Bereich nebeneinander gelegt hat.
 *
 * Dieses Werkzeug faehrt GENAU die Filterkette des Scanners nach
 * (supabase/functions/orion-lauf/index.ts, Durchgang 1) und sagt, an
 * WELCHEM Schritt die Maerkte verloren gehen:
 *
 *   Ereignisse -> Maerkte -> handelbar -> Marktart erkannt -> im Zeitfenster
 *               -> Titel ist eine Paarung "A gegen B"
 *
 * Der letzte Schritt ist der wichtigste: ohne Paarung im Titel gibt es
 * keinen Anker, und ohne Anker kann Durchgang 1 nichts finden — egal wie
 * viele Maerkte das Buch fuehrt.
 *
 * DREI ZUSTAENDE, nicht zwei: ein Bereich ist "traegt", "leer" oder
 * "Quelle antwortet nicht". Das dritte darf nie als "leer" durchgehen.
 */

const Z = require('../js/zuordnung.js');

const SUPA = 'https://noexklrgtqveiclijdwp.supabase.co';
const KEY = 'sb_publishable_NrgVUoZhe-uN8U8j41P17Q_9cZgUd6M';
const FENSTER_H = 72;

/* Wortgleich aus dem Scanner (index.ts). Weicht das hier ab, misst das
 * Werkzeug etwas anderes als der Betrieb — und ist damit wertlos. */
function tokenVon(m) {
  try {
    const t = typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : (m.clobTokenIds || []);
    return Array.isArray(t) ? t.map(String) : [];
  } catch { return []; }
}
function handelbar(m) {
  return m.closed === false && m.active === true && m.enableOrderBook === true &&
         m.acceptingOrders !== false && tokenVon(m).length >= 2;
}

async function bereiche() {
  const r = await fetch(SUPA + '/rest/v1/orion_bereiche?select=*&order=reihenfolge', {
    headers: { apikey: KEY, authorization: 'Bearer ' + KEY, accept: 'application/json' }
  });
  if (!r.ok) throw new Error('Register nicht lesbar: HTTP ' + r.status);
  return r.json();
}

async function seite(tag, off) {
  const url = 'https://gamma-api.polymarket.com/events?closed=false&active=true' +
              '&limit=100&offset=' + off + '&tag_slug=' + encodeURIComponent(tag);
  for (let versuch = 0; versuch < 3; versuch++) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      if (r.status === 422) return { ende: true, daten: [] };
      if (!r.ok) {
        if (r.status >= 500 && versuch < 2) { await warte(300 * (versuch + 1)); continue; }
        return { fehler: 'HTTP ' + r.status, daten: [] };
      }
      const d = await r.json();
      return { daten: Array.isArray(d) ? d : [] };
    } catch (e) {
      if (versuch < 2) { await warte(300 * (versuch + 1)); continue; }
      return { fehler: String(e.message || e), daten: [] };
    }
  }
  return { fehler: 'unerreichbar', daten: [] };
}

function warte(ms) { return new Promise(s => setTimeout(s, ms)); }

async function messeBereich(reg) {
  const jetzt = Date.now();
  const grenze = jetzt + FENSTER_H * 3600000;
  const tags = Array.isArray(reg.pm_tags) ? reg.pm_tags : [];

  const z = {
    bereich: reg.bereich, name: reg.name, aktiv: reg.aktiv, tags,
    ereignisse: 0, maerkte: 0, handelbar: 0, mit_art: 0, im_fenster: 0,
    mit_paarung: 0, arten: {}, fehler: null, ohne_art_beispiele: []
  };

  if (!tags.length) { z.fehler = 'keine Tags im Register'; return z; }

  for (const tag of tags) {
    for (let off = 0; off < 3000; off += 100) {
      const s = await seite(tag, off);
      if (s.fehler) { z.fehler = 'Tag "' + tag + '": ' + s.fehler; break; }
      if (s.ende || !s.daten.length) break;
      for (const ev of s.daten) {
        z.ereignisse++;
        const paarung = Z.paar(ev.title) !== null;
        for (const m of (ev.markets || [])) {
          z.maerkte++;
          if (!handelbar(m)) continue;
          z.handelbar++;
          const art = Z.marktArt(m.question, m.groupItemTitle);
          if (!art) {
            if (z.ohne_art_beispiele.length < 3) {
              z.ohne_art_beispiele.push(String(m.question || '').slice(0, 70));
            }
            continue;
          }
          z.mit_art++;
          z.arten[art] = (z.arten[art] || 0) + 1;
          const ende = Date.parse(m.endDate || m.endDateIso || '');
          if (isNaN(ende) || ende <= jetzt || ende > grenze) continue;
          z.im_fenster++;
          if (paarung) z.mit_paarung++;
        }
      }
      if (s.daten.length < 100) break;
    }
    if (z.fehler) break;
  }
  return z;
}

function urteil(z) {
  if (z.fehler) return 'QUELLE ANTWORTET NICHT';
  if (z.mit_paarung > 0) return 'traegt';
  if (z.im_fenster > 0) return 'leer: kein Titel der Form "A gegen B"';
  if (z.mit_art > 0) return 'leer: nichts im 72-Stunden-Fenster';
  if (z.handelbar > 0) return 'leer: keine bekannte Marktart';
  if (z.maerkte > 0) return 'leer: nichts handelbar';
  if (z.ereignisse > 0) return 'leer: Ereignisse ohne Maerkte';
  return 'leer: der Tag liefert keine Ereignisse';
}

(async function () {
  const nur = process.argv[2];
  let liste;
  try { liste = await bereiche(); }
  catch (e) { console.error('Register nicht lesbar:', e.message); process.exit(1); }
  if (nur) liste = liste.filter(b => b.bereich === nur);
  if (!liste.length) { console.error('Kein solcher Bereich.'); process.exit(1); }

  console.log('Bereichsmessung gegen die echte Polymarket-Schnittstelle,');
  console.log('Filterkette wie im Scanner, Fenster ' + FENSTER_H + ' h.\n');
  const kopf = 'Bereich'.padEnd(14) + 'Ereign'.padStart(7) + 'Maerkte'.padStart(8) +
               'handelb'.padStart(8) + 'mit Art'.padStart(8) + 'Fenster'.padStart(8) +
               'PAARUNG'.padStart(9) + '  Urteil';
  console.log(kopf);
  console.log('-'.repeat(kopf.length + 20));

  const alle = [];
  for (const reg of liste) {
    const z = await messeBereich(reg);
    alle.push(z);
    console.log(
      z.bereich.padEnd(14) +
      String(z.ereignisse).padStart(7) + String(z.maerkte).padStart(8) +
      String(z.handelbar).padStart(8) + String(z.mit_art).padStart(8) +
      String(z.im_fenster).padStart(8) + String(z.mit_paarung).padStart(9) +
      '  ' + urteil(z) + (z.aktiv ? '' : '  [im Register abgeschaltet]')
    );
  }

  console.log('\n--- Was in den leeren Bereichen wirklich steht ---');
  for (const z of alle) {
    if (z.mit_paarung > 0 || z.fehler) continue;
    if (!z.ohne_art_beispiele.length) continue;
    console.log('\n' + z.bereich + ' (Tags: ' + z.tags.join(', ') + ')');
    for (const b of z.ohne_art_beispiele) console.log('   nicht zugeordnet: ' + b);
  }

  const traegt = alle.filter(z => z.mit_paarung > 0);
  const kaputt = alle.filter(z => z.fehler);
  console.log('\nZusammenfassung: ' + traegt.length + ' von ' + alle.length +
              ' Bereichen tragen einen Anker' +
              (kaputt.length ? ', ' + kaputt.length + ' antworten nicht' : '') + '.');
  console.log('Tragende Bereiche: ' + (traegt.map(z => z.bereich).join(', ') || 'keiner'));
})();
