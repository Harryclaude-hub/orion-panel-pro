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

    /* Ab welcher Rendite ein Fund als Chance gilt. 0,05 % ist Rauschen. */
    mindestRendite: 0.5,

    /* Ab wann etwas als stehengeblieben gilt. */
    bridgeMaxAlterS: 300,
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
