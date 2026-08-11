// orion-lauf — der Scanner. pg_cron, alle 15 Sekunden, serverseitig.
//
// ZWEI DURCHGAENGE:
//   1. ANKER POLYMARKET — fuer jeden Polymarket-Markt ein Gegenstueck bei
//      Smarkets und Kalshi. Dort gibt es immer zwei Belege: Partie und Laeufer.
//   2. OHNE ANKER — Smarkets direkt gegen Kalshi. Ersatz fuer den fehlenden
//      zweiten Beleg ist die EINDEUTIGKEIT in Z.direktPaare.
//
// GENUTZTE FRAGEN (Regel 1: nur gleiche Frage gegen gleiche Frage):
//   sieger · unentschieden · hz_sieger · hz_unentschieden · btts
//   ueber_unter · hz1_ueber_unter · hz2_ueber_unter · ecken_ueber_unter
//
// DAS MODELL — eine SEITE statt eines Buchpaares:
//     JA    Polymarket JA-Anteil · Kalshi Yes · Boerse BACK
//     NEIN  Polymarket NEIN-Anteil · Kalshi No · Boerse LAY
// Jede Seite traegt ihre Effektivquote NACH Gebuehr. Danach jede JA-Seite
// gegen jede NEIN-Seite eines ANDEREN Buches (R.chance erzwingt: genau zwei
// Buecher, immer JA gegen NEIN).

import * as R from './rechnung.ts';
import * as Z from './zuordnung.ts';

const TAGS = ['soccer', 'mlb', 'nfl', 'nba', 'tennis', 'ucl'];
const FENSTER_H = 72;
const SCHWELLE = 0.5;
const LAEUFER_SCHWELLE = 0.8;
const BROKER = 'https://www.orbitexch.com/customer/sport/1/market/{id}';
const RAUSCH_GRENZE = -1.0;

// BETFAIR WIEDER AKTIV seit 11.8.2026 abends — ueber die Bridge auf einem
// eigenen Laptop. Aus Supabase heraus bleibt Betfair gesperrt (403, rund 50
// Wege gemessen); die Bridge umgeht das nicht, sie laeuft schlicht an einem
// Privatanschluss und liest mit dem Konto des Auftraggebers.
//
// Gemessen am 11.8. vor dem Scharfschalten: orion_bf_maerkte(72) liefert
// 1240 Maerkte, davon rund 850 MATCH_ODDS und 1100 OVER_UNDER.
//
// DREI EINSCHRAENKUNGEN, die in jeder Betfair-Zeile stecken:
//  1. App-Key ist DELAYED  - Kurse rund eine Minute alt. Bei laufenden
//     Spielen ist die gesehene Quote meist schon weg.
//  2. Konto ist fuer API-Wetten SUSPENDED. Lesen geht, automatisch setzen
//     nicht - fuer einen Scanner, bei dem der Mensch klickt, kein Hindernis.
//  3. Bridge Build 17 sendet den echten Kommissionssatz NICHT mit. Es wird
//     mit 7 % gerechnet statt der echten 2 bis 5 %; an einem echten Markt
//     nachgerechnet kostet das rund einen Prozentpunkt Rendite. Konservativ,
//     also sicher - aber es kostet Chancen. Build 18 behebt es.
//
// Zum Abschalten: hier auf false und KONFIG.buecher.betfair.aktiv ebenso.
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
  // Wie die Gebuehr dieser Seite in Geld ausgerechnet wird (R.gebuehrBetrag).
  gebuehr_form: R.GebuehrForm;
}

