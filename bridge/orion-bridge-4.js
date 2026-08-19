/* ============================================================================
 * ORION BRIDGE 4.0 — schlank, sportartweise, ohne Ballast
 * ============================================================================
 *
 * WOZU: Betfair beantwortet Anfragen aus Rechenzentren mit 403. Deshalb —
 * und NUR deshalb — muss dieses eine Stück auf einem Rechner zu Hause
 * laufen. Es holt Betfair-Kurse und lädt sie zum Panel hoch. Sonst nichts.
 *
 * WAS SICH GEGENÜBER 3.8 ÄNDERT (16.8.2026, Auftrag des Auftraggebers:
 * „die Bridge lässt sich nicht mehr öffnen, sie wird immer größer …
 *  scanne mehrere Sachen separat, nicht alles auf einmal"):
 *
 *   1. SPORTART FÜR SPORTART, im Rotationsverfahren. 3.8 zog in einem
 *      Durchlauf ALLE Sportarten in einen einzigen Katalog und hielt sie
 *      alle gleichzeitig im Speicher. Jetzt ist jede Sportart ein eigener,
 *      getrennter Vorrat, und je Durchlauf wird GENAU EINER erneuert
 *      (Fußball öfter, weil dort die Partien liegen). Das ist derselbe
 *      Gedanke wie beim Server-Scanner: getrennt scannen, nichts vermischen.
 *   2. VERFALL. Jeder Markt, dessen Anpfiff über 3 Stunden zurückliegt
 *      oder der über 30 Minuten nicht mehr gesehen wurde, fliegt raus.
 *      Damit hört der Speicher auf zu wachsen — das war der Grund, warum
 *      3.8 mit den Stunden immer träger wurde.
 *   3. NUR NOCH BETFAIR. Der Polymarket-Scan, die eigene Arbitrage-Rechnung
 *      und die Telegram-Meldungen sind RAUS: das macht seit dem 11.8. alles
 *      der Server (orion-lauf, jede Sportart mit eigenem Takt, dreifach
 *      geprüft). Zwei Rechenwege für dieselbe Sache sind die Drift-Falle,
 *      die dieses Projekt schon zweimal getroffen hat.
 *   4. KEINE 92-MB-EXE mehr, sondern ein Node-Skript von ~350 Zeilen.
 *      Es startet sofort, lässt sich lesen und ändern.
 *
 * WAS ABSICHTLICH GLEICH BLEIBT — HARTE REGEL:
 *   Das Upload-Format (Felder k, r, mt, ev, st, ip, sz, et, link sowie
 *   data/v:2/stats), die Adresse bf-bridge und die Zugangsdatei
 *   bridge-config.json. Der Server erwartet genau das. Wer daran etwas
 *   ändert, bricht den laufenden Betrieb.
 *
 * START:  Bridge-start.cmd  (oder: node orion-bridge-4.js)
 * ========================================================================== */

'use strict';

const fs = require('fs');
const pfad = require('path');

const VERSION = '4.0';
const BUILD = 25;   // 24: co = Wettbewerb · 25: Grundanteil je Sportart + Standby-Pruefung

/* ---------- Zugangsdatei ---------- */
const CFG_DATEI = pfad.join(__dirname, 'bridge-config.json');
let CFG;
try {
  CFG = JSON.parse(fs.readFileSync(CFG_DATEI, 'utf8'));
} catch (e) {
  console.error('\n  Die Datei bridge-config.json fehlt oder ist beschädigt.');
  console.error('  Sie gehört NEBEN dieses Programm. ' + e.message + '\n');
  process.exit(1);
}
for (const feld of ['betfairUsername', 'betfairPassword', 'betfairAppKey', 'bridgeToken', 'bridgeUrl']) {
  if (!CFG[feld]) { console.error('\n  In bridge-config.json fehlt: ' + feld + '\n'); process.exit(1); }
}

/* ---------- NUR EINE BRIDGE GLEICHZEITIG ----------
 * Sie startet ab dem 16.8. automatisch beim Anmelden (Aufgabenplanung).
 * Klickt man zusätzlich von Hand auf Bridge-start.cmd, liefen sonst zwei
 * Bridges nebeneinander: doppelte Betfair-Anfragen (Drosselung droht) und
 * zwei Uploads, die sich gegenseitig überschreiben. Die Sperrdatei hält
 * die Prozessnummer; lebt der Prozess nicht mehr, wird sie übernommen. */
