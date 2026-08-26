// pm-scan — holt den Polymarket-Bestand EINMAL zentral, statt in jedem Browser.
//
// WARUM ES DAS GIBT
// Gemessen am 09.08.2026: jeder Nutzer lud ~13,6 MB Katalog von Polymarket
// (21 Seiten a 100 Eintraege) und sortierte sie selbst — bei jedem
// Katalogaufbau, auf jedem Geraet, doppelt. Das war der groesste Posten der
// Ladezeit, um Faktor 40 groesser als alles andere zusammen.
// Hier laeuft derselbe Vorgang einmal im Takt auf dem Server. Der Browser
// liest danach nur noch das fertige Ergebnis (~350 KB).
//
// WAS ES NICHT AENDERT
// Die Rechnung selbst bleibt, wo sie ist. Diese Funktion bewertet nichts und
// meldet keine Chancen — sie sammelt nur Kurse. Arbitrage wird weiterhin in
// der Bridge und in der Website gerechnet, mit denselben Regeln wie bisher.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const GAMMA = 'https://gamma-api.polymarket.com/markets';
const CLOB  = 'https://clob.polymarket.com';
const cors  = {'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};

const zahl = (v: unknown) => { const x = Number(v); return isFinite(x) ? x : 0; };

/* Katalog in Wellen holen. Gamma deckelt JEDE Antwort bei 100 Eintraegen,
   egal welches limit gesetzt ist — nur offset-Blaettern liefert alles.
   Hinter dem letzten Eintrag antwortet Gamma mit 422, nicht mit einer
   leeren Liste; das ist das Ende, kein Fehler. */
async function katalog(): Promise<any[]> {
  const raus: any[] = [];
  let off = 0, ende = false;
  while (!ende && off < 20000) {
    const offs: number[] = [];
    for (let k = 0; k < 5 && !ende && off < 20000; k++) { offs.push(off); off += 100; }
    const seiten = await Promise.all(offs.map(async (o) => {
      try {
        const r = await fetch(`${GAMMA}?closed=false&active=true&limit=100&offset=${o}`);
        if (r.status === 422 || !r.ok) return null;
        return await r.json();
      } catch { return null; }
    }));
    for (const j of seiten) {
      if (!Array.isArray(j) || !j.length) { ende = true; break; }
      raus.push(...j);
      if (j.length < 100) { ende = true; break; }
    }
  }
  return raus;
}

/* Kurse im Stapel. /books nimmt bis 500 Token, 250 ist der sichere Wert.
   Die asks kommen ABSTEIGEND — der Kaufpreis ist das Minimum, nicht asks[0].
   Diese Verwechslung erzeugt sonst Fantasiepreise. */
async function kurse(tokens: string[]): Promise<Record<string, {p:number,s:number}>> {
  const out: Record<string, {p:number,s:number}> = {};
  const stapel: string[][] = [];
  for (let i = 0; i < tokens.length; i += 250) stapel.push(tokens.slice(i, i + 250));
  for (let i = 0; i < stapel.length; i += 4) {
    await Promise.all(stapel.slice(i, i + 4).map(async (chunk) => {
      try {
        const r = await fetch(`${CLOB}/books`, {
          method: 'POST', headers: {'content-type':'application/json'},
          body: JSON.stringify(chunk.map(t => ({ token_id: t })))
        });
        const j = await r.json();
        if (!Array.isArray(j)) return;
        for (const b of j) {
          if (!b?.asks?.length) continue;
          let best: {p:number,s:number} | null = null;
          for (const a of b.asks) {
            const p = Number(a.price);
            if (p > 0 && p < 1 && (best === null || p < best.p)) best = { p, s: Number(a.size) };
          }
          if (best) out[String(b.asset_id)] = best;
        }
      } catch { /* ein Stapel darf ausfallen, der Rest zaehlt */ }
    }));
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const t0 = Date.now();
  /* DB-SCHLUESSEL, 26.8.2026 - Ausweg um eine Supabase-Stoerung herum.
   *
   * Seit dem 25.8. um 21:33 UTC wies die Datenbank die eigenen Edge-Funktionen
   * ab: PostgREST antwortete auf den Dienstschluessel mit
   *     "JWT issued at future"  ->  HTTP 401
   * Damit stand ALLES: Scanner, Bridge-Annahme, beide Melder, Panel leer.
   * Gemessen: 12 von 12 Aufrufen abgewiesen, nicht sprunghaft. Ein Neu-
   * ausrollen half NICHT (am 26.8. mit HTTP 201 geprueft).
   *
   * Auf status.supabase.com steht dazu seit dem 14.8. die offene Meldung
   * "401 errors due to JWT rejections".
   *
   * DER AUSWEG: die NEUEN Supabase-Schluessel (sb_secret_...) sind KEINE
   * JWT. Sie laufen an der kaputten Pruefung vorbei. Gegenprobe am 26.8.:
   * derselbe Aufruf mit dem neuen sb_publishable_-Schluessel kam mit
   * HTTP 200 durch, waehrend jeder JWT abgewiesen wurde.
   *
   * ORION_DB_KEY wird als Funktions-Geheimnis hinterlegt. Fehlt es, faellt
   * alles auf den alten Weg zurueck - diese Zeile ist also gefahrlos, egal
   * ob das Geheimnis schon existiert. Ist die Stoerung behoben, kann
   * ORION_DB_KEY einfach geloescht werden, dann greift wieder der alte Weg.
   *
   * SPIEGEL: dieselbe Zeile steht in allen neun Funktionen. */
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, (Deno.env.get('ORION_DB_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''));

  try {
    const liste = await katalog();
    const tGelistet = Date.now();

    // Nur zweiseitige Maerkte mit Orderbuch — alles andere ist nicht handelbar
    const kandidaten: any[] = [];
    const tokens: string[] = [];
    for (const m of liste) {
      if (!m?.enableOrderBook) continue;
      let outs: string[], toks: string[];
      try { outs = JSON.parse(m.outcomes); toks = JSON.parse(m.clobTokenIds); } catch { continue; }
      if (outs?.length !== 2 || toks?.length !== 2) continue;
      kandidaten.push({ m, outs, toks });
      tokens.push(String(toks[0]), String(toks[1]));
    }

    const preise = await kurse(tokens);
    const tBepreist = Date.now();

    /* Gebuehr je Markt mitschicken. Ein unbekannter Satz gilt als 7 % —
       der unguenstigste beobachtete Wert. NIEMALS als 0: ein fehlender
       Satz, der als gebuehrenfrei durchgeht, erzeugt Scheinchancen. */
    const markets: any[] = [];
    for (const k of kandidaten) {
      const a = preise[String(k.toks[0])], b = preise[String(k.toks[1])];
      if (!a || !b) continue;
      if (a.p < 0.01 || a.p > 0.99 || b.p < 0.01 || b.p > 0.99) continue;
      const m = k.m;
      const ev = Array.isArray(m.events) && m.events[0] ? m.events[0] : null;
      const fs = m.feeSchedule || {};
      const an = m.feesEnabled !== false;
      markets.push({
        id: String(m.id),
        q: String(m.question || '').slice(0, 180),
        outs: k.outs,
        toks: k.toks,
        ask: [a.p, b.p],
        size: [Math.floor(a.s), Math.floor(b.s)],
        slug: (ev?.slug) || m.slug || '',
        mslug: m.slug || '',
        evTitel: String(ev?.title || '').slice(0, 140),
        negRisk: !!(m.negRisk || ev?.negRisk),
        liq: zahl(m.liquidity),
        vol: zahl(m.volume),
        endet: m.endDate || null,
        start: m.gameStartTime || null,
        feeSatz: an ? (isFinite(Number(fs.rate)) && Number(fs.rate) >= 0 ? Number(fs.rate) : 0.07) : 0,
        feeExp: isFinite(Number(fs.exponent)) && Number(fs.exponent) > 0 ? Number(fs.exponent) : 1
      });
    }

    const stats = {
      gelistet: liste.length,
      zweiseitig: kandidaten.length,
      handelbar: markets.length,
      katalog_ms: tGelistet - t0,
      kurse_ms: tBepreist - tGelistet,
      gesamt_ms: Date.now() - t0,
      zeit: new Date().toISOString()
    };

    // Nur schreiben, wenn wirklich etwas da ist — ein misslungener Lauf darf
    // einen guten Bestand nicht durch eine leere Liste ersetzen.
    if (!markets.length) {
      return new Response(JSON.stringify({ ok:false, error:'keine handelbaren Maerkte', stats }), { status: 200, headers: cors });
    }

    const { error } = await sb.from('pm_snapshot')
      .update({ markets, stats, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) return new Response(JSON.stringify({ ok:false, error:error.message }), { status: 500, headers: cors });

    return new Response(JSON.stringify({ ok:true, stats }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error:String((e as Error)?.message || e) }), { status: 500, headers: cors });
  }
});
