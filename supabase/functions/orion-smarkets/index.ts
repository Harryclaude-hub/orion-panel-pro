// orion-smarkets — sammelt die dritte Boerse ein. pg_cron, alle 5 Minuten.
//
// WARUM EIGENER SAMMLER, nicht in orion-lauf hinein:
// orion-lauf faellt schon heute gelegentlich mit WORKER_RESOURCE_LIMIT aus
// (offener Punkt 6). Smarkets kostet rund 60 zusaetzliche Abrufe je
// Durchlauf. Das haette den Scanner sicher umgebracht. Deshalb dasselbe
// Muster wie bei Kalshi: hier wird gesammelt, orion-lauf liest nur ab.
//
// GEMESSEN am 10.8.2026, alles aus Supabase heraus, ohne Konto:
//   Spiele    200   314 ms   124 Fussballspiele im 72h-Fenster
//   Maerkte   200   364 ms   8967 gesamt, 992 davon Sieger/Ueber-Unter
//   Quoten    200    42 ms   volle Tiefe
//
// PREISKODIERUNG (dreifach belegt, siehe rechnung.ts):
//   price ist die implizite Wahrscheinlichkeit in Hundertstel-Prozent.
//   Quote = 10000 / price.  4032 -> 2,48
//   quantity ist die AUSZAHLUNG, nicht der Einsatz:
//   Geld = quantity * price / 10^8

const URL_SUPA = Deno.env.get('SUPABASE_URL')!;
const DIENST = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FENSTER_H = 72;

// Nur die Leiter 1,01 bis 1000. Ausserhalb liegen die Randmarken 1 und 9999,
// hinter denen kein handelbares Volumen steht, sondern eine Platzhalterzeile.
const PREIS_MIN = 10;
const PREIS_MAX = 9901;
const PLATZHALTER = 2147483646;

function dbKopf() {
  return { apikey: DIENST, authorization: 'Bearer ' + DIENST, 'content-type': 'application/json' };
}

async function hole(url: string, versuche = 3): Promise<any> {
  for (let i = 0; i < versuche; i++) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      if (r.ok) return await r.json();
      if (r.status === 404 || r.status === 422) return null;
      if (r.status === 403) throw new Error('Smarkets sperrt Supabase: 403');
    } catch (e) {
      if (String(e).includes('403')) throw e;
      if (i === versuche - 1) return null;
    }
    await new Promise(s => setTimeout(s, 300 * (i + 1)));
  }
  return null;
}

function quote(preis: number): number | null {
  if (typeof preis !== 'number' || !isFinite(preis)) return null;
  if (preis < PREIS_MIN || preis > PREIS_MAX) return null;
  return 10000 / preis;
}
function geld(menge: number, preis: number): number | null {
  if (typeof menge !== 'number' || !isFinite(menge) || menge <= 0) return null;
  if (menge === PLATZHALTER) return null;
  if (quote(preis) === null) return null;
  return menge * preis / 1e8;
}

