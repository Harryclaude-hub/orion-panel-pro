// orion-lauf — der Scanner. pg_cron, EIN AUFRUF JE BEREICH, serverseitig.
//
// SEIT DEM 11.8.2026 ABENDS GIBT ES KEIN "ALLE BEREICHE" MEHR.
// Jeder Aufruf traegt einen Bereich ({"bereich":"fussball"}); gescannt,
// gepaart und aufgeraeumt wird AUSSCHLIESSLICH innerhalb dieses Bereichs.
// Der Takt je Bereich steht im Register orion_bereiche (takt_sek), die
// pg_cron-Jobs heissen orion-lauf-<bereich>.
//
// WARUM: Eine Sammelsuche ist genau die Lage, in der Fussball neben League
// of Legends steht und verwechselt wird — am 11.8. stand eine Fehlpaarung
// mit 5,34 % live (FSV Frankfurt vs. Eintracht Frankfurt, Fussball, gegen
// ROSSMANN Centaurs vs. Eintracht Frankfurt, LoL; die Namen sind wirklich
// gleich, nur der Sport nicht). Nebenbei loest die Trennung den
// HTTP-546-Speicherfehler (WORKER_RESOURCE_LIMIT): kein Lauf laedt mehr
// alle Buecher aller Bereiche gleichzeitig.
//
// ZWEI DURCHGAENGE (nur innerhalb des Bereichs):
//   1. ANKER POLYMARKET — fuer jeden Polymarket-Markt ein Gegenstueck bei
//      Smarkets, Kalshi und Betfair. Zwei Belege: Partie und Laeufer.
//   2. OHNE ANKER — Smarkets direkt gegen Kalshi, NUR im Bereich fussball
//      (Smarkets fuehrt ausschliesslich Fussball, gemessen: der Sammler
//      holt type=football_match). Ersatz fuer den fehlenden zweiten Beleg
//      ist die EINDEUTIGKEIT in Z.direktPaare.
//
// PROBELAUF: mit {"bereich":"golf","probe":true} rechnet der Lauf alles,
// schreibt aber NICHTS und liefert jede Zuordnung einzeln zurueck — der
// Trockenlauf gegen echte Daten, den jede Bereichs-Freischaltung braucht.

import * as R from './rechnung.ts';
import * as Z from './zuordnung.ts';

const FENSTER_H = 72;
const SCHWELLE = 0.5;
const LAEUFER_SCHWELLE = 0.8;
const BROKER = 'https://www.orbitexch.com/customer/sport/1/market/{id}';
const RAUSCH_GRENZE = -1.0;

// BETFAIR AKTIV seit 11.8.2026 ueber die Bridge auf einem eigenen Laptop.
// Einschraenkungen: App-Key DELAYED (Kurse ~1 min alt), Konto fuer
// API-Wetten SUSPENDED (Lesen geht).
//
// BEREICHSSPERRE AUCH HIER: orion_bf_maerkte(fenster_h, bereich_p) liefert
// nur Maerkte, deren eventTypeId (Bridge-Feld et, ab Build 19) laut
// orion_bf_sport zum Bereich gehoert. Eine Bridge VOR Build 19 schickt kein
// et — dann kommt hier NICHTS an, und das ist Absicht: unbekannter Bereich
// heisst nicht "passt schon". Dieselbe Regel wie bei Kalshi.
const BETFAIR_AKTIV = true;

const URL_SUPA = Deno.env.get('SUPABASE_URL')!;
const DIENST = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const KUERZEL: Record<string, string> = {
  polymarket: 'pm', betfair: 'bf', kalshi: 'ka', smarkets: 'sm'
};

function dbKopf() {
  return { apikey: DIENST, authorization: 'Bearer ' + DIENST, 'content-type': 'application/json' };
}

async function wiederholt(url: string, init?: RequestInit, versuche = 3): Promise<Response | null> {
  for (let i = 0; i < versuche; i++) {
    try {
      const r = await fetch(url, init);
      if (r.status === 422 || r.ok) return r;
      if (r.status >= 500 && i < versuche - 1) { await new Promise(s => setTimeout(s, 250 * (i + 1))); continue; }
      return r;
    } catch {
      if (i < versuche - 1) await new Promise(s => setTimeout(s, 250 * (i + 1)));
    }
  }
  return null;
}

function tokenVon(m: any): string[] {
  try {
    const t = typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : (m.clobTokenIds || []);
    return Array.isArray(t) ? t.map(String) : [];
  } catch { return []; }
}
function handelbar(m: any) {
  return m.closed === false && m.active === true && m.enableOrderBook === true &&
         m.acceptingOrders !== false && tokenVon(m).length >= 2;
}
function brokerLink(bfLink: string) {
  const m = String(bfLink || '').match(/market\/([\d.]+)/);
  return m ? BROKER.replace('{id}', m[1]) : (bfLink || '');
}
function kalshiLink(k: any) {
  const ev = String(k.ev || '').toLowerCase();
  const serie = String(k.serie || '').toLowerCase();
  return ev ? `https://kalshi.com/markets/${serie}/${ev}` : `https://kalshi.com/markets/${serie}`;
}
function zahlOderNull(x: unknown): number | null {
  const n = Number(x);
  return isFinite(n) ? n : null;
}

