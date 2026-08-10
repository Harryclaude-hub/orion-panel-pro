// orion-lauf — der Scanner. pg_cron, jede Minute, serverseitig.
//
// UMBAU vom 10.8.2026: von "Polymarket gegen den Rest" auf "jedes Buch
// gegen jedes".
//
// Vorher wurden genau zwei Paarungen gesucht: Polymarket gegen Betfair und
// Polymarket gegen Kalshi. Mit Smarkets als drittem Buch sind es sechs, und
// Betfair gegen Smarkets ist genauso eine Arbitrage wie Polymarket gegen
// Betfair. Es waere Unsinn, die Haelfte davon liegen zu lassen.
//
// DAS NEUE MODELL — eine SEITE statt eines Buchpaares:
// Zu jeder Frage ("Gewinnt Team A?") liefert jedes Buch bis zu zwei Seiten:
//     JA    Polymarket JA-Anteil · Kalshi Yes · Betfair/Smarkets BACK
//     NEIN  Polymarket NEIN-Anteil · Kalshi No · Betfair/Smarkets LAY
// Jede Seite traegt ihre Effektivquote NACH Gebuehr. Danach wird jede
// JA-Seite gegen jede NEIN-Seite eines ANDEREN Buches gerechnet.
//
// Was dabei erzwungen wird (R.chance):
//   - genau ZWEI Buecher, nie eins, nie drei
//   - immer JA gegen NEIN, nie zweimal dasselbe
//   - Gebuehr steckt schon in qe, es gibt keine Zeile ohne Gebuehr
//
// Mehrere Kombinationen zur selben Partie ergeben MEHRERE Zeilen. Jede hat
// eigene Links, eigene Einsaetze und eine eigene Rendite — eine gemeinsame
// Karte waere gelogen.
//
// SPEICHER: lief regelmaessig ins Rechenlimit (HTTP 546). Deshalb wird
// Smarkets NICHT hier geholt, sondern von orion-smarkets eingesammelt und
// hier nur abgelesen — dasselbe Muster wie bei Kalshi.

import * as R from './rechnung.ts';
import * as Z from './zuordnung.ts';

const TAGS = ['soccer', 'mlb', 'nfl', 'nba', 'tennis', 'ucl'];
const FENSTER_H = 72;
const SCHWELLE = 0.5;
const LAEUFER_SCHWELLE = 0.8;
const BROKER = 'https://www.orbitexch.com/customer/sport/1/market/{id}';

// Ab hier abwaerts ist es Rauschen und wird gar nicht erst gespeichert.
// Ohne diese Grenze entstuenden aus sechs Paarungen je Markt Zehntausende
// Zeilen je Minute, von denen fast alle tief im Minus liegen.
const RAUSCH_GRENZE = -1.0;

// BETFAIR ABGESCHALTET am 10.8.2026. Der Code bleibt vollstaendig stehen.
//
// Betfair ist das einzige Buch, das einen laufenden Heim-PC braucht, und aus
// Supabase gemessen gesperrt: 5 von 8 Wegen antworten 403 von Cloudflare,
// auch die oeffentliche Startseite, VOR jeder Anmeldung.
//
// Der letzte offene Weg waere Zertifikat -> Stream gewesen. Er ist eine
// Sackgasse: Betfairs eigenes Stream-Schema hat in RunnerDefinition nur
// sortPriority, removalDate, id, hc, adjustmentFactor, bsp, status. KEIN
// Feld im ganzen Schema traegt einen Namen. Der Stream liefert Preise zu
// einer selectionId, ohne zu sagen, welche Mannschaft das ist — und Namen
// gibt es nur ueber listMarketCatalogue auf api.betfair.com, also 403.
// Ohne Namen keine Zuordnung.
//
// Loest Betfair die Sperre je: hier auf true, sonst nichts.
const BETFAIR_AKTIV = false;

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

// Eine SEITE: ein fertiges Angebot eines Buches, Gebuehr schon eingerechnet.
interface Seite {
  buch: string;
  richtung: 'ja' | 'nein';
  qe: number;
  geld: number | null;
  roh: number;            // was angezeigt wird: Preis (pm/ka) oder Quote (bf/sm)
  gebuehr: number;
  gebuehr_echt: boolean;
  name: string;           // Laeufer- bzw. Ausgangsname
  seite_text: string;     // "JA" / "NEIN" / "Back" / "Lay"
  link: string;
  partie: string;
}

