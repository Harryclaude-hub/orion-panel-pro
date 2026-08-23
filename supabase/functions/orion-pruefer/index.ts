// orion-pruefer — die Nachkontrolle. Serverseitig, alle 5 Minuten.
//
// SEIT 23.8.2026 IM REPO. Bis dahin lebte diese Funktion NUR in Supabase —
// genau die Drift-Falle, vor der die Uebergabe warnt. Und die Drift war
// eingetreten: die eingesetzte Fassung (v7) rechnete die Polymarket-Gebuehr
// noch mit der alten, widerlegten Formel `satz * min(p, 1-p)`, waehrend
// Scanner und Anzeige laengst `satz * p * (1-p)` rechnen (belegt aus der
// Anbieterdoku, UEBERGABE 8f). Die "unabhaengige Nachrechnung" widersprach
// damit systematisch der richtigen Rechnung.
//
// Keine KI, sondern eine Pruefliste — die Fragen sind alle entscheidbar.
//
// Vier Aufgaben:
//   1. ALTER    — was seit ueber einer Stunde nicht mehr bestaetigt wurde,
//                 wandert in den Verlauf. Keine Karteileichen.
//   2. RECHNUNG — JEDE Zeile wird neu gerechnet, auch die im Verlauf. Die
//                 Formeln stehen hier bewusst getrennt ausgeschrieben: eine
//                 Nachkontrolle, die dieselbe Zeile Code aufruft wie die
//                 Rechnung, prueft gar nichts.
//   3. LINKS    — nur fuer laufende Funde, weil jeder Aufruf Zeit kostet.
//   4. WIDERSPRUCH — eine Zeile, die als Chance gilt, deren Kehrwertsumme
//                 aber nicht unter 1 liegt, wird beanstandet.
//
// RENDITE = VOR GEBUEHREN (Karams Vorgabe 23.8.2026): die gespeicherte
// rendite ist die ROHE Rechnung (1/p, q, L/(L-1) — Kehrwertsumme unter 1).
// Nachgerechnet wird deshalb zuerst roh. Trifft stattdessen die NETTO-
// Rechnung (nach Gebuehren), ist es eine Zeile von VOR der Umstellung —
// die gilt als richtig und wird binnen 24 h ohnehin geloescht.
//
// DREI Ergebnisse, nicht zwei: richtig, falsch, ODER nicht nachrechenbar.

const URL_SUPA = Deno.env.get('SUPABASE_URL')!;
const DIENST = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX_ALTER_MIN = 60;
const SCHWELLE = 0.5;

function dbKopf() {
  return { apikey: DIENST, authorization: 'Bearer ' + DIENST, 'content-type': 'application/json' };
}

function satzOderNull(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return isFinite(n) && n >= 0 && n < 1 ? n : null;
}

// Betfair und Smarkets rechnen gleich: Kommission auf den Nettogewinn je
// Markt. Polymarket und Kalshi handeln Anteile zu einem Preis unter 1.
function istBoerse(buch: string): boolean {
  return buch === 'betfair' || buch === 'smarkets';
}

/* ROHE Quote, ohne Gebuehr — das ist seit dem 23.8. die Hauptrechnung. */
function qeRoh(buch: string, wert: number, seiteText: string): number | null {
  if (!isFinite(wert)) return null;
  if (istBoerse(buch)) {
    if (!(wert > 1)) return null;
    const legt = String(seiteText || '').toLowerCase() === 'lay';
    return legt ? 1 + 1 / (wert - 1) : wert;
  }
  if (!(wert > 0 && wert < 1)) return null;
  return 1 / wert;
}

/* NETTO-Quote, nach Gebuehr. Polymarket UND Kalshi: satz * p * (1-p) —
 * NICHT min(p, 1-p); das war der Fehler der alten Fassung. */
function qeNetto(buch: string, wert: number, satz: number, seiteText: string): number | null {
  if (!isFinite(wert)) return null;
  if (istBoerse(buch)) {
    if (!(wert > 1)) return null;
    const legt = String(seiteText || '').toLowerCase() === 'lay';
    return legt ? 1 + (1 - satz) / (wert - 1) : 1 + (wert - 1) * (1 - satz);
  }
  if (!(wert > 0 && wert < 1)) return null;
  const qe = (1 - satz * wert * (1 - wert)) / wert;
  return qe > 1 ? qe : null;
}

