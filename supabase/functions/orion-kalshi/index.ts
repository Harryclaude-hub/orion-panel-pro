// orion-kalshi v4 — holt die oeffentlichen Kalshi-Kurse und legt sie ab.
//
// Kalshi ist eine regulierte US-Boerse, kein Buchmacher. Die Kursdaten sind
// OHNE Konto und OHNE Schluessel lesbar. Weder Anmeldung noch Heim-PC noetig.
//
// ============================================================================
// V4 (19.8.2026) — NOTFALLREPARATUR: Kalshi lieferte NULL Maerkte
// ============================================================================
// Gemessen am 19.8.: 40 Seiten geholt, 40.000 Maerkte gesehen, 40.000
// verworfen, 0 abgelegt — und der Sammler meldete dabei "fehler: 0".
// Genau die stille Fehlerklasse, die dieses Projekt jagt.
//
// URSACHE: Kalshi hat den Endpunkt /markets mit Kombinationsmaerkten
// geflutet (Ticker KXMVECROSSCATEGORY-SHARD1-...). Sie tragen keine
// echten Kurse (ja_ask 0,0000 / nein_ask 1,0000) und fielen deshalb durch
// unseren Plausibilitaetsfilter. Gemessen:
//   /markets?status=open              100 von 100 sind MVE-Muell
//   /markets?series_ticker=KXBTCD     100 von 100 sind ECHT
// Der Seitenweg von v3 erreichte damit nie einen echten Markt.
//
// LOESUNG: zurueck zum SERIENWEG (wie v2), aber gezielt und parallel.
// Gemessen: 259 Sport-Serien mit Endung GAME, 260 ms je Abruf, in
// Vierergruppen also rund 17 s. Der Welt-Vorrat kommt aus einer festen
// Liste der liquidesten Schwellen-Serien statt aus 2150 Politik-Serien.
//
// ZWEI ABLAGEN, damit der laufende Scanner UNBERUEHRT bleibt:
//   id=1  nur Sport-GAME-Serien   — Format wie seit v2, orion-lauf liest sie
//   id=2  Schwellen-Serien (Krypto, Indizes, Rohstoffe) — Vorrat fuer die
//         kuenftige Marktart "Schwelle"; liest heute noch niemand.

const KAL = 'https://api.elections.kalshi.com/trade-api/v2';
const FENSTER_H = 72;
const BUENDEL = 4;            // gemessen v2: 4 gleichzeitig, sonst 429
const WELT_DECKEL = 3000;

// Die liquidesten Schwellen-Serien. Bewusst eine FESTE Liste: Kalshi fuehrt
// ueber 2000 Politik-Serien, die einzeln abzufragen dauerte 8 Minuten. Diese
// hier tragen die Basisgroessen, bei denen eine Paarung ueberhaupt denkbar
// ist (gemessen am 17.8. im Bestand).
const WELT_SERIEN = [
  'KXBTCD', 'KXETHD', 'KXSOLD', 'KXXRPD', 'KXDOGE', 'KXHYPED',
  'KXINXU', 'KXNASDAQ100U', 'KXDJI', 'KXINX', 'KXNASDAQ100',
  'KXGOLDD', 'KXSILVERD', 'KXCOPPERD', 'KXWTI', 'KXBRENTD', 'KXNATGASD',
  'KXHIGHNY', 'KXHIGHCHI', 'KXHIGHLAX', 'KXHIGHMIA', 'KXHIGHAUS',
  'KXFED', 'KXCPI', 'KXU3'
];

const URL_SUPA = Deno.env.get('SUPABASE_URL')!;
const DIENST = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const schlaf = (ms: number) => new Promise(r => setTimeout(r, ms));
const zahl = (s: unknown): number | null => {
  const x = parseFloat(String(s));
  return isFinite(x) ? x : null;
};

async function hole(url: string) {
  for (let versuch = 0; versuch < 4; versuch++) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      // 429 ist kein Fehler, sondern "gleich nochmal". Wer hier aufgibt,
      // verliert stillschweigend Maerkte.
      if (r.status === 429) { await schlaf(300 * (versuch + 1)); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      if (versuch === 3) return null;
      await schlaf(250 * (versuch + 1));
    }
  }
  return null;
}

async function sportSerien(): Promise<string[]> {
  const d = await hole(`${KAL}/series?category=Sports`);
  if (!d || !Array.isArray(d.series)) return [];
  return d.series.map((s: any) => s.ticker).filter((t: string) => /GAME$/.test(t));
}