Deno.serve(async () => {
  const kopf = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };
  const t0 = Date.now();
  const jetzt = Date.now();
  const grenze = jetzt + FENSTER_H * 3600000;

  try {
    // ---------- Polymarket ----------
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

    // ---------- Betfair ----------
    let bfImFenster: Z.BfMarkt[] = [];
    let bfAlterS: number | null = null;
    if (BETFAIR_AKTIV) {
      const bfR = await fetch(`${URL_SUPA}/rest/v1/rpc/orion_bf_maerkte`, {
        method: 'POST', headers: dbKopf(), body: JSON.stringify({ fenster_h: FENSTER_H })
      });
      bfImFenster = bfR.ok ? (await bfR.json() || []) : [];
      const zeitR = await fetch(`${URL_SUPA}/rest/v1/bridge_odds?id=eq.1&select=updated_at`, { headers: dbKopf() });
      const zeitZ = zeitR.ok ? await zeitR.json() : [];
      bfAlterS = zeitZ[0]?.updated_at ? Math.round((jetzt - Date.parse(zeitZ[0].updated_at)) / 1000) : null;
    }
    const bfSieger = bfImFenster.filter(m => m.mt === 'MATCH_ODDS');
    const bfOu = bfImFenster.filter(m => Z.bfOuLinie(m.mt) !== null);

    // ---------- Kalshi ----------
    const kaAntwort = await fetch(`${URL_SUPA}/rest/v1/kalshi_snapshot?id=eq.1&select=maerkte,updated_at`, { headers: dbKopf() });
    const kaZeilen = kaAntwort.ok ? await kaAntwort.json() : [];
    const kaZeile = kaZeilen[0] || { maerkte: [], updated_at: null };
    const kaAlterS = kaZeile.updated_at ? Math.round((jetzt - Date.parse(kaZeile.updated_at)) / 1000) : null;
    const kalshi = (kaZeile.maerkte || []).filter((k: any) => {
      const t = Date.parse(k.schliesst || '');
      return !isNaN(t) && t > jetzt && t <= grenze;
    });
    const kIndex = Z.kalshiIndex(kalshi);

    // ---------- Smarkets ----------
    const smAntwort = await fetch(`${URL_SUPA}/rest/v1/smarkets_snapshot?id=eq.1&select=maerkte,updated_at`, { headers: dbKopf() });
    const smZeilen = smAntwort.ok ? await smAntwort.json() : [];
    const smZeile = smZeilen[0] || { maerkte: [], updated_at: null };
    const smAlterS = smZeile.updated_at ? Math.round((jetzt - Date.parse(smZeile.updated_at)) / 1000) : null;
    const smAlle = smZeile.maerkte || [];
    const smNachArt: Record<string, any[]> = {};
    for (const m of smAlle) (smNachArt[m.art] = smNachArt[m.art] || []).push(m);
    const smSieger = smNachArt['sieger'] || [];
    const smHalbzeit = smNachArt['halbzeit'] || [];
    const smBtts = smNachArt['btts'] || [];

    const zeilen: any[] = [];
    const jePaarung: Record<string, number> = {};
    let mitMenge = 0;
    const smGesehen = new Set<string>();

    function schreibe(a: Seite, b: Seite, e: any, opt: {
      schluessel: string; marktId: string; titel: string; frage: string;
      bez: string; art: string; sport: string; ende: string; zuordnung: number;
    }) {
      const paarung = KUERZEL[a.buch] + '>' + KUERZEL[b.buch];
      jePaarung[paarung] = (jePaarung[paarung] || 0) + 1;
      if (e.maxEinsatz !== null && e.maxEinsatz !== undefined) mitMenge++;

      /* GEBUEHR IN GELD, je Seite und in Summe.
       *
       * Die Gebuehr steckte bisher nur in qe — sichtbar war der Satz, nie der
       * Betrag. Wer 0,71 % Rendite sieht, soll auch sehen, dass davon vorher
       * 2 % Kommission abgezogen wurden und wie viel das in Geld ist.
       * Bezugsgroesse ist der Musterlauf ueber 100 (e.einsatz), damit die
       * Zahlen zwischen Zeilen vergleichbar bleiben. */
      const gA = R.gebuehrBetrag(a.gebuehr_form, e.s1, a.roh, a.qe);
      const gB = R.gebuehrBetrag(b.gebuehr_form, e.s2, b.roh, b.qe);
      const gSumme = (gA === null || gB === null) ? null : gA + gB;

      zeilen.push({
        schluessel: opt.schluessel,
        buch_1: a.buch, buch: b.buch,
        markt_id: opt.marktId, titel: opt.titel, frage: opt.frage,
        mannschaft: opt.bez, art: opt.art, sportart: opt.sport, weg: paarung,
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
      const ou = Z.ouArt(m.teil);          // {art, linie} bei allen vier Ueber/Unter
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
      const pmEcht = m.satz !== null && m.satz !== undefined;
      const qeJa = R.qePm(ask[0], m.satz, m.expo);
      const qeNein = R.qePm(ask[1], m.satz, m.expo);
      if (qeJa !== null) seiten.push({
        buch: 'polymarket', richtung: 'ja', qe: qeJa, geld: mengen[0] * ask[0], roh: ask[0],
        gebuehr: R.gebuehrSicher(m.satz), gebuehr_echt: pmEcht, gebuehr_form: 'anteil',
        name: bez, seite_text: istOu ? 'ÜBER' : 'JA', link: pmLink, partie: m.titel
      });
      if (qeNein !== null) seiten.push({
        buch: 'polymarket', richtung: 'nein', qe: qeNein, geld: mengen[1] * ask[1], roh: ask[1],
        gebuehr: R.gebuehrSicher(m.satz), gebuehr_echt: pmEcht, gebuehr_form: 'anteil',
        name: bez, seite_text: istOu ? 'UNTER' : 'NEIN', link: pmLink, partie: m.titel
      });

      // ----- Betfair -----
      // Nur die drei Fragen, fuer die es dort eine gepruefte Regel gibt.
      // Halbzeit, BTTS, Halbzeit-Ueber/Unter und Ecken haben keine.
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
            const satz = Z.bfSatzVon(tr.bf);
            const link = brokerLink(tr.bf.link);
            const partie = tr.bf.ev || tr.bf.k;
            const qb = R.qeBack(lauf.laeufer.b, satz);
            const ql = R.qeLay(lauf.laeufer.l, satz);
            if (qb !== null) seiten.push({
              buch: 'betfair', richtung: 'ja', qe: qb, geld: zahlOderNull(lauf.laeufer.bs),
              roh: lauf.laeufer.b, gebuehr: R.gebuehrSicher(satz), gebuehr_echt: satz !== null,
              gebuehr_form: 'back',
              name: lauf.laeufer.n, seite_text: 'Back', link, partie
            });
            if (ql !== null) {
              const ls = zahlOderNull(lauf.laeufer.ls);
              seiten.push({
                buch: 'betfair', richtung: 'nein', qe: ql,
                geld: ls === null ? null : ls * (lauf.laeufer.l - 1),
                roh: lauf.laeufer.l, gebuehr: R.gebuehrSicher(satz), gebuehr_echt: satz !== null,
                gebuehr_form: 'lay',
                name: lauf.laeufer.n, seite_text: 'Lay', link, partie
              });
            }
          }
        }
      }

      // ----- Smarkets -----
      // Ueber/Unter: gleiche ART und gleiche LINIE gegen gleiche.
      const smKand = istHzSieger ? smHalbzeit
                   : m.art === 'btts' ? smBtts
                   : istOu ? Z.smOuKandidaten(smNachArt[m.art] || [], ou!.linie)
                   : smSieger;
      if (smKand.length) {
        const tr = Z.besterTreffer(p[0], p[1], smKand as any, SCHWELLE);
        if (tr) {
          const lauf = Z.smLaeufer(m.art, m.teil, p, (tr.bf as any).r, tr.getauscht, LAEUFER_SCHWELLE);
          if (lauf) {
            // Nur SIEGERMAERKTE decken eine Partie fuer den zweiten Durchgang ab.
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
        const pmBereich = Z.bereichPm(m.tag);
        if (pmSeite) {
          const A = Z.woerter(p[0]), B = Z.woerter(p[1]);
          for (const e of Z.kalshiKandidaten(kIndex, A, B)) {
            /* BEREICH gegen BEREICH. Am 11.8.2026 stand eine Fehlpaarung mit
             * 5,34 % live: FSV Frankfurt gegen Eintracht Frankfurt (Fussball)
             * wurde mit einem League-of-Legends-Match derselben Mannschaft
             * gepaart. Die Namen sind wirklich gleich - nur der Sport nicht.
             * Kein bekannter Bereich heisst: nicht paaren. */
            if (!Z.gleicherBereich(pmBereich, Z.bereichKalshi(e.k.serie))) continue;
            const gerade = Math.min(Z.aehnlichkeitW(A, e.kw0), Z.aehnlichkeitW(B, e.kw1));
            const kreuz  = Math.min(Z.aehnlichkeitW(A, e.kw1), Z.aehnlichkeitW(B, e.kw0));
            const score = Math.max(gerade, kreuz);
            if (score < SCHWELLE) continue;
            if (!Z.gleicheSeite(pmSeite, e.kSeite, kreuz > gerade)) continue;

            const k = e.k;
            const link = kalshiLink(k);
            const qJa = R.qeKalshi(k.ja);
            const qNein = R.qeKalshi(k.nein);
            const kMenge = zahlOderNull(k.jaMenge);
            if (qJa !== null) seiten.push({
              buch: 'kalshi', richtung: 'ja', qe: qJa,
              geld: kMenge === null ? null : kMenge * k.ja, roh: k.ja,
              gebuehr: R.KALSHI_SATZ, gebuehr_echt: false, gebuehr_form: 'kontrakt',
              name: k.jaName, seite_text: 'Ja', link, partie: k.titel
            });
            if (qNein !== null) seiten.push({
              buch: 'kalshi', richtung: 'nein', qe: qNein,
              geld: kMenge === null ? null : kMenge * k.nein, roh: k.nein,
              gebuehr: R.KALSHI_SATZ, gebuehr_echt: false, gebuehr_form: 'kontrakt',
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

    // ========= DURCHGANG 2: Smarkets gegen Kalshi, OHNE Polymarket =========
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
    let kaAnderesFach = 0;
    for (const k of kalshi) {
      /* Smarkets fuehrt AUSSCHLIESSLICH Fussball (der Sammler holt
       * type=football_match, 896 Maerkte gemessen). Alles andere bei Kalshi -
       * und das waren am 11.8. 196 von 369 Maerkten E-Sport - hat hier nichts
       * zu suchen. Ohne diese Sperre wird Counter-Strike gegen Fussball
       * gehalten, und bei gleichnamigen Mannschaften entsteht eine Zeile,
       * die perfekt aussieht. */
      if (Z.bereichKalshi(k.serie) !== 'fussball') { kaAnderesFach++; continue; }
      const pp = Z.kalshiPaar(k.titel);
      if (!pp) continue;
      const z = Z.kalshiZeit(k.ev);
      if (!kaNachPartie.has(k.ev)) {
        kaNachPartie.set(k.ev, { id: k.ev, partie: pp, zeit: z ? z.zeit : null, titel: k.titel, ausgaenge: [] });
      }
      kaNachPartie.get(k.ev).ausgaenge.push(k);
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
        const qJa = R.qeKalshi(k.ja), qNein = R.qeKalshi(k.nein);
        const kMenge = zahlOderNull(k.jaMenge);
        if (qJa !== null) seiten.push({
          buch: 'kalshi', richtung: 'ja', qe: qJa, geld: kMenge === null ? null : kMenge * k.ja,
          roh: k.ja, gebuehr: R.KALSHI_SATZ, gebuehr_echt: false, gebuehr_form: 'kontrakt',
          name: k.jaName, seite_text: 'Ja', link: kLink, partie: k.titel
        });
        if (qNein !== null) seiten.push({
          buch: 'kalshi', richtung: 'nein', qe: qNein, geld: kMenge === null ? null : kMenge * k.nein,
          roh: k.nein, gebuehr: R.KALSHI_SATZ, gebuehr_echt: false, gebuehr_form: 'kontrakt',
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

    // WURZELFIX 11.8.2026: nicht mehr gefundene Zeilen ueber eine ZEITMARKE
    // beenden, nicht ueber eine Liste ALLER Schluessel.
    //
    // Vorher stand hier ?schluessel=not.in.("a","b",...) mit jedem gefundenen
    // Schluessel. Bei 40+ Zeilen wurde die URL zu lang und die Anfrage schlug
    // STILL fehl: beendetAntwort.ok war false, beendet = 0, KEIN Fehler
    // geworfen. Die nicht mehr gefundenen Zeilen blieben auf 'live' stehen und
    // sahen auf der Website aus wie aktuelle Funde. Der Waechter raeumte sie
    // nachtraeglich ab - jetzt entstehen sie gar nicht erst.
    //
    // Jede in DIESEM Lauf geschriebene Zeile traegt zuletzt_gesehen von NACH
    // `jetzt` (in schreibe() mit new Date() gesetzt). Wird eine Zeile wieder
    // gefunden, hebt merge-duplicates ihren Zeitstempel an. Nicht mehr
    // gefundene Zeilen behalten ihren alten, aus einem frueheren Lauf, und der
    // liegt vor `jetzt`. Also: alles vor der Laufmarke ist verwaist. Die URL
    // ist jetzt fest und kurz und kann nicht mehr zu lang werden.
    const laufMarke = new Date(jetzt).toISOString();
    const beendetAntwort = await fetch(
      `${URL_SUPA}/rest/v1/orion_funde?status=eq.live&zuletzt_gesehen=lt.${laufMarke}`, {
      method: 'PATCH', headers: { ...dbKopf(), prefer: 'return=representation' },
      body: JSON.stringify({ status: 'vorbei', vorbei_seit: new Date().toISOString(), vorbei_grund: 'nicht mehr gefunden' })
    });
    const beendet = beendetAntwort.ok ? (await beendetAntwort.json()).length : 0;
    if (!beendetAntwort.ok) throw new Error('Aufraeumen fehlgeschlagen ' + beendetAntwort.status);

    await fetch(`${URL_SUPA}/rest/v1/orion_funde?status=eq.live&endet_am=lt.${new Date().toISOString()}`, {
      method: 'PATCH', headers: { ...dbKopf(), prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'vorbei', vorbei_seit: new Date().toISOString(), vorbei_grund: 'Partie vorbei' })
    });

    const chancen = zeilen.filter(z => z.rendite >= 0.5).length;

    await fetch(`${URL_SUPA}/rest/v1/orion_laeufe`, {
      method: 'POST', headers: { ...dbKopf(), prefer: 'return=minimal' },
      body: JSON.stringify({
        dauer_ms: Date.now() - t0, pm_maerkte: maerkte.length,
        bf_match_odds: bfSieger.length + bfOu.length, bf_alter_s: bfAlterS,
        paare: zeilen.length, chancen_neu: chancen, chancen_live: chancen, beendet
      })
    });

    const smJeArt: Record<string, number> = {};
    for (const k of Object.keys(smNachArt)) smJeArt[k] = smNachArt[k].length;

    return new Response(JSON.stringify({
      ok: true, dauer_ms: Date.now() - t0,
      betfair_aktiv: BETFAIR_AKTIV,
      pm_maerkte: maerkte.length, je_art: jeArt,
      kalshi_maerkte: kalshi.length, kalshi_alter_s: kaAlterS,
      smarkets_maerkte: smAlle.length, smarkets_alter_s: smAlterS,
      smarkets_je_art: smJeArt,
      anker_smarkets_partien: smGesehen.size,
      direkt: {
        offene_smarkets_partien: offen.length,
        kalshi_partien: kaNachPartie.size,
        kalshi_anderer_bereich_verworfen: kaAnderesFach,
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
      body: JSON.stringify({ dauer_ms: Date.now() - t0, fehler: String(e).slice(0, 500) })
    }).catch(() => {});
    return new Response(JSON.stringify({ ok: false, fehler: String(e) }), { status: 500, headers: kopf });
  }
});
