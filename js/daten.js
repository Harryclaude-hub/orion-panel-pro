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
    return db('orion_funde?status=eq.live&order=rendite.desc&limit=1000');
  }

  /* Was einmal galt und nicht mehr. Neueste Beendigung zuerst. */
  function holeVerlauf(grenze) {
    return db('orion_funde?status=eq.vorbei&order=vorbei_seit.desc&limit=' + (grenze || 500));
  }

  /* Die ganze Uebersicht in EINER Abfrage. Fuenf getrennte Abfragen koennten
   * sich widersprechen: die Tafel sagt 61 Funde, die Liste zeigt 60, weil
   * dazwischen ein Lauf durchging. Nebenbei ist die Antwortzeit dieser einen
   * Abfrage das ehrlichste Mass fuer "ist Supabase erreichbar und wie schnell". */
  function holeUebersicht() {
    var t0 = Date.now();
    return fetch(K.supabase + '/rest/v1/rpc/orion_uebersicht', {
      method: 'POST',
      headers: { apikey: K.key, authorization: 'Bearer ' + K.key,
                 'content-type': 'application/json', accept: 'application/json' },
      body: '{}'
    }).then(function (r) {
      if (!r.ok) throw new Error('Uebersicht HTTP ' + r.status);
      return r.json();
    }).then(function (u) {
      u.antwort_ms = Date.now() - t0;
      return u;
    }).catch(function (e) {
      return { fehler: e.message, antwort_ms: Date.now() - t0 };
    });
  }

  /* Was die Nachtwache zuletzt gesehen hat. */
  function holeWache() {
    return db('orion_wache?order=geprueft_am.desc&limit=1').then(function (z) { return z[0] || null; });
  }

  /* Laeuft der Scanner ueberhaupt? */
  function holeLauf() {
    return db('orion_laeufe?order=gelaufen_am.desc&limit=1').then(function (z) { return z[0] || null; });
  }

  /* Wie alt sind die oeffentlichen Kalshi-Kurse? */
  function holeKalshi() {
    return db('kalshi_snapshot?id=eq.1&select=updated_at,stats').then(function (z) { return z[0] || null; });
  }

  /* WECHSELKURS USD -> EUR.
   *
   * Alle Betraege im System stehen in USD: Polymarket und Kalshi rechnen so,
   * Smarkets wird an der Quelle von GBP nach USD umgerechnet. Angezeigt wurde
   * bisher eine nackte Zahl OHNE Einheit — "max. Einsatz 94" sagt nicht, ob
   * das Euro, Dollar oder eine Skala ist.
   *
   * Den Kurs holt die DATENBANK selbst (pg_net, im Waechter). Der Browser
   * kann es nicht: api.frankfurter.dev sendet keinen CORS-Header, gemessen.
   *
   * REGEL: ohne Kurs wird NICHT geraten. Dann bleibt alles in USD und die
   * Anzeige sagt es dazu — dieselbe Regel wie beim Smarkets-Sammler, wo
   * ohne Kurs gar nicht geschrieben wird. */
  function kurs() {
    return db('orion_kurse?paar=eq.USD_EUR&select=kurs,stand,quelle,geholt_am')
      .then(function (z) { return z[0] || null; })
      .catch(function () { return null; });
  }

  /* Wie alt ist der Smarkets-Schnappschuss? */
  function holeSmarkets() {
    return db('smarkets_snapshot?id=eq.1&select=updated_at,stats').then(function (z) { return z[0] || null; });
  }

  function ladeAlles() {
    return Promise.all([holeLive(), holeVerlauf(500), holeLauf(), holeKalshi(), holeWache(),
                        holeUebersicht(), holeSmarkets(), kurs()])
      .then(function (teile) {
        var live = teile[0], verlauf = teile[1], lauf = teile[2], ka = teile[3], wache = teile[4];
        var fx = teile[7];
        var uebersicht = teile[5], sm = teile[6];
        var jetzt = Date.now();

        var kaAlterS = ka && ka.updated_at ? Math.round((jetzt - Date.parse(ka.updated_at)) / 1000) : null;
        var smAlterS = sm && sm.updated_at ? Math.round((jetzt - Date.parse(sm.updated_at)) / 1000) : null;
        var bfAlterS = lauf ? lauf.bf_alter_s : null;
        var laufAlterS = lauf ? Math.round((jetzt - Date.parse(lauf.gelaufen_am)) / 1000) : null;

        /* Frische JE BUCH. Ein einziger Schalter waere falsch: Kalshi kann
         * frisch sein, waehrend die Bridge steht. Wer beides zusammenwirft,
         * versteckt entweder echte Funde oder zeigt tote Kurse als Chance.
         *
         * Seit dem Umbau auf "jedes Buch gegen jedes" hat eine Zeile ZWEI
         * Buecher, die beide alt sein koennen — buch_1 ist nicht mehr immer
         * Polymarket. Veraltet ist eine Zeile, sobald EINE ihrer Seiten
         * veraltet ist. */
        function buchVeraltet(name) {
          if (name === 'kalshi')   return kaAlterS === null || kaAlterS > K.kalshiMaxAlterS;
          if (name === 'smarkets') return smAlterS === null || smAlterS > K.smarketsMaxAlterS;
          if (name === 'betfair')  return bfAlterS === null || bfAlterS > K.bridgeMaxAlterS;
          /* Polymarket wird bei JEDEM Lauf frisch geholt. Seine Frische ist
           * die Frische des Scanners. */
          return laufAlterS === null || laufAlterS > K.laufMaxAlterS;
        }
        function veraltet(f) {
          return buchVeraltet(f.buch_1 || 'polymarket') || buchVeraltet(f.buch || 'betfair');
        }

        /* Broker-Adresse an EINER Stelle festlegen, hier beim Anzeigen.
         * Die Marktnummer ist das Bestaendige, der Broker nicht: 96ex.com
         * antwortete am 9.8.2026 gar nicht mehr (HTTP 000, dreimal 21 s
         * Zeitueberschreitung). Wer den Broker wechselt, aendert nur
         * KONFIG.brokerMuster und alle Zeilen stimmen wieder, auch die
         * alten im Verlauf.
         *
         * NUR fuer Betfair. Kalshi und Smarkets sind direkt erreichbar, und
         * Polymarket ohnehin. Frueher stand hier "alles ausser Kalshi" —
         * das haette einen Smarkets-Link stillschweigend nach Orbit
         * umgebogen, sobald Betfair auf Seite 2 nicht mehr gesetzt ist. */
        function brokerRichten(f) {
          if ((f.buch_1 || 'polymarket') === 'betfair') {
            var m1 = String(f.pm_link || '').match(/market\/([\d.]+)/);
            if (m1) f.pm_link = K.brokerMuster.replace('{id}', m1[1]);
          }
          if ((f.buch || 'betfair') === 'betfair') {
            var m2 = String(f.bf_link || '').match(/market\/([\d.]+)/);
            if (m2) f.bf_link = K.brokerMuster.replace('{id}', m2[1]);
          }
        }

        /* SMARKETS-LINK: Schraegstrich am Ende. Gemessen am 11.8.2026 mit
         * den ECHTEN gespeicherten Links aus der Datenbank:
         *
         *   ohne Schraegstrich (so wie gespeichert)  ->  HTTP 308 Redirect
         *   mit Schraegstrich                        ->  HTTP 200, richtige Seite
         *
         * Alle drei geprueften Links antworteten mit 308. Der Auftraggeber
         * berichtet, dass er "eine Millisekunde beim echten Markt" landet und
         * dann auf der Startseite - das passt zu einem Redirect, bei dem die
         * JavaScript-App neu startet und den Zustand verliert. Der Schraeg-
         * strich vermeidet den Redirect ueberhaupt.
         *
         * Das ist BELEGT. Was NICHT belegt ist: ein Link auf den einzelnen
         * MARKT (.../over-under-2-5/). Die Pfadform stimmt zwar, aber
         * smarkets.com antwortet auf JEDEN Pfad mit 200 und rendert erst im
         * Browser - sogar /quatsch-markt/ bekommt eine Seite mit Titel. Ohne
         * pruefbaren Unterschied wird nicht geraten: ein falscher Marktpfad
         * fuehrt ins Leere, der Spiel-Link wenigstens zur Partie. Bis dahin
         * nennt die Karte den zu waehlenden Markt im Klartext. */
        function smarketsLinkRichten(f) {
          function schraeg(u) {
            var s = String(u || '');
            if (s.indexOf('smarkets.com') < 0) return u;
            if (s.indexOf('?') >= 0 || s.indexOf('#') >= 0) return u;  // nichts anfassen
            return s.charAt(s.length - 1) === '/' ? s : s + '/';
          }
          if ((f.buch_1 || 'polymarket') === 'smarkets') f.pm_link = schraeg(f.pm_link);
          if ((f.buch || 'betfair') === 'smarkets')      f.bf_link = schraeg(f.bf_link);
        }

        live.forEach(function (f) { f.veraltet = veraltet(f); brokerRichten(f); smarketsLinkRichten(f); });
        verlauf.forEach(function (f) { f.veraltet = false; brokerRichten(f); smarketsLinkRichten(f); });

        /* Zusaetzliche Wache im Browser: zwischen zwei Aufraeumlaeufen kann
         * eine frisch beendete Minuszeile durchrutschen. Im Verlauf hat sie
         * nichts verloren. */
        /* BEIDE Werte muessen im Plus sein. Der erste Anlauf filterte nur
         * nach der besten je gesehenen Rendite — angezeigt wird aber die
         * zuletzt gesehene. Eine Zeile mit beste +2,31 % und zuletzt -2,83 %
         * ueberlebte damit und stand dann mit Minus da. */
        /* DER VERLAUF ZEIGT NUR, WAS SICH GELOHNT HAETTE.
         *
         * Vorher reichte "Rendite ueber null" — damit standen dort Zeilen mit
         * +0,04 % und drei Cent Gewinn neben echten Funden. Wer den Verlauf
         * ansieht, will wissen: haette sich das gelohnt? Eine Zeile, die
         * rechnerisch im Plus war und real drei Cent gebracht haette,
         * beantwortet diese Frage mit Nein.
         *
         * Dieselben drei Bedingungen wie bei den Chancen (siehe konfig.js):
         * Rendite ueber der Schwelle, Menge BEKANNT, Gewinn ueber
         * KONFIG.mindestGewinn. Wer alles sehen will, setzt mindestGewinn
         * auf 0 — dann ist der Verlauf wieder so vollstaendig wie vorher. */
        verlauf = verlauf.filter(function (f) {
          var zuletzt = Number(f.rendite);
          var beste = Number(f.beste_rendite == null ? f.rendite : f.beste_rendite);
          if (!(zuletzt >= K.verlaufMinRendite && beste >= K.verlaufMinRendite)) return false;
          if (zuletzt < K.mindestRendite) return false;
          /* Der Gewinn wird aus der BESTEN je gesehenen Rendite gerechnet:
           * im Verlauf zaehlt, was moeglich GEWESEN waere, nicht was am
           * Ende uebrig blieb. */
          if (f.max_einsatz === null || f.max_einsatz === undefined) return !K.nurMitBekannterMenge;
          var moeglich = Number(f.max_einsatz) * beste / 100;
          return isFinite(moeglich) && moeglich >= K.mindestGewinn;
        });

        /* DREI Gruppen, nicht zwei. Ein Fund ueber der Schwelle, dessen Kurse
         * veraltet sind, ist weder eine Chance noch ein knappes Paar — er ist
         * eine alte Zahl. Ihn unter "Knappste Paare" zu stecken war irrefuehrend:
         * dort stand dann +16 % zwischen lauter Minuswerten, ohne Erklaerung. */
        /* Zu duenn: Rendite stimmt, aber es passt fast nichts hinein.
         *
         * Gemessen am 10.8.2026: der beste Kurs im Smarkets-Orderbuch war
         * ein Auftrag ueber 0,0035 GBP. Er zog die Kehrwertsumme unter
         * 100 % und haette eine Chance vorgetaeuscht, die mit dem naechsten
         * echten Kurs keine ist.
         *
         * Solche Zeilen werden NICHT versteckt — sie wandern zu den knappen
         * Paaren und tragen dort eine Marke. Unbekannte Menge bleibt
         * unbekannt und zaehlt NICHT als zu duenn: das waere eine
         * Unterstellung. */
        function zuDuenn(f) {
          var m = Number(f.max_einsatz);
          return f.max_einsatz !== null && isFinite(m) && m < K.mindestEinsatz;
        }
        live.forEach(function (f) { f.zu_duenn = zuDuenn(f); });
        verlauf.forEach(function (f) { f.zu_duenn = zuDuenn(f); });

        /* Was tatsaechlich an Gewinn herauskaeme, in GELD — nicht in Prozent.
         * null heisst "nicht bekannt", nicht "null Euro". */
        function echterGewinn(f) {
          var m = Number(f.max_einsatz);
          if (f.max_einsatz === null || f.max_einsatz === undefined || !isFinite(m)) return null;
          var r = Number(f.rendite);
          if (!isFinite(r)) return null;
          return m * r / 100;
        }
        live.forEach(function (f) { f.echter_gewinn = echterGewinn(f); });
        verlauf.forEach(function (f) { f.echter_gewinn = echterGewinn(f); });

        /* EINE CHANCE IST EINE ZEILE, DIE GELD BRINGT.
         *
         * Drei Bedingungen, alle drei noetig:
         *   1. Rendite ueber der Schwelle       — das Verhaeltnis stimmt
         *   2. Menge BEKANNT                    — wir wissen, was hineinpasst
         *   3. Gewinn in Geld ueber der Schwelle — es lohnt sich wirklich
         *
         * Bedingung 2 und 3 sind am 10.8.2026 dazugekommen. Vorher reichte
         * die Rendite, und dann hiess eine Zeile mit +1,03 % und drei Cent
         * Gewinn genauso "Chance" wie eine mit 40 Euro. Nichts davon wird
         * geloescht — was hier durchfaellt, steht unter "Knappste Paare"
         * mit Begruendung. */
        var chancen = live.filter(function (f) {
          if (f.veraltet || f.zu_duenn) return false;
          if (f.rendite < K.mindestRendite) return false;
          if (K.nurMitBekannterMenge && f.echter_gewinn === null) return false;
          if (f.echter_gewinn !== null && f.echter_gewinn < K.mindestGewinn) return false;
          return true;
        });
        var veraltetHoch = live.filter(function (f) { return f.rendite >= K.mindestRendite && f.veraltet; });
        /* Nur Gruenes und knapp Danebengegangenes. Alles unter der
         * Rauschgrenze wird nicht gezeigt — es sagt nichts, ausser dass zwei
         * Buecher eben verschieden stehen. */
        var knapp = live.filter(function (f) {
          if (f.veraltet) return false;
          /* Zu duenne Zeilen mit guter Rendite gehoeren hierher, nicht in
           * die Chancen — und schon gar nicht ins Nichts. */
          /* Alles mit guter Rendite, das KEINE Chance geworden ist, faellt
           * hierher: zu duenn, unbekannte Menge, oder Gewinn unter der
           * Geldschwelle. Es darf auf keinen Fall verschwinden — ein Filter,
           * der stillschweigend schluckt, ist eine Falle. */
          if (f.rendite >= K.mindestRendite) {
            if (f.zu_duenn) return true;
            if (f.echter_gewinn === null) return true;
            if (f.echter_gewinn < K.mindestGewinn) return true;
            return false;
          }
          return f.rendite >= K.rauschGrenze;
        });
        var rauschen = live.filter(function (f) { return f.rendite < K.rauschGrenze; }).length;

        return {
          chancen: chancen,
          veraltetHoch: veraltetHoch,
          knapp: knapp,
          verlauf: verlauf,
          lauf: lauf,
          uebersicht: uebersicht,
          /* null heisst: kein Kurs bekannt. Dann zeigt die Anzeige USD und
           * sagt es dazu, statt einen Kurs zu erfinden. */
          kurs: fx,
          statistik: {
            chancen: chancen.length,
            veraltet_hoch: veraltetHoch.length,
            zu_duenn: live.filter(function (f) { return f.rendite >= K.mindestRendite && f.zu_duenn; }).length,
            knapp: knapp.length,
            rauschen: rauschen,
            live_gesamt: live.length,
            verlauf: verlauf.length,
            kalshi_alter_s: kaAlterS,
            kalshi_maerkte: ka && ka.stats ? ka.stats.maerkte : null,
            smarkets_alter_s: smAlterS,
            smarkets_maerkte: sm && sm.stats ? sm.stats.mit_quoten : null,
            smarkets_spiele: sm && sm.stats ? sm.stats.spiele : null,
            /* Je Buch zaehlen, egal auf WELCHER Seite es steht. Eine Zeile
             * mit zwei Buechern zaehlt bei beiden. */
            je_buch: (function () {
              var z = {};
              live.forEach(function (f) {
                [f.buch_1 || 'polymarket', f.buch || 'betfair'].forEach(function (b) {
                  z[b] = (z[b] || 0) + 1;
                });
              });
              return z;
            })(),
            /* Welche Buchpaarungen laufen gerade. */
            je_paarung: (function () {
              var z = {};
              live.forEach(function (f) {
                var s = (f.buch_1 || 'polymarket') + ' → ' + (f.buch || 'betfair');
                z[s] = (z[s] || 0) + 1;
              });
              return z;
            })(),
            lauf_alter_s: laufAlterS,
            bf_alter_s: bfAlterS,
            pm_maerkte: lauf ? lauf.pm_maerkte : null,
            bf_match_odds: lauf ? lauf.bf_match_odds : null,
            paare: lauf ? lauf.paare : null,
            lauf_dauer_ms: lauf ? lauf.dauer_ms : null,
            lauf_fehler: lauf ? lauf.fehler : null,
            wache_alter_s: wache ? Math.round((jetzt - Date.parse(wache.geprueft_am)) / 1000) : null,
            wache_gut: wache ? wache.alles_gut : null,
            wache_eingriff: wache ? wache.eingegriffen : null
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
