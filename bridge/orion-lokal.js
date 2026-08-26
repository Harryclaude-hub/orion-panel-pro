/* ===========================================================================
 * ORION NOTBETRIEB: der Scanner laeuft auf DIESEM Laptop
 * ===========================================================================
 * Stand 26.08.2026.
 *
 * WARUM ES DAS GIBT
 * -----------------
 * Seit dem 25.08. um 21:33 UTC weist die Supabase-Datenbank ihre EIGENEN
 * Server-Funktionen ab. PostgREST antwortet auf den Dienstschluessel mit
 *     "JWT issued at future"   ->   HTTP 401
 * Gemessen: 12 von 12 Aufrufen, dauerhaft. Auf status.supabase.com steht
 * dazu seit dem 14.08. die offene Meldung "401 errors due to JWT rejections".
 * Neu ausrollen half nicht (am 26.08. mit HTTP 201 ausgerollt, danach
 * unveraendert 401). Neuen Code auf den Server zu bringen nuetzt nichts,
 * solange der Server seine eigene Datenbank nicht lesen darf.
 *
 * DER AUSWEG
 * ----------
 * Die NEUEN Supabase-Schluessel (sb_publishable_...) sind KEINE JWT und
 * laufen an der kaputten Pruefung vorbei. Deshalb laeuft der Scanner
 * ersatzweise hier, mit GENAU DEMSELBEN CODE: orion-lauf.bundle.js ist
 * Wort fuer Wort der Scanner aus dem Repo, nur mit esbuild fuer Node
 * gebuendelt. Es gibt KEINE zweite Fassung der Logik.
 *
 * WAS DIESES PROGRAMM ANFASST
 * ---------------------------
 * Es liest KEINE Zugangsdatei. Es kennt nur zwei Werte:
 *   - den oeffentlichen Schluessel (steht unten im Klartext, weil er
 *     oeffentlich IST: derselbe steht im Panel und ist im Browser jedes
 *     Besuchers lesbar; er darf ausschliesslich lesen)
 *   - den Bridge-Token, den ihm der Starter als Umgebungsvariable
 *     ORION_BRIDGE_TOKEN uebergibt
 * Betfair-Benutzername und -Passwort braucht es hier nicht und sieht es nie.
 *
 * WOHIN ES SPRICHT
 * ----------------
 * Nur zwei Ziele, beide fest verdrahtet:
 *   noexklrgtqveiclijdwp.supabase.co   (Datenbank)
 *   die Polymarket-Adressen des Scanners
 * Es gibt keinen weiteren Empfaenger und keine Moeglichkeit, einen
 * hinzuzufuegen.
 *
 * WAS NICHT GEHT
 * --------------
 * Kalshi und Smarkets werden von eigenen Server-Funktionen eingesammelt,
 * die genauso tot sind. Ihre Schnappschuesse sind ueber 20 Stunden alt, und
 * die Frischesperren halten sie deshalb richtigerweise zurueck. Es entstehen
 * also nur Polymarket-gegen-Betfair-Paare. Das ist genau die Paarung des
 * Sonego-Falls vom 24.08.
 *
 * ZURUECKBAUEN
 * ------------
 * Ist die Stoerung vorbei, dieses Programm beenden. Die pg_cron-Takte rufen
 * den Server-Scanner weiter jede Minute, der uebernimmt von selbst wieder.
 * Danach koennen orion_lauf_schreiben() und orion_bridge_annehmen() in der
 * Datenbank ersatzlos geloescht werden.
 * =========================================================================== */

'use strict';

const pfad = require('path');
const HIER = __dirname;

const SUPA = 'https://noexklrgtqveiclijdwp.supabase.co';

/* Oeffentlicher Schluessel, KEIN Geheimnis. Er darf nur lesen. */
const OEFFENTLICH = 'sb_publishable_NrgVUoZhe-uN8U8j41P17Q_9cZgUd6M';

