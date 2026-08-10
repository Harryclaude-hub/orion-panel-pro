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
    club: 1, city: 1, united: 1, town: 1, county: 1, athletic: 1, real: 1,

    /* Weitere Vereinskuerzel. Am 10.8.2026 gemessen, warum das noetig ist:
     *
     *   Polymarket:  Cruzeiro EC vs. CR Flamengo
     *   Betfair:     Flamengo v EC Vitoria Salvador     <- ein ANDERES Spiel
     *
     * Das wurde mit Score 0,50 gepaart und meldete 16,02 % Rendite. Verbunden
     * hat die beiden allein das Kuerzel "ec" (Esporte Clube) zusammen mit
     * "flamengo" ueber Kreuz. Mit "ec" und "cr" als Stoppwoerter faellt der
     * Score auf 0,00.
     *
     * Die Schwelle anzuheben waere der falsche Eingriff gewesen: dieselbe
     * Messung zeigt richtige Paare bei 0,50 ("Independiente Medellin" gegen
     * "Ind. Medellin"), die dabei mit verloren gegangen waeren. */
    ec: 1, cr: 1, ca: 1, ad: 1, sd: 1, mh: 1, cs: 1, ks: 1,
    nk: 1, hk: 1, bk: 1, if: 1,

    /* Sportbegriffe. Am 10.8.2026 gemessen: von den vorgeschlagenen Woertern
     * kommen in 800 Namensfeldern nur "goals" und "over" ueberhaupt vor, und
     * zwar in Betfairs Over/Under-Laeufernamen.
     *
     * Sie zu filtern schliesst trotzdem eine echte Luecke, naemlich im
     * RUECKFALLWEG von partieVon: wenn `ev` einmal fehlt, wird `k` zerlegt,
     * und das lautet bei Over/Under "Under 3.5 Goals vs Over 3.5 Goals".
     * Ohne diese Stoppwoerter waeren das die Namen "under" und "over" — und
     * die passen dann auf JEDEN anderen Over/Under-Markt mit Score 1,00.
     * Mit ihnen bleibt eine leere Wortliste, und leer wird abgewiesen.
     *
     * ouLaeufer ist davon NICHT betroffen: die Funktion prueft den Laeufer
     * mit einem Ausdruck auf dem normalisierten Namen, nicht ueber woerter(). */
    goals: 1, goal: 1, points: 1, point: 1, runs: 1, sets: 1, set: 1,
    games: 1, innings: 1, corners: 1, total: 1, over: 1, under: 1
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

  /* Die PARTIE eines Betfair-Marktes, nicht seine Laeufer.
   *
   * Teuer gelernt am 9.8.2026: bei MATCH_ODDS steht in `k` die Partie
   * ("Italy vs Bahrain"), bei jedem anderen Markttyp aber stehen dort die
   * Laeufer ("Under 3.5 Goals vs Over 3.5 Goals"). Der frueher benutzte
   * Ausdruck `paar(k) || paar(ev)` faellt deshalb NIE auf `ev` zurueck:
   * `paar(k)` gelingt ja, es kommt nur Unsinn heraus. Ergebnis waren
   * 0 Paare bei 849 Polymarket- gegen 865 Betfair-Over/Under-Maerkten.
   *
   * `ev` traegt in BEIDEN Faellen die Partie. Also `ev` zuerst. */
  function partieVon(bf) {
    if (!bf) return null;
    return paar(bf.ev) || paar(bf.k);
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
      var bp = partieVon(bf);
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
  function marktArt(frage, teil) {
    var f = norm(frage);
    if (/\bwin on \d{4} \d{2} \d{2}\b/.test(f)) return 'sieger';
    if (/end in a draw/.test(f)) return 'unentschieden';
    /* Ueber/Unter zaehlt NUR, wenn es die Gesamtlinie der Partie ist.
     * "CF America O/U 1.5" ist das Torkonto EINER Mannschaft und damit
     * eine andere Frage als Betfairs OVER_UNDER_15, das fuer das Spiel gilt.
     * Deshalb muss der Teilname GENAU "O/U x.x" sein, ohne Vorsatz. */
    if (ouLinie(teil) !== null) return 'ueber_unter';
    /* Beide Mannschaften treffen. Der Teilname muss GENAU passen.
     * Gemessen am 10.8.2026 stehen im selben Ereignis, mit demselben Titel:
     *     "Both Teams to Score"                  44   <- das Endergebnis
     *     "Both Teams to Score in First Half"    44   <- ANDERE Frage
     *     "Both Teams to Score in Second Half"   44   <- ANDERE Frage
     * Sie unterscheiden sich NUR im Teilnamen. Ein Test mit Teilstring
     * haette alle drei gegen denselben Smarkets-Markt gepaart und damit
     * die Halbzeit gegen das Endergebnis gestellt — Regel 1 gebrochen,
     * mit einer Rendite, die nach etwas aussieht. */
    if (/^both teams to score$/.test(norm(teil))) return 'btts';
    return null;
  }

  /* "O/U 2.5" -> 2.5 ; alles mit Vorsatz oder Zusatz -> null */
  function ouLinie(teil) {
    var m = String(teil == null ? '' : teil).trim().match(/^O\/U\s*(\d+(?:\.\d+)?)$/i);
    return m ? parseFloat(m[1]) : null;
  }

  /* "OVER_UNDER_25" -> 2.5 */
  function bfOuLinie(mt) {
    var m = String(mt == null ? '' : mt).match(/^OVER_UNDER_(\d)(\d)$/);
    return m ? parseFloat(m[1] + '.' + m[2]) : null;
  }

  /* Nur die Betfair-Maerkte derselben Linie kommen als Gegenstueck infrage. */
  function ouKandidaten(bfListe, linie) {
    if (!bfListe || linie === null) return [];
    var aus = [];
    for (var i = 0; i < bfListe.length; i++) {
      if (bfOuLinie(bfListe[i].mt) === linie) aus.push(bfListe[i]);
    }
    return aus;
  }

  /* Polymarket fragt "Over?" mit Ja und Nein. Das Gegenstueck bei Betfair
   * ist der Over-Laeufer. Under ergibt sich als dessen Gegenseite. */
  function ouLaeufer(laeufer) {
    if (!laeufer) return null;
    for (var i = 0; i < laeufer.length; i++) {
      if (/^over\b/.test(norm(laeufer[i].n))) return { score: 1, laeufer: laeufer[i] };
    }
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

  /* ---------- Smarkets ----------
   *
   * Smarkets ist das erste Buch, das die Struktur MITLIEFERT, statt sie im
   * Namen zu verstecken:
   *   market_type   { name: 'WINNER_3_WAY' }  oder
   *                 { name: 'OVER_UNDER', param: '2.5' }
   *   contract_type { name: 'HOME' | 'DRAW' | 'AWAY' | 'OVER' | 'UNDER' }
   *
   * Bei Betfair muss die Linie aus "OVER_UNDER_25" geklaubt werden, hier
   * steht sie als Zahl da. Das ist kein Komfort, sondern weniger Ratefehler.
   */
  function smMarktArt(marktTyp) {
    if (!marktTyp || typeof marktTyp !== 'object') return null;
    if (marktTyp.name === 'WINNER_3_WAY') return { art: 'sieger', linie: null };
    if (marktTyp.name === 'BTTS') return { art: 'btts', linie: null };
    if (marktTyp.name === 'OVER_UNDER') {
      var l = parseFloat(marktTyp.param);
      if (!isFinite(l)) return null;
      return { art: 'ueber_unter', linie: l };
    }
    /* Alles andere hat noch keine Zuordnungsregel. 163 Markttypen bietet
     * Smarkets an; wer hier raet, baut Fehlpaarungen. */
    return null;
  }

  /* Den passenden Smarkets-Vertrag zu einem Polymarket-Ausgang finden.
   *
   * ZWEI WEGE, und der zweite ist ein VETO — nicht eine Pflicht:
   *
   *   STRUKTUR  Auf welcher Seite des POLYMARKET-Titels steht die
   *             Mannschaft? Dort steht ihr Name woertlich, das ist die
   *             sicherste Auskunft, die es gibt. War die Partie ueber Kreuz
   *             getroffen, wird die Seite gedreht. Dann liefert
   *             contract_type HOME/AWAY den Vertrag.
   *             Gemessen am 10.8.2026: bei 124 von 124 Spielen entspricht
   *             die Reihenfolge in "X vs Y" genau HOME/AWAY. Keine Abweichung.
   *
   *   NAME      laeuferZu wie bei Betfair, Schwelle 0,80.
   *
   * Zeigen BEIDE Wege auf einen Vertrag und es ist NICHT derselbe, wird gar
   * nicht gepaart. Ein Widerspruch ist kein Grund, sich fuer einen Weg zu
   * entscheiden, sondern einer, die Finger davon zu lassen.
   *
   * Warum der Name nicht Pflicht bleibt wie in Regel 3: er verwirft
   * gemessene 17 von 60 RICHTIGEN Paaren, weil die Buecher verschieden
   * lang benennen — "CD Nacional" gegen "Nacional da Madeira" ergibt 0,33,
   * "Minnesota United FC" gegen "Minnesota Utd" ergibt 0,50. Die zweite
   * Absicherung faellt dabei nicht weg, sie wechselt die Rolle.
   * Gemessen: 0 Widersprueche bei 60 Paaren.
   *
   * Wer zurueck auf streng will, setzt namePflicht = true. */
  function smLaeufer(art, pmTeil, pmPartie, vertraege, getauscht, schwelle, namePflicht) {
    if (!vertraege || !vertraege.length) return null;
    var grenze = typeof schwelle === 'number' ? schwelle : 0.8;

    function nachTyp(t) {
      for (var i = 0; i < vertraege.length; i++) {
        if (vertraege[i].typ === t) return vertraege[i];
      }
      return null;
    }

    /* Unentschieden und Ueber/Unter sind eindeutig ausgezeichnet.
     * Da gibt es nichts zu vergleichen und nichts zu verwechseln. */
    if (art === 'unentschieden') {
      var d = nachTyp('DRAW');
      return d ? { score: 1, laeufer: d, weg: 'struktur' } : null;
    }
    if (art === 'ueber_unter') {
      var o = nachTyp('OVER');
      return o ? { score: 1, laeufer: o, weg: 'struktur' } : null;
    }
    /* Beide Mannschaften treffen: Polymarket fragt Ja/Nein, Smarkets hat
     * die Vertraege YES und NO. Die JA-Seite ist YES. Hier gibt es keine
     * Mannschaft zuzuordnen — die Frage gilt der ganzen Partie. */
    if (art === 'btts') {
      var j = nachTyp('YES');
      return j ? { score: 1, laeufer: j, weg: 'struktur' } : null;
    }
    if (art !== 'sieger') return null;

    /* Weg 1: Struktur. */
    var struktur = null;
    var seite = seiteVon(pmTeil, pmPartie);
    if (seite === 'a' || seite === 'b') {
      var smSeite = getauscht ? (seite === 'a' ? 'b' : 'a') : seite;
      struktur = nachTyp(smSeite === 'a' ? 'HOME' : 'AWAY');
    }

    /* Weg 2: Name. */
    /* Der Namensweg darf bei einem Siegermarkt NUR auf HOME oder AWAY
     * zeigen. Ohne diese Fessel griff er den Vertrag "Yes" eines
     * BTTS-Marktes ab, weil "Yes" gegen "Yes" die Gleichheit 1,00 ergibt —
     * eine perfekte Punktzahl auf eine voellig andere Frage. */
    var perName = laeuferZu(pmTeil, vertraege, grenze);
    if (perName && perName.laeufer.typ !== 'HOME' && perName.laeufer.typ !== 'AWAY') perName = null;

    /* Widerspruch = nicht paaren. */
    if (struktur && perName && perName.laeufer !== struktur) return null;

    if (namePflicht) return perName ? { score: perName.score, laeufer: perName.laeufer, weg: 'name' } : null;
    if (struktur) return { score: perName ? perName.score : 1, laeufer: struktur, weg: perName ? 'beide' : 'struktur' };
    if (perName) return { score: perName.score, laeufer: perName.laeufer, weg: 'name' };
    return null;
  }

  /* Smarkets-Kandidaten fuer eine Ueber/Unter-Linie.
   * Gleiche Linie gegen gleiche Linie, sonst gar nicht (Regel 1). */
  function smOuKandidaten(smListe, linie) {
    var aus = [];
    if (!smListe || typeof linie !== 'number' || !isFinite(linie)) return aus;
    for (var i = 0; i < smListe.length; i++) {
      if (smListe[i].linie === linie) aus.push(smListe[i]);
    }
    return aus;
  }

  /* ---------- Kalshi ----------
   *
   * Kalshi nennt einen Markt "Cruz Azul vs New York City Winner?" und sagt
   * im Feld yes_sub_title, worauf JA sich bezieht ("New York City", "Tie").
   * Die Namen weichen zwischen den Buechern staerker ab als innerhalb eines
   * Buches: "Club Tijuana" bei Polymarket, "Tijuana de Caliente" bei Kalshi.
   * Ein direkter Namensvergleich waere hier entweder zu streng oder zu lasch.
   *
   * Deshalb wird ueber die SEITE der Partie zugeordnet: erst wird bestimmt,
   * ob ein Markt die erste Mannschaft, die zweite oder das Unentschieden
   * meint, und dann werden nur gleiche Seiten gepaart. */

  var KALSHI_ANHANG = /\s+(winner|women s|men s|to win|pro basketball|game)\b.*$/;

  function kalshiPaar(titel) {
    var s = norm(titel).split(':')[0].replace(KALSHI_ANHANG, '').trim();
    return paar(s);
  }

  /* Welche Seite der Partie meint dieser Ausgang?
   * Gibt 'a', 'b', 'unentschieden' oder null. */
  function seiteVon(ausgang, partie) {
    if (!partie) return null;
    var a = norm(ausgang);
    if (!a) return null;
    if (/\b(tie|draw)\b/.test(a)) return 'unentschieden';
    var zuA = namensgleichheit(a, partie[0]);
    var zuB = namensgleichheit(a, partie[1]);
    /* Der Ausgang muss klar zu EINER Seite gehoeren. Gleichstand heisst,
     * dass die Namen nichts hergeben, und dann wird nicht geraten. */
    if (zuA > zuB && zuA >= 0.5) return 'a';
    if (zuB > zuA && zuB >= 0.5) return 'b';
    return null;
  }

  /* Passen ein Polymarket-Markt und ein Kalshi-Markt auf denselben Ausgang?
   * getauscht = die Partien stehen bei den Buechern in umgekehrter Reihenfolge. */
  function gleicheSeite(pmSeite, kalshiSeite, getauscht) {
    if (!pmSeite || !kalshiSeite) return false;
    if (pmSeite === 'unentschieden' || kalshiSeite === 'unentschieden') {
      return pmSeite === kalshiSeite;
    }
    if (!getauscht) return pmSeite === kalshiSeite;
    return (pmSeite === 'a' && kalshiSeite === 'b') || (pmSeite === 'b' && kalshiSeite === 'a');
  }

  var api = {
    norm: norm,
    kalshiPaar: kalshiPaar,
    seiteVon: seiteVon,
    gleicheSeite: gleicheSeite,
    woerter: woerter,
    aehnlichkeit: aehnlichkeit,
    namensgleichheit: namensgleichheit,
    marktArt: marktArt,
    ouLinie: ouLinie,
    bfOuLinie: bfOuLinie,
    ouKandidaten: ouKandidaten,
    ouLaeufer: ouLaeufer,
    paar: paar,
    partieVon: partieVon,
    ohneAnhang: ohneAnhang,
    besterTreffer: besterTreffer,
    laeuferZu: laeuferZu,
    drawLaeufer: drawLaeufer,
    smMarktArt: smMarktArt,
    smLaeufer: smLaeufer,
    smOuKandidaten: smOuKandidaten
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else welt.Zuordnung = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
