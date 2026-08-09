/* Orion Panel Pro — Datenschicht
 *
 * Die Suche laeuft im Programm, nicht im Browser: orion-lauf rechnet auf dem
 * Server im Minutentakt und legt jeden Fund in orion_funde ab. Diese Datei
 * liest nur noch ab. Deshalb ist ein Neuladen billig genug fuer zwei Sekunden.
 *
 * js/rechnung.js und js/zuordnung.js bleiben im Programm, weil der Pruefstand
 * gegen sie laeuft und weil die Serverfassung ihr Spiegel ist.
 */

(function (welt) {
  'use strict';

  var K = welt.KONFIG;

  function db(pfad) {
    return fetch(K.supabase + '/rest/v1/' + pfad, {
      headers: { apikey: K.key, authorization: 'Bearer ' + K.key, accept: 'application/json' }
    }).then(function (r) {
      if (!r.ok) throw new Error('Datenbank HTTP ' + r.status);
      return r.json();
    });
  }

  /* Was gerade gilt. Absteigend nach Rendite, das Beste oben. */
  function holeLive() {
    return db('orion_funde?status=eq.live&order=rendite.desc&limit=300');
  }

  /* Was einmal galt und nicht mehr. Neueste Beendigung zuerst. */
  function holeVerlauf(grenze) {
    return db('orion_funde?status=eq.vorbei&order=vorbei_seit.desc&limit=' + (grenze || 60));
  }

  /* Laeuft der Scanner ueberhaupt? */
  function holeLauf() {
    return db('orion_laeufe?order=gelaufen_am.desc&limit=1').then(function (z) { return z[0] || null; });
  }

  /* Wie alt sind die oeffentlichen Kalshi-Kurse? */
  function holeKalshi() {
    return db('kalshi_snapshot?id=eq.1&select=updated_at,stats').then(function (z) { return z[0] || null; });
  }

  function ladeAlles() {
    return Promise.all([holeLive(), holeVerlauf(60), holeLauf(), holeKalshi()])
      .then(function (teile) {
        var live = teile[0], verlauf = teile[1], lauf = teile[2], ka = teile[3];
        var jetzt = Date.now();

        var kaAlterS = ka && ka.updated_at ? Math.round((jetzt - Date.parse(ka.updated_at)) / 1000) : null;
        var bfAlterS = lauf ? lauf.bf_alter_s : null;

        /* Frische JE BUCH. Ein einziger Schalter waere falsch: Kalshi kann
         * frisch sein, waehrend die Bridge steht. Wer beides zusammenwirft,
         * versteckt entweder echte Funde oder zeigt tote Kurse als Chance. */
        function veraltet(f) {
          if (f.buch === 'kalshi') return kaAlterS === null || kaAlterS > K.kalshiMaxAlterS;
          return bfAlterS === null || bfAlterS > K.bridgeMaxAlterS;
        }

        live.forEach(function (f) { f.veraltet = veraltet(f); });
        verlauf.forEach(function (f) { f.veraltet = false; });

        var chancen = live.filter(function (f) { return f.rendite >= K.mindestRendite && !f.veraltet; });
        var knapp = live.filter(function (f) { return !(f.rendite >= K.mindestRendite && !f.veraltet); });

        return {
          chancen: chancen,
          knapp: knapp,
          verlauf: verlauf,
          lauf: lauf,
          statistik: {
            chancen: chancen.length,
            knapp: knapp.length,
            live_gesamt: live.length,
            verlauf: verlauf.length,
            kalshi_alter_s: kaAlterS,
            kalshi_maerkte: ka && ka.stats ? ka.stats.maerkte : null,
            aus_betfair: live.filter(function (f) { return f.buch !== 'kalshi'; }).length,
            aus_kalshi: live.filter(function (f) { return f.buch === 'kalshi'; }).length,
            lauf_alter_s: lauf ? Math.round((jetzt - Date.parse(lauf.gelaufen_am)) / 1000) : null,
            bf_alter_s: bfAlterS,
            pm_maerkte: lauf ? lauf.pm_maerkte : null,
            bf_match_odds: lauf ? lauf.bf_match_odds : null,
            paare: lauf ? lauf.paare : null,
            lauf_dauer_ms: lauf ? lauf.dauer_ms : null,
            lauf_fehler: lauf ? lauf.fehler : null
          }
        };
      });
  }

  welt.Daten = {
    holeLive: holeLive,
    holeVerlauf: holeVerlauf,
    holeLauf: holeLauf,
    ladeAlles: ladeAlles
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