const SPERRE = pfad.join(__dirname, 'bridge.lock');
(function einzeln() {
  try {
    const alt = Number(fs.readFileSync(SPERRE, 'utf8').trim());
    if (alt && alt !== process.pid) {
      try {
        process.kill(alt, 0);          // wirft, wenn es den Prozess nicht gibt
        console.error('');
        console.error('  Es läuft bereits eine Bridge (Prozess ' + alt + ').');
        console.error('  Dieses Fenster kann geschlossen werden.');
        console.error('');
        process.exit(0);
      } catch (e) { /* Prozess ist tot — Sperre übernehmen */ }
    }
  } catch (e) { /* keine Sperrdatei — erster Start */ }
  fs.writeFileSync(SPERRE, String(process.pid));
  const weg = () => { try { fs.unlinkSync(SPERRE); } catch (e) {} };
  process.on('exit', weg);
  process.on('SIGINT', () => { weg(); process.exit(0); });
  process.on('SIGTERM', () => { weg(); process.exit(0); });
})();

/* ---------- Adressen (nie ändern) ---------- */
const BF_LOGIN = 'https://identitysso.betfair.com/api/login';
const BF_KEEP  = 'https://identitysso.betfair.com/api/keepAlive';
const BF_RPC   = 'https://api.betfair.com/exchange/betting/json-rpc/v1';

/* ---------- Einstellungen ---------- */
const O = {
  /* Wie weit voraus geschaut wird. Der Server nimmt ohnehin nur Märkte,
   * die innerhalb von 72 Stunden starten. */
  fensterStunden: zahl(CFG.windowHours, 72),
  /* Sekunden zwischen zwei Durchläufen. Je Durchlauf wird EINE Sportart
   * erneuert und danach werden die Kurse der dringlichsten Märkte gelesen. */
  taktSekunden: zahl(CFG.intervalSeconds, 30),
  /* Wie viele Märkte je Durchlauf Kurse bekommen. Betfair rechnet
   * EX_BEST_OFFERS mit Gewicht 5 und erlaubt 200 je Aufruf — 40 je Paket. */
  kurseProDurchlauf: zahl(CFG.marketsPerRun, 400),
  /* Höchstzahl hochgeladener Märkte (der Server deckelt ohnehin). */
  uploadLimit: zahl(CFG.uploadLimit, 1200),
  /* Rückfall-Kommission, falls Betfair für einen Markt keine meldet. */
  feeBf: zahl(CFG.feeBetfairPercent, 3) / 100,
  /* Sportarten, die nie geladen werden (Standard: 7 = Pferde, 4339 = Hunde). */
  aus: (CFG.excludeEventTypeIds || ['7', '4339']).map(String),
  /* GRUNDANTEIL je Sportart (Build 25): so viele Maerkte bekommt JEDE
   * Sportart mit Bestand garantiert Kurse, bevor der Rest global nach
   * Dringlichkeit verteilt wird. Ohne das fressen Fussball und Tennis
   * das ganze Kontingent und die kleinen Sportarten kommen nie an. */
  grundanteil: zahl(CFG.grundanteilJeSportart, 24)
};

const PAKET = 40;
const VERFALL_MIN = 30;          // nicht mehr gesehen -> vergessen
const NACH_ANPFIFF_STD = 3;      // so lange nach Anpfiff bleibt ein Markt

/* Sportarten, die der Server überhaupt zuordnen kann (orion_bf_sport).
 * Alles andere zu laden wäre Arbeit für nichts — der Server verwirft es.
 * Fußball steht vorn und kommt öfter dran.
 *
 * SCHALTER (seit Build 21): In bridge-config.json darf ein Feld
 * "sportarten" stehen. Je Schlüssel sind drei Einstellungen erlaubt:
 *   aktiv           false nimmt die Sportart ganz aus der Rotation
 *   fensterStunden  wie weit DIESE Sportart vorausschaut (höchstens das
 *                   globale Fenster — der Server nimmt ohnehin nur 72 h)
 *   anteil          wie oft je Rotationszyklus (ganze Zahl, Standard 1)
 * Beispiel:
 *   "sportarten": { "tennis": { "aktiv": false },
 *                   "esport": { "anteil": 2, "fensterStunden": 24 } }
 * Fehlt das Feld, läuft alles exakt wie bisher. Die erste AKTIVE Sportart
 * der Liste (normal: Fußball) kommt in jeder zweiten Runde dran; "anteil"
 * steuert die übrigen. */
