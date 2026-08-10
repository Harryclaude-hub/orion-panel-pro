// Spiegel von js/zuordnung.js. Geprueft: pruefung/zuordnung.test.js, 179 Pruefungen.

const STOPP: Record<string, number> = {
  will: 1, does: 1, did: 1, would: 1, shall: 1, can: 1, is: 1, are: 1, be: 1,
  the: 1, a: 1, an: 1, of: 1, and: 1, or: 1, to: 1, in: 1, on: 1, at: 1, by: 1,
  vs: 1, v: 1, win: 1, wins: 1, match: 1, game: 1,
  fc: 1, cf: 1, sc: 1, ac: 1, afc: 1, ss: 1, as: 1, fk: 1, cd: 1, sk: 1,
  club: 1, city: 1, united: 1, town: 1, county: 1, athletic: 1, real: 1,
  /* Vereinskuerzel. Am 10.8.2026 gemessen:
   *   Polymarket:  Cruzeiro EC vs. CR Flamengo
   *   Betfair:     Flamengo v EC Vitoria Salvador   <- ein ANDERES Spiel
   * Gepaart mit 0,50, gemeldet mit 16,02 % Rendite. */
  ec: 1, cr: 1, ca: 1, ad: 1, sd: 1, mh: 1, cs: 1, ks: 1,
  nk: 1, hk: 1, bk: 1, if: 1
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

export function ouLinie(teil: unknown): number | null {
  const m = String(teil == null ? '' : teil).trim().match(/^O\/U\s*(\d+(?:\.\d+)?)$/i);
  return m ? parseFloat(m[1]) : null;
}
export function bfOuLinie(mt: unknown): number | null {
  const m = String(mt == null ? '' : mt).match(/^OVER_UNDER_(\d)(\d)$/);
  return m ? parseFloat(m[1] + '.' + m[2]) : null;
}

export type Art = 'sieger' | 'unentschieden' | 'ueber_unter' | 'btts' | null;

export function marktArt(frage: unknown, teil?: unknown): Art {
  const f = norm(frage);
  if (/\bwin on \d{4} \d{2} \d{2}\b/.test(f)) return 'sieger';
  if (/end in a draw/.test(f)) return 'unentschieden';
  if (ouLinie(teil) !== null) return 'ueber_unter';
  /* Beide Mannschaften treffen. Der Teilname muss GENAU passen.
   * Gemessen am 10.8.2026 stehen im selben Ereignis, mit demselben Titel:
   *     "Both Teams to Score"                  44   <- das Endergebnis
   *     "Both Teams to Score in First Half"    44   <- ANDERE Frage
   *     "Both Teams to Score in Second Half"   44   <- ANDERE Frage
   * Sie unterscheiden sich NUR im Teilnamen. Ein Teilstring-Test haette
   * alle drei gegen denselben Smarkets-Markt gepaart. */
  if (/^both teams to score$/.test(norm(teil))) return 'btts';
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

/* ---------- Smarkets ----------
 *
 * Smarkets ist das erste Buch, das die Struktur MITLIEFERT:
 *   market_type   { name: 'WINNER_3_WAY' } | { name: 'OVER_UNDER', param: '2.5' }
 *   contract_type { name: 'HOME' | 'DRAW' | 'AWAY' | 'OVER' | 'UNDER' }
 * Bei Betfair muss die Linie aus "OVER_UNDER_25" geklaubt werden, hier steht
 * sie als Zahl da. Das ist kein Komfort, sondern weniger Ratefehler. */
export function smMarktArt(marktTyp: any): { art: string; linie: number | null } | null {
  if (!marktTyp || typeof marktTyp !== 'object') return null;
  if (marktTyp.name === 'WINNER_3_WAY') return { art: 'sieger', linie: null };
  if (marktTyp.name === 'BTTS') return { art: 'btts', linie: null };
  if (marktTyp.name === 'OVER_UNDER') {
    const l = parseFloat(marktTyp.param);
    if (!isFinite(l)) return null;
    return { art: 'ueber_unter', linie: l };
  }
  return null;
}

/* Den passenden Smarkets-Vertrag zu einem Polymarket-Ausgang finden.
 *
 * ZWEI WEGE, und der zweite ist ein VETO — nicht eine Pflicht:
 *
 *   STRUKTUR  Auf welcher Seite des POLYMARKET-Titels steht die Mannschaft?
 *             Dort steht ihr Name woertlich. War die Partie ueber Kreuz
 *             getroffen, wird die Seite gedreht. contract_type HOME/AWAY
 *             liefert dann den Vertrag.
 *             Gemessen am 10.8.2026: bei 124 von 124 Spielen entspricht die
 *             Reihenfolge in "X vs Y" genau HOME/AWAY. Keine Abweichung.
 *   NAME      laeuferZu wie bei Betfair, Schwelle 0,80.
 *
 * Zeigen BEIDE Wege auf einen Vertrag und es ist NICHT derselbe, wird gar
 * nicht gepaart. Ein Widerspruch ist kein Grund, sich fuer einen Weg zu
 * entscheiden, sondern einer, die Finger davon zu lassen.
 *
 * Warum der Name nicht Pflicht bleibt wie in Regel 3: er verwirft gemessene
 * 17 von 60 RICHTIGEN Paaren, weil die Buecher verschieden lang benennen —
 * "CD Nacional" gegen "Nacional da Madeira" ergibt 0,33. Die zweite
 * Absicherung faellt nicht weg, sie wechselt die Rolle.
 * Gemessen: 0 Widersprueche bei 60 Paaren. */
export function smLaeufer(
  art: string, pmTeil: unknown, pmPartie: [string, string] | null,
  vertraege: any[], getauscht: boolean, schwelle = 0.8, namePflicht = false
) {
  if (!vertraege || !vertraege.length) return null;

  const nachTyp = (t: string) => {
    for (const v of vertraege) if (v.typ === t) return v;
    return null;
  };

  if (art === 'unentschieden') {
    const d = nachTyp('DRAW');
    return d ? { score: 1, laeufer: d, weg: 'struktur' } : null;
  }
  if (art === 'ueber_unter') {
    const o = nachTyp('OVER');
    return o ? { score: 1, laeufer: o, weg: 'struktur' } : null;
  }
  /* Beide Mannschaften treffen: Polymarket fragt Ja/Nein, Smarkets hat die
   * Vertraege YES und NO. Keine Mannschaft zuzuordnen — die Frage gilt der
   * ganzen Partie. */
  if (art === 'btts') {
    const j = nachTyp('YES');
    return j ? { score: 1, laeufer: j, weg: 'struktur' } : null;
  }
  if (art !== 'sieger') return null;

  let struktur: any = null;
  const seite = seiteVon(pmTeil, pmPartie);
  if (seite === 'a' || seite === 'b') {
    const smSeite = getauscht ? (seite === 'a' ? 'b' : 'a') : seite;
    struktur = nachTyp(smSeite === 'a' ? 'HOME' : 'AWAY');
  }

  /* Der Namensweg darf bei einem Siegermarkt NUR auf HOME oder AWAY zeigen.
   * Ohne diese Fessel griff er den Vertrag "Yes" eines BTTS-Marktes ab,
   * weil "Yes" gegen "Yes" die Gleichheit 1,00 ergibt — eine perfekte
   * Punktzahl auf eine voellig andere Frage. */
  let perName = laeuferZu(String(pmTeil || ''), vertraege as any, schwelle);
  if (perName && perName.laeufer.typ !== 'HOME' && perName.laeufer.typ !== 'AWAY') perName = null;

  // Widerspruch = nicht paaren.
  if (struktur && perName && perName.laeufer !== struktur) return null;

  if (namePflicht) return perName ? { score: perName.score, laeufer: perName.laeufer, weg: 'name' } : null;
  if (struktur) return { score: perName ? perName.score : 1, laeufer: struktur, weg: perName ? 'beide' : 'struktur' };
  if (perName) return { score: perName.score, laeufer: perName.laeufer, weg: 'name' };
  return null;
}

/* Gleiche Linie gegen gleiche Linie, sonst gar nicht (Regel 1). */
export function smOuKandidaten(smListe: any[], linie: number | null): any[] {
  if (!smListe || typeof linie !== 'number' || !isFinite(linie)) return [];
  return smListe.filter(m => m.linie === linie);
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
