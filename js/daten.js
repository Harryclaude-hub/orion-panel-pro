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

  /* Was einmal galt und nicht mehr. Neueste Beendigung zuerst.
   *
   * OHNE RAUSCHEN, und das ist der Kern (gemessen 14.8.): Zeilen, die nie
   * etwas wert waren (beste Rendite unter 0), stehen bis zum naechsten
   * Loeschtakt (alle 5 min) mit in der Tabelle. An einem vollen
   * Fussballabend fluteten hunderte davon das Neueste-zuerst-Fenster und
   * SCHOBEN echte Verlaufszeilen ueber das Limit hinaus — der Verlauf
   * sprang von 160 auf 2 und wieder zurueck. Deshalb laedt diese Abfrage
   * nur, was in einen der drei Reiter gehoert: nachgewiesen falsch, oder
   * je ueber 0 % gewesen. */
  function holeVerlauf(grenze) {
    return db('orion_funde?status=eq.vorbei' +
      '&or=(pruefung.eq.falsch,beste_rendite.gte.0,and(beste_rendite.is.null,rendite.gte.0))' +
      '&order=vorbei_seit.desc&limit=' + (grenze || 1000));
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

  /* Laeuft der Scanner ueberhaupt? (Juengster Lauf, egal welcher Bereich.) */
  function holeLauf() {
    return db('orion_laeufe?order=gelaufen_am.desc&limit=1').then(function (z) { return z[0] || null; });
  }

  /* SEIT DEM BEREICHS-SCANNER (11.8. abends) gibt es nicht mehr DEN letzten
   * Lauf, sondern einen je Bereich: orion-lauf-fussball alle 20 s,
   * orion-lauf-tennis jede Minute, und so weiter. Eine einzelne letzte
   * Zeile zeigte dann mal 700 Maerkte (Fussball), mal 40 (Tennis) — die
   * Tafel haette bei jedem Ablesen andere Zahlen behauptet.
   *
   * Deshalb: die juengste Zeile JE BEREICH holen und daraus aggregieren.
   * 60 Zeilen reichen: der dichteste Takt ist 20 s, damit liegen selbst
   * bei 20 Bereichen alle juengsten Laeufe in den letzten 60 Zeilen. */
  function holeLaeufe() {
    return db('orion_laeufe?select=bereich,gelaufen_am,pm_maerkte,bf_match_odds,paare,dauer_ms,fehler,bf_alter_s&order=gelaufen_am.desc&limit=60');
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
    return Promise.all([holeLive(), holeVerlauf(1000), holeLaeufe(), holeKalshi(), holeWache(),
                        holeUebersicht(), holeSmarkets(), kurs()])
      .then(function (teile) {
        var live = teile[0], verlauf = teile[1], laeufe = teile[2] || [], ka = teile[3], wache = teile[4];
        var fx = teile[7];
        var uebersicht = teile[5], sm = teile[6];
        var jetzt = Date.now();

        /* Juengster Lauf JE BEREICH (die Liste kommt absteigend sortiert,
         * also gewinnt je Bereich die erste Zeile). Zeilen ohne Bereich
         * stammen von vor der Umstellung und zaehlen nicht mehr mit. */
        var lauf = laeufe[0] || null;                 // juengster Lauf ueberhaupt
        var jeBereich = {};
        var FRISCH_MS = 5 * 60000;                    // aeltere Bereichslaeufe zaehlen nicht
        for (var li = 0; li < laeufe.length; li++) {
          var L = laeufe[li];
          if (!L.bereich) continue;
          if (Object.prototype.hasOwnProperty.call(jeBereich, L.bereich)) continue;
          if (jetzt - Date.parse(L.gelaufen_am) > FRISCH_MS) continue;
          jeBereich[L.bereich] = L;
        }

        var kaAlterS = ka && ka.updated_at ? Math.round((jetzt - Date.parse(ka.updated_at)) / 1000) : null;
        var smAlterS = sm && sm.updated_at ? Math.round((jetzt - Date.parse(sm.updated_at)) / 1000) : null;
        /* Betfair-Frische aus dem juengsten Lauf, der Betfair ueberhaupt
         * gelesen hat — nicht aus irgendeinem. */
        var bfAlterS = null;
        for (var bi = 0; bi < laeufe.length; bi++) {
          if (laeufe[bi].bf_alter_s !== null && laeufe[bi].bf_alter_s !== undefined) { bfAlterS = laeufe[bi].bf_alter_s; break; }
        }
        var laufAlterS = lauf ? Math.round((jetzt - Date.parse(lauf.gelaufen_am)) / 1000) : null;
        /* Frische des Scanners JE BEREICH: eine Fussball-Zeile ist so
         * frisch wie der letzte Fussball-Lauf, nicht wie der letzte
         * Tennis-Lauf. Faellt fuer unbekannte Bereiche auf den juengsten
         * Lauf insgesamt zurueck. */
        function laufAlterVon(bereich) {
          var L = bereich ? jeBereich[bereich] : null;
          return L ? Math.round((jetzt - Date.parse(L.gelaufen_am)) / 1000) : laufAlterS;
        }

        /* Frische JE BUCH. Ein einziger Schalter waere falsch: Kalshi kann
         * frisch sein, waehrend die Bridge steht. Wer beides zusammenwirft,
         * versteckt entweder echte Funde oder zeigt tote Kurse als Chance.
         *
         * Seit dem Umbau auf "jedes Buch gegen jedes" hat eine Zeile ZWEI
         * Buecher, die beide alt sein koennen — buch_1 ist nicht mehr immer
         * Polymarket. Veraltet ist eine Zeile, sobald EINE ihrer Seiten
         * veraltet ist. */
        function buchVeraltet(name, f) {
          if (name === 'kalshi')   return kaAlterS === null || kaAlterS > K.kalshiMaxAlterS;
          if (name === 'smarkets') return smAlterS === null || smAlterS > K.smarketsMaxAlterS;
          if (name === 'betfair')  return bfAlterS === null || bfAlterS > K.bridgeMaxAlterS;
          /* Polymarket wird bei JEDEM Lauf frisch geholt. Seine Frische ist
           * die Frische des Scanners — und zwar des Scanners im BEREICH
           * dieser Zeile: der Fussball-Takt (20 s) sagt nichts darueber,
           * ob der Tennis-Lauf noch laeuft. */
          var a = laufAlterVon(f && f.bereich);
          return a === null || a > K.laufMaxAlterS;
        }
        function veraltet(f) {
          return buchVeraltet(f.buch_1 || 'polymarket', f) || buchVeraltet(f.buch || 'betfair', f);
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

        /* RECHNUNGSNUMMER (13.8., nachts): jede Zeile traegt eine feste
         * fuenfstellige Nummer, abgeleitet aus ihrem Schluessel — dieselbe
         * Zeile hat immer dieselbe Nummer, auch nach einem Neuladen. Damit
         * kann man dem Funker sagen: pruefe #48213. Kein Zufall, kein
         * Hochzaehlen (das verschoebe sich mit jeder neuen Zeile). */
        function rechnungsNr(s) {
          var h = 5381; s = String(s || '');
          for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
          return 10000 + Math.abs(h) % 90000;
        }
        live.forEach(function (f) { f.nr = rechnungsNr(f.schluessel); });
        verlauf.forEach(function (f) { f.nr = rechnungsNr(f.schluessel); });

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
        /* FEHLPAARUNG, unabhaengig nachgerechnet — auch im VERLAUF.
         *
         * Anlass, gemessen am 12.8.2026 nachts: von 11 Verlaufszeilen ueber
         * 3 % waren DREI bekannte Fehlpaarungen — beide "Al"-Faelle und der
         * League-of-Legends-Fall. Mit der neuen 3-%-Schwelle standen genau
         * die als "die besten Funde" oben im Verlauf. Der Waechter faengt
         * sie live, aber er sieht nur status='live'; alte Zeilen bleiben
         * stehen wie sie sind (Geschichte wird nicht umgeschrieben).
         *
         * Dieselbe Regel wie im Waechter: teilen die beiden Titel kein
         * unterscheidendes Wort, meinen sie nicht dieselbe Partie. Gerechnet
         * mit Zuordnung.woerter, also unabhaengig von dem, was der Scanner
         * damals als zuordnung eingetragen hat — der stand bei allen dreien
         * auf 1,00. */
        function fehlpaarung(f) {
          var Z = welt.Zuordnung;
          if (!Z || !Z.woerter) return false;

          /* Weg 1: kein gemeinsames unterscheidendes Wort. */
          var a = Z.woerter(f.titel || ''), b = Z.woerter(f.bf_partie || '');
          if (a.length && b.length) {
            var gemeinsam = false;
            for (var i = 0; i < a.length; i++) if (b.indexOf(a[i]) >= 0) { gemeinsam = true; break; }
            if (!gemeinsam) return true;
          }

          /* Weg 2: der KALSHI-LINK verraet die Serie, und die Serie verraet
           * den Bereich. Zeigt er in einen anderen Bereich als die Zeile,
           * ist es eine Fehlpaarung — auch wenn die Namen gleich sind.
           *
           * GENAU DAFUER ist dieser zweite Weg da: der Fall vom 11.8. mit
           * 5,34 % (FSV Frankfurt gegen ROSSMANN Centaurs) teilt das Wort
           * "Frankfurt" und rutscht durch Weg 1 hindurch. Sein Link zeigt
           * aber auf kxlolgame — League of Legends gegen Fussball. */
          if (Z.bereichKalshi && welt.Filter && welt.Filter.bereichVon) {
            var eigen = welt.Filter.bereichVon(f);
            var links = [
              (f.buch_1 || 'polymarket') === 'kalshi' ? f.pm_link : null,
              (f.buch || 'betfair') === 'kalshi' ? f.bf_link : null
            ];
            for (var j = 0; j < links.length; j++) {
              if (!links[j]) continue;
              var m = String(links[j]).match(/kalshi\.com\/markets\/([^\/?#]+)/i);
              if (!m) continue;
              var ausLink = Z.bereichKalshi(m[1].toUpperCase());
              if (eigen && ausLink && ausLink !== eigen) return true;
            }
          }
          return false;
        }
        /* GEPRUEFTES URTEIL schlaegt jede Rechnung.
         *
         * Seit 13.8.2026 traegt eine Zeile die Spalte `pruefung`. Steht dort
         * 'falsch', ist sie einzeln nachgewiesen als Fehlpaarung — sie
         * verschwindet aus Chancen UND Verlauf, egal wie gut ihre Zahlen
         * aussehen. Der Grund steht in `pruefung_grund` und bleibt in der
         * Datenbank stehen: an genau diesen Faellen wird jede neue Regel
         * getestet, bevor sie scharf geschaltet wird. Geloescht wird nichts. */
        function nachgewiesenFalsch(f) { return f.pruefung === 'falsch'; }
        live.forEach(function (f) { f.fehlpaarung = fehlpaarung(f) || nachgewiesenFalsch(f); });
        verlauf.forEach(function (f) { f.fehlpaarung = fehlpaarung(f) || nachgewiesenFalsch(f); });
        var verlaufFehlpaarungen = verlauf.filter(function (f) {
          return f.fehlpaarung && Number(f.rendite) >= K.mindestRendite;
        }).length;

        /* ---------- Verlauf in ZWEI Listen (Vorgabe 13.8., nachts) ----------
         *
         * "Verlauf sind vergangene Chancen" — also darf dort nur stehen,
         * was nach heutigem Wissen WIRKLICH eine war. Alles, was als Chance
         * angezeigt wurde und sich als falsch herausgestellt hat, bekommt
         * einen EIGENEN Reiter "Falsche Rechnungen": zum Analysieren, mit
         * dem erklaerten Ziel einer Woche, in der er leer bleibt.
         *
         * Falsch heisst: nachgewiesen (pruefung='falsch', Fehlpaarung,
         * Buchprobe) ODER unplausibel hoch (ueber maxPlausibel — gemessen
         * war jede solche Zeile ein Kleber) ODER vom Pruefer beanstandet
         * ODER nicht gedeckt. Nichts davon verschwindet mehr still. */
        /* ---------- Beendete in DREI Klassen (Vorgabe 14.8.) ----------
         *
         * "Wenn eine Rechnung kommt: entweder ist sie falsch — dann wissen
         * wir, was er falsch gemacht hat. Verlauf ist, wenn's eine Chance
         * war. Knappste Chancen: es war eine Arbitrage, aber es hat sich
         * wegen Gebuehren und so nicht gelohnt." Jede beendete Zeile
         * bekommt GENAU EINE dieser Klassen und behaelt sie — die drei
         * Reiter koennen dadurch nur noch wachsen. Einzige Ausnahme: stellt
         * der Pruefer eine Zeile spaeter als falsch fest, wandert sie von
         * Verlauf nach Falsch — sichtbar, nicht verschwunden. */
        var falsch = [];
        var vorbeiRauschen = 0;
        verlauf = verlauf.filter(function (f) {
          var beste = Number(f.beste_rendite == null ? f.rendite : f.beste_rendite);
          /* ES ZAEHLT DER BESTE WERT, NICHT DER LETZTE.
           *
           * Der Verlauf beantwortet die Frage "haette sich das gelohnt?".
           * Darauf antwortet der hoechste je gesehene Wert, nicht der, bei
           * dem die Zeile zufaellig endete. Eine Chance, die bei 3 % stand
           * und beim Verschwinden bei 0,5 % lag, IST passiert.
           *
           * Vorher stand hier eine Bedingung auf BEIDE Werte. Damit
           * verschwand genau der Fall, den der Auftraggeber am 13.8. bemerkt
           * hat: "Ich hab eine Chance gesehen, die war kurz da, dann war sie
           * weg — aber nicht im Verlauf."
           *
           * Der Grund fuer die alte Bedingung war ein echtes Aergernis: die
           * Karte zeigte den letzten Wert, und dann stand eine Zeile mit
           * -2,83 % zwischen den Chancen. Das ist aber ein Anzeigeproblem,
           * kein Grund, den Fund wegzuwerfen — die Karte nennt ohnehin beide
           * Zahlen. Wegwerfen war die teurere Loesung.
           *
           * Dazu gehoert die Loeschregel in der Datenbank
           * (orion_rauschen_loeschen), die aus demselben Grund geaendert
           * wurde: sie loescht jetzt nur noch, was NIE etwas wert war. */
          /* Rauschen: war nie eine Arbitrage UND ist nicht als falsch
           * nachgewiesen. Nur DAS faellt weg — und genau das loescht auch
           * die Datenbank binnen 5 Minuten. Anzeige und Loeschregel sagen
           * damit dasselbe. */
          if (beste < 0 && f.pruefung !== 'falsch') { vorbeiRauschen++; return false; }

          /* Nachgewiesen oder rechnerisch falsch -> nur MARKIEREN; getrennt
           * wird erst nach den Schmuckschleifen unten, damit auch diese
           * Karten alle Felder tragen (Gedeckt-Pruefung ebenfalls dort). */
          /* NICHT dabei: rechnung_ok === false. Gemessen 13.8. nachts: der
           * Pruefer beanstandet auch 0,2-Punkte-Differenzen auf
           * Null-Prozent-Niveau (nachgerechnet -0,008 statt 0,499) - das
           * ist ein Hinweis-Chip auf der Karte, aber kein Beweis, dass die
           * CHANCE falsch war. Mit dem Kriterium wanderten echte
           * Verlaufszeilen in die falschen Rechnungen. */
          if (f.fehlpaarung ||
              (K.maxPlausibel && beste > K.maxPlausibel)) {
            f.rechnungFalsch = true;
          } else if (beste < K.mindestRendite) {
            /* War eine Arbitrage (ueber 0), hat sich aber nie gelohnt
             * (unter der Chancen-Schwelle): das KNAPP-ARCHIV. Vorher fielen
             * diese Zeilen einfach weg ("verlauf_nie") — jetzt sind sie der
             * wachsende Teil des Knapp-Reiters. */
            f.knappArchiv = true;
          }
          /* SONST NICHTS WEITER. Vorgabe 13.8. abends: "wenn es eine Chance
           * war und sie ist abgelaufen, dann in den Verlauf." Menge- und
           * Geldschwellen verschluckten hier vorher 33 von 46 echten
           * Verlaufs-Chancen (max_einsatz traegt nur den LETZTEN Stand). */
          return true;
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

        /* WELCHE SEITE BEGRENZT? — die haeufigste Frage zum max. Einsatz.
         *
         * max_einsatz ist min(Geld1/Anteil1, Geld2/Anteil2). Genau eine der
         * beiden Seiten erzwingt dieses Minimum, und das ist die Engstelle.
         * Ohne sie steht dort nur "hier passen 94 Euro hinein" und niemand
         * weiss, WO es klemmt und ob sich daran etwas aendern laesst.
         *
         * WICHTIG und der eigentliche Grund fuer kleine Betraege: gezaehlt
         * wird nur das Geld auf der BESTEN Preisstufe. Dahinter liegt in
         * der Regel mehr — aber zu schlechteren Kursen, und mit jeder
         * Stufe faellt die Rendite. Bei Kalshi, Smarkets und Betfair
         * liefert die Schnittstelle ohnehin nur diese eine Stufe; was
         * darunter liegt, ist NICHT GEMESSEN, nicht null. */
        function engstelleVon(f) {
          var g1 = Number(f.pm_menge), g2 = Number(f.gegen_menge);
          var s1 = Number(f.einsatz_1), s2 = Number(f.einsatz_2);
          if (!isFinite(g1) || !isFinite(g2) || !(s1 > 0) || !(s2 > 0)) return null;
          var moeglich1 = g1 / (s1 / 100);
          var moeglich2 = g2 / (s2 / 100);
          var erste = moeglich1 <= moeglich2;
          var buch = erste ? (f.buch_1 || 'polymarket') : (f.buch || 'betfair');
          var k = (K.buecher || {})[buch] || {};
          return { buch: buch, name: k.name || buch, geld: erste ? g1 : g2,
                   gesamt: erste ? moeglich1 : moeglich2 };
        }
        live.forEach(function (f) { f.engstelle = engstelleVon(f); });
        verlauf.forEach(function (f) { f.engstelle = engstelleVon(f); });

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

        /* Der Absage-Ausgang, gerechnet in anzeige.js (EINE Formel, keine
         * zweite Fassung). Er entscheidet seit dem 13.8. mit, was eine
         * Chance ist: was bei Absage rechnerisch Geld kostet, zaehlt nicht. */
        var A = welt.Anzeige && welt.Anzeige.absageBilanz;
        if (A) {
          live.forEach(function (f) { f.absage = A(f); });
          verlauf.forEach(function (f) { f.absage = A(f); });
        }

        /* EINE CHANCE IST EINE ZEILE, DIE GELD BRINGT.
         *
         * Vier Bedingungen, alle noetig:
         *   1. Rendite ueber der Schwelle       — das Verhaeltnis stimmt
         *   2. Menge BEKANNT                    — wir wissen, was hineinpasst
         *   3. Gewinn in Geld ueber der Schwelle — es lohnt sich wirklich
         *   4. Absage kostet nichts             — der dritte Ausgang ist gedeckt
         *
         * Bedingung 2 und 3 sind am 10.8.2026 dazugekommen, Bedingung 4 am
         * 13.8. (KONFIG.absageStreng): bei 2 % Gewinn je Wette frisst EIN
         * Absage-Verlust von 20 % zwanzig gewonnene Wetten. Nichts davon
         * wird geloescht — was hier durchfaellt, steht unter "Knappste
         * Paare" mit Begruendung. */
        /* Jetzt erst trennen: falsche Rechnungen in den eigenen Reiter.
         * Die Gedeckt-Pruefung kommt hier dazu (G existiert erst jetzt). */
        var G = welt.Anzeige && welt.Anzeige.istGedeckt;
        /* Die Gedeckt-Pruefung schlaegt nur bei EX-CHANCEN als "falsch" an:
         * eine Knapp-Archiv-Zeile hat nie behauptet, eine Chance zu sein. */
        verlauf.forEach(function (f) {
          if (!f.rechnungFalsch && !f.knappArchiv && G && !G(f)) f.rechnungFalsch = true;
        });
        falsch = verlauf.filter(function (f) { return f.rechnungFalsch; });
        var knappArchiv = verlauf.filter(function (f) { return !f.rechnungFalsch && f.knappArchiv; });
        verlauf = verlauf.filter(function (f) { return !f.rechnungFalsch && !f.knappArchiv; });

        /* PENDLER (entdeckt 14.8.): eine per Buchprobe gesperrte Zeile wird
         * vom Scanner wiederbelebt, solange er den Markt findet, und eine
         * Minute spaeter erneut gesperrt. Als live fehlte sie im
         * Falsch-Reiter — dessen Zahl sprang im Minutentakt. Nachgewiesen
         * falsch bleibt falsch: sie steht hier, auch waehrend sie live ist. */
        var falschNochLive = 0;
        live.forEach(function (f) {
          if (f.pruefung === 'falsch') {
            f.rechnungFalsch = true;
            falsch.push(f);
            falschNochLive++;
          }
        });

        /* Deckung (5. Bedingung, 13.8.): beide Seiten muessen nachweislich
         * GEGENSAETZLICHE Ausgaenge decken. Zwei Wetten auf denselben
         * Ausgang sehen in der Rechnung gut aus und sind doppeltes Risiko. */
        var chancen = live.filter(function (f) {
          /* Nachgewiesen oder rechnerisch falsch ist NIE eine Chance —
           * egal wie gut die Zahlen aussehen. Ohne diese Zeile konnte ein
           * wiederbelebter Kleber (Buchprobe sperrt ihn, der Scanner findet
           * den Markt weiter und macht ihn wieder live) mit 2–5 % als
           * Chance erscheinen. Entdeckt 14.8. an 10 pendelnden Zeilen. */
          if (f.fehlpaarung) return false;
          if (f.veraltet || f.zu_duenn) return false;
          if (f.rendite < K.mindestRendite) return false;
          /* Bedingung 6: unplausibel hoch ist KEINE Chance (siehe KONFIG). */
          if (K.maxPlausibel && f.rendite > K.maxPlausibel) return false;
          if (K.nurMitBekannterMenge && f.echter_gewinn === null) return false;
          if (f.echter_gewinn !== null && f.echter_gewinn < K.mindestGewinn) return false;
          if (K.absageStreng && f.absage && f.absage.art === 'verlust') return false;
          if (G && !G(f)) return false;
          /* Bedingung 7: Bewaehrung - erst von mehreren Laeufen bestaetigt. */
          if (K.bewaehrungS &&
              (Date.parse(f.zuletzt_gesehen) - Date.parse(f.zuerst_gesehen)) < K.bewaehrungS * 1000) return false;
          return true;
        });
        function besteVon(f) { return Number(f.beste_rendite == null ? f.rendite : f.beste_rendite); }
        /* Veraltet-Block im Chancen-Reiter: auch Ex-Chancen (beste >= 2),
         * deren Rendite unter die Schwelle gerutscht ist, waehrend die
         * Kurse alt wurden - vorher fielen die ins NICHTS. */
        var veraltetHoch = live.filter(function (f) {
          return f.veraltet && (f.rendite >= K.mindestRendite || besteVon(f) >= K.mindestRendite);
        });
        /* Nur Gruenes und knapp Danebengegangenes. Alles unter der
         * Rauschgrenze wird nicht gezeigt — es sagt nichts, ausser dass zwei
         * Buecher eben verschieden stehen. */
        var knapp = live.filter(function (f) {
          /* Vom Pruefer als falsch nachgewiesene Zeilen stehen im
           * Falsch-Reiter (auch solange sie live pendeln) — nicht doppelt. */
          if (f.pruefung === 'falsch') return false;
          if (f.veraltet) return false;
          /* Zu duenne Zeilen mit guter Rendite gehoeren hierher, nicht in
           * die Chancen — und schon gar nicht ins Nichts. */
          /* Alles mit guter Rendite, das KEINE Chance geworden ist, faellt
           * hierher: zu duenn, unbekannte Menge, oder Gewinn unter der
           * Geldschwelle. Es darf auf keinen Fall verschwinden — ein Filter,
           * der stillschweigend schluckt, ist eine Falle. */
          if (f.rendite >= K.mindestRendite) {
            /* Wort-Fehlpaarung ueber der Schwelle: aus den Chancen
             * verbannt, aber sichtbar HIER mit ihrer Marke — nicht im
             * unsichtbaren Rauschen. */
            if (f.fehlpaarung) return true;
            if (K.maxPlausibel && f.rendite > K.maxPlausibel) return true;
            if (f.zu_duenn) return true;
            if (f.echter_gewinn === null) return true;
            if (f.echter_gewinn < K.mindestGewinn) return true;
            if (K.absageStreng && f.absage && f.absage.art === 'verlust') return true;
            if (G && !G(f)) return true;
            if (K.bewaehrungS &&
                (Date.parse(f.zuletzt_gesehen) - Date.parse(f.zuerst_gesehen)) < K.bewaehrungS * 1000) return true;
            return false;
          }
          /* WAR es je eine Chance (beste >= Schwelle), bleibt es sichtbar,
           * auch wenn die Rendite unter die Rauschgrenze gestuerzt ist -
           * eine Ex-Chance darf nie im Nichts verschwinden. */
          if (besteVon(f) >= K.mindestRendite) return true;
          return f.rendite >= K.rauschGrenze;
        });
        /* Rauschen = der REST: alles Live, das in keiner der drei
         * sichtbaren Gruppen steckt. Per Definition geht die Rechnung
         * chancen + veraltet + knapp + rauschen = live IMMER auf. */
        var rauschen = live.length - chancen.length - veraltetHoch.length - knapp.length;
        /* Rauschen = was WIRKLICH unsichtbar bleibt: nie ueber der
         * Schwelle UND unter der Rauschgrenze. Die Zahl steht im
         * Knapp-Reiter - Mathematik: chancen + veraltet + knapp + rauschen
         * = alle Live-Zeilen, ohne Rest. */

        return {
          chancen: chancen,
          falsch: falsch,
          veraltetHoch: veraltetHoch,
          knapp: knapp,
          knappArchiv: knappArchiv,
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
            falsch: falsch.length,
            falsch_noch_live: falschNochLive,
            knapp_archiv: knappArchiv.length,
            /* beendete Zeilen, die NIE eine Arbitrage waren (beste unter 0)
             * - gezaehlt, dann von der Datenbank geloescht (Mathematik:
             * verlauf + falsch + knapp_archiv + diese Zahl = alle
             * geladenen Beendeten). */
            vorbei_rauschen: vorbeiRauschen,
            /* Zeilen, deren Markt ZURUECKGEKOMMEN ist: status wieder live,
             * die alte Beendigung steht noch dran. Solange fehlen sie in
             * den Archiv-Reitern - deshalb kann der Verlauf um einzelne
             * Zeilen sinken und spaeter zurueckkehren. Nie stillschweigend. */
            wiederbelebt: live.filter(function (f) { return f.vorbei_seit; }).length,
            /* Wie viele Verlaufszeilen ueber der Schwelle als Fehlpaarung
             * ausgeschieden sind. Nie stillschweigend — die Zahl steht
             * unter dem Reiter, sonst waere der Filter eine Falle. */
            verlauf_fehlpaarungen: verlaufFehlpaarungen,
            live_fehlpaarungen: live.filter(function (f) { return f.fehlpaarung; }).length,
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
            /* Summen ueber den juengsten Lauf JEDES Bereichs (nicht die
             * letzte Zeile allein — die gehoert immer nur einem Bereich
             * und liesse die Tafel bei jedem Ablesen andere Zahlen
             * behaupten). null nur, wenn gar kein frischer Lauf da ist. */
            pm_maerkte: (function () {
              var s = null;
              for (var b in jeBereich) if (Object.prototype.hasOwnProperty.call(jeBereich, b)) {
                s = (s || 0) + (Number(jeBereich[b].pm_maerkte) || 0);
              }
              return s;
            })(),
            bf_match_odds: (function () {
              var s = null;
              for (var b in jeBereich) if (Object.prototype.hasOwnProperty.call(jeBereich, b)) {
                s = (s || 0) + (Number(jeBereich[b].bf_match_odds) || 0);
              }
              return s;
            })(),
            paare: (function () {
              var s = null;
              for (var b in jeBereich) if (Object.prototype.hasOwnProperty.call(jeBereich, b)) {
                s = (s || 0) + (Number(jeBereich[b].paare) || 0);
              }
              return s;
            })(),
            /* Der langsamste Bereich bestimmt die genannte Dauer. */
            lauf_dauer_ms: (function () {
              var m = null;
              for (var b in jeBereich) if (Object.prototype.hasOwnProperty.call(jeBereich, b)) {
                var d = Number(jeBereich[b].dauer_ms);
                if (isFinite(d) && (m === null || d > m)) m = d;
              }
              return m;
            })(),
            /* Ein Fehler in IRGENDEINEM frischen Bereichslauf gehoert
             * gemeldet — nicht nur einer in der zufaellig letzten Zeile. */
            lauf_fehler: (function () {
              for (var b in jeBereich) if (Object.prototype.hasOwnProperty.call(jeBereich, b)) {
                if (jeBereich[b].fehler) return b + ': ' + jeBereich[b].fehler;
              }
              return lauf ? lauf.fehler : null;
            })(),
            /* Je Bereich: Alter und Paare des juengsten Laufs, fuer die
             * Anzeige, welcher Scanner gerade was tut. */
            je_bereich_lauf: (function () {
              var z = {};
              for (var b in jeBereich) if (Object.prototype.hasOwnProperty.call(jeBereich, b)) {
                z[b] = {
                  alter_s: Math.round((jetzt - Date.parse(jeBereich[b].gelaufen_am)) / 1000),
                  paare: jeBereich[b].paare,
                  pm_maerkte: jeBereich[b].pm_maerkte
                };
              }
              return z;
            })(),
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