const SPORT = [
  { key: 'fussball',   et: '1',        name: 'Fußball' },
  { key: 'tennis',     et: '2',        name: 'Tennis' },
  { key: 'basketball', et: '7522',     name: 'Basketball' },
  { key: 'baseball',   et: '7511',     name: 'Baseball' },
  { key: 'football',   et: '6423',     name: 'American Football' },
  { key: 'eishockey',  et: '7524',     name: 'Eishockey' },
  { key: 'cricket',    et: '4',        name: 'Cricket' },
  { key: 'boxen',      et: '6',        name: 'Boxen' },
  { key: 'mma',        et: '26420387', name: 'MMA' },
  { key: 'motorsport', et: '8',        name: 'Motorsport' },
  { key: 'esport',     et: '27454571', name: 'E-Sport' }
];

/* ---------- Sportarten-Schalter auswerten ----------
 * Stille Fehlschläge sind in diesem Projekt eine bekannte Fehlerklasse.
 * Darum wird jeder vertippte Schlüssel und jedes unbekannte Feld beim
 * Start LAUT gemeldet — nichts wird stumm verschluckt. */
const AKTIV = (function schalter() {
  const cfg = CFG.sportarten || {};
  const gueltig = SPORT.map(s => s.key);
  for (const k of Object.keys(cfg)) {
    if (gueltig.indexOf(k) < 0) {
      console.error('  WARNUNG: "sportarten.' + k + '" kennt die Bridge nicht — wird ignoriert.');
      console.error('           Gültige Schlüssel: ' + gueltig.join(', '));
    }
  }
  const liste = [];
  for (const s of SPORT) {
    const c = cfg[s.key] || {};
    for (const feld of Object.keys(c)) {
      if (feld !== 'aktiv' && feld !== 'fensterStunden' && feld !== 'anteil') {
        console.error('  WARNUNG: "sportarten.' + s.key + '.' + feld + '" kennt die Bridge nicht' +
                      ' (gültig: aktiv, fensterStunden, anteil).');
      }
    }
    if (c.aktiv === false) continue;
    let fenster = zahl(c.fensterStunden, O.fensterStunden);
    if (fenster > O.fensterStunden) {
      console.error('  WARNUNG: sportarten.' + s.key + '.fensterStunden (' + fenster + ') liegt über dem' +
                    ' globalen Fenster — gekappt auf ' + O.fensterStunden + ' h (mehr nimmt der Server nicht).');
      fenster = O.fensterStunden;
    }
    if (!(fenster > 0)) fenster = O.fensterStunden;
    const anteil = Math.max(1, Math.round(zahl(c.anteil, 1)));
    liste.push({ key: s.key, et: s.et, name: s.name, fenster, anteil });
  }
  if (liste.length === 0) {
    console.error('\n  In bridge-config.json sind ALLE Sportarten abgeschaltet — dann gibt es nichts zu tun.');
    console.error('  Mindestens eine Sportart in "sportarten" wieder auf aktiv stellen.\n');
    process.exit(1);
  }
  return liste;
})();

/* Nur diese Markttypen kann der Server paaren. Alles andere ist Ballast. */
const TYPEN = /^(MATCH_ODDS|OVER_UNDER_\d+)$/;

function zahl(x, standard) { const n = Number(x); return isFinite(n) ? n : standard; }
function schlaf(ms) { return new Promise(r => setTimeout(r, ms)); }
function zeit() { return new Date().toLocaleTimeString('de-AT'); }
function log(s) { console.log(zeit() + '  ' + s); }

/* ---------- Betfair: Anmeldung ---------- */
let sitzung = null, letzteAnmeldung = 0;

