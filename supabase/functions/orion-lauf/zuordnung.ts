// Spiegel von js/zuordnung.js. Geprueft: pruefung/zuordnung.test.js, 275 Pruefungen.
//
// ACHTUNG: Diese Datei und js/zuordnung.js muessen sich GLEICH VERHALTEN.
// Der Prüfstand pruefung/spiegel.test.js haelt beide Fassungen gegeneinander:
// gleiche Funktionen, gleiche Konstanten, gleiche Ergebnisse auf denselben
// Eingaben. Er schlaegt auch an, wenn eine Seite eine Funktion hat, die der
// anderen fehlt — genau der Fall, der am 10.8.2026 unbemerkt blieb.

const STOPP: Record<string, number> = {
  will: 1, does: 1, did: 1, would: 1, shall: 1, can: 1, is: 1, are: 1, be: 1,
  the: 1, a: 1, an: 1, of: 1, and: 1, or: 1, to: 1, in: 1, on: 1, at: 1, by: 1,
  vs: 1, v: 1, win: 1, wins: 1, match: 1, game: 1,
  fc: 1, cf: 1, sc: 1, ac: 1, afc: 1, ss: 1, as: 1, fk: 1, cd: 1, sk: 1,
  club: 1, city: 1, united: 1, town: 1, county: 1, athletic: 1, real: 1,
  al: 1, el: 1, la: 1, le: 1, los: 1, las: 1,
  de: 1, del: 1, di: 1, du: 1, do: 1, da: 1, dos: 1, das: 1,
  ec: 1, cr: 1, ca: 1, ad: 1, sd: 1, mh: 1, cs: 1, ks: 1,
  nk: 1, hk: 1, bk: 1, if: 1,
  goals: 1, goal: 1, points: 1, point: 1, runs: 1, sets: 1, set: 1,
  games: 1, innings: 1, corners: 1, total: 1, over: 1, under: 1
};