/* Der Bridge-Token kommt vom Starter. Ohne ihn wird nur gerechnet,
 * nicht geschrieben - das ist der Probelauf. */
const TOKEN = process.env.ORION_BRIDGE_TOKEN || '';

const BEREICHE = [
  'fussball', 'tennis', 'basketball', 'baseball', 'eishockey', 'football',
  'fussball', 'cricket', 'mma', 'motorsport', 'golf', 'esport',
  'fussball', 'lol', 'valorant', 'politik', 'krypto', 'wirtschaft',
  'fussball', 'welt', 'wetter', 'tech', 'kultur'
];
const PAUSE_MS = 4000;

const NUR_PROBE = process.argv.includes('--probe') || !TOKEN;

function zeit() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds());
}
function log(s) { console.log(zeit() + '  ' + s); }

/* ---------------------------------------------------------------------------
 * DIE WEICHE
 * ---------------------------------------------------------------------------
 * Der Scanner spricht die Datenbank ueber fetch() an, mit genau den Adressen,
 * die er auf dem Server benutzt. Hier wird das abgefangen:
 *   LESEN     -> unveraendert weiter, nur mit dem oeffentlichen Schluessel
 *   SCHREIBEN -> gesammelt und am Ende in EINEM Aufruf ueber die
 *                token-gesicherte Tuer orion_lauf_schreiben() abgesetzt
 * Alles, was NICHT an die Datenbank geht (Polymarket), laeuft voellig
 * unveraendert durch, ohne dass ein Schluessel angehaengt wird.
 *
 * So bleibt der Scannercode unangetastet, und es gibt keine zweite Fassung
 * der Logik, die auseinanderlaufen koennte.
 * ------------------------------------------------------------------------- */
const echtesFetch = globalThis.fetch;
let sammler = null;

async function schreibenAbsetzen() {
  if (!sammler || !TOKEN) return { ok: true, uebersprungen: true };
  const r = await echtesFetch(SUPA + '/rest/v1/rpc/orion_lauf_schreiben', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: OEFFENTLICH,
      authorization: 'Bearer ' + OEFFENTLICH
    },
    body: JSON.stringify({
      p_token: TOKEN,
      p_bereich: sammler.bereich,
      p_funde: sammler.funde,
      p_marke: sammler.marke,
      p_grund: sammler.grund,
      p_lauf: sammler.lauf
    })
  });
  return await r.json().catch(() => ({}));
}

