/* Orion Panel — Zuordnung
 *
 * Die gefaehrlichste Stelle im ganzen Programm: Fehlpaarungen.
 * Deshalb eigenes Modul, ohne DOM, mit eigenem Pruefstand.
 *
 * Gemessene Grundlage (9.8.2026): dieser Matcher hat 193 Polymarket-Begegnungen
 * gegen 326 Betfair-MATCH_ODDS gehalten und 39 Partien sicher zugeordnet,
 * wo der alte Weg 12 fand.
 *
 * Fehlerklasse 11: reine Zahlen und Hilfsverben duerfen NIE als Namensbeleg
 * zaehlen. "200" aus "200 - 250m" traf "Bitcoin $200,000", "will" verband
 * den Cricketspieler "Will Jacks" mit "Will the Republican Party win...".
 */

(function (welt) {
  'use strict';

  var STOPP = {
    // Hilfsverben und Fuellwoerter (Fehlerklasse 11)
    will: 1, does: 1, did: 1, would: 1, shall: 1, can: 1, is: 1, are: 1, be: 1,
    the: 1, a: 1, an: 1, of: 1, and: 1, or: 1, to: 1, in: 1, on: 1, at: 1, by: 1,
    vs: 1, v: 1, win: 1, wins: 1, match: 1, game: 1,
    // Vereinsbeiwerk, das nichts unterscheidet
    fc: 1, cf: 1, sc: 1, ac: 1, afc: 1, ss: 1, as: 1, fk: 1, cd: 1, sk: 1,
    club: 1, city: 1, united: 1, town: 1, county: 1, athletic: 1, real: 1
  };

  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')   // Akzente weg
      .replace(/[.,'`’\-–—:()\/\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Bedeutungstragende Woerter eines Namens.
   * Reine Zahlen fliegen raus, Stoppwoerter fliegen raus, Einzelbuchstaben auch. */
  function woerter(s) {
    var aus = [], teile = norm(s).split(' ');
    for (var i = 0; i < teile.length; i++) {
      var w = teile[i];
      if (w.length < 2) continue;
      if (STOPP[w]) continue;
      if (/^\d+$/.test(w)) continue;
      aus.push(w);
    }
    return aus;
  }

  /* Aehnlichkeit zweier Namen: Anteil gemeinsamer Woerter am kuerzeren Namen.
   * 1.0 = jedes Wort des kuerzeren Namens kommt im laengeren vor. */
  function aehnlichkeit(a, b) {
    var A = woerter(a), B = woerter(b);
    if (!A.length || !B.length) return 0;
    var menge = {}, i;
    for (i = 0; i < B.length; i++) menge[B[i]] = 1;
    var treffer = 0, gezaehlt = {};
    for (i = 0; i < A.length; i++) {
      if (gezaehlt[A[i]]) continue;
      gezaehlt[A[i]] = 1;
      if (menge[A[i]]) treffer++;
    }
    return treffer / Math.min(A.length, B.length);
  }

  /* "A vs B" oder "A v B" in seine zwei Seiten zerlegen.
   * Betfair haengt oft " vs The Draw" an, das wird vorher abgeschnitten. */
  function paar(titel) {
    var s = norm(titel).replace(/\s+vs\s+/g, ' v ');
    s = s.replace(/\s+v\s+the draw\s*$/, '');
    var m = s.match(/^(.+?)\s+v\s+(.+)$/);
    if (!m) return null;
    var a = m[1].trim(), b = m[2].trim();
    if (!a || !b) return null;
    return [a, b];
  }

  /* Zusatzmaerkte abschneiden: Polymarket fuehrt dieselbe Partie mehrfach
   * ("... total corners", "... halftime result"). Fuer die Zuordnung zaehlt
   * die Begegnung, nicht die Marktvariante. */
  var ANHANG = /\s+(halftime result|second half result|exact score|first team to score|total corners|total goals|both teams to score|clean sheet|winning margin|correct score|double chance|draw no bet|more markets|first half|second half).*$/;
  function ohneAnhang(s) {
    return norm(s).replace(ANHANG, '').trim();
  }

  /* Eine Polymarket-Begegnung gegen eine Liste Betfair-Maerkte halten.
   * Gibt den besten Treffer zurueck oder null, wenn nichts die Schwelle schafft.
   *
   * schwelle: ab welcher Aehnlichkeit ein Paar gilt. 0.5 hat in der Messung
   * 39 richtige Partien gefunden, ohne erkennbare Fehlpaarung. */
  function besterTreffer(pmA, pmB, bfListe, schwelle) {
    var grenze = typeof schwelle === 'number' ? schwelle : 0.5;
    if (!pmA || !pmB || !bfListe || !bfListe.length) return null;

    var a = ohneAnhang(pmA), b = ohneAnhang(pmB);
    var best = null;

    for (var i = 0; i < bfListe.length; i++) {
      var bf = bfListe[i];
      var bp = paar(bf.k) || paar(bf.ev);
      if (!bp) continue;

      // beide Richtungen: Heim und Auswaerts koennen vertauscht sein
      var gerade = Math.min(aehnlichkeit(a, bp[0]), aehnlichkeit(b, bp[1]));
      var kreuz  = Math.min(aehnlichkeit(a, bp[1]), aehnlichkeit(b, bp[0]));
      var wert   = gerade > kreuz ? gerade : kreuz;

      if (!best || wert > best.score) {
        best = { score: wert, bf: bf, getauscht: kreuz > gerade };
      }
    }

    if (!best || best.score < grenze) return null;
    return best;
  }

  /* Symmetrische Namensgleichheit: Anteil gemeinsamer Woerter am LAENGEREN
   * Namen. Anders als aehnlichkeit() laesst sich das nicht dadurch austricksen,
   * dass ein Name im anderen steckt.
   *
   * Gemessener Anlass (9.8.2026): der Polymarket-Markt
   * "CSD Municipal 1 - 3 CSD Coban Imperial" (Exact Score) traf den Betfair-
   * Laeufer "CSD Municipal" mit 1.00, weil jedes Wort des kuerzeren Namens
   * im laengeren vorkam. Ergebnis waren 663 Scheinchancen mit bis zu 184 %.
   * Mit dem symmetrischen Mass sind es 0.5 statt 1.0. */
  function namensgleichheit(a, b) {
    var A = woerter(a), B = woerter(b);
    if (!A.length || !B.length) return 0;
    var menge = {}, i;
    for (i = 0; i < B.length; i++) menge[B[i]] = 1;
    var treffer = 0, gezaehlt = {};
    for (i = 0; i < A.length; i++) {
      if (gezaehlt[A[i]]) continue;
      gezaehlt[A[i]] = 1;
      if (menge[A[i]]) treffer++;
    }
    return treffer / Math.max(A.length, B.length);
  }

  /* Welche Frage stellt der Polymarket-Markt ueberhaupt?
   *
   * NUR wer dieselbe Frage stellt wie Betfair MATCH_ODDS, darf zugeordnet
   * werden. Alles andere (Exact Score, Over/Under, Spread, Halbzeit,
   * Torschuetze, First 5 Innings) ist eine ANDERE Wette und deshalb keine
   * Absicherung, auch wenn dieselben Mannschaften darin vorkommen.
   *
   * Gibt 'sieger', 'unentschieden' oder null zurueck. */
  function marktArt(frage) {
    var f = norm(frage);
    if (/\bwin on \d{4} \d{2} \d{2}\b/.test(f)) return 'sieger';
    if (/end in a draw/.test(f)) return 'unentschieden';
    return null;
  }

  /* Den passenden Betfair-Laeufer zu einem Polymarket-Namen finden.
   * Nutzt bewusst die SYMMETRISCHE Gleichheit und eine hohe Schwelle. */
  function laeuferZu(name, laeufer, schwelle) {
    var grenze = typeof schwelle === 'number' ? schwelle : 0.8;
    if (!name || !laeufer || !laeufer.length) return null;
    var best = null;
    for (var i = 0; i < laeufer.length; i++) {
      var wert = namensgleichheit(name, laeufer[i].n);
      if (!best || wert > best.score) best = { score: wert, laeufer: laeufer[i] };
    }
    if (!best || best.score < grenze) return null;
    return best;
  }

  /* Den Unentschieden-Laeufer finden. Betfair nennt ihn "The Draw". */
  function drawLaeufer(laeufer) {
    if (!laeufer) return null;
    for (var i = 0; i < laeufer.length; i++) {
      if (/\bdraw\b/.test(norm(laeufer[i].n))) return { score: 1, laeufer: laeufer[i] };
    }
    return null;
  }

  var api = {
    norm: norm,
    woerter: woerter,
    aehnlichkeit: aehnlichkeit,
    namensgleichheit: namensgleichheit,
    marktArt: marktArt,
    paar: paar,
    ohneAnhang: ohneAnhang,
    besterTreffer: besterTreffer,
    laeuferZu: laeuferZu,
    drawLaeufer: drawLaeufer
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else welt.Zuordnung = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