export function norm(s: unknown): string {
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[.,'`’\-–—:()\/\[\]]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
export function woerter(s: unknown): string[] {
  const aus: string[] = [];
  for (const w of norm(s).split(' ')) {
    if (w.length < 2) continue;
    if (STOPP[w]) continue;
    if (/^\d+$/.test(w)) continue;
    aus.push(w);
  }
  return aus;
}
function treffer(A: string[], B: string[]): number {
  const menge: Record<string, number> = {};
  for (const b of B) menge[b] = 1;
  let t = 0; const gezaehlt: Record<string, number> = {};
  for (const a of A) { if (gezaehlt[a]) continue; gezaehlt[a] = 1; if (menge[a]) t++; }
  return t;
}
export function aehnlichkeitW(A: string[], B: string[]): number {
  if (!A.length || !B.length) return 0;
  return treffer(A, B) / Math.min(A.length, B.length);
}
export function namensgleichheitW(A: string[], B: string[]): number {
  if (!A.length || !B.length) return 0;
  return treffer(A, B) / Math.max(A.length, B.length);
}
export function aehnlichkeit(a: unknown, b: unknown): number { return aehnlichkeitW(woerter(a), woerter(b)); }
export function namensgleichheit(a: unknown, b: unknown): number { return namensgleichheitW(woerter(a), woerter(b)); }

/* Ueber/Unter gibt es in vier Ausfuehrungen, und sie sind VERSCHIEDENE
 * Fragen. Der Teilname muss GENAU passen, mit Anker vorn und hinten.
 * Am 10.8.2026 im 72h-Fenster gemessen:
 *     "O/U 2.5"                        276   gesamtes Spiel
 *     "1st Half O/U 0.5"               138   erste Halbzeit
 *     "2nd Half O/U 0.5"               138   zweite Halbzeit
 *     "Total Corners: O/U 7.5"         259   Ecken
 *     "1st Half Total Corners: O/U"    111   ANDERE Frage, keine Regel
 *     "FK Bodo/Glimt O/U 0.5"            9   Torkonto EINER Mannschaft
 * Ohne "^" ginge "1st Half Total Corners" als Ecken des ganzen Spiels durch,
 * ohne "$" das Torkonto einer Mannschaft als Spielsumme. */
const OU_MUSTER: Array<{ art: string; muster: RegExp }> = [
  { art: 'ueber_unter',       muster: /^O\/U\s*(\d+(?:\.\d+)?)$/i },
  { art: 'hz1_ueber_unter',   muster: /^1st Half O\/U\s*(\d+(?:\.\d+)?)$/i },
  { art: 'hz2_ueber_unter',   muster: /^2nd Half O\/U\s*(\d+(?:\.\d+)?)$/i },
  { art: 'ecken_ueber_unter', muster: /^Total Corners:\s*O\/U\s*(\d+(?:\.\d+)?)$/i }
];

export function ouArt(teil: unknown): { art: string; linie: number } | null {
  const s = String(teil == null ? '' : teil).trim();
  for (const m of OU_MUSTER) {
    const t = s.match(m.muster);
    if (t) {
      const l = parseFloat(t[1]);
      if (isFinite(l)) return { art: m.art, linie: l };
    }
  }
  return null;
}

export function ouLinie(teil: unknown): number | null {
  const m = String(teil == null ? '' : teil).trim().match(/^O\/U\s*(\d+(?:\.\d+)?)$/i);
  return m ? parseFloat(m[1]) : null;
}
export function bfOuLinie(mt: unknown): number | null {
  const m = String(mt == null ? '' : mt).match(/^OVER_UNDER_(\d)(\d)$/);
  return m ? parseFloat(m[1] + '.' + m[2]) : null;
}

export type Art = string | null;

export function marktArt(frage: unknown, teil?: unknown): Art {
  const f = norm(frage);
  if (/\bwin on \d{4} \d{2} \d{2}\b/.test(f)) return 'sieger';
  if (/end in a draw/.test(f)) return 'unentschieden';
  const ou = ouArt(teil);
  if (ou) return ou.art;
  if (/^both teams to score$/.test(norm(teil))) return 'btts';
  /* HALBZEIT an der FRAGE, nicht am Teilnamen — die Teilnamen sind bei
   * Halbzeit und zweiter Halbzeit IDENTISCH (243 gegen 240 Maerkte). */
  if (/\bsecond half\b/.test(f)) return null;
  if (/\bat halftime\b/.test(f)) {
    return norm(teil) === 'draw' ? 'hz_unentschieden' : 'hz_sieger';
  }
  return null;
}

export function paar(titel: unknown): [string, string] | null {
  let s = norm(titel).replace(/\s+vs\s+/g, ' v ');
  s = s.replace(/\s+v\s+the draw\s*$/, '');
  const m = s.match(/^(.+?)\s+v\s+(.+)$/);
  if (!m) return null;
  const a = m[1].trim(), b = m[2].trim();
  if (!a || !b) return null;
  return [a, b];
}

export interface BfMarkt {
  k: string; ev: string; mt: string; st: string; link: string; sz?: number | null;
  r: Array<{ n: string; b: number; l: number; bs: number; ls: number; typ?: string }>;
}

export function partieVon(bf: BfMarkt | null): [string, string] | null {
  if (!bf) return null;
  return paar(bf.ev) || paar(bf.k);
}

const ANHANG = /\s+(halftime result|second half result|exact score|first team to score|total corners|total goals|both teams to score|clean sheet|winning margin|correct score|double chance|draw no bet|more markets|first half|second half).*$/;
export function ohneAnhang(s: unknown): string { return norm(s).replace(ANHANG, '').trim(); }

export function besterTreffer(pmA: string, pmB: string, bfListe: BfMarkt[], schwelle = 0.5) {
  if (!pmA || !pmB || !bfListe || !bfListe.length) return null;
  const A = woerter(ohneAnhang(pmA)), B = woerter(ohneAnhang(pmB));
  let best: { score: number; bf: BfMarkt; getauscht: boolean } | null = null;
  for (const bf of bfListe) {
    const bp = partieVon(bf);
    if (!bp) continue;
    const P0 = woerter(bp[0]), P1 = woerter(bp[1]);
    const gerade = Math.min(aehnlichkeitW(A, P0), aehnlichkeitW(B, P1));
    const kreuz = Math.min(aehnlichkeitW(A, P1), aehnlichkeitW(B, P0));
    const wert = Math.max(gerade, kreuz);
    if (!best || wert > best.score) best = { score: wert, bf, getauscht: kreuz > gerade };
  }
  if (!best || best.score < schwelle) return null;
  return best;
}

export function laeuferZu(name: string, laeufer: BfMarkt['r'], schwelle = 0.8) {
  if (!name || !laeufer || !laeufer.length) return null;
  let best: { score: number; laeufer: BfMarkt['r'][0] } | null = null;
  for (const l of laeufer) {
    const wert = namensgleichheit(name, l.n);
    if (!best || wert > best.score) best = { score: wert, laeufer: l };
  }
  if (!best || best.score < schwelle) return null;
  return best;
}
export function drawLaeufer(laeufer: BfMarkt['r']) {
  if (!laeufer) return null;
  for (const l of laeufer) if (/\bdraw\b/.test(norm(l.n))) return { score: 1, laeufer: l };
  return null;
}
export function ouLaeufer(laeufer: BfMarkt['r']) {
  if (!laeufer) return null;
  for (const l of laeufer) if (/^over\b/.test(norm(l.n))) return { score: 1, laeufer: l };
  return null;
}
export function ouKandidaten(bfListe: BfMarkt[], linie: number | null): BfMarkt[] {
  if (!bfListe || linie === null) return [];
  return bfListe.filter(b => bfOuLinie(b.mt) === linie);
}
export function bfSatzVon(bf: BfMarkt | null): number | null {
  if (!bf) return null;
  const x = (bf as any).sz;
  if (typeof x !== 'number' || !isFinite(x)) return null;
  if (x < 0 || x >= 1) return null;
  return x;
}

/* ---------- Smarkets ---------- */

/* Vier Ueber/Unter-Typen, EXAKT beim Namen genommen. Smarkets fuehrt daneben
 * SECOND_HALF_HOME_TEAM_OVER_UNDER (Torkonto EINER Mannschaft),
 * AWAY_CORNERS_OVER_UNDER (Ecken EINER Mannschaft) und CORNERS_HANDICAP.
 * Ein Praefix-Vergleich haette alle drei mitgenommen. */
const SM_OU_TYP: Record<string, string> = {
  OVER_UNDER: 'ueber_unter',
  FIRST_HALF_OVER_UNDER: 'hz1_ueber_unter',
  SECOND_HALF_OVER_UNDER: 'hz2_ueber_unter',
  CORNERS_OVER_UNDER: 'ecken_ueber_unter'
};

export function smMarktArt(marktTyp: any): { art: string; linie: number | null } | null {
  if (!marktTyp || typeof marktTyp !== 'object') return null;
  if (marktTyp.name === 'WINNER_3_WAY') return { art: 'sieger', linie: null };
  if (marktTyp.name === 'HALF_TIME_WINNER_3_WAY') return { art: 'halbzeit', linie: null };
  if (marktTyp.name === 'BTTS') return { art: 'btts', linie: null };
  if (Object.prototype.hasOwnProperty.call(SM_OU_TYP, marktTyp.name)) {
    const l = parseFloat(marktTyp.param);
    if (!isFinite(l)) return null;
    return { art: SM_OU_TYP[marktTyp.name], linie: l };
  }
  return null;
}

/* Struktur entscheidet, Name hat ein VETO. Bei 124 von 124 Spielen entspricht
 * "X vs Y" genau HOME/AWAY; 0 Widersprueche bei 60 Paaren. */
export function smLaeufer(
  art: string, pmTeil: unknown, pmPartie: [string, string] | null,
  vertraege: any[], getauscht: boolean, schwelle = 0.8, namePflicht = false
) {
  if (!vertraege || !vertraege.length) return null;
  const nachTyp = (t: string) => {
    for (const v of vertraege) if (v.typ === t) return v;
    return null;
  };
  if (art === 'unentschieden' || art === 'hz_unentschieden') {
    const d = nachTyp('DRAW');
    return d ? { score: 1, laeufer: d, weg: 'struktur' } : null;
  }
  /* Jede Ueber/Unter-Frage hat dieselbe Form: OVER ist die JA-Seite. */
  if (art === 'ueber_unter' || art === 'hz1_ueber_unter' ||
      art === 'hz2_ueber_unter' || art === 'ecken_ueber_unter') {
    const o = nachTyp('OVER');
    return o ? { score: 1, laeufer: o, weg: 'struktur' } : null;
  }
  if (art === 'btts') {
    const j = nachTyp('YES');
    return j ? { score: 1, laeufer: j, weg: 'struktur' } : null;
  }
  if (art !== 'sieger' && art !== 'hz_sieger') return null;

  let struktur: any = null;
  const seite = seiteVon(pmTeil, pmPartie);
  if (seite === 'a' || seite === 'b') {
    const smSeite = getauscht ? (seite === 'a' ? 'b' : 'a') : seite;
    struktur = nachTyp(smSeite === 'a' ? 'HOME' : 'AWAY');
  }

  /* Der Namensweg darf bei einem Siegermarkt NUR auf HOME oder AWAY zeigen.
   * Sonst griff er den Vertrag "Yes" eines BTTS-Marktes ab. */
  let perName = laeuferZu(String(pmTeil || ''), vertraege as any, schwelle);
  if (perName && perName.laeufer.typ !== 'HOME' && perName.laeufer.typ !== 'AWAY') perName = null;

  if (struktur && perName && perName.laeufer !== struktur) return null;

  if (namePflicht) return perName ? { score: perName.score, laeufer: perName.laeufer, weg: 'name' } : null;
  if (struktur) return { score: perName ? perName.score : 1, laeufer: struktur, weg: perName ? 'beide' : 'struktur' };
  if (perName) return { score: perName.score, laeufer: perName.laeufer, weg: 'name' };
  return null;
}

export function smOuKandidaten(smListe: any[], linie: number | null): any[] {
  if (!smListe || typeof linie !== 'number' || !isFinite(linie)) return [];
  return smListe.filter(m => m.linie === linie);
}

/* ---------- Zwei Buecher DIREKT, ohne Polymarket als Anker ----------
 *
 * Ersatz fuer den fehlenden zweiten Beleg ist die EINDEUTIGKEIT.
 * Gemessen bei 109 x 95 Vergleichen: 18 Kandidaten, 0 mehrdeutig.
 * KEIN enger Zeitfilter: Kalshis Ticker-Datum liegt bei manchen Serien bis
 * zu zwei Tage neben dem Anstoss (47 h, 48 h — beides RICHTIGE Paare). */
export const DIREKT_MAX_STUNDEN = 120;

const MONATE: Record<string, number> = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
                                         jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

export function kalshiZeit(ev: unknown): { zeit: number; genau: boolean } | null {
  const m = String(ev == null ? '' : ev).match(/-(\d{2})([A-Za-z]{3})(\d{2})(\d{4})?(?=[A-Za-z]|$)/);
  if (!m) return null;
  const mon = MONATE[m[2].toLowerCase()];
  if (mon === undefined) return null;
  const std = m[4] ? Number(m[4].slice(0, 2)) : 0;
  const min = m[4] ? Number(m[4].slice(2)) : 0;
  if (std > 23 || min > 59) return null;
  const t = Date.UTC(2000 + Number(m[1]), mon, Number(m[3]), std, min);
  return isFinite(t) ? { zeit: t, genau: !!m[4] } : null;
}

export function direktPaare(listeA: any[], listeB: any[], schwelle = 0.5, maxStunden = DIREKT_MAX_STUNDEN) {
  const fenster = maxStunden * 3600000;
  const aus = { paare: [] as any[], mehrdeutig: 0, zuWeit: 0 };
  if (!listeA || !listeB || !listeA.length || !listeB.length) return aus;

  const kand: any[] = [];
  for (const a of listeA) {
    if (!a || !a.partie) continue;
    for (const b of listeB) {
      if (!b || !b.partie) continue;
      const gerade = Math.min(aehnlichkeit(a.partie[0], b.partie[0]), aehnlichkeit(a.partie[1], b.partie[1]));
      const kreuz  = Math.min(aehnlichkeit(a.partie[0], b.partie[1]), aehnlichkeit(a.partie[1], b.partie[0]));
      const wert = Math.max(gerade, kreuz);
      if (wert < schwelle) continue;
      if (typeof a.zeit === 'number' && typeof b.zeit === 'number' &&
          isFinite(a.zeit) && isFinite(b.zeit) && Math.abs(a.zeit - b.zeit) > fenster) {
        aus.zuWeit++;
        continue;
      }
      kand.push({ a, b, score: wert, getauscht: kreuz > gerade });
    }
  }

  const zaehlA: Record<string, number> = {}, zaehlB: Record<string, number> = {};
  for (const k of kand) {
    zaehlA[k.a.id] = (zaehlA[k.a.id] || 0) + 1;
    zaehlB[k.b.id] = (zaehlB[k.b.id] || 0) + 1;
  }
  for (const k of kand) {
    if (zaehlA[k.a.id] > 1 || zaehlB[k.b.id] > 1) { aus.mehrdeutig++; continue; }
    aus.paare.push(k);
  }
  return aus;
}

/* ---------- BEREICHE: was NIE gegeneinander gepaart werden darf ----------
 *
 * Gemessen am 11.8.2026, eine live stehende Fehlpaarung mit 5,34 %:
 *
 *   Polymarket:  FSV Frankfurt 1899 vs. Eintracht Frankfurt      FUSSBALL
 *   Kalshi:      ROSSMANN Centaurs vs. Eintracht Frankfurt       LEAGUE OF LEGENDS
 *
 * Verbunden allein dadurch, dass Eintracht Frankfurt auch eine E-Sport-
 * Mannschaft hat. Die Namenspruefung kann das NICHT fangen - die Namen sind
 * ja wirklich gleich. Nur der Bereich ist ein anderer.
 *
 * Von 369 Kalshi-Maerkten waren an dem Tag 196 E-Sport (CS2, LoL, Valorant,
 * Rocket League). Sie alle wurden gegen Fussball geprueft.
 *
 * BEREICH gegen BEREICH. Wer keinen Bereich kennt, paart nicht - unbekannt
 * heisst nicht "passt schon". Dieselbe Regel wie bei der unbekannten Menge. */
const KALSHI_BEREICH: Array<{ muster: RegExp; bereich: string }> = [
  { muster: /^KX(CS2|LOL|VALORANT|RL|DOTA|OW|COD)/i,        bereich: 'esport' },
  { muster: /^KX(CLUBF|UCL|LEAGUESCUP|CONMEBOL|DIMAYOR|EPL|MLS|EFL|SERIEA|BUNDES|LALIGA|LIGUE)/i, bereich: 'fussball' },
  { muster: /^KX(NPB|KBO|LMB|MLB)/i,                        bereich: 'baseball' },
  { muster: /^KX(WNBA|NBA)/i,                               bereich: 'basketball' },
  { muster: /^KX(NFL|CFB)/i,                                bereich: 'football' },
  { muster: /^KX(ATP|WTA|TENNIS)/i,                         bereich: 'tennis' },
  { muster: /^KX(NHL|HOCKEY)/i,                             bereich: 'eishockey' }
];

const PM_BEREICH: Record<string, string> = {
  soccer: 'fussball', ucl: 'fussball',
  mlb: 'baseball', nfl: 'football', nba: 'basketball', tennis: 'tennis'
};

export function bereichKalshi(serie: unknown): string | null {
  const s = String(serie == null ? '' : serie);
  if (!s) return null;
  for (const b of KALSHI_BEREICH) if (b.muster.test(s)) return b.bereich;
  return null;
}

export function bereichPm(tag: unknown): string | null {
  const t = String(tag == null ? '' : tag).toLowerCase();
  return Object.prototype.hasOwnProperty.call(PM_BEREICH, t) ? PM_BEREICH[t] : null;
}

export function gleicherBereich(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a === b;
}

/* ---------- Kalshi ---------- */

const KALSHI_ANHANG = /\s+(winner|women s|men s|to win|pro basketball|game)\b.*$/;

export function kalshiPaar(titel: unknown): [string, string] | null {
  const s = norm(titel).split(':')[0].replace(KALSHI_ANHANG, '').trim();
  return paar(s);
}

export type Seite = 'a' | 'b' | 'unentschieden' | null;

export function seiteVon(ausgang: unknown, partie: [string, string] | null): Seite {
  if (!partie) return null;
  const a = norm(ausgang);
  if (!a) return null;
  if (/\b(tie|draw)\b/.test(a)) return 'unentschieden';
  const zuA = namensgleichheit(a, partie[0]);
  const zuB = namensgleichheit(a, partie[1]);
  if (zuA > zuB && zuA >= 0.5) return 'a';
  if (zuB > zuA && zuB >= 0.5) return 'b';
  return null;
}

export function gleicheSeite(pmSeite: Seite, kSeite: Seite, getauscht: boolean): boolean {
  if (!pmSeite || !kSeite) return false;
  if (pmSeite === 'unentschieden' || kSeite === 'unentschieden') return pmSeite === kSeite;
  if (!getauscht) return pmSeite === kSeite;
  return (pmSeite === 'a' && kSeite === 'b') || (pmSeite === 'b' && kSeite === 'a');
}

export interface KalshiEintrag { k: any; kp: [string, string]; kw0: string[]; kw1: string[]; kSeite: Seite; }

export function kalshiIndex(maerkte: any[]): Map<string, KalshiEintrag[]> {
  const index = new Map<string, KalshiEintrag[]>();
  for (const k of maerkte || []) {
    const kp = kalshiPaar(k.titel);
    if (!kp) continue;
    const kw0 = woerter(kp[0]), kw1 = woerter(kp[1]);
    const eintrag: KalshiEintrag = { k, kp, kw0, kw1, kSeite: seiteVon(k.jaName, kp) };
    for (const w of new Set([...kw0, ...kw1])) {
      let liste = index.get(w);
      if (!liste) { liste = []; index.set(w, liste); }
      liste.push(eintrag);
    }
  }
  return index;
}

export function kalshiKandidaten(index: Map<string, KalshiEintrag[]>, woerterA: string[], woerterB: string[]): KalshiEintrag[] {
  const menge = new Set<KalshiEintrag>();
  for (const w of [...woerterA, ...woerterB]) {
    const liste = index.get(w);
    if (liste) for (const e of liste) menge.add(e);
  }
  return [...menge];
}