function renditeAus(qe1: number, qe2: number): { inv: number; rendite: number } {
  const inv = 1 / qe1 + 1 / qe2;
  return { inv, rendite: (1 / inv - 1) * 100 };
}

function nachrechnen(f: any): { ok: boolean | null; grund: string } {
  const buch1 = f.buch_1 || 'polymarket';
  const buch2 = f.buch || 'betfair';

  // Zwei Buecher, nie eines. Eine Zeile, die dasselbe Buch gegen sich selbst
  // stellt, waere keine Arbitrage, sondern ein Fehler im Scanner.
  if (buch1 === buch2) {
    return { ok: false, grund: 'beide Seiten sind dasselbe Buch (' + buch1 + ')' };
  }

  const q1 = qeRoh(buch1, Number(f.pm_preis), f.pm_seite);
  const q2 = qeRoh(buch2, Number(f.bf_quote), f.bf_seite);
  if (q1 === null || q2 === null) return { ok: false, grund: 'Preise ergeben keine gueltige Quote' };

  const roh = renditeAus(q1, q2);

  if (Math.abs(roh.rendite - Number(f.rendite)) <= 0.01) {
    if (Number(f.rendite) >= SCHWELLE && roh.inv >= 1) {
      return { ok: false, grund: 'als Chance gemeldet, Kehrwertsumme ' + roh.inv.toFixed(4) + ' liegt aber nicht unter 1' };
    }
    /* Aufteilung gegenpruefen: beide Seiten muessen gleich auszahlen. */
    const S = 100, s1 = S * (1 / q1) / roh.inv, s2 = S - s1;
    if (Math.abs(s1 * q1 - s2 * q2) > 1e-6) {
      return { ok: false, grund: 'Aufteilung zahlt nicht beidseitig gleich' };
    }
    return { ok: true, grund: buch1 + ' gegen ' + buch2 + ', roh, Kehrwertsumme ' + roh.inv.toFixed(4) };
  }

  /* Trifft roh nicht: Zeile von VOR der Umstellung? Dann muss die
   * NETTO-Rechnung treffen. */
  const satz1 = satzOderNull(f.pm_gebuehr);
  const satz2 = satzOderNull(f.bf_gebuehr);
  if (satz1 !== null && satz2 !== null) {
    const n1 = qeNetto(buch1, Number(f.pm_preis), satz1, f.pm_seite);
    const n2 = qeNetto(buch2, Number(f.bf_quote), satz2, f.bf_seite);
    if (n1 !== null && n2 !== null) {
      const netto = renditeAus(n1, n2);
      if (Math.abs(netto.rendite - Number(f.rendite)) <= 0.01) {
        return { ok: true, grund: 'Zeile von vor der Umstellung (rendite noch NACH Gebuehren), Kehrwertsumme ' + netto.inv.toFixed(4) };
      }
    }
  }

  return {
    ok: false,
    grund: 'nachgerechnet roh ' + roh.rendite.toFixed(3) + ' % statt gemeldet ' + Number(f.rendite).toFixed(3) + ' %'
  };
}

async function linkLebt(url: string, zeitLimitMs = 8000): Promise<{ ok: boolean | null; grund: string }> {
  if (!url) return { ok: false, grund: 'kein Link' };
  const ab = new AbortController();
  const uhr = setTimeout(() => ab.abort(), zeitLimitMs);
  try {
    const r = await fetch(url, {
      method: 'GET', redirect: 'follow', signal: ab.signal,
      headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/html' }
    });
    clearTimeout(uhr);
    if (r.status === 429 || r.status === 403) return { ok: null, grund: 'nicht pruefbar (' + r.status + ')' };
    if (r.status >= 200 && r.status < 400) return { ok: true, grund: String(r.status) };
    return { ok: false, grund: 'HTTP ' + r.status };
  } catch (e) {
    clearTimeout(uhr);
    const s = String(e);
    if (s.indexOf('abort') >= 0) return { ok: false, grund: 'Zeitueberschreitung' };
    return { ok: false, grund: s.slice(0, 60) };
  }
}

