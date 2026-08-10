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
    buecher: {
      kalshi:     { name: 'Kalshi',     kurz: 'KA', chip: 'ka', art: 'preis',
                    konto: 'kein Konto', umfang: 206 },
      polymarket: { name: 'Polymarket', kurz: 'PM', chip: 'pm', art: 'preis',
                    konto: 'kein Konto', umfang: 390 },
      smarkets:   { name: 'Smarkets',   kurz: 'SM', chip: 'sm', art: 'quote',
                    konto: 'kein Konto', umfang: 797 },
      betfair:    { name: 'Betfair',    kurz: 'BF', chip: 'bf', art: 'quote',
                    konto: 'Konto + Bridge', umfang: 1189, ueberBroker: true }
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
