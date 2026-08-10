/* Orion Panel Pro — Konfiguration
 * Eine Stelle fuer alles, was sich aendern kann.
 */

(function (welt) {
  'use strict';

  welt.KONFIG = {
    supabase: 'https://noexklrgtqveiclijdwp.supabase.co',
    key: 'sb_publishable_NrgVUoZhe-uN8U8j41P17Q_9cZgUd6M',

    sperrwort: 'ARBRADAR2026',

    /* Wie oft die Seite die Funde abliest. Das ist NUR Ablesen: gesucht
     * wird auf dem Server im Minutentakt. Deshalb sind 2 Sekunden hier
     * billig, waehrend ein voller Scan alle 2 Sekunden unmoeglich waere. */
    taktMs: 2000,

    /* Betfair-Kommission: die Bridge schickt marketBaseRate derzeit nicht
     * mit. Regel aus der Uebergabe: unbekannte Gebuehr NIEMALS als 0,
     * Rueckfall auf den unguenstigsten bekannten Satz. */
    bfGebuehrUnbekannt: 0.07,

    /* Zuordnungsschwellen. 0.5 fuer die Partie, 0.8 fuer den Laeufer.
     * Die 0.8 ist die Lehre aus den 663 Scheinchancen vom 9.8.2026. */
    schwelle: 0.5,
    laeuferSchwelle: 0.8,

    /* Ab welcher Rendite ein Fund als Chance gilt. */
    mindestRendite: 0.5,

    /* Ab welchem handelbaren Betrag ein Fund ueberhaupt als Chance zaehlt.
     *
     * Gemessen am 10.8.2026 im Smarkets-Orderbuch eines BTTS-Marktes:
     *     YES offers  price 5291, quantity 67        <- 0,0035 GBP
     *                 price 5405, quantity 3700277   <- der echte Kurs
     * Der beste Preis im Buch war ein STAUBAUFTRAG. Er zog die
     * Kehrwertsumme auf 99,21 % und haette eine Arbitrage vorgetaeuscht,
     * die mit dem naechsten echten Kurs bei 100,35 % liegt — also keine ist.
     *
     * Eine Rendite ohne Menge ist keine Chance, sondern eine Zahl. Solche
     * Zeilen werden NICHT geloescht — sie bekommen eine Marke und fallen
     * aus der Chancen-Zaehlung. Verschweigen waere schlimmer als zeigen. */
    mindestEinsatz: 5,

    /* Ab hier abwaerts ist es Rauschen und wird gar nicht mehr gezeigt.
     * Ausdruecklicher Wunsch: nur Gruenes und knapp Danebengegangenes.
     * Gemessen am 10.8.2026: von 558 Verlaufszeilen lagen 438 unter -1 %,
     * 78 dazwischen. Die 78 bleiben, sie zeigen dass gesucht wird.
     * Der Verlauf wird serverseitig ebenso beschnitten (orion_rauschen_loeschen). */
    rauschGrenze: -1.0,

    /* Der VERLAUF ist strenger als die Live-Ansicht: dort steht nur, was
     * sich wirklich gelohnt haette. Was nie im Plus war, wird geloescht.
     * Serverseitig ebenso (orion_rauschen_loeschen(0.0), alle 5 Minuten). */
    verlaufMinRendite: 0,

    /* Smarkets-Kommission: 2 % Standard-Tarif auf den Nettogewinn je Markt,
     * gleiche Form wie bei Betfair. NICHT gemessen — es gibt kein Konto und
     * die oeffentliche API gibt den Satz nicht heraus. Es bestehen daneben
     * 1 % (Pro) und 3 % (Select); Select trifft genau die besonders
     * profitablen Konten. Wer dorthin rutscht, traegt hier 0.03 ein, sonst
     * rechnen sich duenne Funde still ins Plus. */
    smarketsGebuehr: 0.02,

    /* Die Buecher an EINER Stelle. Die Anbietertafel wird nach `umfang`
     * sortiert, aufsteigend: das KLEINSTE Buch zuerst, denn es ist die
     * Engstelle — was dort nicht liegt, kann nirgends gepaart werden. Die
     * grossen stehen unten und bringen die Partien, die es sonst nirgends
     * gibt.
     *
     * `umfang` ist der am 10.8.2026 gemessene Umfang im 72h-Fenster, nur
     * fuer die Reihenfolge. Die angezeigten Zahlen kommen live aus den
     * Schnappschuessen, nicht von hier.
     *
     * `art` entscheidet, wie die Zahl gelesen wird:
     *   preis  Anteil zwischen 0 und 1   (Polymarket, Kalshi)
     *   quote  Dezimalquote ueber 1      (Betfair, Smarkets) */
    /* `absage` sagt, was passiert, wenn WEDER noch eintritt: Spiel abgesagt,
     * abgebrochen, Spieler tritt nicht an. Das ist die gefaehrlichste Luecke
     * einer Arbitrage und steht in keiner Rendite: gibt ein Buch das Geld
     * zurueck und das andere wertet, ist aus der abgesicherten Wette eine
     * offene geworden.
     *
     * `absage_sicher` trennt Beleg von Vermutung. Nur Smarkets hat eine
     * zentrale, nachlesbare Regel; bei Polymarket und Kalshi steht sie JE
     * MARKT und kann von Markt zu Markt verschieden sein.
     * Belegt am 10.8.2026, Quellen auf regelwerk.html. */
    buecher: {
      kalshi:     { name: 'Kalshi',     kurz: 'KA', chip: 'ka', art: 'preis',
                    konto: 'kein Konto', umfang: 206,
                    absage: 'oft KEINE Rückzahlung — wertet zum zuletzt gehandelten Preis',
                    absage_sicher: false },
      polymarket: { name: 'Polymarket', kurz: 'PM', chip: 'pm', art: 'preis',
                    konto: 'kein Konto', umfang: 390,
                    absage: 'Regel steht je Markt · 50/50 zahlt 0,50 je Anteil, NICHT den Einsatz',
                    absage_sicher: false },
      smarkets:   { name: 'Smarkets',   kurz: 'SM', chip: 'sm', art: 'quote',
                    konto: 'kein Konto', umfang: 797,
                    absage: 'annulliert, voller Einsatz zurück (36-Stunden-Regel)',
                    absage_sicher: true },
      /* ABGESCHALTET am 10.8.2026, nicht geloescht.
       *
       * Betfair ist das einzige Buch, das einen laufenden Heim-PC braucht.
       * Aus Supabase ist es gemessen gesperrt: 5 von 8 Wegen antworten mit
       * 403 von Cloudflare, auch die oeffentliche Startseite, und zwar VOR
       * jeder Anmeldung.
       *
       * Der letzte offene Weg waere Zertifikat -> Stream gewesen. Er ist
       * eine SACKGASSE, und das ist keine Vermutung: Betfairs eigenes
       * Stream-Schema (ESASwaggerSchema.json) hat in RunnerDefinition nur
       * sortPriority, removalDate, id, hc, adjustmentFactor, bsp, status —
       * und in MarketDefinition nur eventId, eventTypeId, marketType und
       * Verwandtes. KEIN einziges Feld im ganzen Schema traegt einen Namen.
       * Der Stream liefert Preise zu einer selectionId, ohne zu sagen,
       * welche Mannschaft das ist. Namen gibt es nur ueber
       * listMarketCatalogue, und das liegt auf api.betfair.com — 403.
       *
       * Ohne Namen keine Zuordnung. Damit sind alle neun gemessenen Wege
       * erschoepft. Der Code bleibt stehen, falls Betfair die Sperre je
       * loest: dann reicht aktiv: true. */
      betfair:    { name: 'Betfair',    kurz: 'BF', chip: 'bf', art: 'quote',
                    konto: 'Konto + Bridge', umfang: 1189, ueberBroker: true,
                    absage: 'eigenes Regelwerk, ungeprüft — Buch ist abgeschaltet',
                    absage_sicher: false,
                    aktiv: false,
                    grund: 'aus Supabase gesperrt (403), Stream liefert keine Namen' }
    },

    /* Ab wann etwas als stehengeblieben gilt. */
    bridgeMaxAlterS: 300,
    /* Smarkets wird alle 5 Minuten eingesammelt, ein Durchlauf dauert 7 s.
     * Alles unter 15 Minuten ist Normalbetrieb. */
    smarketsMaxAlterS: 900,
    /* Kalshi wird alle 5 Minuten gesammelt, ein Durchlauf dauert 52 s.
     * Alles unter 10 Minuten ist also Normalbetrieb. */
    kalshiMaxAlterS: 600,
    laufMaxAlterS: 180,

    /* Betfair ist aus Oesterreich im Browser gesperrt. Die Marktnummer im
     * Link stimmt, die Seite weist ab. Deshalb ueber den Broker.
     *
     * 96ex.com antwortet seit dem 9.8.2026 GAR NICHT mehr: HTTP 000,
     * Zeitueberschreitung nach 21 s, dreimal gemessen, auch die blosse
     * Startseite. Die Adresse ist tot, das war kein Proxy-Problem.
     *
     * orbitexch.com antwortet in 0,3 s. Muster mit drei verschiedenen
     * Marktnummern gegengeprueft: der Seitentitel nannte jedes Mal den
     * richtigen Wettbewerb (Leagues Cup, Delhi Premier League,
     * International Twenty20). */
    brokerMuster: 'https://www.orbitexch.com/customer/sport/1/market/{id}'
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
