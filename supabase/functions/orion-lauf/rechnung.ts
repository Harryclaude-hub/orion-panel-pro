// Spiegel von js/rechnung.js. Geprueft: pruefung/rechnung.test.js, 171 Pruefungen.
//
// ACHTUNG: Diese Datei und js/rechnung.js muessen inhaltlich gleich bleiben.
// Am 10.8.2026 waren sie es NICHT — maxEinsatz gab es nur hier. Beim naechsten
// Auseinanderlaufen faellt es wieder niemandem auf, solange es keinen
// Prüfstand gibt, der beide Fassungen gegeneinander haelt (offener Punkt 7).

export const GEBUEHR_UNBEKANNT = 0.07;
export const KALSHI_SATZ = 0.07;

/* Smarkets. Kommission auf den NETTOGEWINN JE MARKT — dieselbe Form wie bei
 * Betfair, deshalb gelten qeBack und qeLay unveraendert.
 *
 * Der Satz ist NICHT gemessen: es gibt kein Konto, und die oeffentliche API
 * gibt ihn nicht heraus. 2 % ist der dokumentierte Standard-Tarif. Daneben
 * bestehen 1 % (Pro) und 3 % (Select) — Letzterer trifft genau die besonders
 * profitablen Konten. Wer dort landet, muss hier 0.03 eintragen. */
export const SMARKETS_SATZ = 0.02;

/* Preis -> Quote. Gemessen am 10.8.2026, dreifach belegt:
 *   Quotenleiter, Kehrwertsumme (Back 101,0 % / Lay 98,7 %) und der Endpunkt
 *   last_executed_prices, der fuer 2899 den Wert "28.99" meldet.
 * Gueltig ist nur die Leiter 1,01 bis 1000. Ausserhalb liegen die Randmarken
 * 1 und 9999, hinter denen kein handelbares Volumen steht. */
export const SM_PREIS_MIN = 10;
export const SM_PREIS_MAX = 9901;
export const SM_PLATZHALTER = 2147483646;

function istZahl(x: unknown): x is number { return typeof x === 'number' && isFinite(x); }

export function smQuote(preis: unknown): number | null {
  if (!istZahl(preis)) return null;
  if (preis < SM_PREIS_MIN || preis > SM_PREIS_MAX) return null;
  return 10000 / preis;
}

/* Die API meldet quantity als AUSZAHLUNG, nicht als Einsatz: laut offiziellem
 * SDK ist "quantity = 400000" gleich 40,0000 GBP Auszahlung. Der Einsatz ist
 * Auszahlung * Wahrscheinlichkeit = quantity * price / 10^8. Wer das
 * verwechselt, liegt bei Quote 5,0 um den Faktor 5 daneben. */
export function smGeld(menge: unknown, preis: unknown): number | null {
  if (!istZahl(menge) || menge <= 0) return null;
  if (menge === SM_PLATZHALTER) return null;
  if (smQuote(preis) === null) return null;
  return (menge as number) * (preis as number) / 1e8;
}

export function gebuehrSicher(satz: unknown): number {
  if (!istZahl(satz)) return GEBUEHR_UNBEKANNT;
  if (satz < 0) return GEBUEHR_UNBEKANNT;
  if (satz >= 1) return GEBUEHR_UNBEKANNT;
  return satz;
}
export function qeBack(quote: unknown, gebuehr: unknown): number | null {
  if (!istZahl(quote) || quote <= 1) return null;
  return 1 + (quote - 1) * (1 - gebuehrSicher(gebuehr));
}
export function qeLay(layQuote: unknown, gebuehr: unknown): number | null {
  if (!istZahl(layQuote) || layQuote <= 1) return null;
  return 1 + (1 - gebuehrSicher(gebuehr)) / (layQuote - 1);
}
export function gebuehrPm(preis: unknown, satz: unknown, exponent: unknown): number | null {
  if (!istZahl(preis) || preis <= 0 || preis >= 1) return null;
  const s = gebuehrSicher(satz);
  const e = istZahl(exponent) && exponent > 0 ? exponent : 1;
  return s * Math.pow(Math.min(preis, 1 - preis), e);
}
export function qePm(preis: unknown, satz: unknown, exponent: unknown): number | null {
  if (!istZahl(preis) || preis <= 0 || preis >= 1) return null;
  const g = gebuehrPm(preis, satz, exponent);
  if (g === null) return null;
  const qe = (1 - g) / preis;
  return qe > 1 ? qe : null;
}
export function gebuehrKalshi(preis: unknown, satz?: unknown): number | null {
  if (!istZahl(preis) || preis <= 0 || preis >= 1) return null;
  const s = istZahl(satz) && satz >= 0 && satz < 1 ? satz : KALSHI_SATZ;
  return s * preis * (1 - preis);
}
export function qeKalshi(preis: unknown, satz?: unknown): number | null {
  if (!istZahl(preis) || preis <= 0 || preis >= 1) return null;
  const g = gebuehrKalshi(preis, satz);
  if (g === null) return null;
  const qe = (1 - g) / preis;
  return qe > 1 ? qe : null;
}