globalThis.fetch = async function (eingabe, opt) {
  const url = String(typeof eingabe === 'string' ? eingabe : (eingabe && eingabe.url) || '');

  /* Alles, was nicht an unsere Datenbank geht, bleibt voellig unberuehrt. */
  if (!url.startsWith(SUPA)) return echtesFetch(eingabe, opt);

  const art = ((opt && opt.method) || 'GET').toUpperCase();

  if (sammler) {
    if (art === 'POST' && url.includes('/orion_funde')) {
      try {
        const zeilen = JSON.parse((opt && opt.body) || '[]');
        if (Array.isArray(zeilen)) sammler.funde.push(...zeilen);
      } catch (e) { /* nichts */ }
      return new Response('', { status: 201 });
    }
    if (art === 'PATCH' && url.includes('/orion_funde')) {
      const m = url.match(/zuletzt_gesehen=lt\.([^&]+)/);
      if (m) {
        sammler.marke = decodeURIComponent(m[1]);
        try {
          const b = JSON.parse((opt && opt.body) || '{}');
          if (b && b.vorbei_grund) sammler.grund = b.vorbei_grund;
        } catch (e) { /* nichts */ }
      }
      /* Der Scanner liest daraus nur die ANZAHL. Die echte Zahl rechnet
       * orion_lauf_schreiben() und schreibt sie selbst nach orion_laeufe. */
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (art === 'POST' && url.includes('/orion_laeufe')) {
      try { sammler.lauf = JSON.parse((opt && opt.body) || '{}'); } catch (e) { /* nichts */ }
      return new Response('', { status: 201 });
    }
  }

  const kopf = Object.assign({}, (opt && opt.headers) || {});
  kopf.apikey = OEFFENTLICH;
  kopf.authorization = 'Bearer ' + OEFFENTLICH;
  return echtesFetch(url, Object.assign({}, opt, { headers: kopf }));
};

/* Deno-Ersatz. Der Scanner benutzt nur vier Deno-Stellen. */
let handler = null;
globalThis.Deno = {
  env: {
    get(k) {
      if (k === 'SUPABASE_URL') return SUPA;
      if (k === 'ORION_DB_KEY' || k === 'SUPABASE_SERVICE_ROLE_KEY') return OEFFENTLICH;
      return undefined;
    }
  },
  serve(h) { handler = h; }
};

require(pfad.join(HIER, 'orion-lauf.bundle.js'));

if (typeof handler !== 'function') {
  console.error('Der Scanner hat sich nicht angemeldet. Ist orion-lauf.bundle.js in Ordnung?');
  process.exit(1);
}

async function einBereich(bereich) {
  sammler = { bereich, funde: [], marke: null, grund: 'nicht mehr gefunden', lauf: null };
  const t0 = Date.now();
  let antwort = null;
  try {
    const res = await handler(new Request('http://lokal/orion-lauf', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bereich, probe: false })
    }));
    antwort = await res.json().catch(() => ({}));
  } catch (e) {
    log('FEHLER ' + bereich + ': ' + ((e && e.message) || e));
    sammler = null;
    return;
  }

  if (!antwort || antwort.ok !== true) {
    log(bereich.padEnd(12) + 'nichts: ' + ((antwort && antwort.fehler) || '?'));
    sammler = null;
    return;
  }

  let ergebnis = '(Probelauf, nichts geschrieben)';
  if (!NUR_PROBE) {
    const erg = await schreibenAbsetzen();
    ergebnis = erg && erg.ok
      ? ('gespeichert ' + erg.geschrieben + ' · beendet ' + erg.beendet)
      : ('SCHREIBEN FEHLGESCHLAGEN: ' + ((erg && erg.error) || '?'));
  }
  sammler = null;

  const bf = (antwort.betfair && antwort.betfair.geladen) || 0;
  log(bereich.padEnd(12) +
      'PM ' + String(antwort.pm_maerkte || 0).padStart(4) +
      ' · BF ' + String(bf).padStart(4) +
      ' · Paare ' + String(antwort.paare || 0).padStart(4) +
      ' · Chancen ' + String(antwort.chancen || 0).padStart(3) +
      ' · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s · ' + ergebnis);
}

(async () => {
  console.log('');
  console.log('  ORION NOTBETRIEB - der Scanner laeuft auf diesem Laptop');
  console.log('  ============================================================');
  console.log('  Grund: die Supabase-Server-Funktionen kommen nicht an ihre');
  console.log('  eigene Datenbank ("JWT issued at future"). Siehe README.');
  console.log('');
  console.log('  Gleicher Code wie auf dem Server, nur hier ausgefuehrt.');
  console.log('  Kalshi und Smarkets bleiben still, ihre Sammler sind auch tot.');
  console.log('  Es entstehen Polymarket-gegen-Betfair-Paare.');
  if (NUR_PROBE) {
    console.log('');
    console.log('  PROBELAUF: es wird gerechnet, aber NICHTS geschrieben.');
    console.log('  (kein ORION_BRIDGE_TOKEN gesetzt, oder --probe angegeben)');
  }
  console.log('');

  const einmal = process.argv.includes('--einmal');
  for (;;) {
    for (const b of BEREICHE) {
      await einBereich(b);
      if (einmal) { console.log('\n  Ein Durchgang beendet.'); process.exit(0); }
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
  }
})();
