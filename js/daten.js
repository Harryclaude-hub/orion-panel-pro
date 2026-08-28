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
   * je ueber 0 % gewesen.
   *
   * DAZU SEIT 21.8.: was per Telegram GEMELDET wurde, wird IMMER geholt,
   * auch mit negativer Spitze. Karams Vorgabe: eine gemeldete Zeile muss
   * entweder in den Chancen stehen oder im Verlauf, nie im Nichts.
   * Gemessen an dem Abend: acht gemeldete Zeilen, keine davon irgendwo
   * auffindbar. Zwei davon hatten eine negative Spitze und wurden von
   * dieser Abfrage nicht einmal geladen. */
  function holeVerlauf(grenze) {
    /* NUR SEIT GESTERN (Karams Vorgabe 23.8.): angezeigt wird, was in den
     * letzten 24 Stunden GEFUNDEN wurde. Die Datenbank loescht aeltere
     * Vorbei-Zeilen ohnehin stuendlich (Job 96); dieser Filter schliesst
     * die Luecke zwischen zwei Loeschlaeufen. */
    var seitGestern = new Date(Date.now() - 24 * 3600000).toISOString();
    return db('orion_funde?status=eq.vorbei' +
      '&zuerst_gesehen=gte.' + encodeURIComponent(seitGestern) +
      '&or=(pruefung.eq.falsch,beste_rendite.gte.0,and(beste_rendite.is.null,rendite.gte.0),' +
      'telegram_gemeldet.is.true,knapp_gemeldet.is.true)' +
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

  /* ---------- Scanstand: ALLE Bereiche mit Zustand (Vorgabe 17.8., "c") ----
   * Eine Server-Funktion liefert je Bereich: aktiv, Takt, letzter Lauf,
   * Paare, Live-Zaehler. Aendert sich im Minuten-, nicht im Sekundenrhythmus
   * — deshalb nur alle 30 s frisch geholt, dazwischen aus dem Puffer: die
   * 2-Sekunden-Schleife bleibt schlank. Schlaegt das Holen fehl, bleibt der
   * ALTE Stand stehen (besser als ein leerer Block), und der naechste
   * Versuch kommt nach Ablauf des Puffers ohnehin. */
  var scanstandPuffer = { stand: 0, wert: null };
  function holeScanstandG() {
    if (Date.now() - scanstandPuffer.stand < 30000) return Promise.resolve(scanstandPuffer.wert);
    return fetch(K.supabase + '/rest/v1/rpc/orion_scanstand', {
      method: 'POST',
      headers: { apikey: K.key, authorization: 'Bearer ' + K.key,
                 'content-type': 'application/json', accept: 'application/json' },
      body: '{}'
    }).then(function (r) { if (!r.ok) throw new Error('Scanstand HTTP ' + r.status); return r.json(); })
      .then(function (d) { scanstandPuffer = { stand: Date.now(), wert: d }; return d; })
      .catch(function () { return scanstandPuffer.wert; });
  }

  /* Laeuft der Scanner ueberhaupt? (Juengster Lauf, egal welcher Bereich.) */
  function holeLauf() {
    return db('orion_laeufe?order=gelaufen_am.desc&limit=1').then(function (z) { return z[0] || null; });
  }

  /* SEIT DEM BEREICHS-SCANNER (11.8. abends) gibt es nicht mehr DEN letzten
   * Lauf, sondern einen je Bereich: orion-lauf-fussball alle 2 Minuten,
   * orion-lauf-tennis jede Minute, und so weiter. Eine einzelne letzte
   * Zeile zeigte dann mal 700 Maerkte (Fussball), mal 40 (Tennis) — die
   * Tafel haette bei jedem Ablesen andere Zahlen behauptet.
   *
   * Deshalb: die juengste Zeile JE BEREICH holen und daraus aggregieren.
   * 60 Zeilen reichen: der dichteste Takt ist 120 s, damit liegen selbst
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

  /* GEMESSEN 14.8. abends: JEDE Anfrage kostet gerade ~600 ms Grundzeit
   * (auch Einzeiler wie der Wechselkurs — das ist die Instanz, nicht die
   * Datenmenge), der Verlauf mit 450+ Zeilen sogar 1,4 s. Acht parallele
   * Anfragen je Takt hiessen also: die Anzeige haengt an der langsamsten.
   *
   * Deshalb PUFFER fuer alles, was sich langsam aendert. Der 2-Sekunden-
   * Takt traegt damit meistens nur noch EINE Anfrage (die Live-Funde) —
   * die Chancen bleiben so frisch wie immer, der Rest ist ein paar
   * Sekunden alt, was seinem Wesen entspricht (Verlauf aendert sich nur,
   * wenn etwas endet; der Wechselkurs einmal am Tag). Die Alter-Anzeigen
   * rechnen ohnehin client-seitig aus den Zeitstempeln — sie bleiben
   * korrekt, auch wenn der Schnappschuss gepuffert ist. */
  /* Alle Puffer lassen sich auf einen Schlag leeren — das braucht der
   * Sofort-ablesen-Knopf: er verspricht einen FRISCHEN Lesevorgang und
   * darf nicht aus dem Puffer bedient werden. */
  var pufferLeerer = [];
  function frisch() { for (var i = 0; i < pufferLeerer.length; i++) pufferLeerer[i](); }
  function gepuffert(hole, haltbarMs) {
    var p = { zeit: 0, daten: null, hat: false };
    pufferLeerer.push(function () { p.hat = false; });
    var f = function () {
      if (p.hat && Date.now() - p.zeit < haltbarMs) return Promise.resolve(p.daten);
      return hole().then(function (d) {
        /* Einen FEHLER nicht einfrieren: der naechste Takt darf es sofort
         * wieder versuchen. */
        if (!(d && d.fehler)) p = { zeit: Date.now(), daten: d, hat: true };
        return d;
      });
    };
    /* GEZIELT leeren, nicht nur alle auf einmal: der Verlauf muss sofort
     * nachgeladen werden koennen, wenn eine Live-Zeile verschwindet
     * (siehe verlaufNachziehen). */
    f.leeren = function () { p.hat = false; };
    return f;
  }
  /* EGRESS-BREMSE 20.8., Teil 2: auch die LIVE-Funde in den Puffer.
   * Der Scanner schreibt hoechstens alle 1-2 Minuten je Bereich — die
   * 2-Sekunden-Schleife holte dieselben Bytes also vielfach neu.
   * 15 s Puffer heisst: gleiche Anzeige, ein Achtel der Datenmenge.
   * Die Alters-Anzeigen ("vor X s") rechnen client-seitig weiter. */
  var holeLiveG      = gepuffert(holeLive, 15000);
  /* EGRESS-BREMSE 20.8. (Supabase-Limit, Drosselung angedroht): die
   * Verlaufsantwort wog 2 MB und wurde alle 10 s geholt — 12 MB/min,
   * bis 700 MB je Stunde Panelbetrieb, allein DAS riss das 5-GB-
   * Monatslimit. Verlauf aendert sich nur, wenn etwas endet (Takte:
   * minuetlich bis 5-minuetlich) — 60 s Puffer und 400 Zeilen (Anzeige
   * zeigt ~160) verlieren NICHTS und kosten ein Fuenfzehntel. */
  var holeVerlaufG   = gepuffert(function () { return holeVerlauf(400); }, 60000);
  var holeLaeufeG    = gepuffert(holeLaeufe, 6000);
  var holeUebersichtG = gepuffert(holeUebersicht, 6000);
  var holeKalshiG    = gepuffert(holeKalshi, 10000);
  var holeSmarketsG  = gepuffert(holeSmarkets, 10000);
  var holeWacheG     = gepuffert(holeWache, 10000);
  var kursG          = gepuffert(kurs, 300000);

  /* ---------- KEINE LUECKE ZWISCHEN LIVE UND VERLAUF (24.8.2026) ----
   *
   * Karams Beschwerde: "manche Chancen verschwinden richtig komisch und
   * haengen dazwischen, statt sofort in den Verlauf zu gehen."
   *
   * GEMESSEN, und es war genau eine Zahl: die Live-Funde werden alle
   * 15 Sekunden frisch geholt, der Verlauf aber nur alle 60 (Puffer aus
   * der Egress-Bremse vom 20.8.). Laeuft eine Chance ab, ist sie also
   * sofort aus der Live-Liste raus - und der gepufferte Verlauf kennt
   * sie bis zu 45 Sekunden lang noch nicht. In diesem Fenster steht sie
   * NIRGENDS. Sie ist nicht verloren, sie ist unsichtbar, und das sieht
   * von aussen genau wie ein Verschwinden aus.
   *
   * DIE REPARATUR kostet keinen einzigen zusaetzlichen Abruf im
   * Normalbetrieb: gemerkt wird, welche Schluessel eben noch live
   * waren. Fehlt beim naechsten Ablesen einer davon, wird der
   * Verlaufs-Puffer GEZIELT geleert und der Verlauf sofort neu geholt.
   * Damit ist eine abgelaufene Chance im selben Takt im Verlauf - ohne
   * Zwischenzustand. Passiert nichts, wird auch nichts nachgeladen. */
  var zuletztLive = null;

  function verlaufNachziehen(teile) {
    var live = teile[0] || [];
    var jetztLive = {};
    for (var i = 0; i < live.length; i++) jetztLive[live[i].schluessel] = true;

    var verschwunden = 0;
    if (zuletztLive) {
      for (var s in zuletztLive) {
        if (Object.prototype.hasOwnProperty.call(zuletztLive, s) && !jetztLive[s]) verschwunden++;
      }
    }
    zuletztLive = jetztLive;

    if (!verschwunden) return teile;

    /* Etwas ist gerade abgelaufen: den Verlauf JETZT frisch holen,
     * damit die Zeile im selben Zeichnen wieder auftaucht. Schlaegt das
     * fehl, wird mit dem alten Verlauf gezeichnet - lieber ein
     * veralteter Verlauf als gar keine Anzeige. */
    holeVerlaufG.leeren();
    return holeVerlaufG().then(function (frisch) {
      teile[1] = frisch;
      teile._nachgezogen = verschwunden;
      return teile;
    }, function () { return teile; });
  }

  function ladeAlles() {
    return Promise.all([holeLiveG(), holeVerlaufG(), holeLaeufeG(), holeKalshiG(), holeWacheG(),
                        holeUebersichtG(), holeSmarketsG(), kursG(), holeScanstandG()])
      .then(verlaufNachziehen)
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
         * gelesen hat - nicht aus irgendeinem.
         *
         * L9 BEHOBEN (28.8.2026). Zwei Fehler steckten in den drei Zeilen
         * darunter, beide in derselben Richtung: die Zahl war zu KLEIN,
         * also zu optimistisch.
         *
         *   1. KEIN NACHALTERN. bf_alter_s ist das Alter ZUM ZEITPUNKT
         *      DES LAUFS. Lief der Lauf vor 19 s und war der Kurs damals
         *      14 s alt, ist er JETZT 33 s alt - das Panel zeigte 14.
         *      Genau so gemessen am 28.8.
         *   2. KEINE FRISCHEGRENZE. Genommen wurde der erste Lauf mit
         *      einer Zahl, egal wie alt der Lauf war. STEHT DER SCANNER,
         *      friert die Betfair-Ampel damit auf gruen ein und luegt
         *      unbegrenzt weiter. Im Normalbetrieb sind es ein paar
         *      Sekunden Fehler, im Ernstfall - und nur da zaehlt die
         *      Ampel - beliebig viele.
         *
         * Kalshi und Smarkets hatten das Problem nie: ihre Zahlen werden
         * oben aus updated_at gegen JETZT gerechnet und altern von selbst
         * nach. Nur Betfair kam ueber den Umweg Laufeintrag.
         *
         * Dieselbe Grenze wie fuer die Bereichslaeufe (FRISCH_MS, 5 min):
         * hat seit fuenf Minuten kein Lauf Betfair gelesen, ist die Zahl
         * nicht mehr aussagekraeftig. Dann bleibt sie null, und null zeigt
         * das Panel als rot - richtig so. Was man nicht weiss, ist nicht
         * gruen.
         *
         * GEFAHRLOS fuer die Zeilen: bf_alter_s steuert nur Anzeige,
         * Ampel und Warntext (anzeige.js:2446, :2477, :2668, :2687). Ob
         * eine Zeile als veraltet gilt, entscheidet pm_preis_seit /
         * bf_quote_seit JE ZEILE - davon wird hier nichts angefasst. */
        var bfAlterS = null;
        for (var bi = 0; bi < laeufe.length; bi++) {
          var BL = laeufe[bi];
          if (BL.bf_alter_s === null || BL.bf_alter_s === undefined) continue;
          var seitLauf = Math.round((jetzt - Date.parse(BL.gelaufen_am)) / 1000);
          if (!isFinite(seitLauf) || seitLauf * 1000 > FRISCH_MS) break;
          bfAlterS = BL.bf_alter_s + Math.max(0, seitLauf);
          break;
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
           * dieser Zeile: der Fussball-Takt (120 s) sagt nichts darueber,
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
        /* SEIT 18.8.2026 (des Auftraggebers Vorgabe): Smarkets-Zeilen zeigen nicht
         * mehr auf smarkets.com, sondern auf SEINEN Broker
         * (pro.sportmarket.com). Gesetzt wird dort, also gehoert der Link
         * dorthin — dieselbe Ueberlegung wie bei Betfair ueber Orbit.
         *
         * Die Adresse haengt am BEREICH, nicht am einzelnen Markt: ein
         * Link auf die Partie ist nicht baubar, weil die Seite auf JEDEN
         * Pfad mit 200 antwortet (gemessen, siehe konfig.js). Wer die
         * Partie sucht, findet ihren Namen auf der Karte im Klartext.
         *
         * Der alte Schraegstrich-Griff faellt damit weg: er richtete
         * smarkets.com-Adressen, die hier nicht mehr vorkommen. */
        function smarketsLinkRichten(f) {
          function broker() {
            var sport = (K.smarketsSport || {})[f.bereich];
            return K.smarketsBroker + (sport || '');
          }
          if (!K.smarketsBroker) return;
          if ((f.buch_1 || 'polymarket') === 'smarkets') f.pm_link = broker();
          if ((f.buch || 'betfair') === 'smarkets')      f.bf_link = broker();
        }

        live.forEach(function (f) { f.veraltet = veraltet(f); brokerRichten(f); smarketsLinkRichten(f); });
        verlauf.forEach(function (f) { f.veraltet = false; brokerRichten(f); smarketsLinkRichten(f); });

        /* FUNKER-NACHPRUEFUNG ALS DEFAULT (des Auftraggebers Befehl 17.08. nachts):
         * die unabhaengige Nachrechnung, die frueher nur auf Chat-Befehl
         * lief („pruefe #…"), laeuft jetzt IMMER — jede Zeile, jeder Takt.
         * Reine Arithmetik mit denselben Spiegel-Formeln, billig. Das
         * Ergebnis haengt als f.nachpruefung an der Zeile; die Karte
         * zeigt den Abgleich (gruener Haken) oder die Abweichung (rot
         * in den Warnungen). Ein Fehler hier darf NIE das Laden reissen. */
        function nachpruefen(f) {
          try {
            var F = welt.Funker;
            if (!F || !F.nachrechnen) return null;
            return F.nachrechnen(f);
          } catch (e) {
            return { pruefbar: false, text: 'Nachprüfung selbst gescheitert: ' + String((e && e.message) || e) };
          }
        }
        live.forEach(function (f) { f.nachpruefung = nachpruefen(f); });
        verlauf.forEach(function (f) { f.nachpruefung = nachpruefen(f); });

        /* RECHNUNGSNUMMER: vergibt seit dem 14.8. die DATENBANK selbst
         * (Spalte nr, fortlaufend ab #10000, Minutentakt, nie doppelt,
         * nie wiederverwendet — ein wiederbelebter Fund behaelt seine).
         *
         * Vorher rechnete der Browser einen djb2-Hash aus dem Schluessel.
         * Gemessen an 507 echten Zeilen: EINE Kollision — #73641 gehoerte
         * zwei verschiedenen Funden, der Funker haette den falschen
         * geprueft. Deshalb kommt die Nummer jetzt mit den Daten und wird
         * hier NICHT mehr errechnet. Eine ganz frische Zeile (unter einer
         * Minute alt) hat noch keine — dann bleibt f.nr leer, die Karte
         * zeigt den Chip nicht, und der Funker sagt es dazu. */

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
           * damit dasselbe.
           *
           * AUSNAHME SEIT 21.8.: was per Telegram GEMELDET wurde, bleibt
           * hier stehen. Karams Vorgabe: eine gemeldete Zeile gehoert in
           * die Chancen ODER in den Verlauf, nie ins Nichts. Die
           * Loeschregel orion_rauschen_loeschen wurde am selben Tag um
           * genau dieselbe Ausnahme erweitert — die beiden bleiben
           * gekoppelt, sonst zeigt das Panel etwas an, das die Datenbank
           * fuenf Minuten spaeter wegwirft, oder umgekehrt. */
          if (beste < 0 && f.pruefung !== 'falsch' &&
              !f.telegram_gemeldet && !f.knapp_gemeldet) { vorbeiRauschen++; return false; }

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
        /* ---------- KARAMS AUFTEILUNG (23.8.2026) ----------
         *
         * "Knappe Paare sind immer alles, was unter zwei Prozent ist;
         * ueber zwei Prozent Rendite ist dann Chance." Die Trennlinie ist
         * die RENDITE (vor Gebuehren), sonst nichts Wirtschaftliches.
         *
         * Was BLEIBT, sind die Beweisfragen — eine nachweislich falsche
         * Paarung ist gar kein Fund, egal welche Zahl dransteht:
         *   nachgewiesen falsch / Fehlpaarung  -> Falsch-Reiter
         *   Kurse veraltet                     -> Veraltet-Block
         *   Mannschaftsklasse/Anpfiff/Deckung  -> knappe Paare, mit Marke
         *   unplausibel hoch (Kleber)          -> knappe Paare, mit Marke
         *
         * Was NICHT mehr aussperrt, sondern nur noch als Marke auf der
         * Karte steht: duenne Menge, unbekannte Menge, Gewinn unter der
         * Geldschwelle, Absage-Risiko, Bewaehrungszeit. Diese Warnungen
         * trug die Karte schon immer — jetzt entscheiden sie nicht mehr
         * ueber den Reiter. */
        var chancen = live.filter(function (f) {
          /* Nachgewiesen oder rechnerisch falsch ist NIE eine Chance —
           * egal wie gut die Zahlen aussehen. Ohne diese Zeile konnte ein
           * wiederbelebter Kleber (Buchprobe sperrt ihn, der Scanner findet
           * den Markt weiter und macht ihn wieder live) mit 2–5 % als
           * Chance erscheinen. Entdeckt 14.8. an 10 pendelnden Zeilen. */
          if (f.fehlpaarung) return false;
          if (f.veraltet) return false;
          /* ACHTE BEDINGUNG (18.8.): dieselbe Mannschaftsklasse und dieselbe
           * Anstosszeit — im BROWSER nachgerechnet, nicht nur geglaubt.
           *
           * Warum hier zusaetzlich: Scanner und Datenbank pruefen das auch,
           * aber der Datenbank-Waechter laeuft im MINUTENTAKT. In diesem
           * Fenster koennte eine frisch entstandene Fehlpaarung kurz als
           * Chance sichtbar sein — genau in dem Moment, in dem der Auftraggeber
           * hinsieht. Diese Pruefung schliesst das Fenster ganz: sie laeuft
           * bei JEDEM Zeichnen, also alle zwei Sekunden.
           *
           * Anlass: erste Elf gegen U21 desselben Vereins, 4,68 % Rendite. */
          var Zu = welt.Zuordnung;
          if (Zu && Zu.kennungGleich && f.bf_partie &&
              !Zu.kennungGleich(f.titel, f.bf_partie)) return false;
          /* ZEITPFLICHT (19.8.2026): bisher stand hier nur zeitPasst(), und
           * das gibt bei einer FEHLENDEN Zeit true zurueck ("ungemessen ist
           * nicht falsch"). Damit stand eine Zeile ohne belegten Anpfiff in
           * den Chancen. Ab jetzt gilt hier dieselbe Regel wie im Scanner
           * (pruefeSpiel, Huerde 4) und in der Wache (Stufe 2): ohne Datum
           * auf BEIDEN Seiten ist nicht beweisbar, dass es dasselbe Spiel
           * ist -- und was nicht beweisbar ist, ist keine Chance.
           * Gemessen: kostet 2 von 23 lebenden Zeilen, beide mit negativer
           * Rendite. */
          if (!f.beginnt_am || !f.endet_am) return false;
          if (Zu && Zu.zeitPasst && !Zu.zeitPasst(f.endet_am, f.beginnt_am)) return false;
          if (f.rendite < K.mindestRendite) return false;
          /* Unplausibel hoch ist KEINE Chance (siehe KONFIG, jetzt 6,5 %
           * vor Gebuehren) — das ist eine Beweisfrage: Kleber, kein Fund. */
          if (K.maxPlausibel && f.rendite > K.maxPlausibel) return false;
          /* Deckung bleibt Pflicht: zwei Wetten auf DENSELBEN Ausgang sind
           * keine Arbitrage, sondern doppeltes Risiko. */
          if (G && !G(f)) return false;
          /* Menge, Geldschwelle, Absage und Bewaehrung sperren seit dem
           * 23.8. NICHT mehr aus (Karams Aufteilung) — sie stehen als
           * Marken auf der Karte. */
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
            /* Ueber der Schwelle, aber an einer BEWEISFRAGE gescheitert:
             * aus den Chancen verbannt, aber sichtbar HIER mit Marke —
             * nicht im unsichtbaren Rauschen. Seit 23.8. landen die
             * frueher stillen Faelle (Mannschaftsklasse, Anpfiff) auch
             * hier statt im Nichts. */
            if (f.fehlpaarung) return true;
            if (K.maxPlausibel && f.rendite > K.maxPlausibel) return true;
            var Zu3 = welt.Zuordnung;
            if (Zu3 && Zu3.kennungGleich && f.bf_partie &&
                !Zu3.kennungGleich(f.titel, f.bf_partie)) return true;
            if (!f.beginnt_am || !f.endet_am) return true;
            if (Zu3 && Zu3.zeitPasst && !Zu3.zeitPasst(f.endet_am, f.beginnt_am)) return true;
            if (G && !G(f)) return true;
            /* Alles Uebrige ueber 2 % IST eine Chance (Karams Aufteilung),
             * auch mit duenner Menge oder in der Bewaehrung — die Marken
             * stehen auf der Karte. */
            return false;
          }
          /* WAS GEMELDET WURDE, VERSCHWINDET NIE (21.8., Karams Vorgabe:
           * "die Chancen muessen immer angezeigt werden, und wenn ich mich
           * neu einlogge ... dann soll sie angezeigt werden oder in den
           * Verlauf getan werden. Das ist die erste Wichtigkeit").
           *
           * Gemessen an diesem Abend: von ACHT per Telegram gemeldeten
           * Zeilen waren ALLE ACHT im Panel unsichtbar. Sie standen beim
           * Versand ueber der Grenze und fielen danach darunter; die
           * Rauschgrenze blendete sie aus, und weil sie nie 2 % erreicht
           * hatten, griff die Ex-Chance-Regel darunter auch nicht.
           *
           * Eine Nachricht, die auf etwas Unauffindbares zeigt, ist die
           * schlimmste Form des stillen Fehlschlags: sie behauptet einen
           * Fund und laesst den Leser suchen. Deshalb steht diese Regel
           * VOR allen Grenzen. Sie kostet hoechstens ein paar Zeilen
           * Anzeige und nimmt dem Panel seine gefaehrlichste Luecke. */
          if (f.telegram_gemeldet || f.knapp_gemeldet) return true;
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
          scanstand: teile[8] || null,
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
    ladeAlles: ladeAlles,
    frisch: frisch
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
