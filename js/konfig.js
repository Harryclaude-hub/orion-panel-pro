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

    /* BETFAIR-SEITE = ORBIT-SATZ, belegt am 11.8.2026 spät abends.
     *
     * betfair.com ist aus Österreich gesperrt; jeder Betfair-Link dieser
     * Seite wird auf den Broker Orbit umgeschrieben, und DORT wird gesetzt.
     * Orbit nimmt pauschal 3 % auf den Nettogewinn je Markt, keine
     * Premium-Gebühr, 0 % auf Verluste. Also ist 3 % der Satz, der für uns
     * gilt — nicht Betfairs eigener marketBaseRate (2 bis 7 %, gilt nur
     * für ein direktes Betfair-Konto) und erst recht nicht der alte
     * 7-%-Rückfall, der mehr als das Doppelte war. */
    bfGebuehrUnbekannt: 0.03,
    orbitGebuehr: 0.03,

    /* Zuordnungsschwellen. 0.5 fuer die Partie, 0.8 fuer den Laeufer.
     * Die 0.8 ist die Lehre aus den 663 Scheinchancen vom 9.8.2026. */
    schwelle: 0.5,
    laeuferSchwelle: 0.8,

    /* Ab welcher Rendite ein Fund als Chance gilt — und ab welcher er im
     * VERLAUF bleibt. Alles darunter steht unter "Knappste Paare"
     * (sichtbar, gezaehlt, nur nicht mehr "Chance" genannt).
     *
     * 11.8.2026 abends auf 3,0 gesetzt, am 12.8.2026 auf 2,0 gesenkt —
     * NICHT aus Hoffnung, sondern nach der ersten vollen Nacht mit vier
     * Buechern. In 13 Stunden entstanden 96 Zeilen:
     *
     *     ab 5,0 %      0        <- keine einzige, das ist neu
     *     ab 3,0 %      0        <- deshalb blieb der Reiter leer
     *     ab 2,0 %      4        <- diese vier
     *     ab 1,0 %     16
     *     ueber null   38
     *
     * Die vier ueber 2 % bestehen alle die unabhaengige Wortpruefung, und
     * zwei davon waren dick genug, um zu zaehlen:
     *     2,66 %  Charlotte FC vs Pachuca   2814 EUR handelbar -> 74,89 EUR
     *     2,39 %  Real Salt Lake vs Juarez   571 EUR handelbar -> 13,65 EUR
     * Beide standen 44 Minuten lang. Die anderen zwei bringen 0,38 und
     * 0,58 EUR und fallen ohnehin durch `mindestGewinn`.
     *
     * Bei 3,0 haette die Nacht also NICHTS gezeigt, obwohl zweimal etwas
     * da war. Genau dafuer ist die Schwelle da, und deshalb wandert sie.
     *
     * Was weiter gilt: die Buecher liegen im Schnitt 1,3 % auseinander,
     * und JEDE Zeile ueber 5 % war bisher eine Fehlpaarung, nie eine
     * Chance — der Waechter markiert ab 5 % weiterhin als unplausibel. */
    mindestRendite: 2.0,

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

    /* Ab welchem GEWINN IN GELD eine Zeile als Chance gilt.
     *
     * Das ist die Schwelle, die am 10.8.2026 gefehlt hat. Vorher zaehlte
     * allein die Rendite, und dann steht "+1,03 %" neben einer Zeile, die
     * drei Cent bringt:
     *
     *     ka>sm  Anápolis FC     Rendite +1,03 %
     *            handelbar: 2,94        Gewinn: 0,030
     *
     * Beides ist wahr. Nur ist das zweite die Zahl, die zaehlt. Eine
     * Rendite ist ein Verhaeltnis; ausgezahlt wird ein Betrag.
     *
     * Zusammen mit `nurMitBekannterMenge` heisst das: eine Chance ist eine
     * Zeile, bei der man WEISS, wie viel hineinpasst, UND bei der das genug
     * ist. Alles andere wandert unter "Knappste Paare" und ist dort
     * weiterhin sichtbar — es verschwindet nicht, es heisst nur nicht mehr
     * Chance. */
    /* EINHEIT: USD. Alle Betraege im System stehen in USD — Polymarket und
     * Kalshi rechnen so, Smarkets wird an der Quelle von GBP nach USD
     * umgerechnet. Die ANZEIGE rechnet auf Euro um (Kurs holt die Datenbank
     * per pg_net); diese Schwelle bleibt bewusst in USD, damit sie sich
     * nicht mit dem Tageskurs verschiebt. Bei 0,87 EUR/USD sind 5 USD rund
     * 4,33 €. Wer in Euro denken will, traegt hier den Eurobetrag geteilt
     * durch den Kurs ein. */
    mindestGewinn: 5,

    /* Unbekannte Menge ist keine Chance.
     *
     * Bisher galt: "unbekannt ist nicht zu duenn" — richtig, denn es waere
     * eine Unterstellung. Daraus wurde aber faelschlich "also ist es eine
     * Chance". Beides ist falsch. Wer nicht weiss, wie viel hineinpasst,
     * weiss nicht, ob er 3 Cent oder 300 Euro verdient. Das gehoert
     * gezeigt, aber nicht unter "Chancen".
     *
     * Auf false setzen, wenn man solche Zeilen wieder mitzaehlen will. */
    nurMitBekannterMenge: true,

    /* Ab hier abwaerts ist es Rauschen und wird gar nicht mehr gezeigt.
     * Ausdruecklicher Wunsch: nur Gruenes und knapp Danebengegangenes.
     * Gemessen am 10.8.2026: von 558 Verlaufszeilen lagen 438 unter -1 %,
     * 78 dazwischen. Die 78 bleiben, sie zeigen dass gesucht wird.
     * Der Verlauf wird serverseitig ebenso beschnitten (orion_rauschen_loeschen). */
    /* 14.8. frueh angehoben von -1,0 auf 0,0: das Band zwischen -1 und 0
     * war der Haupttreiber des Zahlen-Springens im Knapp-Reiter - Paare,
     * die im 20-Sekunden-Takt auftauchen und verschwinden und nichts
     * sagen, ausser dass zwei Buecher verschieden stehen. Unter null ist
     * keine Beinahe-Chance. Geloescht wird nichts; die Zahl der
     * ausgeblendeten Zeilen steht weiter im Reiter. */
    rauschGrenze: 0.0,

    /* Der VERLAUF ist strenger als die Live-Ansicht: dort steht nur, was
     * sich wirklich gelohnt haette. Was nie im Plus war, wird geloescht.
     * Serverseitig ebenso (orion_rauschen_loeschen(0.0), alle 5 Minuten). */
    verlaufMinRendite: 0,

    /* Smarkets-Kommission: 2 % Standard auf den NETTOGEWINN JE MARKT.
     * BELEGT am 11.8.2026 spät abends aus der Commission FAQ des Anbieters
     * (vorher stand hier "nicht gemessen"). Bei Verlust in einem Markt
     * fällt keine Kommission an.
     *
     * Die beiden anderen Tarife stehen mit ihren SCHWELLEN da, damit man
     * merkt, wann man hineinrutscht:
     *   1 % Pro    — ab 1500 Wetten ODER 1 Mio £ Einsatz je Kalendermonat,
     *                muss ausdrücklich gewählt werden
     *   3 % Select — ab 25 000 £ Nettogewinn in den vorangegangenen
     *                12 Kalendermonaten, trifft die profitabelsten Konten
     * Wer dorthin rutscht, trägt hier 0.01 bzw. 0.03 ein — sonst rechnen
     * sich dünne Funde still ins Plus. */
    smarketsGebuehr: 0.02,
    smarketsPro: 0.01,
    smarketsSelect: 0.03,

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
     * zentrale, nachlesbare Regel; bei Polymarkt und Kalshi steht sie JE
     * MARKT und kann von Markt zu Markt verschieden sein.
     * Belegt am 10.8.2026, Quellen auf regelwerk.html.
     *
     * `absage_form` macht die Regel RECHENBAR (13.8.2026). Vier Formen:
     *   einsatz_zurueck  annulliert, Geld zurueck          -> nie Verlust
     *   anteil_50        Markt loest 50/50 auf,
     *                    0,50 je Anteil                    -> haengt vom KAUFPREIS ab:
     *                       JA fuer 0,37 gekauft  -> 0,50 zurueck = Gewinn
     *                       NEIN fuer 0,62 gekauft -> 0,50 zurueck = Verlust
     *   letzter_preis    wertet zum letzten Kurs           -> nicht vorhersagbar,
     *                                                         schlimmstenfalls Einsatz weg
     *   unbekannt        Regel nicht belegt                -> wie letzter_preis rechnen
     * Daraus rechnet die Anzeige je Fund den ABSAGE-AUSGANG in Geld aus.
     * Diese Zahl steht in keiner Rendite — und bei 2 % Gewinn je Wette ist
     * ein einziger Absage-Verlust groesser als zwanzig gewonnene Wetten. */
    buecher: {
      kalshi:     { name: 'Kalshi',     kurz: 'KA', chip: 'ka', art: 'preis',
                    konto: 'kein Konto', umfang: 206,
                    absage: 'oft KEINE Rückzahlung — wertet zum zuletzt gehandelten Preis',
                    absage_sicher: false, absage_form: 'letzter_preis' },
      polymarket: { name: 'Polymarket', kurz: 'PM', chip: 'pm', art: 'preis',
                    konto: 'kein Konto', umfang: 390,
                    absage: 'Regel steht je Markt · 50/50 zahlt 0,50 je Anteil, NICHT den Einsatz',
                    absage_sicher: false, absage_form: 'anteil_50' },
      smarkets:   { name: 'Smarkets',   kurz: 'SM', chip: 'sm', art: 'quote',
                    konto: 'kein Konto', umfang: 797,
                    absage: 'annulliert, voller Einsatz zurück (36-Stunden-Regel)',
                    absage_sicher: true, absage_form: 'einsatz_zurueck' },
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
                    absage: 'eigenes Regelwerk, ungeprüft — Vorsicht bei Absagen',
                    absage_sicher: false, absage_form: 'unbekannt',
                    /* WIEDER AKTIV seit 11.8.2026 abends, über die Bridge auf
                     * einem eigenen Laptop. Aus Supabase heraus bleibt Betfair
                     * gesperrt (403) — die Bridge umgeht das nicht, sie läuft
                     * schlicht an einem Privatanschluss, wo Betfair nicht
                     * sperrt. Sie liest mit dem Konto des Auftraggebers und
                     * schiebt über bf-bridge nach Supabase.
                     *
                     * DREI EINSCHRÄNKUNGEN, gemessen am 11.8.:
                     *  1. Der App-Key ist DELAYED — Kurse rund eine Minute
                     *     alt. Bei laufenden Spielen ist die gesehene Quote
                     *     meist schon weg.
                     *  2. Das Konto ist für API-Wetten SUSPENDED. Lesen geht,
                     *     automatisch setzen nicht. Für einen Scanner, bei dem
                     *     der Mensch klickt, ist das kein Hindernis.
                     *  3. Build 17 sendet den echten Kommissionssatz NICHT
                     *     mit; es wird mit 7 % gerechnet statt der echten
                     *     2 bis 5 %. Das drückt jede Betfair-Rendite um rund
                     *     einen Prozentpunkt nach unten — konservativ, also
                     *     sicher, aber es kostet Chancen. Build 18 behebt das.
                     *
                     * Zum Abschalten: aktiv auf false und BETFAIR_AKTIV in
                     * orion-lauf ebenso. */
                    aktiv: true,
                    grund: 'Bridge auf eigenem Laptop · Kurse verzögert (DELAYED)' }
    },

    /* Der GRUNDEINSATZ, auf den "So setzt du" rechnet. Ausdruecklicher
     * Wunsch vom 13.8.2026: nicht auf 100 rechnen, sondern auf den Betrag,
     * der wirklich gesetzt werden soll. Die AUFTEILUNG ist bei jedem Betrag
     * dieselbe; die Karte sagt zusaetzlich, wie viel zu diesen Kursen
     * wirklich hineinpasst. In der Anzeige-Waehrung (Euro, sobald der
     * Kurs da ist). */
    grundEinsatz: 1000,

    /* Absagen duerfen kein Geld kosten (13.8.2026, erste Prioritaet).
     *
     * Eine Zeile, deren ABSAGE-AUSGANG rechnerisch im Minus liegt — etwa
     * NEIN fuer 0,62 gekauft, der Markt loest bei Absage 50/50 auf und
     * zahlt nur 0,50 —, zaehlt NICHT mehr als Chance, egal wie gut die
     * Rendite aussieht. Begruendung: bei 2 % Gewinn je Wette frisst EIN
     * Absage-Verlust von 20 % zwanzig gewonnene Wetten.
     *
     * Zeilen mit NICHT BERECHENBAREM Absage-Ausgang (Kalshi wertet zum
     * letzten Kurs, Betfair-Regel unbelegt) bleiben Chancen, tragen aber
     * eine deutliche Warnung: vor dem Setzen die Regel DIESES Marktes
     * lesen. Wer auch das sperren will, setzt hier 'hart' statt true. */
    absageStreng: true,

    /* Obergrenze der Glaubwuerdigkeit (13.8.2026, sechste Chancen-Bedingung).
     *
     * Gemessen an 26 einzeln geprueften Zeilen: alle richtigen lagen
     * zwischen 2,07 und 3,27 Prozent, alle falschen ueber 4,48 — und JEDE
     * Zeile ueber 5 Prozent war bisher ein klebender Kurs oder eine
     * Fehlpaarung, keine einzige eine Chance. Zwei Boersen mit echten
     * Teilnehmern liegen nicht 20 Prozent auseinander; wenn doch, ist ein
     * Buch alt (NFL-Vorsaison am 13.8.: Kalshi 60 % gegen Betfair 41 %
     * fuer dieselbe Mannschaft, beide in sich stimmig — einer klebt).
     *
     * Solche Zeilen zaehlen NICHT als Chance und loesen weder Kino noch
     * Meldung aus. Sie wandern zu den knappen Paaren mit Begruendung —
     * verschwinden waere schlimmer, denn an ihnen sieht man die Kleber. */
    maxPlausibel: 5.0,

    /* BEWAEHRUNGSZEIT (14.8. frueh, siebte Chancen-Bedingung).
     *
     * 'Wenn eine Chance kommt, soll sie nicht falsch sein.' Gemessen: die
     * Kleber (stehengebliebene Kurse) sterben binnen ein, zwei Laeufen -
     * echte Chancen standen 44 Minuten. Eine Zeile heisst deshalb erst
     * dann Chance, wenn sie mindestens diese Zeitspanne ueberlebt hat
     * (zuletzt_gesehen minus zuerst_gesehen), also von MEHREREN Laeufen
     * bestaetigt wurde. Bis dahin steht sie im Knapp-Reiter mit der Marke
     * IN PRUEFUNG. Kino, Meldung und Abzeichen feuern erst nach der
     * Bewaehrung - genau dann, wenn es sich lohnt hinzusehen. */
    bewaehrungS: 25,

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