Deno.serve(async () => {
  const kopf = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };
  const t0 = Date.now();
  const jetzt = Date.now();
  const grenze = jetzt + FENSTER_H * 3600000;

  try {
    // ---------- Polymarket ----------
    const nachId = new Map<string, any>();
    const jeArt: Record<string, number> = { sieger: 0, unentschieden: 0, ueber_unter: 0, btts: 0 };
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
            jeArt[art]++;
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

    // ---------- Betfair, in der Datenbank vorgefiltert ----------
    // Wird gar nicht erst geladen, wenn abgeschaltet: das spart je Lauf
    // eine RPC ueber rund 1000 Maerkte.
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
    const smSieger = smAlle.filter((m: any) => m.art === 'sieger');
    const smOu = smAlle.filter((m: any) => m.art === 'ueber_unter');
    const smBtts = smAlle.filter((m: any) => m.art === 'btts');

    const zeilen: any[] = [];
    const jePaarung: Record<string, number> = {};
    let mitMenge = 0;

    for (const m of maerkte) {
      const p = Z.paar(m.titel);
      if (!p) continue;
      const buch = m.tokens.map((t: string) => preise.get(t));
      if (buch.some((x: any) => x === undefined)) continue;
      const ask = buch.map((x: any) => x.p);
      const mengen = buch.map((x: any) => x.menge);

      const bez = m.art === 'unentschieden' ? 'Unentschieden'
                : m.art === 'btts'         ? 'Beide Mannschaften treffen'
                : m.art === 'ueber_unter'  ? ('Über/Unter ' + Z.ouLinie(m.teil)) : m.teil;
      const seiten: Seite[] = [];

      // ----- Polymarket: beide Anteile -----
      const pmLink = `https://polymarket.com/event/${m.evSlug}/${m.mSlug}`;
      const qeJa = R.qePm(ask[0], m.satz, m.expo);
      const qeNein = R.qePm(ask[1], m.satz, m.expo);
      if (qeJa !== null) seiten.push({
        buch: 'polymarket', richtung: 'ja', qe: qeJa, geld: mengen[0] * ask[0], roh: ask[0],
        gebuehr: R.gebuehrSicher(m.satz), gebuehr_echt: m.satz !== null && m.satz !== undefined,
        name: bez, seite_text: m.art === 'ueber_unter' ? 'ÜBER' : 'JA', link: pmLink, partie: m.titel
      });
      if (qeNein !== null) seiten.push({
        buch: 'polymarket', richtung: 'nein', qe: qeNein, geld: mengen[1] * ask[1], roh: ask[1],
        gebuehr: R.gebuehrSicher(m.satz), gebuehr_echt: m.satz !== null && m.satz !== undefined,
        name: bez, seite_text: m.art === 'ueber_unter' ? 'UNTER' : 'NEIN', link: pmLink, partie: m.titel
      });

      // ----- Betfair -----
      // Betfair kennt kein BTTS in unserer Zuordnung: der Markttyp
      // BOTH_TEAMS_TO_SCORE existiert dort zwar, hat aber keine geprüfte
      // Regel. Keine Regel, keine Paarung.
      const bfKand = m.art === 'btts' ? []
                   : m.art === 'ueber_unter' ? Z.ouKandidaten(bfOu, Z.ouLinie(m.teil))
                   : bfSieger;
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
              name: lauf.laeufer.n, seite_text: 'Back', link, partie
            });
            if (ql !== null) {
              // Beim Legen begrenzt die HAFTUNG, nicht der Einsatz des Gegenuebers.
              const ls = zahlOderNull(lauf.laeufer.ls);
              seiten.push({
                buch: 'betfair', richtung: 'nein', qe: ql,
                geld: ls === null ? null : ls * (lauf.laeufer.l - 1),
                roh: lauf.laeufer.l, gebuehr: R.gebuehrSicher(satz), gebuehr_echt: satz !== null,
                name: lauf.laeufer.n, seite_text: 'Lay', link, partie
              });
            }
          }
        }
      }

      // ----- Smarkets -----
      const smKand = m.art === 'btts' ? smBtts
                   : m.art === 'ueber_unter' ? Z.smOuKandidaten(smOu, Z.ouLinie(m.teil))
                   : smSieger;
      if (smKand.length) {
        const tr = Z.besterTreffer(p[0], p[1], smKand, SCHWELLE);
        if (tr) {
          const lauf = Z.smLaeufer(m.art, m.teil, p, (tr.bf as any).r, tr.getauscht, LAEUFER_SCHWELLE);
          if (lauf) {
            const satz = (tr.bf as any).sz;
            const echt = (tr.bf as any).sz_echt === true;
            const link = (tr.bf as any).link;
            const partie = tr.bf.ev;
            const qb = R.qeBack(lauf.laeufer.b, satz);
            const ql = R.qeLay(lauf.laeufer.l, satz);
            if (qb !== null) seiten.push({
              buch: 'smarkets', richtung: 'ja', qe: qb, geld: zahlOderNull(lauf.laeufer.bs),
              roh: lauf.laeufer.b, gebuehr: R.gebuehrSicher(satz), gebuehr_echt: echt,
              name: lauf.laeufer.n, seite_text: 'Back', link, partie
            });
            if (ql !== null) {
              const ls = zahlOderNull(lauf.laeufer.ls);
              seiten.push({
                buch: 'smarkets', richtung: 'nein', qe: ql,
                geld: ls === null ? null : ls * (lauf.laeufer.l - 1),
                roh: lauf.laeufer.l, gebuehr: R.gebuehrSicher(satz), gebuehr_echt: echt,
                name: lauf.laeufer.n, seite_text: 'Lay', link, partie
              });
            }
          }
        }
      }

      // ----- Kalshi: nur Sieger und Unentschieden -----
      // Kalshi fuehrt weder Ueber/Unter noch BTTS in einer Form, fuer die
      // es hier eine geprüfte Zuordnung gaebe.
      if (m.art === 'sieger' || m.art === 'unentschieden') {
        const pmSeite: Z.Seite = m.art === 'unentschieden' ? 'unentschieden' : Z.seiteVon(m.teil, p);
        if (pmSeite) {
          const A = Z.woerter(p[0]), B = Z.woerter(p[1]);
          for (const e of Z.kalshiKandidaten(kIndex, A, B)) {
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
              gebuehr: R.KALSHI_SATZ, gebuehr_echt: false,
              name: k.jaName, seite_text: 'Ja', link, partie: k.titel
            });
            if (qNein !== null) seiten.push({
              buch: 'kalshi', richtung: 'nein', qe: qNein,
              geld: kMenge === null ? null : kMenge * k.nein, roh: k.nein,
              gebuehr: R.KALSHI_SATZ, gebuehr_echt: false,
              name: k.jaName, seite_text: 'Nein', link, partie: k.titel
            });
            break;
          }
        }
      }

      // ----- Jede JA-Seite gegen jede NEIN-Seite eines ANDEREN Buches -----
      for (const treffer of R.alleChancen(seiten, RAUSCH_GRENZE)) {
        const a = treffer.ja as Seite, b = treffer.nein as Seite, e = treffer.ergebnis;
        const paarung = KUERZEL[a.buch] + '>' + KUERZEL[b.buch];
        jePaarung[paarung] = (jePaarung[paarung] || 0) + 1;
        if (e.maxEinsatz !== null) mitMenge++;

        zeilen.push({
          schluessel: paarung + ':' + m.id,
          buch_1: a.buch, buch: b.buch,
          markt_id: m.id, titel: m.titel, frage: m.frage,
          mannschaft: bez, sportart: m.tag, weg: paarung,
          pm_seite: a.seite_text, pm_preis: a.roh, pm_link: a.link,
          bf_name: b.name, bf_seite: b.seite_text, bf_quote: b.roh,
          bf_link: b.link, bf_partie: b.partie,
          zuordnung: 1, rendite: e.rendite, inv: e.inv,
          einsatz_1: e.s1, einsatz_2: e.s2, auszahlung: e.auszahlung,
          pm_gebuehr: a.gebuehr, bf_gebuehr: b.gebuehr, bf_gebuehr_echt: b.gebuehr_echt,
          pm_menge: a.geld, gegen_menge: b.geld,
          max_einsatz: e.maxEinsatz, max_gewinn: e.maxGewinn,
          endet_am: m.ende, zuletzt_gesehen: new Date().toISOString(), status: 'live'
        });
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

    const gesehen = zeilen.map(z => z.schluessel);
    const filter = gesehen.length ? `&schluessel=not.in.(${gesehen.map(s => '"' + s + '"').join(',')})` : '';
    const beendetAntwort = await fetch(`${URL_SUPA}/rest/v1/orion_funde?status=eq.live${filter}`, {
      method: 'PATCH', headers: { ...dbKopf(), prefer: 'return=representation' },
      body: JSON.stringify({ status: 'vorbei', vorbei_seit: new Date().toISOString(), vorbei_grund: 'nicht mehr gefunden' })
    });
    const beendet = beendetAntwort.ok ? (await beendetAntwort.json()).length : 0;

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

    return new Response(JSON.stringify({
      ok: true, dauer_ms: Date.now() - t0,
      pm_maerkte: maerkte.length, je_art: jeArt,
      bf_geladen: bfImFenster.length, bf_alter_s: bfAlterS,
      kalshi_maerkte: kalshi.length, kalshi_alter_s: kaAlterS,
      smarkets_maerkte: smAlle.length, smarkets_alter_s: smAlterS,
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