export interface Ergebnis {
  qe1: number; qe2: number; inv: number; istArbitrage: boolean;
  einsatz: number; s1: number; s2: number; auszahlung: number;
  gewinn: number; rendite: number;
  seite1?: string; seite2?: string;
  maxEinsatz?: number | null; maxGewinn?: number | null;
}

export function pruefe(qe1: unknown, qe2: unknown, einsatz?: number): Ergebnis | null {
  if (!istZahl(qe1) || qe1 <= 1) return null;
  if (!istZahl(qe2) || qe2 <= 1) return null;
  const inv = 1 / qe1 + 1 / qe2;
  const S = istZahl(einsatz) && einsatz > 0 ? einsatz : 100;
  const s1 = S * (1 / qe1) / inv;
  const s2 = S - s1;
  const auszahlung = S / inv;
  return { qe1, qe2, inv, istArbitrage: inv < 1, einsatz: S, s1, s2,
           auszahlung, gewinn: auszahlung - S, rendite: (1 / inv - 1) * 100 };
}

/* Wie viel Geld passt wirklich hinein? Begrenzend ist immer die duennere der
 * beiden Seiten, gemessen an ihrem ANTEIL am Gesamteinsatz. Fehlt eine der
 * Mengen, gibt es KEINE Schaetzung: null heisst "nicht bekannt", nicht
 * "unbegrenzt". */
export function maxEinsatz(e: Ergebnis, geld1: number | null, geld2: number | null): number | null {
  if (!e || !istZahl(geld1) || !istZahl(geld2)) return null;
  if (geld1 <= 0 || geld2 <= 0) return 0;
  const a1 = e.s1 / e.einsatz;
  const a2 = e.s2 / e.einsatz;
  if (!(a1 > 0) || !(a2 > 0)) return null;
  return Math.min(geld1 / a1, geld2 / a2);
}

/* ---------- Der allgemeine Weg: zwei beliebige Buecher ----------
 *
 * Eine SEITE ist ein fertig gerechnetes Angebot eines Buches. qe ist bereits
 * NACH Gebuehr — hier wird nichts mehr nachgeholt.
 *
 * Erzwungen wird:
 *   - GENAU zwei Buecher. Nicht eins, nicht drei.
 *   - JA gegen NEIN. Zweimal JA ist keine Absicherung, sondern die doppelte Wette.
 *   - Dasselbe Buch gegen sich selbst ist keine Arbitrage. */
export interface SeiteRoh { buch: string; richtung: string; qe: number; geld: number | null; }

export function chance(a: SeiteRoh, b: SeiteRoh, einsatz?: number): Ergebnis | null {
  if (!a || !b) return null;
  if (!a.buch || !b.buch) return null;
  if (a.buch === b.buch) return null;
  if (a.richtung !== 'ja' || b.richtung !== 'nein') return null;
  const e = pruefe(a.qe, b.qe, einsatz);
  if (!e) return null;
  e.seite1 = a.buch;
  e.seite2 = b.buch;
  e.maxEinsatz = maxEinsatz(e, a.geld, b.geld);
  e.maxGewinn = e.maxEinsatz === null ? null : e.maxEinsatz * e.rendite / 100;
  return e;
}

/* Alle Paarungen einer Liste von Seiten zum selben Ausgang. Aus n Buechern
 * werden bis zu n*(n-1) gerichtete Paare — jedes davon ist eine eigene
 * Anzeige, denn jede hat eigene Links, Einsaetze und Rendite. */
export function alleChancen(seiten: any[], minRendite: number | null, einsatz?: number) {
  const aus: Array<{ ja: any; nein: any; ergebnis: Ergebnis }> = [];
  if (!seiten || !seiten.length) return aus;
  for (let i = 0; i < seiten.length; i++) {
    for (let j = 0; j < seiten.length; j++) {
      if (i === j) continue;
      const e = chance(seiten[i], seiten[j], einsatz);
      if (!e) continue;
      if (istZahl(minRendite) && e.rendite < (minRendite as number)) continue;
      aus.push({ ja: seiten[i], nein: seiten[j], ergebnis: e });
    }
  }
  aus.sort((x, y) => y.ergebnis.rendite - x.ergebnis.rendite);
  return aus;
}
