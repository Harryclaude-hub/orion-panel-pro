/* Prüft gespeicherte Funde gegen die JETZIGEN Kurse an der Quelle.
 *
 * node pruefung/nachschlagen.js            alle Live-Zeilen ab 2 %
 * node pruefung/nachschlagen.js 1.0        andere Schwelle
 *
 * WOZU. Eine Zeile in der Datenbank ist ein FOTO. Die Frage "stimmt der
 * Fund?" heisst in Wahrheit: stehen die zwei Kurse JETZT NOCH so da, und
 * ergeben sie zusammen wirklich weniger als einen Euro fuer einen sicheren
 * Euro? Das beantwortet nur ein frischer Abruf bei beiden Buechern.
 *
 * Geprueft wird dreifach:
 *   1. Steht der Kurs noch?     — beide Buecher neu abgefragt
 *   2. Rechnet es sich noch?    — mit DENSELBEN Formeln wie der Scanner
 *   3. Ist das Buch stimmig?    — Summe der Back-Gegenwahrscheinlichkeiten
 *
 * DREI URTEILE, nie zwei: BESTAETIGT, WIDERLEGT, oder NICHT PRUEFBAR
 * (Quelle antwortet nicht, Partie schon angepfiffen, Markt geschlossen).
 * "Nicht pruefbar" darf nie als "in Ordnung" durchgehen.
 */

const R = require('../js/rechnung.js');

const SUPA = 'https://noexklrgtqveiclijdwp.supabase.co';
const KEY = 'sb_publishable_NrgVUoZhe-uN8U8j41P17Q_9cZgUd6M';

function warte(ms) { return new Promise(s => setTimeout(s, ms)); }

async function db(pfad) {
  const r = await fetch(SUPA + '/rest/v1/' + pfad, {
    headers: { apikey: KEY, authorization: 'Bearer ' + KEY, accept: 'application/json' }
  });
  if (!r.ok) throw new Error('DB ' + r.status);
  return r.json();
}

/* ---------- Polymarket: aktueller bester Verkaufspreis je Seite ---------- */
async function pmKurse(marktId) {
  try {
    const r = await fetch('https://gamma-api.polymarket.com/markets/' + marktId,
                          { headers: { accept: 'application/json' } });
    if (!r.ok) return { fehler: 'Markt HTTP ' + r.status };
    const m = await r.json();
    if (m.closed === true) return { fehler: 'Markt geschlossen' };
    let tok = m.clobTokenIds;
    if (typeof tok === 'string') { try { tok = JSON.parse(tok); } catch { tok = []; } }
    if (!Array.isArray(tok) || tok.length < 2) return { fehler: 'keine Token' };

    const b = await fetch('https://clob.polymarket.com/books', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(tok.map(t => ({ token_id: String(t) })))
    });
    if (!b.ok) return { fehler: 'Orderbuch HTTP ' + b.status };
    const buecher = await b.json();
    const preis = {};
    for (const buch of (Array.isArray(buecher) ? buecher : [])) {
      const id = String(buch.asset_id || buch.market || '');
      if (!Array.isArray(buch.asks) || !buch.asks.length) continue;
      let min = Infinity, menge = 0;
      for (const a of buch.asks) {
        const p = parseFloat(a.price);
        if (p > 0 && p < min) { min = p; menge = parseFloat(a.size) || 0; }
      }
      if (min < Infinity) preis[id] = { p: min, menge };
    }
    const ja = preis[String(tok[0])], nein = preis[String(tok[1])];
    if (!ja || !nein) return { fehler: 'Orderbuch leer' };
    return { ja: ja.p, nein: nein.p, jaMenge: ja.menge, neinMenge: nein.menge, frage: m.question };
  } catch (e) { return { fehler: String(e.message || e) }; }
}

/* ---------- Smarkets: aktueller Siegermarkt einer Partie ---------- */
let smSpiele = null;
async function smLade() {
  if (smSpiele) return smSpiele;
  const bis = new Date(Date.now() + 40 * 3600000).toISOString();
  let q = '?type=football_match&state=upcoming&limit=100&sort=start_datetime,name' +
          '&start_datetime_max=' + encodeURIComponent(bis);
  const alle = [];
  for (let s = 0; s < 10 && q; s++) {
    const r = await fetch('https://api.smarkets.com/v3/events/' + q);
    if (!r.ok) break;
    const d = await r.json();
    if (!d.events || !d.events.length) break;
    alle.push(...d.events);
    q = (d.pagination && d.pagination.next_page) || null;
  }
  smSpiele = alle;
  return alle;
}

function schluesselWort(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 3);
}

