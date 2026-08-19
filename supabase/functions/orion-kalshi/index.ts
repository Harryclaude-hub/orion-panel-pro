// orion-kalshi v3 — holt die oeffentlichen Kalshi-Kurse und legt sie ab.
//
// Kalshi ist eine regulierte US-Boerse, kein Buchmacher. Die Kursdaten sind
// OHNE Konto und OHNE Schluessel lesbar. Weder Anmeldung noch Heim-PC noetig.
//
// V3 (17.8.2026, des Auftraggebers Befehl "alles muss gescannt werden"):
//
// Der alte Weg fragte EINE Serie je Anfrage ab und kannte nur die Kategorie
// Sports mit Endung GAME. Gemessen: 258 Serien, 61 s. Politik allein haette
// 2150 Serien = ueber 8 Minuten — dieser Weg skaliert nicht.
//
// Der neue Weg holt ALLE offenen Maerkte, deren Schluss im 72-h-Fenster
// liegt, SEITENWEISE mit Server-Zeitfilter (max_close_ts). Gemessen am
// 17.8.: ~1000 Maerkte je Seite, ~1,1 s je Seite, ueber 12 Seiten im
// Fenster — alle Kategorien zusammen schneller als vorher nur Sport.
//
// ZWEI ABLAGEN, damit der laufende Scanner UNBERUEHRT bleibt (harte Regel:
// laufender Betrieb darf bei Updates nie brechen):
//   Zeile id=1: NUR Sport-GAME-Serien — exakt Format und Groessenordnung
//               wie bisher; orion-lauf liest sie bei jedem Lauf komplett
//               und kippte gemessen schon bei ~2700 Fremdmaerkten.
//   Zeile id=2: alle uebrigen Kategorien (Politik, Krypto, Wirtschaft,
//               Wetter, ...) — der Vorrat fuer die kommende Marktart
//               "Schwelle". Gedeckelt auf die 3000 mit dem groessten
//               Open Interest; was der Deckel verwirft, steht LAUT in
//               den stats (nichts verschwindet still).

const KAL = 'https://api.elections.kalshi.com/trade-api/v2';
const FENSTER_H = 72;
const SEITEN_DECKEL = 40;     // Schutz: mehr Seiten kann kein Fenster haben
const WELT_DECKEL = 3000;     // Zeile 2: nur die liquidesten, Rest gezaehlt

const URL_SUPA = Deno.env.get('SUPABASE_URL')!;
const DIENST = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const schlaf = (ms: number) => new Promise(r => setTimeout(r, ms));
const zahl = (s: unknown): number | null => {
  const x = parseFloat(String(s));
  return isFinite(x) ? x : null;
};

async function seiteHolen(url: string) {
  for (let versuch = 0; versuch < 4; versuch++) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      // 429 ist kein Fehler, sondern "gleich nochmal". Wer hier aufgibt,
      // verliert stillschweigend Maerkte.
      if (r.status === 429) { await schlaf(400 * (versuch + 1)); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      if (versuch === 3) throw e;
      await schlaf(300 * (versuch + 1));
    }
  }
  throw new Error('aufgegeben');
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
  const grenzeMs = jetzt + FENSTER_H * 3600000;
  const grenzeS = Math.floor(grenzeMs / 1000);

  try {
    const sport: any[] = [];
    const welt: any[] = [];
    let seiten = 0, gesehen = 0, einseitig = 0;

    let cursor = '';
    do {
      const url = KAL + '/markets?limit=1000&status=open&max_close_ts=' + grenzeS +
                  (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
      const d = await seiteHolen(url);
      seiten++;
      for (const m of (d.markets || [])) {
        gesehen++;
        const t = Date.parse(m.close_time || '');
        if (isNaN(t) || t <= jetzt || t > grenzeMs) continue;
        const ja = zahl(m.yes_ask_dollars);
        const nein = zahl(m.no_ask_dollars);
        if (ja === null || nein === null || ja <= 0 || ja >= 1 || nein <= 0 || nein >= 1) { einseitig++; continue; }
        /* Die Serie steht nicht am Markt, aber vorn im Ereignis-Schluessel:
         * KXVENFUTVEGAME-25AUG17ACAT -> KXVENFUTVEGAME. Serien-Kuerzel
         * selbst tragen keinen Bindestrich. */
        const serie = String(m.event_ticker || '').split('-')[0];
        if (!serie) continue;
        const eintrag = {
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
        };
        if (/GAME$/.test(serie)) sport.push(eintrag);
        else welt.push(eintrag);
      }
      cursor = d.cursor || '';
    } while (cursor && seiten < SEITEN_DECKEL);

    /* Zeile 2 deckeln: die liquidesten zuerst, der Rest wird GEZAEHLT. */
    welt.sort((a, b) => b.oi - a.oi);
    const weltDeckel = welt.length > WELT_DECKEL ? welt.length - WELT_DECKEL : 0;
    const weltAbgelegt = welt.slice(0, WELT_DECKEL);

    const serienVon = (liste: any[]) => {
      const s = new Set(); for (const m of liste) s.add(m.serie); return s.size;
    };

    /* Zeile 1: Schluesselnamen wie in v2, damit Tafel und Waechter nichts
     * Neues lernen muessen. */
    const statsSport = {
      version: 3,
      serien_geprueft: serienVon(sport),
      serien_mit_inhalt: serienVon(sport),
      fehler: 0,
      maerkte: sport.length,
      mit_open_interest_50: sport.filter(m => m.oi >= 50).length,
      mit_menge: sport.filter(m => m.jaMenge !== null && m.jaMenge > 0).length,
      seiten, gesehen, einseitig_verworfen: einseitig,
      dauer_ms: Date.now() - t0
    };
    const statsWelt = {
      version: 3,
      maerkte: weltAbgelegt.length,
      serien: serienVon(weltAbgelegt),
      deckel_verworfen: weltDeckel,
      mit_open_interest_50: weltAbgelegt.filter(m => m.oi >= 50).length,
      dauer_ms: Date.now() - t0
    };

    await ablegen(1, sport, statsSport);
    await ablegen(2, weltAbgelegt, statsWelt);

    return new Response(JSON.stringify({ ok: true, sport: statsSport, welt: statsWelt }, null, 1),
                        { headers: kopf });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, fehler: String(e), dauer_ms: Date.now() - t0 }),
                        { status: 500, headers: kopf });
  }
});