interface Seite {
  buch: string; richtung: 'ja' | 'nein'; qe: number; geld: number | null; roh: number;
  gebuehr: number; gebuehr_echt: boolean; name: string; seite_text: string;
  link: string; partie: string;
  gebuehr_form: R.GebuehrForm;
}

Deno.serve(async (req) => {
  const kopf = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };
  const t0 = Date.now();
  const jetzt = Date.now();
  const grenze = jetzt + FENSTER_H * 3600000;

  /* ---------- Welcher Bereich? Ohne Bereich laeuft hier nichts. ---------- */
  const url = new URL(req.url);
  let body: any = null;
  try { body = await req.json(); } catch { /* leerer oder kein JSON-Koerper */ }
  const bereich = String((body && body.bereich) || url.searchParams.get('bereich') || '').trim();
  const probe = (body && body.probe === true) || url.searchParams.get('probe') === '1';

  if (!/^[a-z0-9_-]+$/.test(bereich)) {
    return new Response(JSON.stringify({
      ok: false,
      fehler: 'bereich fehlt oder ist ungueltig. Es gibt kein "alle Bereiche" — ' +
              'jeder Aufruf gilt GENAU EINEM Bereich aus orion_bereiche, z.B. {"bereich":"fussball"}.'
    }), { status: 400, headers: kopf });
  }

  try {
    const regR = await fetch(`${URL_SUPA}/rest/v1/orion_bereiche?bereich=eq.${bereich}&select=*`, { headers: dbKopf() });
    const regZ = regR.ok ? await regR.json() : [];
    const reg = regZ[0];
    if (!reg) {
      return new Response(JSON.stringify({ ok: false, fehler: `Bereich "${bereich}" steht nicht im Register orion_bereiche.` }),
                          { status: 400, headers: kopf });
    }
    if (!reg.aktiv && !probe) {
      /* Inaktiv heisst: bewusst noch nicht freigeschaltet (kein Trockenlauf
       * bestanden). Kein Fehler — aber auch kein Lauf. Der Probelauf bleibt
       * erlaubt, denn genau er ist der Weg zur Freischaltung. */
      return new Response(JSON.stringify({ ok: true, bereich, uebersprungen: 'Bereich ist im Register inaktiv.' }), { headers: kopf });
    }
    const TAGS: string[] = Array.isArray(reg.pm_tags) ? reg.pm_tags : [];

    /* Die Karte in zuordnung.ts muss zum Register passen. Widerspricht sie,
     * wird bei Kalshi NICHT gepaart (Widerspruchsregel: zwei Wege, zwei
     * Antworten -> gar nicht handeln), und der Lauf sagt es laut. */
    const karteOk = TAGS.every(t => Z.bereichPm(t) === bereich);

    // ---------- Polymarket: NUR die Tags dieses Bereichs ----------
    const nachId = new Map<string, any>();
    const jeArt: Record<string, number> = {};
    for (const tag of TAGS) {
      for (let off = 0; off < 3000; off += 100) {
        const r = await wiederholt(`https://gamma-api.polymarket.com/events?closed=false&active=true&limit=100&offset=${off}&tag_slug=${tag}`,
                                   { headers: { accept: 'application/json' } });
        if (!r || r.status === 422 || !r.ok) break;
        const daten = await r.json();
        if (!Array.isArray(daten) || daten.length === 0) break;
        for (const ev of daten) {
          for (const m of (ev.markets || [])) {
            if (!handelbar(m)) continue;
            const art = Z.marktArt(m.question, m.groupItemTitle);
            if (!art) continue;
            const ende = Date.parse(m.endDate || m.endDateIso || '');
            if (isNaN(ende) || ende <= jetzt || ende > grenze) continue;
            const id = String(m.id);
            if (nachId.has(id)) continue;
            jeArt[art] = (jeArt[art] || 0) + 1;
            nachId.set(id, {
              id, art, frage: m.question, teil: m.groupItemTitle || null,
              titel: ev.title, tag, ende: new Date(ende).toISOString(),
              evSlug: ev.slug, mSlug: m.slug, tokens: tokenVon(m),
              satz: m.feeSchedule ? m.feeSchedule.rate : null,
              expo: m.feeSchedule ? m.feeSchedule.exponent : 1
            });
          }
        }
        if (daten.length < 100) break;
      }
    }
    const maerkte = [...nachId.values()];
    nachId.clear();

    // ---------- Orderbuecher, mit MENGEN ----------
    const alleTokens: string[] = [];
    for (const m of maerkte) for (const t of m.tokens) alleTokens.push(t);
    const preise = new Map<string, { p: number; menge: number }>();
    for (let i = 0; i < alleTokens.length; i += 250) {
      const r = await wiederholt('https://clob.polymarket.com/books', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(alleTokens.slice(i, i + 250).map(t => ({ token_id: t })))
      });
      if (!r || !r.ok) continue;
      const buecher = await r.json();
      if (!Array.isArray(buecher)) continue;
      for (const b of buecher) {
        const id = String(b.asset_id || b.market || '');
        if (!Array.isArray(b.asks) || !b.asks.length) continue;
        let min = Infinity, menge = 0;
        for (const a of b.asks) {
          const p = parseFloat(a.price);
          if (p > 0 && p < min) { min = p; menge = parseFloat(a.size) || 0; }
        }
        if (min < Infinity) preise.set(id, { p: min, menge });
      }
    }

    // ---------- Betfair: nur Maerkte DIESES Bereichs ----------
    let bfImFenster: Z.BfMarkt[] = [];
    let bfAlterS: number | null = null;
    if (BETFAIR_AKTIV) {
      const bfR = await fetch(`${URL_SUPA}/rest/v1/rpc/orion_bf_maerkte`, {
        method: 'POST', headers: dbKopf(), body: JSON.stringify({ fenster_h: 12, bereich_p: bereich })
      });
      bfImFenster = bfR.ok ? (await bfR.json() || []) : [];
      /* Gurt UND Hosentraeger: die RPC filtert schon nach Bereich, hier
       * wird es trotzdem nachgeprueft. Eine kuenftige Aenderung an der RPC
       * darf nicht still Maerkte fremder Bereiche hereinlassen. */
      bfImFenster = bfImFenster.filter(m => (m as any).bereich === bereich);
      const zeitR = await fetch(`${URL_SUPA}/rest/v1/bridge_odds?id=eq.1&select=updated_at`, { headers: dbKopf() });
      const zeitZ = zeitR.ok ? await zeitR.json() : [];
      bfAlterS = zeitZ[0]?.updated_at ? Math.round((jetzt - Date.parse(zeitZ[0].updated_at)) / 1000) : null;
    }
    const bfSieger = bfImFenster.filter(m => m.mt === 'MATCH_ODDS');
    const bfOu = bfImFenster.filter(m => Z.bfOuLinie(m.mt) !== null);

    // ---------- Kalshi: nur Serien DIESES Bereichs ----------
    const kaAntwort = await fetch(`${URL_SUPA}/rest/v1/kalshi_snapshot?id=eq.1&select=maerkte,updated_at`, { headers: dbKopf() });
    const kaZeilen = kaAntwort.ok ? await kaAntwort.json() : [];
    const kaZeile = kaZeilen[0] || { maerkte: [], updated_at: null };
    const kaAlterS = kaZeile.updated_at ? Math.round((jetzt - Date.parse(kaZeile.updated_at)) / 1000) : null;
    let kaAnderesFach = 0;
    const kalshi = (kaZeile.maerkte || []).filter((k: any) => {
      /* Der Bereich kommt aus dem Serien-Ticker. Was nicht zu DIESEM
       * Bereich gehoert — oder gar keinem zuzuordnen ist — fliegt VOR der
       * Paarung raus. Unbekannt heisst nicht "passt schon". */
      if (Z.bereichKalshi(k.serie) !== bereich) { kaAnderesFach++; return false; }
      const t = Date.parse(k.schliesst || '');
      return !isNaN(t) && t > jetzt && t <= grenze;
    });
    const kIndex = Z.kalshiIndex(kalshi);

    // ---------- Smarkets: fuehrt AUSSCHLIESSLICH Fussball ----------
    /* Gemessen: der Sammler holt type=football_match (896 Maerkte). In jedem
     * anderen Bereich wird der Schnappschuss GAR NICHT ERST GELADEN — das
     * spart Speicher (546!) und schliesst die Verwechslung strukturell aus. */
    let smAlle: any[] = [];
    let smAlterS: number | null = null;
    if (bereich === 'fussball') {
      const smAntwort = await fetch(`${URL_SUPA}/rest/v1/smarkets_snapshot?id=eq.1&select=maerkte,updated_at`, { headers: dbKopf() });
      const smZeilen = smAntwort.ok ? await smAntwort.json() : [];
      const smZeile = smZeilen[0] || { maerkte: [], updated_at: null };
      smAlterS = smZeile.updated_at ? Math.round((jetzt - Date.parse(smZeile.updated_at)) / 1000) : null;
      smAlle = smZeile.maerkte || [];
    }
    const smNachArt: Record<string, any[]> = {};
    for (const m of smAlle) (smNachArt[m.art] = smNachArt[m.art] || []).push(m);
    const smSieger = smNachArt['sieger'] || [];
    const smHalbzeit = smNachArt['halbzeit'] || [];
    const smBtts = smNachArt['btts'] || [];

    const zeilen: any[] = [];
    const jePaarung: Record<string, number> = {};
    let mitMenge = 0;
    let bereichVerworfen = 0;
    const smGesehen = new Set<string>();

    function schreibe(a: Seite, b: Seite, e: any, opt: {
      schluessel: string; marktId: string; titel: string; frage: string;
      bez: string; art: string; sport: string; ende: string; zuordnung: number;
    }) {
      const paarung = KUERZEL[a.buch] + '>' + KUERZEL[b.buch];
      jePaarung[paarung] = (jePaarung[paarung] || 0) + 1;
      if (e.maxEinsatz !== null && e.maxEinsatz !== undefined) mitMenge++;

      const gA = R.gebuehrBetrag(a.gebuehr_form, e.s1, a.roh, a.qe);
      const gB = R.gebuehrBetrag(b.gebuehr_form, e.s2, b.roh, b.qe);
      const gSumme = (gA === null || gB === null) ? null : gA + gB;

      zeilen.push({
        schluessel: opt.schluessel,
        buch_1: a.buch, buch: b.buch,
        markt_id: opt.marktId, titel: opt.titel, frage: opt.frage,
        mannschaft: opt.bez, art: opt.art, sportart: opt.sport, weg: paarung,
        /* Der Bereich des Laufs. Jede Zeile gehoert GENAU EINEM Bereich —
         * die Aufraeumung unten arbeitet nur innerhalb dieses Bereichs. */
        bereich,
        pm_seite: a.seite_text, pm_preis: a.roh, pm_link: a.link,
        bf_name: b.name, bf_seite: b.seite_text, bf_quote: b.roh,
        bf_link: b.link, bf_partie: b.partie,
        zuordnung: opt.zuordnung, rendite: e.rendite, inv: e.inv,
        einsatz_1: e.s1, einsatz_2: e.s2, auszahlung: e.auszahlung,
        pm_gebuehr: a.gebuehr, bf_gebuehr: b.gebuehr,
        pm_gebuehr_echt: a.gebuehr_echt, bf_gebuehr_echt: b.gebuehr_echt,
        pm_gebuehr_betrag: gA, bf_gebuehr_betrag: gB, gebuehr_gesamt: gSumme,
        pm_menge: a.geld, gegen_menge: b.geld,
        max_einsatz: e.maxEinsatz === undefined ? null : e.maxEinsatz,
        max_gewinn: e.maxGewinn === undefined ? null : e.maxGewinn,
        endet_am: opt.ende, zuletzt_gesehen: new Date().toISOString(), status: 'live'
      });
    }

    // ================= DURCHGANG 1: Anker Polymarket =================
    for (const m of maerkte) {
      const p = Z.paar(m.titel);
      if (!p) continue;
      const buch = m.tokens.map((t: string) => preise.get(t));
      if (buch.some((x: any) => x === undefined)) continue;
      const ask = buch.map((x: any) => x.p);
      const mengen = buch.map((x: any) => x.menge);

      const istHzSieger = m.art === 'hz_sieger' || m.art === 'hz_unentschieden';
      const ou = Z.ouArt(m.teil);
      const istOu = ou !== null && ou.art === m.art;

      const bez = m.art === 'unentschieden'     ? 'Unentschieden'
                : m.art === 'btts'              ? 'Beide Mannschaften treffen'
                : m.art === 'hz_unentschieden'  ? 'Unentschieden zur Halbzeit'
                : m.art === 'hz_sieger'         ? (m.teil + ' führt zur Halbzeit')
                : m.art === 'ueber_unter'       ? ('Über/Unter ' + (ou ? ou.linie : '?'))
                : m.art === 'hz1_ueber_unter'   ? ('1. Halbzeit Über/Unter ' + (ou ? ou.linie : '?'))
                : m.art === 'hz2_ueber_unter'   ? ('2. Halbzeit Über/Unter ' + (ou ? ou.linie : '?'))
                : m.art === 'ecken_ueber_unter' ? ('Ecken Über/Unter ' + (ou ? ou.linie : '?'))
                : m.teil;
      const seiten: Seite[] = [];

      const pmLink = `https://polymarket.com/event/${m.evSlug}/${m.mSlug}`;
      /* Satz: was der Markt selbst meldet, sonst der belegte Satz der
       * Marktart (Sport 5 %, Krypto 7 %, Politik/Technik 4 %). Bis zum
       * 11.8. fiel ein Markt ohne feeSchedule auf 7 % zurueck — im Sport
       * also 40 % zu hoch. Beides ist jetzt gemessen, nicht geraten. */
      const pmSatz = (m.satz !== null && m.satz !== undefined) ? m.satz : R.pmSatzFuer(bereich);
      const pmEcht = true;
      const qeJa = R.qePm(ask[0], pmSatz);
      const qeNein = R.qePm(ask[1], pmSatz);
      if (qeJa !== null) seiten.push({
        buch: 'polymarket', richtung: 'ja', qe: qeJa, geld: mengen[0] * ask[0], roh: ask[0],
        gebuehr: R.gebuehrSicher(pmSatz), gebuehr_echt: pmEcht, gebuehr_form: 'anteil',
        name: bez, seite_text: istOu ? 'ÜBER' : 'JA', link: pmLink, partie: m.titel
      });
      if (qeNein !== null) seiten.push({
        buch: 'polymarket', richtung: 'nein', qe: qeNein, geld: mengen[1] * ask[1], roh: ask[1],
        gebuehr: R.gebuehrSicher(pmSatz), gebuehr_echt: pmEcht, gebuehr_form: 'anteil',
        name: bez, seite_text: istOu ? 'UNTER' : 'NEIN', link: pmLink, partie: m.titel
      });

      // ----- Betfair (kommt bereits bereichsgefiltert aus der RPC) -----
      const bfKand = m.art === 'ueber_unter' ? Z.ouKandidaten(bfOu, ou ? ou.linie : null)
                   : (m.art === 'sieger' || m.art === 'unentschieden') ? bfSieger
                   : [];
      if (bfKand.length) {
        const tr = Z.besterTreffer(p[0], p[1], bfKand, SCHWELLE);
        if (tr) {
          const lauf = m.art === 'unentschieden' ? Z.drawLaeufer(tr.bf.r)
                     : m.art === 'ueber_unter'  ? Z.ouLaeufer(tr.bf.r)
                     : Z.laeuferZu(m.teil, tr.bf.r, LAEUFER_SCHWELLE);
          if (lauf) {
            /* GESETZT WIRD BEI ORBIT, nicht bei Betfair: betfair.com ist aus
             * Oesterreich gesperrt, brokerLink() schreibt jeden Link auf Orbit
             * um. Also gilt Orbits Satz - pauschal 3 % auf den Nettogewinn je
             * Markt, belegt aus deren Doku, keine Premium-Gebuehr, 0 % auf
             * Verluste. Betfairs eigener marketBaseRate (bfEigen) gilt nur fuer
             * ein direktes Betfair-Konto und wird nur mitgefuehrt. Bis zum 11.8.
             * rechnete diese Seite mit 7 % Rueckfall, also mehr als dem
             * Doppelten des echten Satzes. */
            const bfEigen = Z.bfSatzVon(tr.bf);
            const satz = R.ORBIT_SATZ;
            const link = brokerLink(tr.bf.link);
            const partie = tr.bf.ev || tr.bf.k;
            const qb = R.qeBack(lauf.laeufer.b, satz);
            const ql = R.qeLay(lauf.laeufer.l, satz);
            if (qb !== null) seiten.push({
              buch: 'betfair', richtung: 'ja', qe: qb, geld: zahlOderNull(lauf.laeufer.bs),
              roh: lauf.laeufer.b, gebuehr: R.gebuehrSicher(satz), gebuehr_echt: true,
              gebuehr_form: 'back',
              name: lauf.laeufer.n, seite_text: 'Back', link, partie
            });
            if (ql !== null) {
              const ls = zahlOderNull(lauf.laeufer.ls);
              seiten.push({
                buch: 'betfair', richtung: 'nein', qe: ql,
                geld: ls === null ? null : ls * (lauf.laeufer.l - 1),
                roh: lauf.laeufer.l, gebuehr: R.gebuehrSicher(satz), gebuehr_echt: true,
                gebuehr_form: 'lay',
                name: lauf.laeufer.n, seite_text: 'Lay', link, partie
              });
            }
          }
        }
      }

      // ----- Smarkets (nur im Bereich fussball ueberhaupt geladen) -----
      const smKand = istHzSieger ? smHalbzeit
                   : m.art === 'btts' ? smBtts
                   : istOu ? Z.smOuKandidaten(smNachArt[m.art] || [], ou!.linie)
                   : smSieger;
      if (smKand.length) {
        const tr = Z.besterTreffer(p[0], p[1], smKand as any, SCHWELLE);
        if (tr) {
          const lauf = Z.smLaeufer(m.art, m.teil, p, (tr.bf as any).r, tr.getauscht, LAEUFER_SCHWELLE);
          if (lauf) {
            if (m.art === 'sieger' || m.art === 'unentschieden') smGesehen.add(tr.bf.ev);
            const satz = (tr.bf as any).sz;
            const echt = (tr.bf as any).sz_echt === true;
            const link = (tr.bf as any).link;
            const partie = tr.bf.ev;
            const qb = R.qeBack(lauf.laeufer.b, satz);
            const ql = R.qeLay(lauf.laeufer.l, satz);
            if (qb !== null) seiten.push({
              buch: 'smarkets', richtung: 'ja', qe: qb, geld: zahlOderNull(lauf.laeufer.bs),
              roh: lauf.laeufer.b, gebuehr: R.gebuehrSicher(satz), gebuehr_echt: echt,
              gebuehr_form: 'back',
              name: lauf.laeufer.n, seite_text: 'Back', link, partie
            });
            if (ql !== null) {
              const ls = zahlOderNull(lauf.laeufer.ls);
              seiten.push({
                buch: 'smarkets', richtung: 'nein', qe: ql,
                geld: ls === null ? null : ls * (lauf.laeufer.l - 1),
                roh: lauf.laeufer.l, gebuehr: R.gebuehrSicher(satz), gebuehr_echt: echt,
                gebuehr_form: 'lay',
                name: lauf.laeufer.n, seite_text: 'Lay', link, partie
              });
            }
          }
        }
      }

      // ----- Kalshi: nur Sieger und Unentschieden -----
      if (m.art === 'sieger' || m.art === 'unentschieden') {
        const pmSeite: Z.Seite = m.art === 'unentschieden' ? 'unentschieden' : Z.seiteVon(m.teil, p);
        if (pmSeite && karteOk) {
          const A = Z.woerter(p[0]), B = Z.woerter(p[1]);
          for (const e of Z.kalshiKandidaten(kIndex, A, B)) {
            /* BEREICH gegen BEREICH, dreifach: die Kalshi-Liste ist oben
             * schon auf diesen Bereich gefiltert, der PM-Markt kommt
             * strukturell aus den Tags dieses Bereichs (und die Karte
             * bestaetigt es — karteOk), und hier steht die Pruefung noch
             * einmal ausdruecklich. Der Fall vom 11.8. (Fussball gegen LoL,
             * 5,34 % live) darf keinen einzigen Weg zurueck haben. */
            if (!Z.gleicherBereich(bereich, Z.bereichKalshi(e.k.serie))) { bereichVerworfen++; continue; }
            const gerade = Math.min(Z.aehnlichkeitW(A, e.kw0), Z.aehnlichkeitW(B, e.kw1));
            const kreuz  = Math.min(Z.aehnlichkeitW(A, e.kw1), Z.aehnlichkeitW(B, e.kw0));
            const score = Math.max(gerade, kreuz);
            if (score < SCHWELLE) continue;
            if (!Z.gleicheSeite(pmSeite, e.kSeite, kreuz > gerade)) continue;

            const k = e.k;
            const link = kalshiLink(k);
            /* Serien-Multiplikator aus Kalshis Gebuehrenordnung (PDF vom
             * 7.7.2026): neun Serien tragen 0 und sind GEBUEHRENFREI. */
            const kSatz = R.kalshiSatzFuer(k.serie);
            const qJa = R.qeKalshi(k.ja, kSatz);
            const qNein = R.qeKalshi(k.nein, kSatz);
            const kMenge = zahlOderNull(k.jaMenge);
            if (qJa !== null) seiten.push({
              buch: 'kalshi', richtung: 'ja', qe: qJa,
              geld: kMenge === null ? null : kMenge * k.ja, roh: k.ja,
              gebuehr: kSatz, gebuehr_echt: true, gebuehr_form: 'kontrakt',
              name: k.jaName, seite_text: 'Ja', link, partie: k.titel
            });
            if (qNein !== null) seiten.push({
              buch: 'kalshi', richtung: 'nein', qe: qNein,
              geld: kMenge === null ? null : kMenge * k.nein, roh: k.nein,
              gebuehr: kSatz, gebuehr_echt: true, gebuehr_form: 'kontrakt',
              name: k.jaName, seite_text: 'Nein', link, partie: k.titel
            });
            break;
          }
        }
      }

      for (const treffer of R.alleChancen(seiten, RAUSCH_GRENZE)) {
        const a = treffer.ja as Seite, b = treffer.nein as Seite, e = treffer.ergebnis;
        schreibe(a, b, e, {
          schluessel: KUERZEL[a.buch] + '>' + KUERZEL[b.buch] + ':' + m.id,
          marktId: m.id, titel: m.titel, frage: m.frage, bez, art: m.art, sport: m.tag,
          ende: m.ende, zuordnung: 1
        });
      }
    }

    // ========= DURCHGANG 2: Smarkets gegen Kalshi, NUR fussball =========
    const smNachPartie = new Map<string, any>();
    for (const m of smSieger) if (!smNachPartie.has(m.ev)) smNachPartie.set(m.ev, m);
    const offen: any[] = [];
    for (const [ev, m] of smNachPartie) {
      if (smGesehen.has(ev)) continue;
      const pp = Z.paar(ev);
      if (!pp) continue;
      const t = Date.parse(m.st || '');
      offen.push({ id: ev, partie: pp, zeit: isFinite(t) ? t : null, markt: m });
    }
    const kaNachPartie = new Map<string, any>();
    if (bereich === 'fussball') {
      /* Die Kalshi-Liste ist oben bereits auf fussball gefiltert — hier
       * wird nur noch nach Partien gebuendelt. */
      for (const k of kalshi) {
        const pp = Z.kalshiPaar(k.titel);
        if (!pp) continue;
        const z = Z.kalshiZeit(k.ev);
        if (!kaNachPartie.has(k.ev)) {
          kaNachPartie.set(k.ev, { id: k.ev, partie: pp, zeit: z ? z.zeit : null, titel: k.titel, ausgaenge: [] });
        }
        kaNachPartie.get(k.ev).ausgaenge.push(k);
      }
    }
    const direkt = Z.direktPaare(offen, [...kaNachPartie.values()], SCHWELLE);

    for (const pr of direkt.paare) {
      const smM = pr.a.markt, kaE = pr.b;
      for (const k of kaE.ausgaenge) {
        const kSeite = Z.seiteVon(k.jaName, kaE.partie);
        if (!kSeite) continue;
        const seite = kSeite === 'unentschieden' ? 'DRAW'
                    : ((pr.getauscht ? (kSeite === 'a' ? 'b' : 'a') : kSeite) === 'a' ? 'HOME' : 'AWAY');
        const v = (smM.r || []).find((x: any) => x.typ === seite);
        if (!v) continue;

        const seiten: Seite[] = [];
        const kLink = kalshiLink(k);
        const kSatz = R.kalshiSatzFuer(k.serie);
        const qJa = R.qeKalshi(k.ja, kSatz), qNein = R.qeKalshi(k.nein, kSatz);
        const kMenge = zahlOderNull(k.jaMenge);
        if (qJa !== null) seiten.push({
          buch: 'kalshi', richtung: 'ja', qe: qJa, geld: kMenge === null ? null : kMenge * k.ja,
          roh: k.ja, gebuehr: kSatz, gebuehr_echt: true, gebuehr_form: 'kontrakt',
          name: k.jaName, seite_text: 'Ja', link: kLink, partie: k.titel
        });
        if (qNein !== null) seiten.push({
          buch: 'kalshi', richtung: 'nein', qe: qNein, geld: kMenge === null ? null : kMenge * k.nein,
          roh: k.nein, gebuehr: kSatz, gebuehr_echt: true, gebuehr_form: 'kontrakt',
          name: k.jaName, seite_text: 'Nein', link: kLink, partie: k.titel
        });
        const qb = R.qeBack(v.b, smM.sz), ql = R.qeLay(v.l, smM.sz);
        if (qb !== null) seiten.push({
          buch: 'smarkets', richtung: 'ja', qe: qb, geld: zahlOderNull(v.bs), roh: v.b,
          gebuehr: R.gebuehrSicher(smM.sz), gebuehr_echt: smM.sz_echt === true,
          gebuehr_form: 'back',
          name: v.n, seite_text: 'Back', link: smM.link, partie: smM.ev
        });
        if (ql !== null) {
          const ls = zahlOderNull(v.ls);
          seiten.push({
            buch: 'smarkets', richtung: 'nein', qe: ql,
            geld: ls === null ? null : ls * (v.l - 1), roh: v.l,
            gebuehr: R.gebuehrSicher(smM.sz), gebuehr_echt: smM.sz_echt === true,
            gebuehr_form: 'lay',
            name: v.n, seite_text: 'Lay', link: smM.link, partie: smM.ev
          });
        }

        const bez = seite === 'DRAW' ? 'Unentschieden' : v.n;
        for (const treffer of R.alleChancen(seiten, RAUSCH_GRENZE)) {
          const a = treffer.ja as Seite, b = treffer.nein as Seite, e = treffer.ergebnis;
          schreibe(a, b, e, {
            schluessel: KUERZEL[a.buch] + '>' + KUERZEL[b.buch] + '#' + k.ticker,
            marktId: String(k.ticker), titel: smM.ev, frage: k.titel,
            bez, art: seite === 'DRAW' ? 'unentschieden' : 'sieger',
            sport: 'soccer', ende: smM.st || new Date(grenze).toISOString(),
            zuordnung: pr.score
          });
        }
      }
    }

    /* ---------- PROBELAUF: rechnen ja, schreiben nein ----------
     * Das ist der Trockenlauf gegen echte Daten, den jede Freischaltung
     * eines Bereichs braucht: jede Zuordnung einzeln zum Nachsehen. */
    if (probe) {
      return new Response(JSON.stringify({
        ok: true, probe: true, bereich, dauer_ms: Date.now() - t0,
        pm_maerkte: maerkte.length, je_art: jeArt,
        kalshi_maerkte: kalshi.length, kalshi_anderer_bereich: kaAnderesFach,
        betfair_maerkte: bfImFenster.length, smarkets_maerkte: smAlle.length,
        karte_ok: karteOk,
        paare: zeilen.length,
        zuordnungen: zeilen.slice(0, 200).map(z => ({
          schluessel: z.schluessel, titel: z.titel, gegen: z.bf_partie,
          frage: z.frage, art: z.art, zuordnung: z.zuordnung,
          rendite: z.rendite, max_einsatz: z.max_einsatz
        }))
      }, null, 1), { headers: kopf });
    }

    if (zeilen.length) {
      for (let i = 0; i < zeilen.length; i += 500) {
        const r = await fetch(`${URL_SUPA}/rest/v1/orion_funde?on_conflict=schluessel`, {
          method: 'POST',
          headers: { ...dbKopf(), prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(zeilen.slice(i, i + 500))
        });
        if (!r.ok) throw new Error('Upsert ' + r.status + ' ' + (await r.text()).slice(0, 200));
      }
    }

    /* ---------- Aufraeumen: NUR im eigenen Bereich ----------
     * Ueber die Zeitmarke (der Wurzelfix vom 11.8. bleibt), aber je Bereich:
     * der Tennis-Lauf darf keine Fussball-Zeilen beenden, die er nie gesehen
     * hat — sonst loeschen sich die Bereiche gegenseitig die Funde. */
    const laufMarke = new Date(jetzt).toISOString();
    const beendetAntwort = await fetch(
      `${URL_SUPA}/rest/v1/orion_funde?status=eq.live&bereich=eq.${bereich}&zuletzt_gesehen=lt.${laufMarke}`, {
      method: 'PATCH', headers: { ...dbKopf(), prefer: 'return=representation' },
      body: JSON.stringify({ status: 'vorbei', vorbei_seit: new Date().toISOString(), vorbei_grund: 'nicht mehr gefunden' })
    });
    const beendet = beendetAntwort.ok ? (await beendetAntwort.json()).length : 0;
    if (!beendetAntwort.ok) throw new Error('Aufraeumen fehlgeschlagen ' + beendetAntwort.status);

    await fetch(`${URL_SUPA}/rest/v1/orion_funde?status=eq.live&bereich=eq.${bereich}&endet_am=lt.${new Date().toISOString()}`, {
      method: 'PATCH', headers: { ...dbKopf(), prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'vorbei', vorbei_seit: new Date().toISOString(), vorbei_grund: 'Partie vorbei' })
    });

    /* Zaehlschwelle wie in der Anzeige und in orion_uebersicht: 3 %
     * (Vorgabe 11.8. spaet abends). Stand hier bis dahin 0,5 %, waehrend
     * die Website schon 3 % zeigte, haette das Protokoll andere Zahlen
     * behauptet als die Seite. */
    const chancen = zeilen.filter(z => z.rendite >= 3.0).length;

    await fetch(`${URL_SUPA}/rest/v1/orion_laeufe`, {
      method: 'POST', headers: { ...dbKopf(), prefer: 'return=minimal' },
      body: JSON.stringify({
        bereich,
        dauer_ms: Date.now() - t0, pm_maerkte: maerkte.length,
        bf_match_odds: bfSieger.length + bfOu.length, bf_alter_s: bfAlterS,
        paare: zeilen.length, chancen_neu: chancen, chancen_live: chancen, beendet
      })
    });

    const smJeArt: Record<string, number> = {};
    for (const k of Object.keys(smNachArt)) smJeArt[k] = smNachArt[k].length;

    return new Response(JSON.stringify({
      ok: true, bereich, dauer_ms: Date.now() - t0,
      betfair_aktiv: BETFAIR_AKTIV,
      betfair: { geladen: bfImFenster.length, sieger: bfSieger.length,
                 ueber_unter: bfOu.length, alter_s: bfAlterS },
      pm_maerkte: maerkte.length, je_art: jeArt,
      kalshi_maerkte: kalshi.length, kalshi_alter_s: kaAlterS,
      kalshi_anderer_bereich: kaAnderesFach,
      smarkets_maerkte: smAlle.length, smarkets_alter_s: smAlterS,
      smarkets_je_art: smJeArt,
      bereich_verworfen: bereichVerworfen,
      karte_ok: karteOk,
      anker_smarkets_partien: smGesehen.size,
      direkt: {
        offene_smarkets_partien: offen.length,
        kalshi_partien: kaNachPartie.size,
        paare: direkt.paare.length,
        mehrdeutig_verworfen: direkt.mehrdeutig,
        zeitlich_zu_weit: direkt.zuWeit
      },
      paare: zeilen.length, je_paarung: jePaarung,
      mit_bekannter_menge: mitMenge, chancen, beendet
    }, null, 1), { headers: kopf });

  } catch (e) {
    await fetch(`${URL_SUPA}/rest/v1/orion_laeufe`, {
      method: 'POST', headers: { ...dbKopf(), prefer: 'return=minimal' },
      body: JSON.stringify({ bereich: bereich || null, dauer_ms: Date.now() - t0, fehler: String(e).slice(0, 500) })
    }).catch(() => {});
    return new Response(JSON.stringify({ ok: false, bereich, fehler: String(e) }), { status: 500, headers: kopf });
  }
});
