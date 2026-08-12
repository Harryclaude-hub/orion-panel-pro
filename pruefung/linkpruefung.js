/* Prueft die gespeicherten Links der Live-Funde ueber HTTP.
 *
 * GRUNDREGEL: erst die Pruefung selbst pruefen. Zu jedem Buch laeuft eine
 * KONTROLLE mit einer erfundenen Adresse. Antwortet der Anbieter darauf
 * genauso wie auf einen echten Link, hat die Pruefung dort keine
 * Aussagekraft — und dann steht hier "nicht pruefbar", nicht "in Ordnung".
 *
 * Gemessen am 12.8.2026:
 *   Polymarket  echt 200, erfunden 404                  -> Status traegt
 *   Kalshi      echt 429, erfunden 429 (Bot-Sperre)     -> nicht pruefbar
 *   Smarkets    echt 200, erfunden 200 — und der Titel
 *               wird aus dem PFAD gebaut                -> nicht pruefbar
 *   Orbit       echt 200 mit Wettbewerb im Titel,
 *               erfunden 200 mit generischem Titel      -> TITEL traegt
 *
 * Der Orbit-Fall ist der Grund, warum hier nicht nur der Status zaehlt:
 * derselbe Statuscode, aber ein unterscheidbarer Inhalt.
 */
const SUPA = 'https://noexklrgtqveiclijdwp.supabase.co';
const KEY = 'sb_publishable_NrgVUoZhe-uN8U8j41P17Q_9cZgUd6M';

/* Titel, den Orbit ausliefert, wenn es den Markt NICHT gibt. */
const ORBIT_LEER = 'orbit exchange - open best orbit betting exchange';

async function hole(pfad) {
  const r = await fetch(SUPA + '/rest/v1/' + pfad, {
    headers: { apikey: KEY, authorization: 'Bearer ' + KEY, accept: 'application/json' }
  });
  if (!r.ok) throw new Error('DB ' + r.status);
  return r.json();
}

function buchVon(u) {
  const h = (() => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return '?'; } })();
  return h;
}

async function pruefe(u) {
  try {
    const r = await fetch(u, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 OrionPanel-Linkpruefung' } });
    const txt = await r.text();
    const titel = (txt.match(/<title[^>]*>([\s\S]{0,140}?)<\/title>/i) || [, ''])[1].replace(/\s+/g, ' ').trim();
    return { status: r.status, titel, bytes: txt.length, umgeleitet: r.url !== u };
  } catch (e) {
    return { status: 0, fehler: String(e.message).slice(0, 60) };
  }
}

/* Urteil je Buch — nach dem, was dort NACHWEISLICH unterscheidet. */
function urteil(buch, e) {
  if (e.status === 0) return ['FEHLER', e.fehler];
  if (buch === 'polymarket.com') {
    return e.status === 200 ? ['richtig', 'Status 200 (erfunden gaebe 404)']
                            : ['FALSCH', 'HTTP ' + e.status];
  }
  if (buch === 'orbitexch.com') {
    const leer = e.titel.toLowerCase().startsWith(ORBIT_LEER);
    return leer ? ['FALSCH', 'generischer Titel = Markt gibt es nicht']
                : ['richtig', 'Wettbewerb im Titel: ' + e.titel.slice(0, 40)];
  }
  if (buch === 'kalshi.com') return ['nicht pruefbar', 'Bot-Sperre (HTTP ' + e.status + ')'];
  if (buch === 'smarkets.com') return ['nicht pruefbar', 'antwortet auf jeden Pfad mit 200'];
  return ['nicht pruefbar', 'kein Kontrollwert fuer diesen Anbieter'];
}

(async () => {
  const zeilen = await hole('orion_funde?status=eq.live&select=schluessel,titel,pm_link,bf_link&limit=300');
  const alle = new Map();
  for (const z of zeilen) {
    for (const u of [z.pm_link, z.bf_link]) if (u && !alle.has(u)) alle.set(u, z.titel);
  }
  console.log('LIVE-LINKS: ' + alle.size + ' verschiedene aus ' + zeilen.length + ' Zeilen\n');

  const je = {};
  const schlecht = [];
  for (const [u, titel] of alle) {
    const b = buchVon(u);
    const e = await pruefe(u);
    const [wert, grund] = urteil(b, e);
    (je[b] = je[b] || { richtig: 0, falsch: 0, unpruefbar: 0 });
    if (wert === 'richtig') je[b].richtig++;
    else if (wert === 'FALSCH' || wert === 'FEHLER') { je[b].falsch++; schlecht.push([b, titel, u, grund]); }
    else je[b].unpruefbar++;
  }

  for (const b of Object.keys(je).sort()) {
    const s = je[b];
    console.log(b.padEnd(18) +
      'belegt richtig: ' + String(s.richtig).padStart(3) +
      ' · FALSCH: ' + String(s.falsch).padStart(2) +
      ' · nicht pruefbar: ' + String(s.unpruefbar).padStart(3));
  }

  if (schlecht.length) {
    console.log('\nZEILEN MIT FALSCHEM LINK:');
    for (const [b, t, u, g] of schlecht) console.log('  [' + b + '] ' + t + '\n      ' + g + '\n      ' + u);
  } else {
    console.log('\nKein einziger Link zeigt nachweislich ins Leere.');
  }

  console.log('\nKONTROLLE — erfundene Adressen, damit das Urteil etwas wert ist:');
  const kontrollen = [
    ['polymarket.com', 'https://polymarket.com/event/gibt-es-nicht-2026-99-99/gibt-es-nicht-xyz'],
    ['kalshi.com', 'https://kalshi.com/markets/kxgibtesnicht/kxgibtesnicht-99xxx99xyz'],
    ['smarkets.com', 'https://smarkets.com/sport/football/gibt-es-nicht/2026/08/12/00-00/quatsch-vs-unsinn/'],
    ['orbitexch.com', 'https://www.orbitexch.com/customer/sport/detail?eventId=99999999&marketId=1.999999999']
  ];
  for (const [b, u] of kontrollen) {
    const e = await pruefe(u);
    const [wert, grund] = urteil(b, e);
    const gut = (wert === 'FALSCH' || wert === 'nicht pruefbar');
    console.log('  ' + b.padEnd(18) + 'HTTP ' + e.status + ' -> Urteil "' + wert + '" ' +
                (gut ? '(richtig erkannt)' : '<-- ACHTUNG: erfundene Adresse gilt als richtig!') +
                ' · ' + grund);
  }
})();
