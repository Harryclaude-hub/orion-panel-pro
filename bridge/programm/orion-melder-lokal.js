/* ===========================================================================
 * ORION NOTBETRIEB: die beiden Telegram-Bots laufen auf DIESEM Laptop
 * ===========================================================================
 * Stand 26.08.2026. Schwesterprogramm zu orion-lokal.js (dem Scanner).
 *
 * WARUM: die Supabase-Server-Funktionen kommen seit dem 25.08. nicht mehr
 * an ihre eigene Datenbank ("JWT issued at future", HTTP 401). Deshalb sind
 * auch die beiden Melder still. Neuen Code hochzuladen nuetzt nichts.
 *
 * Es ist GENAU DERSELBE Botcode wie auf dem Server, nur mit esbuild fuer
 * Node gebuendelt. Keine zweite Fassung der Logik.
 *
 * WAS ES BRAUCHT
 * --------------
 *   ORION_BRIDGE_TOKEN   - fuer die Datenbank (aus bridge-config.json)
 *   TELEGRAM_BOT_TOKEN   - fuer Telegram selbst
 * Der Telegram-Schluessel liegt NUR in den Supabase-Geheimnissen und ist
 * von aussen nicht lesbar. Der Starter fragt ihn deshalb EINMAL ab und legt
 * ihn danach in bridge-config.json ab, damit nie wieder danach gefragt wird.
 *
 * WOHIN ES SPRICHT: nur zwei Ziele, beide fest verdrahtet -
 *   noexklrgtqveiclijdwp.supabase.co   und   api.telegram.org
 *
 * ZURUECKBAUEN: beenden. Die pg_cron-Takte rufen die Server-Bots weiter
 * jede Minute, die uebernehmen von selbst, sobald Supabase repariert ist.
 * =========================================================================== */

'use strict';

const pfad = require('path');
const HIER = __dirname;

const SUPA = 'https://noexklrgtqveiclijdwp.supabase.co';
const OEFFENTLICH = 'sb_publishable_NrgVUoZhe-uN8U8j41P17Q_9cZgUd6M';
const TOKEN = process.env.ORION_BRIDGE_TOKEN || '';
/* ZWEI Bots, ZWEI Schluessel. Der Chancen-Bot liest TELEGRAM_BOT_TOKEN,
 * der Knapp-Bot TELEGRAM_BOT_TOKEN_KNAPP (orion-melder-knapp/index.ts:64).
 * Beide kommen von @BotFather. Fehlt einer, laeuft nur der andere. */
const TG = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_KNAPP = process.env.TELEGRAM_BOT_TOKEN_KNAPP || '';

const TAKT_CHANCE_MS = 60_000;    // wie pg_cron 92: jede Minute
const TAKT_KNAPP_MS = 300_000;    // wie pg_cron 93: alle fuenf Minuten

function zeit() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds());
}
function log(s) { console.log(zeit() + '  ' + s); }

/* ---------------------------------------------------------------------------
 * DIE WEICHE
 * ---------------------------------------------------------------------------
 * orion_telegram_empfaenger ist gesperrt (RLS an, keine Regel) - dort stehen
 * Chat-Nummern. Das bleibt so. Zugriff nur ueber die token-gesicherte Tuer
 * orion_melder(). orion_funde und orion_kurse darf der oeffentliche
 * Schluessel lesen, das laeuft direkt.
 * ------------------------------------------------------------------------- */
const echtesFetch = globalThis.fetch;
let botNr = 1;

async function tuer(tat, daten) {
  const r = await echtesFetch(SUPA + '/rest/v1/rpc/orion_melder', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: OEFFENTLICH, authorization: 'Bearer ' + OEFFENTLICH
    },
    body: JSON.stringify({ p_token: TOKEN, p_tat: tat, p_bot: botNr, p_daten: daten ?? null })
  });
  return await r.json().catch(() => ({}));
}

function antwort(objekt, status) {
  return new Response(JSON.stringify(objekt), {
    status: status || 200, headers: { 'content-type': 'application/json' }
  });
}