Deno.serve(async () => {
  const kopf = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };
  const t0 = Date.now();

  try {
    const bis = new Date(Date.now() + FENSTER_H * 3600000).toISOString();
    const BASIS = 'https://api.smarkets.com/v3/events/';

    // ---------- Spiele ----------
    // Die Paginierung liefert next_page als QUERY-STRING, nicht als Pfad.
    // Wer ihn an den Host haengt, bekommt 50 Spiele statt 124 und merkt es nicht.
    let spiele: any[] = [];
    let q: string | null =
      `?type=football_match&state=upcoming&limit=100&sort=start_datetime,name` +
      `&start_datetime_max=${encodeURIComponent(bis)}`;
    for (let seite = 0; seite < 20 && q; seite++) {
      const d = await hole(BASIS + q);
      if (!d || !Array.isArray(d.events) || !d.events.length) break;
      spiele = spiele.concat(d.events);
      q = d.pagination?.next_page || null;
    }

    const spielNach = new Map<string, any>(spiele.map((e: any) => [e.id, e]));

    // ---------- Maerkte ----------
    let maerkte: any[] = [];
    for (let i = 0; i < spiele.length; i += 20) {
      const ids = spiele.slice(i, i + 20).map((e: any) => e.id).join(',');
      const d = await hole(`${BASIS}${ids}/markets/`);
      if (d && Array.isArray(d.markets)) maerkte = maerkte.concat(d.markets);
    }

    // Nur Fragen, die es woanders GENAUSO gibt (Regel 1).
    // Correct Score, Both Teams To Score, Winner-and-Over und der ganze Rest
    // bleiben liegen, solange es keine eigene Zuordnungsregel dafuer gibt.
    function art(m: any): { art: string; linie: number | null } | null {
      const t = m.market_type;
      if (!t || typeof t !== 'object') return null;
      if (t.name === 'WINNER_3_WAY') return { art: 'sieger', linie: null };
      if (t.name === 'OVER_UNDER') {
        const l = parseFloat(t.param);
        return isFinite(l) ? { art: 'ueber_unter', linie: l } : null;
      }
      return null;
    }
    const genutzt = maerkte.filter(m => art(m) !== null && m.state !== 'settled');

    // ---------- Vertraege und Quoten ----------
    let vertraege: any[] = [];
    const quoten: Record<string, any> = {};
    for (let i = 0; i < genutzt.length; i += 50) {
      const ids = genutzt.slice(i, i + 50).map((m: any) => m.id).join(',');
      const c = await hole(`https://api.smarkets.com/v3/markets/${ids}/contracts/`);
      if (c && Array.isArray(c.contracts)) vertraege = vertraege.concat(c.contracts);
      const qq = await hole(`https://api.smarkets.com/v3/markets/${ids}/quotes/`);
      if (qq && typeof qq === 'object') Object.assign(quoten, qq);
    }
    const vNach = new Map<string, any[]>();
    for (const c of vertraege) {
      if (!vNach.has(c.market_id)) vNach.set(c.market_id, []);
      vNach.get(c.market_id)!.push(c);
    }

    // ---------- In die gemeinsame Form bringen ----------
    // Dieselben Feldnamen wie bei den Betfair-Maerkten (r, n, b, l, bs, ls),
    // damit die geprueften Zuordnungsbausteine unveraendert greifen.
    const aus: any[] = [];
    let ohneQuote = 0;
    for (const m of genutzt) {
      const a = art(m)!;
      const e = spielNach.get(m.event_id);
      if (!e || !e.name) continue;

      const r: any[] = [];
      for (const c of (vNach.get(m.id) || [])) {
        const qz = quoten[c.id] || {};
        const angebote = (qz.offers || []).filter((o: any) => quote(o.price) !== null && o.quantity !== PLATZHALTER);
        const gebote = (qz.bids || []).filter((o: any) => quote(o.price) !== null && o.quantity !== PLATZHALTER);
        // Kaufen zum NIEDRIGSTEN Angebot, verkaufen zum HOECHSTEN Gebot.
        const besteA = angebote.length ? angebote.reduce((x: any, y: any) => x.price < y.price ? x : y) : null;
        const besteG = gebote.length ? gebote.reduce((x: any, y: any) => x.price > y.price ? x : y) : null;
        if (!besteA && !besteG) { ohneQuote++; continue; }
        r.push({
          n: c.name,
          typ: c.contract_type?.name || null,
          b: besteA ? quote(besteA.price) : null,          // Back
          l: besteG ? quote(besteG.price) : null,          // Lay
          bs: besteA ? geld(besteA.quantity, besteA.price) : null,
          ls: besteG ? geld(besteG.quantity, besteG.price) : null
        });
      }
      if (!r.length) continue;

      aus.push({
        ev: e.name,
        st: e.start_datetime || null,   // Anpfiff. Betfair liefert das nicht mit.
        art: a.art,
        linie: a.linie,
        link: e.full_slug ? 'https://smarkets.com' + e.full_slug : 'https://smarkets.com',
        sz: 0.02,                        // Standard-Tarif, NICHT gemessen
        sz_echt: false,
        r
      });
    }

    const stats = {
      spiele: spiele.length,
      maerkte_gesamt: maerkte.length,
      maerkte_genutzt: genutzt.length,
      mit_quoten: aus.length,
      sieger: aus.filter(x => x.art === 'sieger').length,
      ueber_unter: aus.filter(x => x.art === 'ueber_unter').length,
      ohne_quote: ohneQuote,
      dauer_ms: Date.now() - t0
    };

    // Nur schreiben, wenn wirklich etwas da ist. Ein leerer Schnappschuss
    // wuerde die letzte gute Aufnahme ueberschreiben und den Scanner blind
    // machen, ohne dass es auffiele.
    if (!aus.length) {
      return new Response(JSON.stringify({ ok: false, grund: 'nichts eingesammelt, alte Aufnahme bleibt', stats }, null, 1),
                          { status: 200, headers: kopf });
    }

    const r = await fetch(`${URL_SUPA}/rest/v1/smarkets_snapshot?on_conflict=id`, {
      method: 'POST',
      headers: { ...dbKopf(), prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ id: 1, maerkte: aus, stats, updated_at: new Date().toISOString() }])
    });
    if (!r.ok) throw new Error('Schreiben ' + r.status + ' ' + (await r.text()).slice(0, 200));

    return new Response(JSON.stringify({ ok: true, ...stats }, null, 1), { headers: kopf });

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, fehler: String(e), dauer_ms: Date.now() - t0 }),
                        { status: 500, headers: kopf });
  }
});