async function anmelden() {
  const r = await fetch(BF_LOGIN, {
    method: 'POST',
    headers: {
      'X-Application': CFG.betfairAppKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: 'username=' + encodeURIComponent(CFG.betfairUsername) +
          '&password=' + encodeURIComponent(CFG.betfairPassword)
  });
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch (e) {}
  if (!j) throw new Error('Unerwartete Antwort von Betfair: ' + txt.slice(0, 120));
  /* Bei eingeschränktem Konto (SUSPENDED, KYC) kommt TROTZDEM ein Token:
   * wetten gesperrt, Kurse lesen erlaubt. Genau das brauchen wir. */
  if (!j.token) {
    throw new Error('Anmeldung fehlgeschlagen: ' + (j.error || j.status || 'unbekannt') +
                    ' — prüfe zuerst den Benutzernamen in bridge-config.json');
  }
  sitzung = j.token;
  letzteAnmeldung = Date.now();
  log(j.status === 'SUCCESS'
    ? 'Bei Betfair angemeldet.'
    : 'Angemeldet — Konto eingeschränkt (' + (j.error || j.status) + '), Kurse lesen geht.');
}

async function wachhalten() {
  try {
    await fetch(BF_KEEP, { headers: { 'X-Application': CFG.betfairAppKey, 'X-Authentication': sitzung } });
    letzteAnmeldung = Date.now();
  } catch (e) { sitzung = null; }
}

/* ---------- Betfair: Anfragen ---------- */
let letzteAnfrage = 0;
async function rpc(methode, params) {
  /* Sanfte Bremse: Betfair drosselt bei zu vielen Anfragen je Sekunde. */
  const abstand = Date.now() - letzteAnfrage;
  if (abstand < 120) await schlaf(120 - abstand);
  letzteAnfrage = Date.now();

  const r = await fetch(BF_RPC, {
    method: 'POST',
    headers: {
      'X-Application': CFG.betfairAppKey, 'X-Authentication': sitzung,
      'Content-Type': 'application/json', 'Accept': 'application/json'
    },
    body: JSON.stringify([{ jsonrpc: '2.0', method: 'SportsAPING/v1.0/' + methode, params, id: 1 }])
  });
  const txt = await r.text();
  if (txt.trim().startsWith('<')) {
    throw new Error('Blockiert (HTML statt Daten) — läuft das Programm wirklich zu Hause? VPN aus?');
  }
  const j = JSON.parse(txt);
  const erste = Array.isArray(j) ? j[0] : j;
  if (erste && erste.error) {
    const d = erste.error.data && erste.error.data.APINGException;
    throw new Error((d && (d.errorCode || d.errorDetails)) || erste.error.message || 'Betfair-Fehler');
  }
  return erste ? erste.result : null;
}

/* ---------- Der Vorrat: JE SPORTART getrennt ----------
 * Das ist der Kern der Änderung. 3.8 hatte EINEN Katalog für alles; hier
 * hat jede Sportart ihren eigenen, und nur einer wird je Durchlauf
 * angefasst. Nichts vermischt sich, nichts wächst unbegrenzt. */
const VORRAT = new Map();   // etId -> Map(marketId -> markt)

function vorratVon(et) {
  let m = VORRAT.get(et);
  if (!m) { m = new Map(); VORRAT.set(et, m); }
  return m;
}

/* ---------- Betfairs eigene Sportkarte (Build 23) ----------
 * Der Wächter prüft die Zuordnung et → Bereich gegen Betfairs EIGENE
 * Bezeichnungen (orion_bf_sport.name_erwartet: "Soccer", "Boxing", …).
 * Build 20-22 schickten stattdessen unsere deutschen Anzeigenamen —
 * Folge: Dauer-Fehlalarm im Wächter, jede Minute seit dem 16.8., der
 * echte Vermischungs-Alarme im Rauschen ersäufte. Build 23 holt die
 * Namen wieder aus listEventTypes (wie Build 19): geprüft wird gegen
 * die Quelle, statt ihr zu glauben — nur so fällt eine falsche
 * eventTypeId auf (die MMA-Fehlzuordnung wurde genau so gefunden).
 * Solange die Karte noch nicht geholt ist, wird et_namen WEGGELASSEN;
 * der Wächter überspringt die Prüfung dann, statt Unsinn zu melden. */
let ET_NAMEN = null;

async function sportkarteHolen() {
  const res = await rpc('listEventTypes', { filter: {} });
  const karte = {};
  for (const r of res || []) {
    const et = r.eventType ? String(r.eventType.id) : null;
    if (et && SPORT.some(s => s.et === et)) karte[et] = r.eventType.name;
  }
  if (Object.keys(karte).length === 0) throw new Error('Sportkarte kam leer zurück');
  ET_NAMEN = karte;
  log('Sportkarte von Betfair geholt (' + Object.keys(karte).length + ' von ' + SPORT.length + ' Sportarten).');
}

/* Fenster halbieren, wenn Betfair „zu viel verlangt" meldet — das ist
 * kein Fehler, sondern der normale Weg bei großen Sportarten. */
async function katalog(et, vonMs, bisMs, tiefe) {
  let res;
  try {
    res = await rpc('listMarketCatalogue', {
      filter: {
        eventTypeIds: [et],
        marketTypeCodes: ['MATCH_ODDS', 'OVER_UNDER_05', 'OVER_UNDER_15', 'OVER_UNDER_25',
                          'OVER_UNDER_35', 'OVER_UNDER_45', 'OVER_UNDER_55'],
        marketStartTime: { from: new Date(vonMs).toISOString(), to: new Date(bisMs).toISOString() }
      },
      maxResults: 1000, sort: 'FIRST_TO_START',
      /* COMPETITION seit Build 24: der Wettbewerbsname ("Premier League 2",
       * "Liga MX U21"). Er verraet eine Jugend-, Reserve- oder Frauenliga
       * auch dann, wenn die MANNSCHAFTSNAMEN unauffaellig sind — genau der
       * Fall, den die Namenspruefung nicht sehen kann. */
      marketProjection: ['RUNNER_DESCRIPTION', 'EVENT', 'MARKET_START_TIME', 'MARKET_DESCRIPTION', 'COMPETITION']
    });
  } catch (e) {
    const zuViel = /TOO_MUCH_DATA|ANGX-0001/i.test(String(e.message || ''));
    if (zuViel && bisMs - vonMs > 2 * 60e3 && tiefe < 20) {
      const mitte = Math.floor((vonMs + bisMs) / 2);
      await katalog(et, vonMs, mitte, tiefe + 1);
      await katalog(et, mitte, bisMs, tiefe + 1);
      return;
    }
    if (zuViel) return;          // kleinstes Fenster, trotzdem zu viel: auslassen
    throw e;                     // Anmeldung, Netz: echter Fehler
  }
  if (!res) return;

  const jetzt = Date.now();
  const vorrat = vorratVon(et);
  for (const c of res) {
    const bd = c.description || {};
    if (!TYPEN.test(String(bd.marketType || ''))) continue;
    const satz = isFinite(+bd.marketBaseRate) && +bd.marketBaseRate >= 0 ? +bd.marketBaseRate / 100 : O.feeBf;
    vorrat.set(c.marketId, {
      ev: (c.event && c.event.name) || '',
      /* Der WETTBEWERB (Build 24): verraet eine Jugend-, Reserve- oder
       * Frauenliga auch dann, wenn die Mannschaftsnamen unauffaellig sind. */
      co: (c.competition && c.competition.name) || '',
      mt: bd.marketType || '',
      satz,
      start: c.marketStartTime || (c.event && c.event.openDate) || null,
      et,
      laeufer: (c.runners || []).map(r => ({ id: r.selectionId, name: r.runnerName })),
      gesehen: jetzt
    });
  }
  /* Genau am Deckel heißt: das Fenster war voll, es fehlen Märkte. */
  if (res.length >= 1000 && bisMs - vonMs > 2 * 60e3 && tiefe < 20) {
    const mitte = Math.floor((vonMs + bisMs) / 2);
    await katalog(et, vonMs, mitte, tiefe + 1);
    await katalog(et, mitte, bisMs, tiefe + 1);
  }
}

/* Alles Alte fliegt raus — hier hört das Wachsen auf. */
function aufraeumen() {
  const jetzt = Date.now();
  let weg = 0;
  for (const [, vorrat] of VORRAT) {
    for (const [mid, m] of vorrat) {
      const start = m.start ? Date.parse(m.start) : null;
      const zuAlt = start && jetzt - start > NACH_ANPFIFF_STD * 3600e3;
      const vergessen = jetzt - m.gesehen > VERFALL_MIN * 60e3;
      if (zuAlt || vergessen) { vorrat.delete(mid); KURSE.delete(mid); weg++; }
    }
  }
  return weg;
}

/* ---------- Kurse ---------- */
const KURSE = new Map();   // marketId -> {status, inplay, laeufer[], stand}

async function kurseHolen(ids) {
  let gelesen = 0;
  for (let i = 0; i < ids.length; i += PAKET) {
    let buecher;
    try {
      buecher = await rpc('listMarketBook', {
        marketIds: ids.slice(i, i + PAKET),
        priceProjection: { priceData: ['EX_BEST_OFFERS'], virtualise: false }
      });
    } catch (e) {
      if (/session|invalid|auth|expired/i.test(e.message)) throw e;
      continue;
    }
    for (const b of buecher || []) {
      KURSE.set(b.marketId, {
        status: b.status, inplay: !!b.inplay, stand: Date.now(),
        laeufer: (b.runners || []).map(r => {
          const back = (r.ex && r.ex.availableToBack && r.ex.availableToBack[0]) || null;
          const lay  = (r.ex && r.ex.availableToLay && r.ex.availableToLay[0]) || null;
          return {
            id: r.selectionId, st: r.status,
            b: back ? back.price : 0, bs: back ? back.size : 0,
            l: lay ? lay.price : 0,  ls: lay ? lay.size : 0
          };
        })
      });
      gelesen++;
    }
  }
  return gelesen;
}

/* Welche Märkte brauchen jetzt Kurse? Die dringlichsten zuerst:
 * laufende Partien, dann die mit dem nächsten Anpfiff. */
function dringlichste(anzahl) {
  /* GRUNDANTEIL JE SPORTART (Build 25) — der Fund vom 19.8.
   *
   * Vorher wurden schlicht die dringlichsten Maerkte ALLER Sportarten
   * genommen. Fussball und Tennis haben aber so viele Partien, dass sie
   * das ganze Kontingent auffressen: gemessen kamen nur noch Fussball
   * (399), Tennis (94) und Basketball (4) im Upload an — E-Sport, MMA,
   * Baseball, Eishockey, Cricket, Boxen und Motorsport bekamen NIE einen
   * Kurs und fielen damit aus dem Upload, obwohl sie im Vorrat lagen.
   * Ein stiller Fehlschlag: die Rotation lief, der Katalog fuellte sich,
   * angekommen ist nichts.
   *
   * Jetzt in ZWEI Durchgaengen:
   *   1. Jede Sportart mit Maerkten bekommt ihren GRUNDANTEIL (Standard
   *      24, in bridge-config.json als grundanteilJeSportart aenderbar) —
   *      ihre eigenen dringlichsten Maerkte, garantiert.
   *   2. Was vom Kontingent uebrig bleibt, wird global nach Dringlichkeit
   *      verteilt. Fussball behaelt damit den Loewenanteil, aber keine
   *      Sportart verhungert mehr. */
  const jeSport = new Map();
  for (const [et, vorrat] of VORRAT) {
    const liste = [];
    for (const [mid, m] of vorrat) {
      const start = m.start ? Date.parse(m.start) : Infinity;
      const k = KURSE.get(mid);
      liste.push({ mid, start, alter: k ? Date.now() - k.stand : Infinity });
    }
    liste.sort((a, b) => (a.start - b.start) || (b.alter - a.alter));
    if (liste.length) jeSport.set(et, liste);
  }

  const gewaehlt = new Set();
  for (const [, liste] of jeSport) {
    const n = Math.min(O.grundanteil, liste.length);
    for (let i = 0; i < n && gewaehlt.size < anzahl; i++) gewaehlt.add(liste[i].mid);
  }

  const rest = [];
  for (const [, liste] of jeSport) for (const x of liste) if (!gewaehlt.has(x.mid)) rest.push(x);
  rest.sort((a, b) => (a.start - b.start) || (b.alter - a.alter));
  for (const x of rest) { if (gewaehlt.size >= anzahl) break; gewaehlt.add(x.mid); }

  return Array.from(gewaehlt);
}

/* ---------- Hochladen — Format wie in 3.8, Feld für Feld ---------- */
function bauen() {
  const raus = [];
  for (const [, vorrat] of VORRAT) {
    for (const [mid, m] of vorrat) {
      const k = KURSE.get(mid);
      if (!k || k.status !== 'OPEN') continue;
      const n = (m.laeufer || []).length;
      if (n < 2 || n > 3) continue;
      const namen = {};
      m.laeufer.forEach(r => { namen[r.id] = r.name; });
      const rs = [];
      let ok = true;
      for (const r of k.laeufer) {
        if (r.st && r.st !== 'ACTIVE') { ok = false; break; }
        if (!(r.b > 1)) { ok = false; break; }
        rs.push({ n: namen[r.id] || String(r.id), b: r.b, bs: r.bs, l: r.l || 0, ls: r.ls || 0 });
      }
      if (!ok || rs.length !== n) continue;
      raus.push({
        k: rs.map(x => x.n).join(' vs '),
        r: rs,
        mt: m.mt || '',
        ev: m.ev || '',
        co: m.co || '',
        st: m.start || null,
        ip: k.inplay ? 1 : 0,
        sz: (typeof m.satz === 'number' && isFinite(m.satz)) ? m.satz : null,
        et: m.et != null ? String(m.et) : null,
        link: 'https://www.betfair.com/exchange/plus/market/' + mid
      });
    }
  }
  raus.sort((a, b) => {
    if (a.ip !== b.ip) return b.ip - a.ip;
    const ta = a.st ? Date.parse(a.st) : Infinity, tb = b.st ? Date.parse(b.st) : Infinity;
    if (ta !== tb) return ta - tb;
    return b.r.reduce((s, x) => s + x.bs, 0) - a.r.reduce((s, x) => s + x.bs, 0);
  });
  return raus.slice(0, O.uploadLimit);
}

async function hochladen(markets, stats) {
  const data = markets.filter(m => m.r.length === 2)
                      .map(m => ({ key: m.k, o1: m.r[0].b, o2: m.r[1].b, link: m.link }));
  const r = await fetch(CFG.bridgeUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-bridge-token': CFG.bridgeToken },
    body: JSON.stringify({ data, v: 2, markets, arbs: [], opps: [], stats })
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error('Upload fehlgeschlagen: ' + (j.error || r.status));
  return j;
}

/* ---------- Der Durchlauf ---------- */
let laeuft = false, runde = 0, fehlerInFolge = 0;

/* Rotationsplan, VERSCHRÄNKT (nach dem Trockenlauf vom 16.8. geändert):
 * ein glatter Plan hätte Fußball viermal hintereinander gebracht und die
 * anderen Sportarten minutenlang blind gelassen. Jetzt wechseln sich
 * die erste aktive Sportart (normal: Fußball) und je eine andere ab:
 *   Fußball, Tennis, Fußball, Basketball, Fußball, Baseball, …
 * Fußball ist damit in JEDER zweiten Runde dran (dort liegen die meisten
 * Partien). Seit Build 21 zählt dabei nur, was in "sportarten" aktiv ist,
 * und "anteil" wiederholt eine Sportart entsprechend oft je Zyklus. */
const PLAN = [];
(function planBauen() {
  const erst = AKTIV[0];
  const rest = AKTIV.slice(1);
  if (rest.length === 0) { PLAN.push(erst); return; }
  for (const s of rest) {
    for (let i = 0; i < s.anteil; i++) { PLAN.push(erst); PLAN.push(s); }
  }
})();

async function durchlauf() {
  if (laeuft) return;
  laeuft = true;
  const t0 = Date.now();
  try {
    if (!sitzung) await anmelden();
    else if (Date.now() - letzteAnmeldung > 15 * 60e3) await wachhalten();

    /* Betfairs Sportkarte einmal holen; klappt es nicht, nächste Runde
     * wieder — bis dahin bleibt et_namen weg (Prüfung pausiert, LAUT
     * gemeldet wird der Fehlversuch trotzdem). */
    if (!ET_NAMEN) {
      try { await sportkarteHolen(); }
      catch (e) { log('Sportkarte nicht geholt: ' + (e.message || e)); }
    }

    /* EINE Sportart je Runde — getrennt, nicht alles auf einmal.
     * Das Fenster ist seit Build 21 je Sportart einstellbar. */
    const dran = PLAN[runde % PLAN.length];
    runde++;
    const von = Date.now(), bis = von + dran.fenster * 3600e3;
    await katalog(dran.et, von, bis, 0);

    const weg = aufraeumen();
    const ids = dringlichste(O.kurseProDurchlauf);
    const gelesen = await kurseHolen(ids);

    const markets = bauen();
    let vorratGesamt = 0;
    for (const [, v] of VORRAT) vorratGesamt += v.size;

    const stats = {
      bridge: VERSION, build: BUILD, sportart: dran.name,
      maerkte: markets.length, vorrat: vorratGesamt, gelesen, verfallen: weg,
      dauer_ms: Date.now() - t0,
      /* Eigener Speicherverbrauch, damit „wächst nicht" MESSBAR bleibt
       * (die 3.8 wurde still immer größer — das soll nie wieder unsichtbar
       * passieren). Soll dauerhaft um ~70-90 MB pendeln. */
      speicher_mb: Math.round(process.memoryUsage().rss / 1048576)
    };
    /* Nur Betfairs ECHTE Namen hochladen — unsere deutschen Anzeigenamen
     * haben hier nichts verloren (Dauer-Fehlalarm, siehe Sportkarte). */
    if (ET_NAMEN) stats.et_namen = ET_NAMEN;
    await hochladen(markets, stats);
    fehlerInFolge = 0;

    log(dran.name.padEnd(17) + 'Vorrat ' + String(vorratGesamt).padStart(4) +
        ' · Kurse ' + String(gelesen).padStart(3) +
        ' · hochgeladen ' + String(markets.length).padStart(4) +
        ' · verfallen ' + String(weg).padStart(3) +
        ' · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  } catch (e) {
    fehlerInFolge++;
    const t = String(e.message || e);
    log('FEHLER: ' + t);
    if (/session|invalid|auth|expired|Anmeldung/i.test(t)) sitzung = null;
    /* Nach mehreren Fehlern hintereinander eine Pause — sonst rennt die
     * Bridge in eine Sperre. */
    if (fehlerInFolge >= 3) {
      log('Drei Fehler hintereinander — zwei Minuten Pause.');
      await schlaf(120e3);
      fehlerInFolge = 0;
    }
  } finally {
    laeuft = false;
  }
}

/* ---------- STANDBY-PRUEFUNG (Build 25) ----------
 *
 * des Auftraggebers Wunsch: die Bridge soll auch laufen, wenn der Deckel zu ist.
 * EHRLICH: ein Node-Programm kann den Ruhezustand nicht selbst
 * verhindern — das ist eine Windows-Einstellung und braucht Adminrechte.
 * Was die Bridge SEHR WOHL kann: beim Start nachsehen und LAUT sagen,
 * wenn der Rechner einschlafen wuerde. Ein stiller Fehlschlag waere hier
 * besonders teuer: die Bridge stuende still und niemand wuesste warum.
 *
 * Geprueft wird der Standby-Zeitgeber fuer Netz- UND Akkubetrieb.
 * 0 heisst nie — nur dann ist Dauerbetrieb sicher. */
function standbyPruefen() {
  try {
    const cp = require('child_process');
    const aus = cp.execSync('powercfg /q SCHEME_CURRENT SUB_SLEEP STANDBYIDLE',
                            { encoding: 'utf8', timeout: 8000, windowsHide: true });
    const netz = /Wechselstromeinstellung|AC Power Setting.*?: *0x([0-9a-f]+)/i.exec(aus);
    const werte = [...aus.matchAll(/: *0x([0-9a-f]+)/gi)].map(m => parseInt(m[1], 16));
    const standby = werte.filter(w => !isNaN(w));
    /* Die beiden letzten Werte sind Wechselstrom (Netz) und Gleichstrom (Akku). */
    const netzWert = standby.length >= 2 ? standby[standby.length - 2] : null;
    const akkuWert = standby.length >= 1 ? standby[standby.length - 1] : null;
    if (netzWert === 0 && akkuWert === 0) {
      console.log('  Standby: AUS (Netz und Akku) — Dauerbetrieb ist sicher.');
      return { netz: 0, akku: 0, sicher: true };
    }
    console.log('');
    console.log('  ACHTUNG: Der Rechner kann einschlafen — dann steht die Bridge!');
    if (netzWert) console.log('    am Netz nach ' + Math.round(netzWert / 60) + ' Minuten');
    if (akkuWert) console.log('    im Akku nach ' + Math.round(akkuWert / 60) + ' Minuten');
    console.log('  So abschalten (Eingabeaufforderung als Administrator):');
    console.log('    powercfg /change standby-timeout-ac 0');
    console.log('    powercfg /change standby-timeout-dc 0');
    console.log('');
    return { netz: netzWert, akku: akkuWert, sicher: false };
  } catch (e) {
    console.log('  Standby-Pruefung nicht moeglich (' + (e.message || e) + ') — bitte selbst nachsehen.');
    return null;
  }
}
const STANDBY = standbyPruefen();

/* ---------- Start ---------- */
console.log('');
console.log('  ORION BRIDGE ' + VERSION + '  (Build ' + BUILD + ')');
console.log('  ------------------------------------------------------------');
console.log('  Holt NUR Betfair-Kurse und lädt sie zum Panel hoch.');
console.log('  Gerechnet wird auf dem Server — hier läuft keine Arbitrage.');
console.log('  Sportarten: ' + AKTIV.length + ' von ' + SPORT.length + ' aktiv, eine je Durchlauf (' +
            AKTIV[0].name + ' öfter).');
console.log('  Takt: alle ' + O.taktSekunden + ' s · Fenster: ' + O.fensterStunden + ' h');
/* Steht ein "sportarten"-Feld in der Zugangsdatei, wird die wirksame
 * Einstellung beim Start VOLLSTÄNDIG gezeigt — gegen stille Drift. */
if (CFG.sportarten) {
  for (const s of AKTIV) {
    console.log('    ' + s.name.padEnd(18) + ' Fenster ' + String(s.fenster).padStart(3) +
                ' h · Anteil ' + s.anteil);
  }
  const aus = SPORT.filter(s => !AKTIV.some(a => a.et === s.et)).map(s => s.name);
  if (aus.length) console.log('    ABGESCHALTET: ' + aus.join(', '));
}
console.log('  Fenster schließen beendet die Bridge. Strg+C ebenso.');
console.log('');

durchlauf();
setInterval(durchlauf, O.taktSekunden * 1000);
