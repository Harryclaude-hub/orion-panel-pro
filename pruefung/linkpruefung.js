/* Prueft die gespeicherten Links der Live-Funde ueber HTTP.
 *
 * WICHTIG: erst die Pruefung selbst pruefen. Zu jedem Host laeuft eine
 * KONTROLLE mit einer Unsinn-Adresse. Antwortet der Host darauf genauso wie
 * auf einen echten Link, hat die Pruefung dort keine Aussagekraft — genau
 * das ist bei smarkets.com der Fall (200 auf jeden Pfad, laut Uebergabe). */
const SUPA = 'https://noexklrgtqveiclijdwp.supabase.co';
const KEY = 'sb_publishable_NrgVUoZhe-uN8U8j41P17Q_9cZgUd6M';

async function hole(pfad) {
  const r = await fetch(SUPA + '/rest/v1/' + pfad, {
    headers: { apikey: KEY, authorization: 'Bearer ' + KEY, accept: 'application/json' }
  });
  if (!r.ok) throw new Error('DB ' + r.status);
  return r.json();
}

function host(u) { try { return new URL(u).host.replace(/^www\./, ''); } catch { return '?'; } }

async function pruefe(u) {
  const t0 = Date.now();
  try {
    const r = await fetch(u, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 OrionPanel-Linkpruefung' } });
    const txt = await r.text();
    const titel = (txt.match(/<title[^>]*>([\s\S]{0,140}?)<\/title>/i) || [, ''])[1].replace(/\s+/g, ' ').trim();
    return { status: r.status, ziel: r.url, umgeleitet: r.url !== u, titel, ms: Date.now() - t0, bytes: txt.length };
  } catch (e) {
    return { status: 0, fehler: String(e.message).slice(0, 60), ms: Date.now() - t0 };
  }
}

(async () => {
  const zeilen = await hole('orion_funde?status=eq.live&select=pm_link,bf_link&limit=200');
  const alle = new Set();
  for (const z of zeilen) { if (z.pm_link) alle.add(z.pm_link); if (z.bf_link) alle.add(z.bf_link); }
  const liste = [...alle];

  // Kontrollen: dieselbe Form, aber erfundener Markt.
  const kontrollen = [
    'https://polymarket.com/event/gibt-es-nicht-2026-99-99/gibt-es-nicht-xyz',
    'https://kalshi.com/markets/kxgibtesnicht/kxgibtesnicht-99xxx99xyz',
    'https://smarkets.com/sport/football/gibt-es-nicht/2026/08/12/00-00/quatsch-vs-unsinn/'
  ];

  console.log('ECHTE LINKS: ' + liste.length + ' verschiedene aus ' + zeilen.length + ' Live-Zeilen\n');
  const jeHost = {};
  for (const u of liste) {
    const e = await pruefe(u);
    const h = host(u);
    (jeHost[h] = jeHost[h] || []).push(e);
  }
  for (const h of Object.keys(jeHost)) {
    const l = jeHost[h];
    const ok = l.filter(x => x.status === 200).length;
    const um = l.filter(x => x.umgeleitet).length;
    const schnitt = Math.round(l.reduce((s, x) => s + x.bytes || 0, 0) / l.length);
    console.log(h.padEnd(18) + l.length + ' Links · ' + ok + '× HTTP 200 · ' +
                um + '× umgeleitet · Ø ' + schnitt + ' Bytes');
    const schlecht = l.filter(x => x.status !== 200);
    schlecht.slice(0, 3).forEach(x => console.log('   NICHT 200: ' + (x.status || x.fehler)));
  }

  console.log('\nKONTROLLE mit erfundenen Adressen — hat die Pruefung Aussagekraft?');
  for (const u of kontrollen) {
    const e = await pruefe(u);
    console.log('  ' + host(u).padEnd(18) + 'HTTP ' + e.status + ' · ' + (e.bytes || 0) + ' Bytes · "' +
                (e.titel || '').slice(0, 60) + '"');
  }

  console.log('\nZum Vergleich ein ECHTER Link je Host (gleiche Kennzahlen):');
  for (const h of ['polymarket.com', 'kalshi.com', 'smarkets.com']) {
    const u = liste.find(x => host(x) === h);
    if (!u) { console.log('  ' + h.padEnd(18) + '— gerade keine Zeile'); continue; }
    const e = await pruefe(u);
    console.log('  ' + h.padEnd(18) + 'HTTP ' + e.status + ' · ' + (e.bytes || 0) + ' Bytes · "' +
                (e.titel || '').slice(0, 60) + '"');
  }
})();