async function serieHolen(serie: string, jetzt: number, grenze: number) {
  const d = await hole(`${KAL}/markets?limit=200&status=open&series_ticker=${serie}`);
  if (!d) return { fehler: true, maerkte: [] as any[] };
  const aus: any[] = [];
  let einseitig = 0;
  for (const m of (d.markets || [])) {
    const t = Date.parse(m.close_time || '');
    if (isNaN(t) || t <= jetzt || t > grenze) continue;
    const ja = zahl(m.yes_ask_dollars);
    const nein = zahl(m.no_ask_dollars);
    // Ein Markt ohne handelbare Gegenseite ist keine Chance, sondern eine
    // halbe Zeile. 0 und 1 heissen "kein Angebot", nicht "geschenkt".
    if (ja === null || nein === null || ja <= 0 || ja >= 1 || nein <= 0 || nein >= 1) { einseitig++; continue; }
    aus.push({
      serie,
      ticker: m.ticker,
      ev: m.event_ticker,
      titel: m.title,
      jaName: m.yes_sub_title || '',
      neinName: m.no_sub_title || '',
      ja, nein,
      /* Mengen zum Briefkurs. Ohne sie ist eine Rendite nur eine Zahl:
       * wenn dort 12 Kontrakte liegen, sind auch 3 % nur ein paar Cent.
       * Fehlt sie, bleibt null — nicht 0. */
      jaMenge: zahl(m.yes_ask_size_fp),
      oi: zahl(m.open_interest_fp) || 0,
      vol: zahl(m.volume_fp) || 0,
      schliesst: m.close_time
    });
  }
  return { fehler: false, maerkte: aus, einseitig };
}

async function alleSerien(serien: string[], jetzt: number, grenze: number) {
  const alle: any[] = [];
  let fehler = 0, einseitig = 0, mitInhalt = 0;
  for (let i = 0; i < serien.length; i += BUENDEL) {
    const teil = serien.slice(i, i + BUENDEL);
    const res = await Promise.all(teil.map(s => serieHolen(s, jetzt, grenze)));
    for (const x of res) {
      if (x.fehler) { fehler++; continue; }
      einseitig += (x as any).einseitig || 0;
      if (x.maerkte.length) { mitInhalt++; alle.push(...x.maerkte); }
    }
  }
  return { alle, fehler, einseitig, mitInhalt };
}

async function ablegen(id: number, maerkte: unknown[], stats: unknown) {
  const r = await fetch(`${URL_SUPA}/rest/v1/kalshi_snapshot?id=eq.${id}`, {
    method: 'PATCH',
    headers: { apikey: DIENST, authorization: 'Bearer ' + DIENST,
               'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify({ maerkte, stats, updated_at: new Date().toISOString() })
  });
  if (!r.ok) throw new Error('Ablegen id=' + id + ' HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

Deno.serve(async () => {
  const kopf = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };
  const t0 = Date.now();
  const jetzt = Date.now();
  const grenze = jetzt + FENSTER_H * 3600000;

  try {
    const sportListe = await sportSerien();
    const sport = await alleSerien(sportListe, jetzt, grenze);
    const welt = await alleSerien(WELT_SERIEN, jetzt, grenze);

    welt.alle.sort((a, b) => b.oi - a.oi);
    const weltDeckel = welt.alle.length > WELT_DECKEL ? welt.alle.length - WELT_DECKEL : 0;
    const weltAbgelegt = welt.alle.slice(0, WELT_DECKEL);

    // Schluesselnamen wie seit v2, damit Tafel und Waechter nichts Neues
    // lernen muessen.
    const statsSport = {
      version: 4,
      serien_geprueft: sportListe.length,
      serien_mit_inhalt: sport.mitInhalt,
      fehler: sport.fehler,
      maerkte: sport.alle.length,
      mit_open_interest_50: sport.alle.filter(m => m.oi >= 50).length,
      mit_menge: sport.alle.filter(m => m.jaMenge !== null && m.jaMenge > 0).length,
      einseitig_verworfen: sport.einseitig,
      dauer_ms: Date.now() - t0
    };
    const statsWelt = {
      version: 4,
      serien_geprueft: WELT_SERIEN.length,
      serien_mit_inhalt: welt.mitInhalt,
      fehler: welt.fehler,
      maerkte: weltAbgelegt.length,
      deckel_verworfen: weltDeckel,
      mit_open_interest_50: weltAbgelegt.filter(m => m.oi >= 50).length,
      dauer_ms: Date.now() - t0
    };

    await ablegen(1, sport.alle, statsSport);
    await ablegen(2, weltAbgelegt, statsWelt);

    return new Response(JSON.stringify({ ok: true, sport: statsSport, welt: statsWelt }, null, 1),
                        { headers: kopf });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, fehler: String(e), dauer_ms: Date.now() - t0 }),
                        { status: 500, headers: kopf });
  }
});