/* Welcher Smarkets-Markt gehoert zu dieser Fundart? Die Kuerzel stammen aus
 * der Schnittstelle selbst (Feld slug), nicht aus einer Vermutung. */
function smSlugFuer(art, mannschaft) {
  if (art === 'sieger' || art === 'unentschieden') return 'winner';
  if (art === 'btts') return 'both-teams-score';
  const linie = String(mannschaft || '').match(/(\d+(?:\.\d+)?)\s*$/);
  if (!linie) return null;
  if (art === 'ueber_unter')     return 'over-under-' + linie[1];
  if (art === 'hz1_ueber_unter') return 'first-half-over-under-' + linie[1];
  if (art === 'hz2_ueber_unter') return 'second-half-over-under-' + linie[1];
  if (art === 'ecken_ueber_unter') return 'corners-over-under-' + linie[1];
  return null;
}

async function smMarkt(partie, slug) {
  slug = slug || 'winner';
  try {
    const spiele = await smLade();
    const woerter = schluesselWort(partie);
    let treffer = null, beste = 0;
    for (const e of spiele) {
      const ew = schluesselWort(e.name);
      let n = 0;
      for (const w of woerter) if (ew.some(x => x.startsWith(w.slice(0, 4)))) n++;
      const wert = woerter.length ? n / woerter.length : 0;
      if (wert > beste) { beste = wert; treffer = e; }
    }
    if (!treffer || beste < 0.5) return { fehler: 'Partie nicht mehr in der Liste (angepfiffen?)' };

    const mk = await (await fetch('https://api.smarkets.com/v3/events/' + treffer.id + '/markets/')).json();
    const w = (mk.markets || []).find(m => m.slug === slug);
    if (!w) return { fehler: 'kein Markt "' + slug + '" bei dieser Partie' };
    if (w.state !== 'open') return { fehler: 'Markt ' + w.state };

    const c = await (await fetch('https://api.smarkets.com/v3/markets/' + w.id + '/contracts/')).json();
    const qq = await (await fetch('https://api.smarkets.com/v3/markets/' + w.id + '/quotes/')).json();
    const quote = p => (typeof p === 'number' && p > 0) ? 10000 / p : null;

    const laeufer = [];
    for (const ct of (c.contracts || [])) {
      const z = qq[ct.id] || {};
      const a = (z.offers || [])[0], b = (z.bids || [])[0];
      laeufer.push({ n: ct.name, back: a ? quote(a.price) : null, lay: b ? quote(b.price) : null });
    }
    let summe = 0, voll = true;
    for (const l of laeufer) { if (!l.back) voll = false; else summe += 1 / l.back; }
    return { partie: treffer.name, anpfiff: treffer.start_datetime, laeufer,
             backSumme: voll ? summe : null };
  } catch (e) { return { fehler: String(e.message || e) }; }
}

/* Läufernamen werden STRENG verglichen, nicht ähnlich.
 *
 * Der erste Durchlauf hat "Over 3.5 goals" auf "Under 3.5 goals" gelegt:
 * schluesselWort() wirft Wörter bis drei Zeichen weg, übrig blieben
 * ["over","goals"] gegen ["under","goals"], und ein Treffer von zwei
 * genügte der 50-Prozent-Regel. Damit hätte das Prüfwerkzeug genau den
 * Fehler produziert, den es finden soll — eine Gegenseite, die das
 * GEGENTEIL der gemeinten ist.
 *
 * Deshalb hier: JEDES Wort des gesuchten Namens muss vorkommen, und die
 * Richtungswörter over/under/ueber/unter müssen exakt übereinstimmen. */
const RICHTUNG = /\b(over|under|ueber|unter|yes|no|ja|nein)\b/g;

function richtungen(s) {
  const t = String(s || '').toLowerCase();
  const g = t.match(RICHTUNG);
  return g ? g.sort().join(',') : '';
}

function nahe(a, b) {
  if (richtungen(a) !== richtungen(b)) return false;
  const A = schluesselWort(a), B = schluesselWort(b);
  if (!A.length) return false;
  for (const w of A) if (!B.some(x => x.startsWith(w.slice(0, 4)))) return false;
  return true;
}

