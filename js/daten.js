/* Orion Panel — Datenschicht
 *
 * Holt beide Seiten und fuehrt sie zusammen. Die schwere Arbeit
 * (Polymarket-Bestand, 31505 Maerkte durchsehen) macht der Server in
 * orion-scan, nicht der Browser und nicht der Heim-PC.
 */

(function (welt) {
  'use strict';

  var K = welt.KONFIG;
  var Z = welt.Zuordnung;
  var R = welt.Rechnung;

  function brokerLink(bfLink) {
    if (!bfLink) return null;
    var m = String(bfLink).match(/market\/([\d.]+)/);
    if (!m) return bfLink;
    return K.brokerMuster.replace('{id}', m[1]);
  }

  /* Polymarket vom Server */
  function holePolymarket() {
    return fetch(K.scanUrl, { headers: { accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('orion-scan HTTP ' + r.status);
        return r.json();
      });
  }

  /* Betfair aus bridge_odds, gefuellt von den laufenden Bridges */
  function holeBetfair() {
    return fetch(K.bfUrl, {
      headers: { apikey: K.key, authorization: 'Bearer ' + K.key, accept: 'application/json' }
    }).then(function (r) {
      if (!r.ok) throw new Error('bridge_odds HTTP ' + r.status);
      return r.json();
    }).then(function (zeilen) {
      var z = zeilen && zeilen[0];
      if (!z) return { markets: [], stats: {}, updated_at: null };
      return z;
    });
  }

  /* Kern: Polymarket-Maerkte gegen Betfair-Maerkte halten und rechnen. */
  function verbinde(pm, bf) {
    var jetzt = Date.now();

    var bfMatch = (bf.markets || []).filter(function (m) {
      if (m.mt !== 'MATCH_ODDS') return false;
      var t = Date.parse(m.st || '');
      return !isNaN(t) && (t - jetzt) / 3600000 <= 72;
    });

    var funde = [];
    var falscheFrage = 0, ohnePaar = 0, ohneLaeufer = 0, gerechnet = 0;

    for (var i = 0; i < (pm.maerkte || []).length; i++) {
      var m = pm.maerkte[i];

      /* Erste und wichtigste Huerde: stellt dieser Markt ueberhaupt dieselbe
       * Frage wie Betfair MATCH_ODDS? Exact Score, Over/Under, Spread,
       * Halbzeit und Torschuetze sind ANDERE Wetten. Sie gegen die
       * Siegerquote zu halten ist keine Absicherung, sondern eine Wette.
       * Gemessen am 9.8.2026: ohne diese Huerde entstanden 663 Scheinchancen. */
      var art = Z.marktArt(m.frage);
      if (!art) { falscheFrage++; continue; }

      var p = Z.paar(m.titel);
      if (!p) { ohnePaar++; continue; }

      var treffer = Z.besterTreffer(p[0], p[1], bfMatch, K.schwelle);
      if (!treffer) { ohnePaar++; continue; }

      var lauf = art === 'unentschieden'
        ? Z.drawLaeufer(treffer.bf.r)
        : Z.laeuferZu(m.teil, treffer.bf.r, K.laeuferSchwelle);
      if (!lauf) { ohneLaeufer++; continue; }

      var pmJa = m.ask[0];                          // Briefkurs fuer JA auf diese Mannschaft
      var pmNein = m.ask[1];                        // Briefkurs fuer NEIN
      var satz = m.gebuehr ? m.gebuehr.satz : null;
      var expo = m.gebuehr ? m.gebuehr.exponent : 1;

      /* Weg 1: JA bei Polymarket kaufen, bei Betfair dagegenhalten (Lay).
         Deckt beide Ausgaenge ab, weil Polymarket binaer fragt. */
      var wegLay = R.pmGegenBf({
        pmPreis: pmJa, pmSatz: satz, pmExponent: expo,
        bfQuote: lauf.laeufer.l, bfGebuehr: K.bfGebuehrUnbekannt, bfLay: true
      });

      /* Weg 2: NEIN bei Polymarket kaufen, bei Betfair auf die Mannschaft setzen. */
      var wegBack = R.pmGegenBf({
        pmPreis: pmNein, pmSatz: satz, pmExponent: expo,
        bfQuote: lauf.laeufer.b, bfGebuehr: K.bfGebuehrUnbekannt, bfLay: false
      });

      var beste = null, weg = null;
      if (wegLay && (!beste || wegLay.rendite > beste.rendite)) { beste = wegLay; weg = 'lay'; }
      if (wegBack && (!beste || wegBack.rendite > beste.rendite)) { beste = wegBack; weg = 'back'; }
      if (!beste) continue;
      gerechnet++;

      funde.push({
        id: m.id,
        titel: m.titel,
        frage: m.frage,
        mannschaft: art === 'unentschieden' ? 'Unentschieden' : m.teil,
        marktart: art,
        tag: m.tag,
        ende: m.ende,
        score: treffer.score,
        art: weg,
        pmPreis: weg === 'lay' ? pmJa : pmNein,
        pmSeite: weg === 'lay' ? 'JA' : 'NEIN',
        pmLink: m.link,
        bfName: lauf.laeufer.n,
        bfQuote: weg === 'lay' ? lauf.laeufer.l : lauf.laeufer.b,
        bfSeite: weg === 'lay' ? 'Lay' : 'Back',
        bfVolumen: weg === 'lay' ? lauf.laeufer.ls : lauf.laeufer.bs,
        bfLink: brokerLink(treffer.bf.link),
        bfRoh: treffer.bf.link,
        bfPartie: treffer.bf.k,
        rechnung: beste
      });
    }

    funde.sort(function (a, b) { return b.rechnung.rendite - a.rechnung.rendite; });

    return {
      funde: funde,
      statistik: {
        pm_handelbar: (pm.maerkte || []).length,
        pm_dauer_ms: pm.dauer_ms,
        bf_maerkte: (bf.markets || []).length,
        bf_match_odds: bfMatch.length,
        bf_alter_s: bf.updated_at ? Math.round((jetzt - Date.parse(bf.updated_at)) / 1000) : null,
        bf_stats: bf.stats || {},
        falsche_frage: falscheFrage,
        ohne_paar: ohnePaar,
        ohne_laeufer: ohneLaeufer,
        gerechnet: gerechnet,
        chancen: funde.filter(function (f) { return f.rechnung.istArbitrage; }).length
      }
    };
  }

  function ladeAlles() {
    return Promise.all([holePolymarket(), holeBetfair()])
      .then(function (beide) { return verbinde(beide[0], beide[1]); });
  }

  welt.Daten = {
    holePolymarket: holePolymarket,
    holeBetfair: holeBetfair,
    verbinde: verbinde,
    ladeAlles: ladeAlles,
    brokerLink: brokerLink
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