Deno.serve(async () => {
  const kopf = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };
  const t0 = Date.now();

  try {
    const grenze = new Date(Date.now() - MAX_ALTER_MIN * 60000).toISOString();
    const altAntwort = await fetch(
      `${URL_SUPA}/rest/v1/orion_funde?status=eq.live&zuletzt_gesehen=lt.${grenze}`, {
        method: 'PATCH', headers: { ...dbKopf(), prefer: 'return=representation' },
        body: JSON.stringify({
          status: 'vorbei', vorbei_seit: new Date().toISOString(),
          vorbei_grund: 'seit ' + MAX_ALTER_MIN + ' min nicht mehr bestaetigt'
        })
      });
    const stillgelegt = altAntwort.ok ? (await altAntwort.json()).length : 0;

    const spalten = 'schluessel,status,buch,buch_1,pm_seite,bf_seite,pm_preis,bf_quote,pm_gebuehr,bf_gebuehr,rendite,pm_link,bf_link';

    const rLive = await fetch(`${URL_SUPA}/rest/v1/orion_funde?status=eq.live&select=${spalten}&order=rendite.desc&limit=400`, { headers: dbKopf() });
    const live = rLive.ok ? await rLive.json() : [];
    const rAlt = await fetch(`${URL_SUPA}/rest/v1/orion_funde?status=eq.vorbei&select=${spalten}&order=vorbei_seit.desc&limit=600`, { headers: dbKopf() });
    const alt = rAlt.ok ? await rAlt.json() : [];

    const adressen = new Map<string, { ok: boolean | null; grund: string }>();
    const zuPruefen: string[] = [];
    for (const f of live) for (const u of [f.pm_link, f.bf_link]) {
      if (u && zuPruefen.indexOf(u) < 0) zuPruefen.push(u);
    }
    const stapel = zuPruefen.slice(0, 48);
    for (let i = 0; i < stapel.length; i += 6) {
      const teil = stapel.slice(i, i + 6);
      const res = await Promise.all(teil.map(u => linkLebt(u)));
      teil.forEach((u, j) => adressen.set(u, res[j]));
    }
    let linksOk = 0, linksTot = 0, linksUnpruefbar = 0;
    for (const [, v] of adressen) {
      if (v.ok === true) linksOk++; else if (v.ok === false) linksTot++; else linksUnpruefbar++;
    }

    const zeilen: any[] = [];
    let richtig = 0, falsch = 0, unpruefbar = 0;
    const beanstandet: any[] = [];
    const jePaarung: Record<string, number> = {};

    for (const f of live.concat(alt)) {
      const pr = nachrechnen(f);
      if (pr.ok === true) richtig++;
      else if (pr.ok === false) {
        falsch++;
        if (beanstandet.length < 10) beanstandet.push({ schluessel: f.schluessel, status: f.status, grund: pr.grund });
      } else unpruefbar++;

      if (f.status === 'live') {
        const p = (f.buch_1 || 'polymarket') + '>' + (f.buch || 'betfair');
        jePaarung[p] = (jePaarung[p] || 0) + 1;
      }

      const pm = adressen.get(f.pm_link);
      const gg = adressen.get(f.bf_link);
      zeilen.push({
        schluessel: f.schluessel,
        rechnung_ok: pr.ok,
        rechnung_grund: pr.grund.slice(0, 200),
        pm_link_ok: pm ? pm.ok : null,
        gegen_link_ok: gg ? gg.ok : null,
        link_grund: [pm ? 'Seite 1 ' + pm.grund : null, gg ? 'Seite 2 ' + gg.grund : null]
                      .filter(Boolean).join(' · ').slice(0, 200) || null,
        geprueft_am: new Date().toISOString()
      });
    }

    let geschrieben = 0;
    if (zeilen.length) {
      const w = await fetch(`${URL_SUPA}/rest/v1/rpc/orion_pruefung_schreiben`, {
        method: 'POST', headers: dbKopf(), body: JSON.stringify({ p: zeilen })
      });
      if (!w.ok) throw new Error('Zurueckschreiben ' + w.status + ' ' + (await w.text()).slice(0, 200));
      geschrieben = Number(await w.json()) || 0;
    }

    return new Response(JSON.stringify({
      ok: true, dauer_ms: Date.now() - t0,
      stillgelegt_wegen_alter: stillgelegt,
      nachgerechnet_live: live.length,
      nachgerechnet_verlauf: alt.length,
      richtig, falsch, nicht_nachrechenbar: unpruefbar,
      je_paarung_live: jePaarung,
      beanstandungen: beanstandet,
      zurueckgeschrieben: geschrieben,
      adressen_geprueft: adressen.size,
      links_ok: linksOk, links_tot: linksTot, links_nicht_pruefbar: linksUnpruefbar
    }, null, 1), { headers: kopf });

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, fehler: String(e), dauer_ms: Date.now() - t0 }),
                        { status: 500, headers: kopf });
  }
});