globalThis.fetch = async function (eingabe, opt) {
  const url = String(typeof eingabe === 'string' ? eingabe : (eingabe && eingabe.url) || '');

  /* Telegram und alles Uebrige: unveraendert hinaus. */
  if (!url.startsWith(SUPA)) return echtesFetch(eingabe, opt);

  const art = ((opt && opt.method) || 'GET').toUpperCase();

  /* Empfaenger holen */
  if (art === 'GET' && url.includes('/orion_telegram_empfaenger')) {
    const e = await tuer('empfaenger');
    return antwort(e && e.ok ? e.empfaenger : []);
  }

  /* Neue Chats eintragen */
  if (art === 'POST' && url.includes('/orion_telegram_empfaenger')) {
    let zeilen = [];
    try { zeilen = JSON.parse((opt && opt.body) || '[]'); } catch (e) { /* nichts */ }
    const e = await tuer('neu', zeilen);
    return antwort(e && e.ok ? (e.zeilen || []) : []);
  }

  /* Einen Empfaenger stilllegen */
  if (art === 'PATCH' && url.includes('/orion_telegram_empfaenger')) {
    const m = url.match(/id=eq\.([^&]+)/);
    let grund = '';
    try { grund = String((JSON.parse((opt && opt.body) || '{}')).letzter_fehler || ''); } catch (e) { /* nichts */ }
    if (m) await tuer('stilllegen', { id: decodeURIComponent(m[1]), grund });
    return antwort({});
  }

  /* Funde als gemeldet markieren */
  if (art === 'PATCH' && url.includes('/orion_funde')) {
    const m = url.match(/schluessel=in\.\(([^)]*)\)/);
    let spalte = 'telegram_gemeldet', klasse = 'chance';
    try {
      const b = JSON.parse((opt && opt.body) || '{}');
      if (b && b.knapp_gemeldet) { spalte = 'knapp_gemeldet'; klasse = 'knapp'; }
    } catch (e) { /* nichts */ }
    if (m) {
      const liste = decodeURIComponent(m[1])
        .split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
      const e = await tuer('gemeldet', { schluessel: liste, spalte, klasse });
      log('  markiert: ' + ((e && e.markiert) || 0));
    }
    return antwort({});
  }

  /* Lesen: orion_funde, orion_kurse - direkt mit dem oeffentlichen Schluessel */
  const kopf = Object.assign({}, (opt && opt.headers) || {});
  kopf.apikey = OEFFENTLICH;
  kopf.authorization = 'Bearer ' + OEFFENTLICH;
  return echtesFetch(url, Object.assign({}, opt, { headers: kopf }));
};

/* Deno-Ersatz */
const handler = {};
let letzterName = null;
globalThis.Deno = {
  env: {
    get(k) {
      if (k === 'SUPABASE_URL') return SUPA;
      if (k === 'ORION_DB_KEY' || k === 'SUPABASE_SERVICE_ROLE_KEY') return OEFFENTLICH;
      if (k === 'TELEGRAM_BOT_TOKEN') return TG;
      if (k === 'TELEGRAM_BOT_TOKEN_KNAPP') return TG_KNAPP;
      return undefined;
    }
  },
  serve(h) { handler[letzterName] = h; }
};

letzterName = 'chance'; require(pfad.join(HIER, 'melder-chance.bundle.js'));
letzterName = 'knapp';  require(pfad.join(HIER, 'melder-knapp.bundle.js'));

if (typeof handler.chance !== 'function' || typeof handler.knapp !== 'function') {
  console.error('Ein Bot hat sich nicht angemeldet. Sind die beiden .bundle.js-Dateien da?');
  process.exit(1);
}

async function laufen(name, nr, koerper) {
  botNr = nr;
  try {
    const res = await handler[name](new Request('http://lokal/' + name, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(koerper || {})
    }));
    const j = await res.json().catch(() => ({}));
    if (j && j.ok) {
      if (j.getan === 'nichts') log(name.padEnd(8) + 'nichts zu melden (' + (j.grund || '') + ')');
      else log(name.padEnd(8) + 'GEMELDET ' + (j.gemeldet || 0) +
               ' · zugestellt an ' + ((j.zustellung && j.zustellung.zugestellt) || 0) +
               (j.neu_angemeldet ? ' · neu angemeldet ' + j.neu_angemeldet : ''));
    } else {
      log(name.padEnd(8) + 'FEHLER: ' + ((j && (j.grund || j.fehler)) || '?'));
    }
    return j;
  } catch (e) {
    log(name.padEnd(8) + 'FEHLER: ' + ((e && e.message) || e));
    return null;
  }
}

(async () => {
  console.log('');
  console.log('  ORION NOTBETRIEB - die Telegram-Bots laufen auf diesem Laptop');
  console.log('  ============================================================');
  console.log('  Gleicher Code wie auf dem Server.');
  console.log('  Chancen-Bot jede Minute, Knapp-Bot alle fuenf Minuten.');
  console.log('');
  if (!TOKEN) { console.error('  FEHLER: ORION_BRIDGE_TOKEN fehlt.'); process.exit(1); }
  if (!TG && !TG_KNAPP) {
    console.error('  FEHLER: kein Telegram-Schluessel gesetzt.');
    console.error('  Die beiden liegen nur in den Supabase-Geheimnissen oder bei');
    console.error('  @BotFather (/mybots > Bot waehlen > API Token):');
    console.error('    TELEGRAM_BOT_TOKEN         fuer den Chancen-Bot');
    console.error('    TELEGRAM_BOT_TOKEN_KNAPP   fuer den Knapp-Bot');
    console.error('  Der Starter NOTBETRIEB-STARTEN.cmd fragt sie EINMAL ab und');
    console.error('  merkt sie sich danach.');
    process.exit(1);
  }
  if (!TG)       console.log('  HINWEIS: kein Chancen-Schluessel, nur der Knapp-Bot laeuft.');
  if (!TG_KNAPP) console.log('  HINWEIS: kein Knapp-Schluessel, nur der Chancen-Bot laeuft.');

  if (process.argv.includes('--probe')) {
    log('Funkprobe an alle Empfaenger ...');
    await laufen('chance', 1, { test: true });
    process.exit(0);
  }

  const takte  = async () => { if (TG)       await laufen('chance', 1); };
  const takteK = async () => { if (TG_KNAPP) await laufen('knapp', 2); };

  await takte(); await takteK();
  setInterval(takte, TAKT_CHANCE_MS);
  setInterval(takteK, TAKT_KNAPP_MS);
})();