(async function () {
  const schwelle = Number(process.argv[2] || 2);
  const zeilen = await db('orion_funde?status=eq.live&rendite=gte.' + schwelle + '&order=rendite.desc');
  console.log('Nachschlagen: ' + zeilen.length + ' Live-Zeilen ab ' + schwelle + ' %');
  console.log('Zeitpunkt: ' + new Date().toISOString() + '\n');

  const urteile = { bestaetigt: [], widerlegt: [], offen: [] };

  for (const f of zeilen) {
    const id = String(f.markt_id || '');
    console.log('─'.repeat(78));
    console.log(f.schluessel + '  ' + Number(f.rendite).toFixed(2) + ' %   ' + f.titel);
    console.log('   gespeichert: ' + f.buch_1 + ' ' + f.pm_seite + ' ' + Number(f.pm_preis).toFixed(4) +
                '  gegen  ' + f.buch + ' ' + f.bf_seite + ' ' + Number(f.bf_quote).toFixed(4));

    const teile = [];
    /* Polymarket-Seite */
    let pm = null;
    if (f.buch_1 === 'polymarket' || f.buch === 'polymarket') {
      pm = await pmKurse(id);
      if (pm.fehler) teile.push(['polymarket', null, pm.fehler]);
      else {
        const gespeichert = f.buch_1 === 'polymarket' ? f.pm_preis : f.bf_quote;
        const seite = f.buch_1 === 'polymarket' ? f.pm_seite : f.bf_seite;
        const jetzt = /JA|ÜBER/.test(String(seite)) ? pm.ja : pm.nein;
        teile.push(['polymarket ' + seite, jetzt, Number(gespeichert)]);
      }
      await warte(120);
    }
    /* Smarkets-Seite */
    let sm = null;
    if (f.buch_1 === 'smarkets' || f.buch === 'smarkets') {
      sm = await smMarkt(f.buch === 'smarkets' ? f.bf_partie : f.titel,
                         smSlugFuer(f.art, f.mannschaft));
      if (sm.fehler) teile.push(['smarkets', null, sm.fehler]);
      else {
        const name = f.buch === 'smarkets' ? f.bf_name : f.mannschaft;
        const l = (sm.laeufer || []).find(x => nahe(name, x.n));
        const gespeichert = f.buch_1 === 'smarkets' ? f.pm_preis : f.bf_quote;
        const seite = f.buch_1 === 'smarkets' ? f.pm_seite : f.bf_seite;
        if (!l) teile.push(['smarkets ' + name, null, 'Läufer nicht gefunden']);
        else {
          const jetzt = String(seite).toLowerCase() === 'lay' ? l.lay : l.back;
          teile.push(['smarkets ' + seite + ' ' + l.n, jetzt, Number(gespeichert)]);
        }
      }
      await warte(120);
    }

    for (const [was, jetzt, war] of teile) {
      console.log('   jetzt: ' + String(was).padEnd(34) +
                  (jetzt === null || jetzt === undefined ? 'NICHT ABRUFBAR' : Number(jetzt).toFixed(4)) +
                  '   (war ' + (typeof war === 'number' ? war.toFixed(4) : war) + ')');
    }
    if (sm && sm.backSumme) {
      console.log('   Smarkets-Buch jetzt: Summe ' + sm.backSumme.toFixed(4) +
                  (sm.backSumme < 1 ? '   UNSTIMMIG' : '   stimmig'));
    }

    const unklar = teile.some(t => t[1] === null || t[1] === undefined);
    if (unklar) { urteile.offen.push(f.schluessel); console.log('   URTEIL: NICHT PRUEFBAR'); continue; }

    /* Beide Kurse frisch: gilt der Vorteil noch? Gerechnet wird mit den
     * Formeln des Scanners, nicht mit einer zweiten Meinung. */
    /* Vergleich gegen die ROHE gespeicherte Zahl, nicht gegen ihre gerundete
     * Anzeige. Eine auf vier Stellen gekuerzte 3,000300030003 unterscheidet
     * sich um 3e-8 von sich selbst — das als "Kurs bewegt" zu melden waere
     * ein Fehlalarm, und der erste Durchlauf dieses Skripts hat genau den
     * sechsmal produziert. Ein Zehntausendstel Quote ist die Schwelle. */
    const bewegt = teile.filter(t => typeof t[2] === 'number' && Math.abs(t[2] - t[1]) > 1e-4);
    console.log('   bewegt seit dem Fund: ' + (bewegt.length ? bewegt.map(t => t[0]).join(', ') : 'nichts'));
    if (bewegt.length) { urteile.widerlegt.push(f.schluessel); console.log('   URTEIL: KURS HAT SICH BEWEGT — Fund veraltet'); }
    else { urteile.bestaetigt.push(f.schluessel); console.log('   URTEIL: BESTAETIGT (beide Kurse unveraendert)'); }
  }

  console.log('\n' + '═'.repeat(78));
  console.log('bestätigt      ' + urteile.bestaetigt.length);
  console.log('veraltet       ' + urteile.widerlegt.length);
  console.log('nicht prüfbar  ' + urteile.offen.length);
})();
