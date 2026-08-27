/* ===========================================================================
 * ORION NOTBETRIEB: die Sammler von KALSHI und SMARKETS
 * ===========================================================================
 * Stand 27.08.2026. Drittes Schwesterprogramm zu orion-lokal.js (Scanner)
 * und orion-melder-lokal.js (Telegram).
 *
 * WARUM: von den vier Boersen arbeiteten zuletzt nur zwei. Polymarket holt
 * der Scanner selbst, Betfair liefert die Bridge auf diesem Laptop. Kalshi
 * und Smarkets dagegen werden von eigenen SERVER-Funktionen eingesammelt,
 * und die kommen seit dem 25.08. nicht mehr an die Datenbank
 * ("JWT issued at future", HTTP 401). Ihre Schnappschuesse waren ueber 20
 * Stunden alt, die Frischesperren hielten sie deshalb zurueck - richtig,
 * aber es entstanden eben keine Kalshi- und Smarkets-Paare mehr.
 *
 * Ab jetzt laufen auch diese zwei hier, mit GENAU DEMSELBEN Code: die
 * .bundle.js-Dateien sind Wort fuer Wort die Server-Sammler, nur mit
 * esbuild fuer Node gebuendelt. Keine zweite Fassung der Logik.
 *
 * Sie brauchen KEINE eigenen Zugangsdaten - Kalshi und Smarkets liefern
 * ihre Kurse oeffentlich. Nur zum SCHREIBEN in die Datenbank wird der
 * Bridge-Token gebraucht, ueber die Tuer orion_schnappschuss().
 *
 * TAKT: alle zwei Minuten, genau wie die pg_cron-Auftraege 3 und 74.
 *
 * ZURUECKBAUEN: beenden. Die Server-Sammler uebernehmen von selbst, sobald
 * Supabase repariert ist.
 * =========================================================================== */

'use strict';

const pfad = require('path');
const HIER = __dirname;

const SUPA = 'https://noexklrgtqveiclijdwp.supabase.co';
const OEFFENTLICH = 'sb_publishable_NrgVUoZhe-uN8U8j41P17Q_9cZgUd6M';
const TOKEN = process.env.ORION_BRIDGE_TOKEN || '';

/* TAKT. Auf dem Server standen 120 s (pg_cron 3 und 74). VON ZUHAUSE AUS
 * dauert es laenger: gemessen am 27.8. braucht Kalshi rund 65 s und
 * Smarkets ueber 200 Einzelabrufe an api.smarkets.com, also mehrere
 * Minuten. Im Rechenzentrum waren es 16 s - das ist reine Leitung, kein
 * Fehler. Deshalb hier 5 Minuten Takt UND eine Ueberlappungssperre:
 * laeuft eine Runde noch, wird die naechste uebersprungen statt danebengelegt. */
const TAKT_MS = 300_000;
let laeuft = false;

function zeit() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds());
}
function log(s) { console.log(zeit() + '  ' + s); }

/* ---------------------------------------------------------------------------
 * DIE WEICHE
 * ---------------------------------------------------------------------------
 * Beide Sammler schreiben genau EINE Tabelle. Das wird abgefangen und ueber
 * die token-gesicherte Tuer abgesetzt. Alles Uebrige (die Abrufe bei Kalshi
 * und Smarkets selbst) laeuft voellig unveraendert hinaus.
 * ------------------------------------------------------------------------- */
const echtesFetch = globalThis.fetch;

async function tuer(welche, id, maerkte, stats) {
  const r = await echtesFetch(SUPA + '/rest/v1/rpc/orion_schnappschuss', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: OEFFENTLICH, authorization: 'Bearer ' + OEFFENTLICH
    },
    body: JSON.stringify({
      p_token: TOKEN, p_welche: welche, p_id: id,
      p_maerkte: maerkte, p_stats: stats
    })
  });
  return await r.json().catch(() => ({}));
}

