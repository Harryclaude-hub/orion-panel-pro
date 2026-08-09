/* Orion Panel — Konfiguration
 * Eine Stelle fuer alles, was sich aendern kann.
 */

(function (welt) {
  'use strict';

  welt.KONFIG = {
    supabase: 'https://noexklrgtqveiclijdwp.supabase.co',
    key: 'sb_publishable_NrgVUoZhe-uN8U8j41P17Q_9cZgUd6M',

    scanUrl: 'https://noexklrgtqveiclijdwp.supabase.co/functions/v1/orion-scan',
    bfUrl:   'https://noexklrgtqveiclijdwp.supabase.co/rest/v1/bridge_odds?id=eq.1&select=markets,stats,updated_at',

    sperrwort: 'ARBRADAR2026',

    /* Betfair-Kommission: die Bridge schickt marketBaseRate derzeit nicht mit.
     * Regel aus der Uebergabe: unbekannte Gebuehr NIEMALS als 0 durchgehen
     * lassen, Rueckfall auf den unguenstigsten bekannten Satz. */
    bfGebuehrUnbekannt: 0.07,

    /* Zuordnungsschwelle. 0.5 hat in der Messung vom 9.8.2026
     * 39 Partien richtig zugeordnet, ohne erkennbare Fehlpaarung. */
    schwelle: 0.5,

    /* Laeufer-Zuordnung braucht eine strengere, symmetrische Schwelle.
     * Mit 0.5 traf "CSD Municipal 1 - 3 CSD Coban Imperial" den Laeufer
     * "CSD Municipal" und erzeugte 663 Scheinchancen. */
    laeuferSchwelle: 0.8,

    /* Ab welcher Rendite ein Fund als Chance gilt.
     * 0,05 % ist Rauschen, kein Fund: die Betfair-Quoten sind verzoegert,
     * und bis beide Seiten gesetzt sind, ist der Vorsprung weg. */
    mindestRendite: 0.5,

    /* Ab wann die Betfair-Daten als veraltet gelten. Die Bridge laedt im
     * Normalbetrieb im Minutentakt hoch. Was aelter ist, ist kein Kurs mehr,
     * sondern Geschichte. Uebergabe 8, Punkt 2: keine Karteileichen. */
    bridgeMaxAlterS: 300,

    /* Wie lange ein Fund gilt, bevor er als Karteileiche stillgelegt wird.
     * Uebergabe 8, Punkt 2: was tagelang steht, ist ein Fehler. */
    fundGiltStunden: 2,

    /* Betfair ist aus Oesterreich im Browser gesperrt. Die Marktnummer stimmt,
     * die Seite weist ab. Deshalb Links auf den Broker umschreiben. */
    brokerMuster: 'https://www.96ex.com/exchange/plus/market/{id}'
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
