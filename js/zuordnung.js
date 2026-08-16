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
    /* ARTIKEL UND NAMENSPARTIKEL. Gemessen am 11.8.2026, weil der
     * Auftraggeber eine Fehlpaarung fand, die genau daran hing:
     *
     *   Polymarket:  Al Diraiyah Saudi Club vs Al Ahli
     *   Kalshi:      Al Jazira vs Al-Ittihad          <- ANDERES Spiel,
     *                                                    zwei Tage spaeter
     *
     * Verbunden hat die beiden allein das Wort "al" - arabisch schlicht der
     * Artikel, der in halb Westasien vor jedem Vereinsnamen steht. Bei zwei
     * Namen mit je zwei Woertern ergibt EIN gemeinsames Wort exakt 0,50,
     * und die Schwelle ist 0,50. Ein einziger Treffer genuegte also.
     * Gemessen: mit "al" als Stoppwort faellt der Wert von 0,50 auf 0,00.
     *
     * Dieselbe Fehlerklasse wie "ec" bei Cruzeiro/Flamengo am 9.8. - die
     * Regel dagegen gab es, sie war nur auf europaeische Namen zugeschnitten.
     * Deshalb hier auch die romanischen Partikel, die dasselbe tun. */
    al: 1, el: 1, la: 1, le: 1, los: 1, las: 1,
    de: 1, del: 1, di: 1, du: 1, do: 1, da: 1, dos: 1, das: 1,
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
  /* Siehe zuordnung.ts: Esport-Titel auf die reine Partie kuerzen. */
  function esportRein(titel) {
    var s = norm(titel);
    s = s.replace(/^(valorant|lol|league of legends|rocket league|cs2|counter strike 2|counter strike|dota 2|dota|overwatch|call of duty)\s+/, '');
    s = s.replace(/\s+bo\d\b.*$/, '');
    return s.trim();
  }

  function paar(titel) {
    var s = esportRein(titel).replace(/\s+vs\s+/g, ' v ');
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
    var ou = ouArt(teil);
    if (ou) return ou.art;
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
    /* HALBZEIT. Unterschieden wird an der FRAGE, nicht am Teilnamen — die
     * Teilnamen sind bei Halbzeit und zweiter Halbzeit identisch:
     *   "Charlotte FC leading at halftime?"      g="Charlotte FC"   HALBZEIT
     *   "Charlotte FC vs. CF Pachuca: Draw at halftime?"  g="Draw"  HALBZEIT
     *   "Charlotte FC to win the second half?"   g="Charlotte FC"   ANDERE FRAGE
     *   "Charlotte FC vs. CF Pachuca: Second half draw?"  g="Draw"  ANDERE FRAGE
     * Am 10.8.2026 gemessen: 243 Halbzeit- gegen 240 Zweite-Halbzeit-Maerkte.
     * Wer nur den Teilnamen ansieht, wirft beide in einen Topf und stellt
     * die Pause gegen die Schlussphase — Regel 1 gebrochen. */
    if (/\bsecond half\b/.test(f)) return null;
    if (/\bat halftime\b/.test(f)) {
      return norm(teil) === 'draw' ? 'hz_unentschieden' : 'hz_sieger';
    }
    /* ESPORT-MATCH — siehe zuordnung.ts: nur "Match Winner" MIT (BOx). */
    if (norm(teil) === 'match winner' && /\bbo\d\b/.test(f)) return 'sieger';
    return null;
  }

  /* "O/U 2.5" -> 2.5 ; alles mit Vorsatz oder Zusatz -> null */
  function ouLinie(teil) {
    var m = String(teil == null ? '' : teil).trim().match(/^O\/U\s*(\d+(?:\.\d+)?)$/i);
    return m ? parseFloat(m[1]) : null;
  }

  /* "OVER_UNDER_25" -> 2.5 */
  /* Ueber/Unter gibt es in vier Ausfuehrungen, und sie sind VERSCHIEDENE
   * Fragen. Der Teilname muss deshalb GENAU passen, mit Anker vorn und
   * hinten. Am 10.8.2026 gemessen, was Polymarket im 72h-Fenster fuehrt:
   *
   *     "O/U 2.5"                        276  gesamtes Spiel   -> genutzt
   *     "1st Half O/U 0.5"               138  erste Halbzeit   -> NEU
   *     "2nd Half O/U 0.5"               138  zweite Halbzeit  -> NEU
   *     "Total Corners: O/U 7.5"         259  Ecken            -> NEU
   *     "1st Half Total Corners: O/U"    111  Ecken 1. Halbzeit -> keine Regel
   *     "2nd Half Total Corners: O/U"    111  Ecken 2. Halbzeit -> keine Regel
   *     "FK Bodo/Glimt O/U 0.5"            9  Torkonto EINER Mannschaft
   *
   * Die Anker sind der ganze Schutz: ohne "^" wuerde "1st Half Total
   * Corners: O/U 3.5" als Ecken-Markt des GANZEN Spiels durchgehen, und
   * ohne "$" wuerde das Torkonto einer Mannschaft als Spielsumme gelten.
   * Beides waere ein Bruch von Regel 1 mit einer Rendite, die echt aussieht. */
  var OU_MUSTER = [
    { art: 'ueber_unter',       muster: /^O\/U\s*(\d+(?:\.\d+)?)$/i },
    { art: 'hz1_ueber_unter',   muster: /^1st Half O\/U\s*(\d+(?:\.\d+)?)$/i },
    { art: 'hz2_ueber_unter',   muster: /^2nd Half O\/U\s*(\d+(?:\.\d+)?)$/i },
    { art: 'ecken_ueber_unter', muster: /^Total Corners:\s*O\/U\s*(\d+(?:\.\d+)?)$/i }
  ];

  function ouArt(teil) {
    var s = String(teil == null ? '' : teil).trim();
    for (var i = 0; i < OU_MUSTER.length; i++) {
      var m = s.match(OU_MUSTER[i].muster);
      if (m) {
        var l = parseFloat(m[1]);
        if (isFinite(l)) return { art: OU_MUSTER[i].art, linie: l };
      }
    }
    return null;
  }

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
    if (marktTyp.name === 'HALF_TIME_WINNER_3_WAY') return { art: 'halbzeit', linie: null };
    /* Vier Ueber/Unter-Typen, exakt beim Namen genommen. Smarkets fuehrt
     * daneben SECOND_HALF_HOME_TEAM_OVER_UNDER und
     * SECOND_HALF_AWAY_TEAM_OVER_UNDER — das ist das Torkonto EINER
     * Mannschaft und damit eine andere Frage. Ein Praefix-Vergleich haette
     * sie mitgenommen. */
    var OU_TYP = {
      OVER_UNDER: 'ueber_unter',
      FIRST_HALF_OVER_UNDER: 'hz1_ueber_unter',
      SECOND_HALF_OVER_UNDER: 'hz2_ueber_unter',
      CORNERS_OVER_UNDER: 'ecken_ueber_unter'
    };
    if (Object.prototype.hasOwnProperty.call(OU_TYP, marktTyp.name)) {
      var l = parseFloat(marktTyp.param);
      if (!isFinite(l)) return null;
      return { art: OU_TYP[marktTyp.name], linie: l };
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
    /* Jede Ueber/Unter-Frage hat dieselbe Form: OVER ist die JA-Seite,
     * UNDER ergibt sich als Gegenseite. Gilt fuer Spiel, Halbzeiten und
     * Ecken gleichermassen. */
    if (art === 'ueber_unter' || art === 'hz1_ueber_unter' ||
        art === 'hz2_ueber_unter' || art === 'ecken_ueber_unter') {
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
    if (art === 'hz_unentschieden') {
      var hd = nachTyp('DRAW');
      return hd ? { score: 1, laeufer: hd, weg: 'struktur' } : null;
    }
    /* Halbzeit-Sieger ist strukturell dasselbe wie der Endergebnis-Sieger:
     * HOME/DRAW/AWAY, gemessen an 33 Maerkten. Deshalb faellt er unten in
     * denselben Zweig. */
    if (art !== 'sieger' && art !== 'hz_sieger') return null;

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

  /* ---------- Zwei Buecher DIREKT, ohne Polymarket als Anker ----------
   *
   * Bis zum 10.8.2026 lief der Scanner ueber die Polymarket-Maerkte und
   * suchte zu jedem ein Gegenstueck. Was Polymarket nicht fuehrt, gab es
   * nicht. Gemessen: von 110 Smarkets-Partien waren 78 unsichtbar, von 225
   * Kalshi-Partien 204, und von 21 gemeinsamen Partien wurden 14 nie
   * gepaart — zwei Drittel.
   *
   * Die Gefahr dabei ist die Fehlpaarung. Bei Polymarket als Anker gab es
   * immer zwei Belege; hier faellt einer weg. Als Ersatz dient die
   * EINDEUTIGKEIT:
   *
   *   Trifft eine Partie mehr als eine auf der Gegenseite — oder wird sie
   *   selbst von mehr als einer getroffen — wird GAR NICHT gepaart.
   *
   * Das ist strenger als "nimm den besten Treffer". Der beste Treffer waere
   * genau der Griff, aus dem am 9.8. die 16,02-%-Fehlpaarung entstand
   * (Cruzeiro/Flamengo). Gemessen bei 109 x 95 Vergleichen: 18 Kandidaten,
   * 0 mehrdeutig auf beiden Seiten.
   *
   * Warum KEIN enger Zeitfilter, obwohl beide Buecher Zeiten liefern:
   * gemessen liegt Kalshis Ticker-Datum bei manchen Serien bis zu zwei Tage
   * neben dem Anstoss.
   *     Ind. Medellin vs Millonarios   Namensgleichheit 1,00   47 h Abstand
   *     Union Santa Fe vs Central Cba  Namensgleichheit 1,00   48 h Abstand
   * Beides sind RICHTIGE Paare. Ein enger Filter haette sie verworfen. Die
   * Zeitschranke ist deshalb grob und wehrt nur Absurdes ab. */
  var DIREKT_MAX_STUNDEN = 120;   // fuenf Tage

  /* Kalshi kodiert Datum und manchmal die Uhrzeit im Ereignis-Ticker:
   *   KXEFLCUPGAME-26AUG10PAEXC     -> 2026-08-10, ohne Uhrzeit
   *   KXLOLGAME-26AUG110400DNFHLE   -> 2026-08-11 04:00
   * Nach dem Tag folgen entweder vier Ziffern (Uhrzeit) oder Buchstaben.
   * `schliesst` taugt NICHT als Ersatz: das ist ein gerundeter Marktschluss,
   * gemessen bis 54 h nach dem Anstoss. */
  var MONATE = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
                 jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

  function kalshiZeit(ev) {
    var m = String(ev == null ? '' : ev).match(/-(\d{2})([A-Za-z]{3})(\d{2})(\d{4})?(?=[A-Za-z]|$)/);
    if (!m) return null;
    var mon = MONATE[m[2].toLowerCase()];
    if (mon === undefined) return null;
    var std = m[4] ? Number(m[4].slice(0, 2)) : 0;
    var min = m[4] ? Number(m[4].slice(2)) : 0;
    if (std > 23 || min > 59) return null;
    var t = Date.UTC(2000 + Number(m[1]), mon, Number(m[3]), std, min);
    return isFinite(t) ? { zeit: t, genau: !!m[4] } : null;
  }

  /* Zwei Listen von Partien gegeneinander. Jeder Eintrag braucht:
   *     { id: eindeutig, partie: [a, b], zeit: ms oder null }
   * Zurueck kommen NUR eindeutige Paare. */
  function direktPaare(listeA, listeB, schwelle, maxStunden) {
    var grenze = typeof schwelle === 'number' ? schwelle : 0.5;
    var fenster = (typeof maxStunden === 'number' ? maxStunden : DIREKT_MAX_STUNDEN) * 3600000;
    var aus = { paare: [], mehrdeutig: 0, zuWeit: 0 };
    if (!listeA || !listeB || !listeA.length || !listeB.length) return aus;

    var kand = [];
    for (var i = 0; i < listeA.length; i++) {
      var a = listeA[i];
      if (!a || !a.partie) continue;
      for (var j = 0; j < listeB.length; j++) {
        var b = listeB[j];
        if (!b || !b.partie) continue;
        var gerade = Math.min(aehnlichkeit(a.partie[0], b.partie[0]), aehnlichkeit(a.partie[1], b.partie[1]));
        var kreuz  = Math.min(aehnlichkeit(a.partie[0], b.partie[1]), aehnlichkeit(a.partie[1], b.partie[0]));
        var wert = Math.max(gerade, kreuz);
        if (wert < grenze) continue;
        /* Zeit nur pruefen, wenn BEIDE eine haben. Fehlende Zeit ist kein
         * Grund abzuweisen — sie ist unbekannt, nicht falsch. */
        if (typeof a.zeit === 'number' && typeof b.zeit === 'number' &&
            isFinite(a.zeit) && isFinite(b.zeit) && Math.abs(a.zeit - b.zeit) > fenster) {
          aus.zuWeit++;
          continue;
        }
        kand.push({ a: a, b: b, score: wert, getauscht: kreuz > gerade });
      }
    }

    /* Eindeutigkeit auf BEIDEN Seiten. */
    var zaehlA = {}, zaehlB = {};
    for (var k = 0; k < kand.length; k++) {
      zaehlA[kand[k].a.id] = (zaehlA[kand[k].a.id] || 0) + 1;
      zaehlB[kand[k].b.id] = (zaehlB[kand[k].b.id] || 0) + 1;
    }
    for (var n = 0; n < kand.length; n++) {
      if (zaehlA[kand[n].a.id] > 1 || zaehlB[kand[n].b.id] > 1) { aus.mehrdeutig++; continue; }
      aus.paare.push(kand[n]);
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
   * Mannschaft hat. Die Namensprüfung kann das NICHT fangen — die Namen sind
   * ja wirklich gleich. Nur der Bereich ist ein anderer.
   *
   * Von 369 Kalshi-Maerkten waren an dem Tag 196 E-Sport (CS2, LoL, Valorant,
   * Rocket League). Sie alle wurden gegen Fussball geprueft.
   *
   * Deshalb: BEREICH gegen BEREICH. Wer keinen Bereich kennt, paart nicht —
   * unbekannt heisst nicht "passt schon". Das ist dieselbe Regel wie bei der
   * unbekannten Menge und beim Widerspruch zweier Wege. */

  /* Kalshi verraet den Bereich im Serien-Ticker. Gemessen an den Serien, die
   * im Schnappschuss tatsaechlich vorkommen — nachgemessen am 11.8.2026
   * abends: dazugekommen sind KXR6GAME (Rainbow Six), KXARGPREMDIVGAME und
   * KXBRASILEIROBGAME (beides Fussball).
   *
   * SEIT DEM BEREICHS-SCANNER feiner: League of Legends und Valorant sind
   * EIGENE Bereiche (wie im Register orion_bereiche), nicht mehr Teil des
   * Sammelbereichs esport. Die spezifischen Muster stehen VOR dem
   * Sammelmuster — die erste Uebereinstimmung gewinnt. */
  var KALSHI_BEREICH = [
    { muster: /^KX(LOL)/i,                                    bereich: 'lol' },
    { muster: /^KX(VALORANT)/i,                               bereich: 'valorant' },
    { muster: /^KX(CS2|RL|DOTA|OW|COD|R6)/i,                  bereich: 'esport' },
    { muster: /^KX(CLUBF|UCL|LEAGUESCUP|CONMEBOL|DIMAYOR|EPL|MLS|EFL|SERIEA|BUNDES|LALIGA|LIGUE|ARGPREMDIV|BRASILEIRO)/i, bereich: 'fussball' },
    { muster: /^KX(NPB|KBO|LMB|MLB)/i,                        bereich: 'baseball' },
    { muster: /^KX(WNBA|NBA)/i,                               bereich: 'basketball' },
    { muster: /^KX(NFL|CFB)/i,                                bereich: 'football' },
    { muster: /^KX(ATP|WTA|TENNIS)/i,                         bereich: 'tennis' },
    { muster: /^KX(NHL|HOCKEY)/i,                             bereich: 'eishockey' }
  ];

  /* Polymarket liefert den Bereich als Tag mit. QUELLE ist das Register
   * orion_bereiche (Spalte pm_tags) — wer dort einen Tag aendert, zieht
   * diese Karte in BEIDEN Spiegeln nach, sonst paart der betroffene
   * Bereich bei Kalshi nicht mehr. */
  var PM_BEREICH = {
    soccer: 'fussball', ucl: 'fussball',
    mlb: 'baseball', nfl: 'football', cfb: 'football', nba: 'basketball',
    tennis: 'tennis', nhl: 'eishockey', golf: 'golf', cricket: 'cricket',
    mma: 'mma', f1: 'motorsport',
    lol: 'lol', valorant: 'valorant', esports: 'esport',
    'league-of-legends': 'lol', 'rocket-league': 'esport',
    cs2: 'esport', 'counter-strike': 'esport', dota: 'esport',
    politics: 'politik', elections: 'politik', geopolitics: 'politik',
    crypto: 'krypto', bitcoin: 'krypto', ethereum: 'krypto',
    economics: 'wirtschaft', inflation: 'wirtschaft', fed: 'wirtschaft',
    world: 'welt', weather: 'wetter',
    tech: 'tech', ai: 'tech', science: 'tech',
    'pop-culture': 'kultur'
  };

  function bereichKalshi(serie) {
    var s = String(serie == null ? '' : serie);
    if (!s) return null;
    for (var i = 0; i < KALSHI_BEREICH.length; i++) {
      if (KALSHI_BEREICH[i].muster.test(s)) return KALSHI_BEREICH[i].bereich;
    }
    return null;                       // unbekannt -> wird nicht gepaart
  }

  function bereichPm(tag) {
    var t = String(tag == null ? '' : tag).toLowerCase();
    return Object.prototype.hasOwnProperty.call(PM_BEREICH, t) ? PM_BEREICH[t] : null;
  }

  /* Duerfen diese beiden Bereiche gepaart werden?
   * Nur wenn BEIDE bekannt sind UND gleich. Ein unbekannter Bereich ist
   * kein Freibrief. */
  function gleicherBereich(a, b) {
    if (!a || !b) return false;
    return a === b;
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
    ouArt: ouArt,
    bfOuLinie: bfOuLinie,
    ouKandidaten: ouKandidaten,
    ouLaeufer: ouLaeufer,
    esportRein: esportRein,
    paar: paar,
    partieVon: partieVon,
    ohneAnhang: ohneAnhang,
    besterTreffer: besterTreffer,
    laeuferZu: laeuferZu,
    drawLaeufer: drawLaeufer,
    smMarktArt: smMarktArt,
    smLaeufer: smLaeufer,
    smOuKandidaten: smOuKandidaten,
    kalshiZeit: kalshiZeit,
    direktPaare: direktPaare,
    DIREKT_MAX_STUNDEN: DIREKT_MAX_STUNDEN,
    bereichKalshi: bereichKalshi,
    bereichPm: bereichPm,
    gleicherBereich: gleicherBereich
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else welt.Zuordnung = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