globalThis.fetch = async function (eingabe, opt) {
  const url = String(typeof eingabe === 'string' ? eingabe : (eingabe && eingabe.url) || '');
  if (!url.startsWith(SUPA)) return echtesFetch(eingabe, opt);

  let koerper = null;
  try { koerper = JSON.parse((opt && opt.body) || 'null'); } catch (e) { /* nichts */ }

  if (url.includes('/kalshi_snapshot')) {
    const m = url.match(/id=eq\.(\d+)/);
    const id = m ? Number(m[1]) : 1;
    const e = await tuer('kalshi', id, (koerper && koerper.maerkte) || null, (koerper && koerper.stats) || null);
    if (!e || e.ok !== true) log('  Kalshi id=' + id + ' NICHT gespeichert: ' + ((e && e.error) || '?'));
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  }

  if (url.includes('/smarkets_snapshot')) {
    const z = Array.isArray(koerper) ? koerper[0] : koerper;
    const e = await tuer('smarkets', (z && z.id) || 1, (z && z.maerkte) || null, (z && z.stats) || null);
    if (!e || e.ok !== true) log('  Smarkets NICHT gespeichert: ' + ((e && e.error) || '?'));
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  }

  const kopf = Object.assign({}, (opt && opt.headers) || {});
  kopf.apikey = OEFFENTLICH;
  kopf.authorization = 'Bearer ' + OEFFENTLICH;
  return echtesFetch(url, Object.assign({}, opt, { headers: kopf }));
};

/* Deno-Ersatz */
const handler = {};
let name = null;
globalThis.Deno = {
  env: {
    get(k) {
      if (k === 'SUPABASE_URL') return SUPA;
      if (k === 'ORION_DB_KEY' || k === 'SUPABASE_SERVICE_ROLE_KEY') return OEFFENTLICH;
      return undefined;
    }
  },
  serve(h) { handler[name] = h; }
};

name = 'kalshi';   require(pfad.join(HIER, 'sammler-kalshi.bundle.js'));
name = 'smarkets'; require(pfad.join(HIER, 'sammler-smarkets.bundle.js'));

if (typeof handler.kalshi !== 'function' || typeof handler.smarkets !== 'function') {
  console.error('Ein Sammler hat sich nicht angemeldet. Sind beide .bundle.js da?');
  process.exit(1);
}

async function sammeln(welcher) {
  const t0 = Date.now();
  try {
    const res = await handler[welcher](new Request('http://lokal/' + welcher, { method: 'POST' }));
    const j = await res.json().catch(() => ({}));
    if (j && j.ok === false) {
      log(welcher.padEnd(9) + 'nichts: ' + (j.grund || j.fehler || '?'));
      return;
    }
    const n = welcher === 'kalshi'
      ? ((j.sport && j.sport.maerkte) || 0) + ((j.welt && j.welt.maerkte) || 0)
      : (j.maerkte || j.sieger || 0);
    log(welcher.padEnd(9) + 'eingesammelt ' + String(n).padStart(4) +
        ' · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  } catch (e) {
    log(welcher.padEnd(9) + 'FEHLER: ' + ((e && e.message) || e));
  }
}

(async () => {
  console.log('');
  console.log('  ORION NOTBETRIEB - Sammler Kalshi und Smarkets');
  console.log('  ============================================================');
  console.log('  Gleicher Code wie auf dem Server. Takt: alle zwei Minuten.');
  console.log('');
  if (!TOKEN) { console.error('  FEHLER: ORION_BRIDGE_TOKEN fehlt.'); process.exit(1); }

  const runde = async () => {
    if (laeuft) { log('vorige Runde laeuft noch, diese uebersprungen'); return; }
    laeuft = true;
    try { await sammeln('kalshi'); await sammeln('smarkets'); }
    finally { laeuft = false; }
  };
  await runde();
  setInterval(runde, TAKT_MS);
})();
