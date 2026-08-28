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
const DIENST = Deno.env.get('ORION_DB_KEY')
  || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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
/* Die Ausgaenge des Marktes, in derselben Reihenfolge wie clobTokenIds:
 * outcomes[0] gehoert zu tokens[0]. Gebraucht fuer den Tennis-Matchsieger,
 * dessen Ausgaenge die SPIELERNAMEN sind (kein Yes/No). */
function ausgaengeVon(m: any): string[] {
  try {
    const o = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : (m.outcomes || []);
    return Array.isArray(o) ? o.map(String) : [];
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

/* RENDITE VOR GEBUEHREN (Karams Vorgabe 23.8.2026).
 *
 * qe ist seit dem 23.8. die ROHE Effektivquote OHNE Gebuehr (1/p, q,
 * L/(L-1)) — damit ist rendite von Hand nachrechenbar: 1/q1 + 1/q2 < 1.
 * qe_netto traegt dieselbe Quote NACH Gebuehr; daraus entsteht
 * rendite_netto als eigene Spalte, zum spaeteren Abziehen. null heisst:
 * nach Gebuehr bleibt keine Quote ueber 1 uebrig. */
interface Seite {
  buch: string; richtung: 'ja' | 'nein'; qe: number; qe_netto: number | null;
  geld: number | null; roh: number;
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
    /* Rest-Topf, sichtbar: Sieger-Maerkte, deren Ausgaenge NICHT die zwei
     * erwarteten Namen sind. Stumm verwerfen waere die stille Fehlklasse. */
    let siegerOhneAusgang = 0;
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
            const art = Z.marktArt(m.question, m.groupItemTitle, bereich);
            if (!art) continue;
            /* TENNIS-MATCHSIEGER (19.8.2026): der Markt traegt keinen
             * Teilnamen; seine Ausgaenge sind die SPIELERNAMEN, und
             * outcomes[0] gehoert zu tokens[0]. Die JA-Seite ist also
             * "outcomes[0] gewinnt" — dieser Name wird als teil
             * mitgefuehrt, damit Laeuferzuordnung (laeuferZu gegen
             * Betfairs volle Spielernamen, gemessen identisch) und
             * Anzeige denselben Weg gehen wie ueberall sonst.
             * Zweite, von der Formpruefung in marktArt UNABHAENGIGE
             * Sicherung: genau zwei Namens-Ausgaenge, kein Yes/No. */
            let teil = m.groupItemTitle || null;
            if (art === 'sieger' && !teil) {
              const out = ausgaengeVon(m);
              if (out.length === 2 && !/^(yes|no)$/i.test(out[0].trim())) teil = out[0];
              else { siegerOhneAusgang++; continue; }
            }
            /* DIE STICHZEIT, gemessen am 19.8.2026 (Matrix, UEBERGABE 8l).
             *
             * Bis heute stand hier nur `endDate` -- und endDate bedeutet je
             * nach Sportart etwas voellig anderes:
             *   Fussball  endDate = Anpfiff            (brauchbar)
             *   Tennis    endDate = Anpfiff + 168 h    (Turnierende!)
             *   Baseball  teils Anpfiff, teils +168 h
             *   E-Sport   Anpfiff + 4..6 h
             *
             * Weil das 72-h-Fenster auf endDate filterte, waren von 4079
             * Tennisspielen mit Anpfiff im Fenster ALLE 4079 unsichtbar --
             * 100 % Verlust. Baseball 18,7 %, Valorant 12,2 %. Umgekehrt
             * standen 451 Wettermaerkte im Fenster, deren Ereignis gar
             * nicht dran war.
             *
             * `gameStartTime` ist der echte Anpfiff und liegt bei 17.272
             * Maerkten vor (Tennis 93,5 %, Wetter 81,9 %, Fussball 80,0 %).
             * Er zaehlt jetzt zuerst; endDate ist nur noch der Rueckfall.
             * Damit filtert das Fenster nach dem Ereignis, und die
             * Zeitsperre in pruefeSpiel vergleicht Anpfiff mit Anpfiff
             * statt Anpfiff mit Turnierende. */
            const anpfiff = Date.parse(m.gameStartTime || '');
            const endeRoh = Date.parse(m.endDate || m.endDateIso || '');
            const stich = isFinite(anpfiff) ? anpfiff : endeRoh;
            if (isNaN(stich) || stich <= jetzt || stich > grenze) continue;
            const id = String(m.id);
            if (nachId.has(id)) continue;
            jeArt[art] = (jeArt[art] || 0) + 1;
            nachId.set(id, {
              id, art, frage: m.question, teil,
              titel: ev.title, tag, ende: new Date(stich).toISOString(),
              /* getrennt mitfuehren, damit spaeter nachweisbar bleibt, ob
               * die Zeit ein echter Anpfiff war oder nur ein Rueckfall. */
              anpfiffEcht: isFinite(anpfiff),
              endeRoh: isFinite(endeRoh) ? new Date(endeRoh).toISOString() : null,
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

    /* ---------- Orderbuecher, mit MENGEN ----------
     *
     * STUECKWEISE STATT ALLES AUF EINMAL (22.8.2026, Karams Wahl).
     *
     * ANLASS: der Fussball-Lauf starb ab 21.8. 23:36 an
     * WORKER_RESOURCE_LIMIT. Alle anderen Bereiche liefen weiter in unter
     * einer Sekunde durch — Fussball ist der groesste Datensatz und der
     * einzige, der zusaetzlich Smarkets laedt. Der Cron-Job meldete dabei
     * "succeeded", weil er den Aufruf nur absetzt; die Funktion starb
     * danach. Elf Stunden ohne einen einzigen Fussball-Fund, ohne dass
     * ein Takt oder ein Fehlerzaehler es gezeigt haette.
     *
     * VORHER wurde erst eine vollstaendige Token-Liste aufgebaut
     * (alleTokens, bei Fussball ueber 2000 Eintraege), daraus je Block
     * eine Kopie mit slice() gezogen und daraus nochmal ein Array von
     * Objekten fuer den Rumpf. Drei Haltungen derselben Daten
     * nebeneinander, zusaetzlich zu den Maerkten.
     *
     * JETZT wird Block fuer Block direkt aus `maerkte` gefuellt: ein
     * Rumpf von hoechstens 250 Eintraegen lebt zur Zeit, danach ist er
     * weg. Behalten wird nur, was gebraucht wird — bester Preis und
     * Menge je Token. Das Ergebnis ist identisch, nur der Spitzenbedarf
     * faellt. */
    const preise = new Map<string, { p: number; menge: number }>();
    {
      let rumpf: { token_id: string }[] = [];

      const blockHolen = async () => {
        if (rumpf.length === 0) return;
        const r = await wiederholt('https://clob.polymarket.com/books', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(rumpf)
        });
        rumpf = [];                    // Rumpf sofort freigeben
        if (!r || !r.ok) return;
        const buecher = await r.json();
        if (!Array.isArray(buecher)) return;
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
      };

      for (const m of maerkte) {
        for (const t of m.tokens) {
          rumpf.push({ token_id: t });
          if (rumpf.length >= 250) await blockHolen();
        }
      }
      await blockHolen();              // der letzte, unvollstaendige Block
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
    /* Ab hier wird von der ROHEN Betfair-Liste nur noch die ANZAHL
     * gebraucht (Bericht unten). bfSieger und bfOu sind eigene Kopien;
     * die Rohliste daneben liegen zu lassen ist bei Fussball eine
     * vermeidbare Doppelhaltung von ueber 500 Maerkten. Zahl merken,
     * Liste freigeben. */
    const bfAnzahl = bfImFenster.length;
    bfImFenster = [];

    // ---------- Kalshi: nur Serien DIESES Bereichs ----------
    /* EGRESS-BREMSE 20.8.: vorher kam der GANZE Schnappschuss (208 KB) und
     * ~90 % flogen hier weg. Jetzt filtert die Datenbank VOR dem Versand
     * ueber denselben dritten Zuordnungsweg (orion_bereich_kalshi) — die
     * Antwort traegt dieselbe Form ([{maerkte, updated_at}]), und der
     * Filter unten bleibt als Gurt bestehen. */
    const kaAntwort = await fetch(`${URL_SUPA}/rest/v1/rpc/orion_kalshi_maerkte`, {
      method: 'POST', headers: dbKopf(), body: JSON.stringify({ bereich_p: bereich })
    });
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
      /* EGRESS-BREMSE 20.8.: gleiche Daten, aber die Quoten kommen auf
       * 6 Nachkommastellen gerundet statt mit 16 Gleitkomma-Stellen
       * (orion_sm_maerkte) — Form der Antwort unveraendert. */
      const smAntwort = await fetch(`${URL_SUPA}/rest/v1/rpc/orion_sm_maerkte`, {
        method: 'POST', headers: dbKopf(), body: '{}'
      });
      const smZeilen = smAntwort.ok ? await smAntwort.json() : [];
      const smZeile = smZeilen[0] || { maerkte: [], updated_at: null };
      smAlterS = smZeile.updated_at ? Math.round((jetzt - Date.parse(smZeile.updated_at)) / 1000) : null;
      smAlle = smZeile.maerkte || [];
    }
    const smNachArt: Record<string, any[]> = {};
    for (const m of smAlle) (smNachArt[m.art] = smNachArt[m.art] || []).push(m);
    /* Wie bei Betfair: smNachArt haelt die Maerkte bereits, die Rohliste
     * daneben ist eine Doppelhaltung von rund 900 Eintraegen — und das
     * ausgerechnet im einzigen Bereich, der ohnehin am meisten laedt.
     * Zahl merken, Liste freigeben. */
    const smAnzahl = smAlle.length;
    smAlle = [];
    const smSieger = smNachArt['sieger'] || [];
    const smHalbzeit = smNachArt['halbzeit'] || [];
    const smBtts = smNachArt['btts'] || [];

    const zeilen: any[] = [];
    const jePaarung: Record<string, number> = {};
    let mitMenge = 0;
    let bereichVerworfen = 0;
    const smGesehen = new Set<string>();
    /* Betfair-Partien, die Durchgang 1 ueber den Polymarket-Anker schon
     * verglichen hat. Durchgang 3 laesst sie aus — sonst stuende dieselbe
     * Paarung zweimal da, einmal mit PM-Schluessel und einmal direkt. */
    const bfGesehen = new Set<string>();

    /* GROSSE CHANCE, Stufe 2 (27.8.2026): Lieferalter je Boerse ZU DIESEM
     * FUND. Bisher gab es nur bf_alter_s je LAUF in orion_laeufe - also
     * eine Zahl fuer zwanzig Bereiche und tausend Zeilen. An der einzelnen
     * Zeile war nie beantwortbar, wie alt der Kurs war, auf dem sie steht.
     * Genau daran ist der Sonego-Fall vom 24.8. nicht mehr aufklaerbar.
     *
     * Die drei Zahlen sind oben schon gerechnet und stehen im selben
     * Block. Es wird NICHTS neu abgefragt und nichts langsamer.
     *
     * polymarket = 0 ist kein geschaetzter Wert: die PM-Preise holt DIESER
     * Lauf gerade selbst, sie sind Sekunden alt. Wer das genauer will,
     * muesste die Laufdauer mitrechnen - dafuer ist die Zahl hier zu grob
     * gemeint. null waere unehrlicher, denn unbekannt ist es nicht.
     *
     * Kennt eine Quelle ihr Alter nicht, bleibt es null. Nichts liest die
     * Spalten bisher, ein Fehlwert kann also nichts kippen. */
    function alterVon(buch: string): number | null {
      if (buch === 'betfair')    return bfAlterS;
      if (buch === 'kalshi')     return kaAlterS;
      if (buch === 'smarkets')   return smAlterS;
      if (buch === 'polymarket') return 0;
      return null;
    }

    function schreibe(a: Seite, b: Seite, e: any, opt: {
      schluessel: string; marktId: string; titel: string; frage: string;
      bez: string; art: string; sport: string; ende: string; zuordnung: number;
    }) {
      const paarung = KUERZEL[a.buch] + '>' + KUERZEL[b.buch];
      jePaarung[paarung] = (jePaarung[paarung] || 0) + 1;
      if (e.maxEinsatz !== null && e.maxEinsatz !== undefined) mitMenge++;

      /* Die Zahl NACH Gebuehren, als Zweitwert. e selbst ist seit dem
       * 23.8. die ROHE Rechnung (Karams Vorgabe: erst ohne Gebuehr
       * rechnen, Gebuehren spaeter abziehen). */
      const eN = (a.qe_netto !== null && b.qe_netto !== null)
        ? R.pruefe(a.qe_netto, b.qe_netto)
        : null;

      /* Der Gebuehrenbetrag braucht die NETTO-Quote (Differenz roh/netto),
       * gerechnet auf die rohe Aufteilung e.s1/e.s2. */
      const gA = R.gebuehrBetrag(a.gebuehr_form, e.s1, a.roh, a.qe_netto);
      const gB = R.gebuehrBetrag(b.gebuehr_form, e.s2, b.roh, b.qe_netto);
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
        rendite_netto: eN ? eN.rendite : null, inv_netto: eN ? eN.inv : null,
        einsatz_1: e.s1, einsatz_2: e.s2, auszahlung: e.auszahlung,
        pm_gebuehr: a.gebuehr, bf_gebuehr: b.gebuehr,
        pm_gebuehr_echt: a.gebuehr_echt, bf_gebuehr_echt: b.gebuehr_echt,
        pm_gebuehr_betrag: gA, bf_gebuehr_betrag: gB, gebuehr_gesamt: gSumme,
        pm_menge: a.geld, gegen_menge: b.geld,
        max_einsatz: e.maxEinsatz === undefined ? null : e.maxEinsatz,
        max_gewinn: e.maxGewinn === undefined ? null : e.maxGewinn,
        endet_am: opt.ende, zuletzt_gesehen: new Date().toISOString(), status: 'live',
        /* Stufe 2, siehe alterVon() oben. Reine Messung, nichts liest sie. */
        alter_1_s: alterVon(a.buch), alter_2_s: alterVon(b.buch)
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
      /* Satz 0 = ROHE Quote (1/p); der Satz selbst geht nur in qe_netto. */
      const qeJa = R.qePm(ask[0], 0);
      const qeNein = R.qePm(ask[1], 0);
      if (qeJa !== null) seiten.push({
        buch: 'polymarket', richtung: 'ja', qe: qeJa, qe_netto: R.qePm(ask[0], pmSatz),
        geld: mengen[0] * ask[0], roh: ask[0],
        gebuehr: R.gebuehrSicher(pmSatz), gebuehr_echt: pmEcht, gebuehr_form: 'anteil',
        name: bez, seite_text: istOu ? 'ÜBER' : 'JA', link: pmLink, partie: m.titel
      });
      if (qeNein !== null) seiten.push({
        buch: 'polymarket', richtung: 'nein', qe: qeNein, qe_netto: R.qePm(ask[1], pmSatz),
        geld: mengen[1] * ask[1], roh: ask[1],
        gebuehr: R.gebuehrSicher(pmSatz), gebuehr_echt: pmEcht, gebuehr_form: 'anteil',
        name: bez, seite_text: istOu ? 'UNTER' : 'NEIN', link: pmLink, partie: m.titel
      });

      // ----- Betfair (kommt bereits bereichsgefiltert aus der RPC) -----
      const bfKand = m.art === 'ueber_unter' ? Z.ouKandidaten(bfOu, ou ? ou.linie : null)
                   : (m.art === 'sieger' || m.art === 'unentschieden') ? bfSieger
                   : [];
      if (bfKand.length) {
        /* m.ende ist Polymarkets Marktende und liegt gemessen praktisch
         * auf dem Anpfiff (59 von 64 Zeilen binnen einer Stunde, Median 0).
         * Damit kann die Zeitsperre in besterTreffer greifen. */
        const tr = Z.besterTreffer(p[0], p[1], bfKand, SCHWELLE, m.ende, bereich);
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
            if (m.art === 'sieger' || m.art === 'unentschieden') bfGesehen.add(tr.bf.ev || tr.bf.k);
            const bfEigen = Z.bfSatzVon(tr.bf);
            const satz = R.ORBIT_SATZ;
            const link = brokerLink(tr.bf.link);
            const partie = tr.bf.ev || tr.bf.k;
            const qb = R.qeBack(lauf.laeufer.b, 0);
            const ql = R.qeLay(lauf.laeufer.l, 0);
            if (qb !== null) seiten.push({
              buch: 'betfair', richtung: 'ja', qe: qb, qe_netto: R.qeBack(lauf.laeufer.b, satz),
              geld: zahlOderNull(lauf.laeufer.bs),
              roh: lauf.laeufer.b, gebuehr: R.gebuehrSicher(satz), gebuehr_echt: true,
              gebuehr_form: 'back',
              name: lauf.laeufer.n, seite_text: 'Back', link, partie
            });
            if (ql !== null) {
              const ls = zahlOderNull(lauf.laeufer.ls);
              seiten.push({
                buch: 'betfair', richtung: 'nein', qe: ql, qe_netto: R.qeLay(lauf.laeufer.l, satz),
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
        /* Zeitsperre auch hier: Smarkets-Maerkte tragen ebenfalls st. */
        const tr = Z.besterTreffer(p[0], p[1], smKand as any, SCHWELLE, m.ende, bereich);
        if (tr) {
          const lauf = Z.smLaeufer(m.art, m.teil, p, (tr.bf as any).r, tr.getauscht, LAEUFER_SCHWELLE);
          if (lauf) {
            if (m.art === 'sieger' || m.art === 'unentschieden') smGesehen.add(tr.bf.ev);
            const satz = (tr.bf as any).sz;
            const echt = (tr.bf as any).sz_echt === true;
            const link = (tr.bf as any).link;
            const partie = tr.bf.ev;
            const qb = R.qeBack(lauf.laeufer.b, 0);
            const ql = R.qeLay(lauf.laeufer.l, 0);
            if (qb !== null) seiten.push({
              buch: 'smarkets', richtung: 'ja', qe: qb, qe_netto: R.qeBack(lauf.laeufer.b, satz),
              geld: zahlOderNull(lauf.laeufer.bs),
              roh: lauf.laeufer.b, gebuehr: R.gebuehrSicher(satz), gebuehr_echt: echt,
              gebuehr_form: 'back',
              name: lauf.laeufer.n, seite_text: 'Back', link, partie
            });
            if (ql !== null) {
              const ls = zahlOderNull(lauf.laeufer.ls);
              seiten.push({
                buch: 'smarkets', richtung: 'nein', qe: ql, qe_netto: R.qeLay(lauf.laeufer.l, satz),
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
            const qJa = R.qeKalshi(k.ja, 0);
            const qNein = R.qeKalshi(k.nein, 0);
            const kMenge = zahlOderNull(k.jaMenge);
            if (qJa !== null) seiten.push({
              buch: 'kalshi', richtung: 'ja', qe: qJa, qe_netto: R.qeKalshi(k.ja, kSatz),
              geld: kMenge === null ? null : kMenge * k.ja, roh: k.ja,
              gebuehr: kSatz, gebuehr_echt: true, gebuehr_form: 'kontrakt',
              name: k.jaName, seite_text: 'Ja', link, partie: k.titel
            });
            if (qNein !== null) seiten.push({
              buch: 'kalshi', richtung: 'nein', qe: qNein, qe_netto: R.qeKalshi(k.nein, kSatz),
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
    /* Die Kalshi-Liste ist oben bereits auf DIESEN Bereich gefiltert — hier
     * wird nur noch nach Partien gebuendelt. Seit dem 13.8. in JEDEM
     * Bereich (nicht mehr nur fussball): Durchgang 3 vergleicht Kalshi auch
     * direkt gegen Betfair, und das geht ueberall, wo beide etwas fuehren. */
    const kaNachPartie = new Map<string, any>();
    for (const k of kalshi) {
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
        const kSatz = R.kalshiSatzFuer(k.serie);
        const qJa = R.qeKalshi(k.ja, 0), qNein = R.qeKalshi(k.nein, 0);
        const kMenge = zahlOderNull(k.jaMenge);
        if (qJa !== null) seiten.push({
          buch: 'kalshi', richtung: 'ja', qe: qJa, qe_netto: R.qeKalshi(k.ja, kSatz),
          geld: kMenge === null ? null : kMenge * k.ja,
          roh: k.ja, gebuehr: kSatz, gebuehr_echt: true, gebuehr_form: 'kontrakt',
          name: k.jaName, seite_text: 'Ja', link: kLink, partie: k.titel
        });
        if (qNein !== null) seiten.push({
          buch: 'kalshi', richtung: 'nein', qe: qNein, qe_netto: R.qeKalshi(k.nein, kSatz),
          geld: kMenge === null ? null : kMenge * k.nein,
          roh: k.nein, gebuehr: kSatz, gebuehr_echt: true, gebuehr_form: 'kontrakt',
          name: k.jaName, seite_text: 'Nein', link: kLink, partie: k.titel
        });
        const qb = R.qeBack(v.b, 0), ql = R.qeLay(v.l, 0);
        if (qb !== null) seiten.push({
          buch: 'smarkets', richtung: 'ja', qe: qb, qe_netto: R.qeBack(v.b, smM.sz),
          geld: zahlOderNull(v.bs), roh: v.b,
          gebuehr: R.gebuehrSicher(smM.sz), gebuehr_echt: smM.sz_echt === true,
          gebuehr_form: 'back',
          name: v.n, seite_text: 'Back', link: smM.link, partie: smM.ev
        });
        if (ql !== null) {
          const ls = zahlOderNull(v.ls);
          seiten.push({
            buch: 'smarkets', richtung: 'nein', qe: ql, qe_netto: R.qeLay(v.l, smM.sz),
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

    // ========= DURCHGANG 3: Betfair DIREKT gegen Smarkets und Kalshi =========
    /* NEU 13.8.2026. Bis dahin kam Betfair NUR ueber den Polymarket-Anker
     * ins Spiel: fuehrte Polymarket eine Partie nicht, wurde Betfair dort
     * mit NIEMANDEM verglichen — obwohl Smarkets oder Kalshi dieselbe
     * Partie fuehren. Gemessen am 13.8.: alle 12 Paarungsrichtungen kamen
     * in 24 h vor, aber eben nur auf Polymarket-Partien.
     *
     * Hier laufen die uebrigen Partien: Betfair-Siegermaerkte, die
     * Durchgang 1 NICHT verglichen hat (bfGesehen), direkt gegen Smarkets
     * (nur dort, wo Smarkets ueberhaupt etwas fuehrt — Fussball) und gegen
     * Kalshi (jeder Bereich). Gepaart wird wie in Durchgang 2 ueber
     * direktPaare mit Eindeutigkeitsregel; je Ausgang wird der
     * Betfair-Laeufer ueber seiteVon bestimmt — dieselbe Frage, beide
     * Antworten, nie A-gewinnt gegen B-gewinnt. */
    const bfOffen: any[] = [];
    for (const m of bfSieger) {
      const ev = m.ev || m.k;
      if (!ev || bfGesehen.has(ev)) continue;
      const pp = Z.partieVon(m);
      if (!pp) continue;
      bfGesehen.add(ev);                       // je Partie nur EIN Markt
      const t = Date.parse(m.st || '');
      bfOffen.push({ id: ev, partie: pp, zeit: isFinite(t) ? t : null, markt: m });
    }

    function bfLaeuferFuer(m: Z.BfMarkt, partie: [string, string], seite: Z.Seite) {
      for (const r of (m.r || [])) if (Z.seiteVon(r.n, partie) === seite) return r;
      return null;
    }
    function gedreht(s: Z.Seite, tausch: boolean): Z.Seite {
      if (!tausch || !s || s === 'unentschieden') return s;
      return s === 'a' ? 'b' : 'a';
    }
    function bfSeitenFuer(m: Z.BfMarkt, r: any): Seite[] {
      const satz = R.ORBIT_SATZ;
      const link = brokerLink(m.link);
      const partie = m.ev || m.k;
      const aus: Seite[] = [];
      const qb = R.qeBack(r.b, 0), ql = R.qeLay(r.l, 0);
      if (qb !== null) aus.push({
        buch: 'betfair', richtung: 'ja', qe: qb, qe_netto: R.qeBack(r.b, satz),
        geld: zahlOderNull(r.bs), roh: r.b,
        gebuehr: R.gebuehrSicher(satz), gebuehr_echt: true, gebuehr_form: 'back',
        name: r.n, seite_text: 'Back', link, partie
      });
      if (ql !== null) {
        const ls = zahlOderNull(r.ls);
        aus.push({
          buch: 'betfair', richtung: 'nein', qe: ql, qe_netto: R.qeLay(r.l, satz),
          geld: ls === null ? null : ls * (r.l - 1), roh: r.l,
          gebuehr: R.gebuehrSicher(satz), gebuehr_echt: true, gebuehr_form: 'lay',
          name: r.n, seite_text: 'Lay', link, partie
        });
      }
      return aus;
    }

    // ----- 3a: Betfair gegen Smarkets -----
    const direktBfSm = Z.direktPaare(bfOffen, offen, SCHWELLE);
    for (const pr of direktBfSm.paare) {
      const bfM = pr.a.markt as Z.BfMarkt, smM = pr.b.markt;
      for (const bfSeite of (['a', 'b', 'unentschieden'] as Z.Seite[])) {
        const r = bfLaeuferFuer(bfM, pr.a.partie, bfSeite);
        if (!r) continue;
        const smSeite = gedreht(bfSeite, pr.getauscht);
        const typ = smSeite === 'unentschieden' ? 'DRAW' : smSeite === 'a' ? 'HOME' : 'AWAY';
        const v = (smM.r || []).find((x: any) => x.typ === typ);
        if (!v) continue;

        const seiten: Seite[] = bfSeitenFuer(bfM, r);
        const qb2 = R.qeBack(v.b, 0), ql2 = R.qeLay(v.l, 0);
        if (qb2 !== null) seiten.push({
          buch: 'smarkets', richtung: 'ja', qe: qb2, qe_netto: R.qeBack(v.b, smM.sz),
          geld: zahlOderNull(v.bs), roh: v.b,
          gebuehr: R.gebuehrSicher(smM.sz), gebuehr_echt: smM.sz_echt === true, gebuehr_form: 'back',
          name: v.n, seite_text: 'Back', link: smM.link, partie: smM.ev
        });
        if (ql2 !== null) {
          const ls2 = zahlOderNull(v.ls);
          seiten.push({
            buch: 'smarkets', richtung: 'nein', qe: ql2, qe_netto: R.qeLay(v.l, smM.sz),
            geld: ls2 === null ? null : ls2 * (v.l - 1), roh: v.l,
            gebuehr: R.gebuehrSicher(smM.sz), gebuehr_echt: smM.sz_echt === true, gebuehr_form: 'lay',
            name: v.n, seite_text: 'Lay', link: smM.link, partie: smM.ev
          });
        }

        const bez3a = bfSeite === 'unentschieden' ? 'Unentschieden' : r.n;
        for (const treffer of R.alleChancen(seiten, RAUSCH_GRENZE)) {
          const a = treffer.ja as Seite, b = treffer.nein as Seite, e = treffer.ergebnis;
          schreibe(a, b, e, {
            schluessel: KUERZEL[a.buch] + '>' + KUERZEL[b.buch] + '@' + bfM.k + '#' +
                        (bfSeite === 'unentschieden' ? 'X' : bfSeite),
            marktId: String(bfM.k), titel: pr.a.id, frage: 'Sieger (Match Odds)',
            bez: bez3a, art: bfSeite === 'unentschieden' ? 'unentschieden' : 'sieger',
            sport: bereich, ende: bfM.st || smM.st || new Date(grenze).toISOString(),
            zuordnung: pr.score
          });
        }
      }
    }

    // ----- 3b: Betfair gegen Kalshi (jeder Bereich, in dem beide etwas fuehren) -----
    const direktBfKa = Z.direktPaare(bfOffen, [...kaNachPartie.values()], SCHWELLE);
    for (const pr of direktBfKa.paare) {
      const bfM = pr.a.markt as Z.BfMarkt, kaE = pr.b;
      for (const k of kaE.ausgaenge) {
        const kSeite = Z.seiteVon(k.jaName, kaE.partie);
        if (!kSeite) continue;
        const r = bfLaeuferFuer(bfM, pr.a.partie, gedreht(kSeite, pr.getauscht));
        if (!r) continue;

        const seiten: Seite[] = bfSeitenFuer(bfM, r);
        const kLink = kalshiLink(k);
        const kSatz = R.kalshiSatzFuer(k.serie);
        const qJa = R.qeKalshi(k.ja, 0), qNein = R.qeKalshi(k.nein, 0);
        const kMenge = zahlOderNull(k.jaMenge);
        if (qJa !== null) seiten.push({
          buch: 'kalshi', richtung: 'ja', qe: qJa, qe_netto: R.qeKalshi(k.ja, kSatz),
          geld: kMenge === null ? null : kMenge * k.ja,
          roh: k.ja, gebuehr: kSatz, gebuehr_echt: true, gebuehr_form: 'kontrakt',
          name: k.jaName, seite_text: 'Ja', link: kLink, partie: k.titel
        });
        if (qNein !== null) seiten.push({
          buch: 'kalshi', richtung: 'nein', qe: qNein, qe_netto: R.qeKalshi(k.nein, kSatz),
          geld: kMenge === null ? null : kMenge * k.nein,
          roh: k.nein, gebuehr: kSatz, gebuehr_echt: true, gebuehr_form: 'kontrakt',
          name: k.jaName, seite_text: 'Nein', link: kLink, partie: k.titel
        });

        const bez3b = kSeite === 'unentschieden' ? 'Unentschieden' : r.n;
        for (const treffer of R.alleChancen(seiten, RAUSCH_GRENZE)) {
          const a = treffer.ja as Seite, b = treffer.nein as Seite, e = treffer.ergebnis;
          schreibe(a, b, e, {
            schluessel: KUERZEL[a.buch] + '>' + KUERZEL[b.buch] + '@' + bfM.k + '#' + k.ticker,
            marktId: String(k.ticker), titel: pr.a.id, frage: k.titel,
            bez: bez3b, art: kSeite === 'unentschieden' ? 'unentschieden' : 'sieger',
            sport: bereich, ende: bfM.st || new Date(grenze).toISOString(),
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
        sieger_ohne_ausgang: siegerOhneAusgang,
        kalshi_maerkte: kalshi.length, kalshi_anderer_bereich: kaAnderesFach,
        betfair_maerkte: bfAnzahl, smarkets_maerkte: smAnzahl,
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

    /* EHRLICHER GRUND, WENN EINE QUELLE GESPERRT WAR (25.8.2026).
     *
     * Seit dem 25.8. sperren die drei Markt-Funktionen an der Wurzel, wenn
     * ein Buch zu lange still steht (orion_bf_maerkte, orion_kalshi_maerkte,
     * orion_sm_maerkte; siehe supabase/frischesperre.sql). Greift so eine
     * Sperre, kommen aus dem Buch NULL Maerkte - der Lauf schreibt fuer
     * dessen Wege also nichts, und der Aufraeumer unten beendet die
     * betroffenen Live-Zeilen.
     *
     * Bis heute stand dort in JEDEM Fall 'nicht mehr gefunden'. Das ist
     * dann schlicht unwahr: es wurde gar nicht gesucht, die Quelle war
     * gesperrt. Der Unterschied ist nicht kosmetisch - bei Smarkets haengen
     * ueber die Haelfte aller Zeilen daran, bei Tennis standen am 25.8. 31
     * von 31 Live-Zeilen auf Betfair-Wegen. Das Brett waere nach EINEM Lauf
     * leer, mit einer Begruendung, die in die falsche Richtung zeigt.
     *
     * SPIEGEL: die drei Grenzen sind DIESELBEN Zahlen wie in
     * supabase/frischesperre.sql und in orion_verdacht_zusatz() Regeln 3
     * bis 5. Wer eine aendert, muss alle drei Stellen aendern. */
    const GESPERRT_AB = { betfair: 300, kalshi: 900, smarkets: 900 };
    const gesperrt: string[] = [];
    if (BETFAIR_AKTIV && bfAlterS !== null && bfAlterS > GESPERRT_AB.betfair && bfAnzahl === 0) {
      gesperrt.push('Betfair ' + Math.round(bfAlterS / 60) + ' min');
    }
    if (kaAlterS !== null && kaAlterS > GESPERRT_AB.kalshi && kalshi.length === 0) {
      gesperrt.push('Kalshi ' + Math.round(kaAlterS / 60) + ' min');
    }
    if (smAlterS !== null && smAlterS > GESPERRT_AB.smarkets && smAnzahl === 0) {
      gesperrt.push('Smarkets ' + Math.round(smAlterS / 60) + ' min');
    }
    const beendetGrund = gesperrt.length
      ? 'Quelle gesperrt, nicht gesucht: ' + gesperrt.join(', ') +
        ' ohne frische Lieferung. Die Zeile ist womoeglich noch da - ' +
        'sie liess sich in diesem Lauf nur nicht bestaetigen.'
      : 'nicht mehr gefunden';

    const beendetAntwort = await fetch(
      `${URL_SUPA}/rest/v1/orion_funde?status=eq.live&bereich=eq.${bereich}&zuletzt_gesehen=lt.${laufMarke}`, {
      method: 'PATCH', headers: { ...dbKopf(), prefer: 'return=representation' },
      body: JSON.stringify({ status: 'vorbei', vorbei_seit: new Date().toISOString(), vorbei_grund: beendetGrund })
    });
    const beendet = beendetAntwort.ok ? (await beendetAntwort.json()).length : 0;
    if (!beendetAntwort.ok) throw new Error('Aufraeumen fehlgeschlagen ' + beendetAntwort.status);

    await fetch(`${URL_SUPA}/rest/v1/orion_funde?status=eq.live&bereich=eq.${bereich}&endet_am=lt.${new Date().toISOString()}`, {
      method: 'PATCH', headers: { ...dbKopf(), prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'vorbei', vorbei_seit: new Date().toISOString(), vorbei_grund: 'Partie vorbei' })
    });

    /* Zaehlschwelle wie in der Anzeige und in orion_uebersicht: 2 %
     * (Karams Aufteilung 23.8.: unter 2 % knappes Paar, ab 2 % Chance —
     * gerechnet VOR Gebuehren). Stand hier bis dahin 3 %, waehrend die
     * Website schon 2 % zeigte — das Protokoll haette andere Zahlen
     * behauptet als die Seite. */
    const chancen = zeilen.filter(z => z.rendite >= 2.0).length;

    await fetch(`${URL_SUPA}/rest/v1/orion_laeufe`, {
      method: 'POST', headers: { ...dbKopf(), prefer: 'return=minimal' },
      body: JSON.stringify({
        bereich,
        dauer_ms: Date.now() - t0, pm_maerkte: maerkte.length,
        bf_match_odds: bfSieger.length + bfOu.length, bf_alter_s: bfAlterS,
        paare: zeilen.length, chancen_neu: chancen, chancen_live: chancen, beendet,
        /* Stufe 2 (27.8.2026): beide Zahlen wurden oben laengst gerechnet
         * und in der HTTP-Antwort zurueckgegeben - gespeichert hat sie nie
         * jemand. Damit war hinterher nicht unterscheidbar, ob ein leerer
         * Lauf nichts fand oder ob eine Quelle eingefroren stand. */
        kalshi_alter_s: kaAlterS, smarkets_alter_s: smAlterS
      })
    });

    const smJeArt: Record<string, number> = {};
    for (const k of Object.keys(smNachArt)) smJeArt[k] = smNachArt[k].length;

    return new Response(JSON.stringify({
      ok: true, bereich, dauer_ms: Date.now() - t0,
      betfair_aktiv: BETFAIR_AKTIV,
      betfair: { geladen: bfAnzahl, sieger: bfSieger.length,
                 ueber_unter: bfOu.length, alter_s: bfAlterS },
      pm_maerkte: maerkte.length, je_art: jeArt,
      sieger_ohne_ausgang: siegerOhneAusgang,
      kalshi_maerkte: kalshi.length, kalshi_alter_s: kaAlterS,
      kalshi_anderer_bereich: kaAnderesFach,
      smarkets_maerkte: smAnzahl, smarkets_alter_s: smAlterS,
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
      direkt_bf: { offene_bf_partien: bfOffen.length,
                   sm_paare: direktBfSm.paare.length, ka_paare: direktBfKa.paare.length,
                   mehrdeutig: direktBfSm.mehrdeutig + direktBfKa.mehrdeutig },
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
