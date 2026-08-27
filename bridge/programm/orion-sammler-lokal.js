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

/* ZWEI GETRENNTE TAKTE, gemessen am 27.8. von diesem Laptop aus:
 *   Kalshi    braucht  65 s
 *   Smarkets  braucht 307 s  (614 Einzelabrufe an api.smarkets.com)
 * Im Rechenzentrum waren es 16 s - das ist reine Leitung, kein Fehler.
 *
 * Nacheinander waeren das 372 s je Runde, und bei einem gemeinsamen
 * 5-Minuten-Takt haetten sie sich dauernd ueberholt. Deshalb laufen sie
 * GETRENNT und jeder mit eigener Sperre:
 *   Kalshi   alle 2 Minuten, wie der Server (pg_cron 3)
 *   Smarkets sofort wieder, sobald er fertig ist, mit 20 s Luft
 * Damit bleibt Smarkets rund 5,5 Minuten jung - die Frischesperre erlaubt
 * 15 Minuten, also reichlich Abstand. */
const TAKT_KALSHI_MS = 120_000;
/* PAUSE ZWISCHEN ZWEI SMARKETS-RUNDEN, am 27.8. von 20 s auf 90 s erhoeht.
 * GRUND, gemessen an 32 Bridge-Runden: waehrend Smarkets seine 614 Abrufe
 * abfeuert, nimmt es der Betfair-Bridge die Leitung. Mitte 9,5 s je Runde,
 * aber drei Runden ueber 60 s und eine bei 171,8 s. Die Frischesperre der
 * Bridge liegt bei 300 s - keine Runde hat sie gerissen, aber 171 s sind
 * zu nah dran. Mit 90 s Pause bekommt die Bridge in jedem Kreislauf ein
 * klares Fenster. Smarkets bleibt dadurch rund 6,5 min jung, seine Sperre
 * erlaubt 15 min. */
const PAUSE_SMARKETS_MS = 90_000;
let laeuftKalshi = false;
let laeuftSmarkets = false;

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
    /* Die Sammler melden verschiedene Felder. Bei Smarkets stand hier
     * vorher j.maerkte - das Feld gibt es dort gar nicht, also fiel es
     * still auf j.sieger zurueck und im Protokoll stand "288", obwohl
     * 3779 Maerkte gespeichert wurden. Genau die Sorte stiller Zahl, die
     * spaeter niemand mehr einordnen kann. */
    const n = welcher === 'kalshi'
      ? ((j.sport && j.sport.maerkte) || 0) + ((j.welt && j.welt.maerkte) || 0)
      : (j.mit_quoten || j.maerkte_genutzt || j.sieger || 0);
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

  /* Kalshi: fester Takt. */
  const kalshiRunde = async () => {
    if (laeuftKalshi) { log('kalshi    vorige Runde laeuft noch, uebersprungen'); return; }
    laeuftKalshi = true;
    try { await sammeln('kalshi'); } finally { laeuftKalshi = false; }
  };

  /* Smarkets: laeuft, ruht kurz, laeuft wieder. Ein fester Takt waere
   * sinnlos, weil ein Durchlauf laenger dauert als jeder vernuenftige Takt. */
  const smarketsSchleife = async () => {
    for (;;) {
      if (!laeuftSmarkets) {
        laeuftSmarkets = true;
        try { await sammeln('smarkets'); } finally { laeuftSmarkets = false; }
      }
      await new Promise((r) => setTimeout(r, PAUSE_SMARKETS_MS));
    }
  };

  await kalshiRunde();
  setInterval(kalshiRunde, TAKT_KALSHI_MS);
  smarketsSchleife();
})();
