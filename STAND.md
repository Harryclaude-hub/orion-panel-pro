# Orion Panel Pro — Stand vom 9. August 2026

Live: https://saifokaram1-hub.github.io/orion-panel-pro/
Alte Fassung unverändert: https://saifokaram1-hub.github.io/orion-panel/

## Wie es jetzt läuft

```
pg_cron  ──jede Minute──→  orion-lauf  ──→  orion_funde  ──→  Website (liest alle 2 s)
                              ↑                                    ↑
                   Polymarket (tag_slug)                    orion_laeufe
                              ↑
                   bridge_odds  ←── Bridge auf dem Heim-PC ←── Betfair
```

**Gesucht wird auf dem Server**, nicht im Browser. Der Scanner läuft weiter,
auch wenn niemand die Seite offen hat. Die Seite liest nur ab, deshalb sind
zwei Sekunden Takt bezahlbar.

Gemessen: Lauf 2,6 bis 6,0 s · Ablesen 114 bis 125 ms · 162 Polymarket-Märkte
im Fenster · 309 Betfair-Match-Odds · 64 Paare.

## Live und Verlauf

- **Chancen**: Rendite ab 0,5 %.
- **Knappste Paare**: alles darunter, mit beiden Links.
- **Verlauf**: was nicht mehr gefunden wird oder dessen Partie vorbei ist,
  mit Grund, erster Sichtung und bester je gesehener Rendite.

Die Verlauf-Regel wurde **absichtlich ausgelöst** und geprüft, nicht nur
gebaut: Prüfzeile eingefügt, ein Lauf, danach `beendet: 1`, Status `vorbei`,
Grund `nicht mehr gefunden`. Prüfzeile danach wieder gelöscht.

## Betfair: was geht und was nicht

Neun Wege aus Supabase geprüft:

```
GEBLOCKT 403  api.betfair.com          json-rpc, rest, account
GEBLOCKT 403  api-au.betfair.com · api.betfair.es
GEBLOCKT 403  historicdata.betfair.com · www.betfair.com
GEBLOCKT 403  menu.json (öffentlich, ohne Anmeldung)
GEBLOCKT 403  identitysso.betfair.com/api/login
ERREICHBAR    identitysso-cert.betfair.com   {"loginStatus":"CERT_AUTH_REQUIRED"}
ERREICHBAR    stream-api.betfair.com:443     {"op":"connection","connectionId":"..."}
```

**Der Push-Strom antwortet aus dem Rechenzentrum.** Damit ist ein
Betfair-Anschluss ohne Heim-PC zum ersten Mal denkbar: anmelden über die
Zertifikats-Anmeldung, Kurse über den Strom empfangen statt abzufragen.

Ungeprüft und deshalb kein Versprechen:
1. Ob eine Supabase Edge Function eine Client-Zertifikat-Verbindung aufbauen
   kann (`Deno.createHttpClient`).
2. Ob eine Funktion einen Strom lange genug offen halten kann. Edge Functions
   sind auf Anfragen ausgelegt, nicht auf Dauerverbindungen.
3. Ob die Marktsuche ohne `listMarketCatalogue` auskommt.

Nachmessen: `curl -s https://noexklrgtqveiclijdwp.supabase.co/functions/v1/bf-erreichbar`

## Einstellungen

`einstellungen.html` nimmt Benutzername, Passwort, App Key und Bridge-Token
entgegen, merkt sie **im Browser** und baut daraus `bridge-config.json` zum
Herunterladen. **Nichts davon geht in die Datenbank.** `orion_funde` und
`bridge_odds` sind öffentlich lesbar, dort hat ein Passwort zu einem
Geldkonto nichts zu suchen.

## Unangetastet

`bf-bridge`, POST-Format `{data:[{key,o1,o2,link}]}`, `profiles.bridge_token`,
`pm-scan` und sein Takt. Die Bridge auf dem Heim-PC läuft unverändert weiter.

## Offen

1. **Die Bridge steht.** Beim letzten Blick waren die Betfair-Daten 71 Minuten
   alt. Ohne sie sind alle Quoten hier Geschichte. Die Seite sagt das in Rot.
2. Stream-Weg messen (die drei Punkte oben). Das ist der Weg zu „läuft ganz
   von allein, ohne PC".
3. Bridge lädt nur 4.000 von 8.357 Märkten hoch. Additiv anhebbar.
4. Bridge schickt `marketBaseRate` nicht mit, deshalb wird mit 7 % statt der
   echten 2 bis 5 % gerechnet. Das drückt jede Rendite nach unten.
5. Prüfstand, der die Serverfassung (`rechnung.ts`, `zuordnung.ts`) gegen die
   Browserfassung hält. Solange es zwei Fassungen gibt, können sie
   auseinanderlaufen.
6. `logik.html` und `funktionen.html` sind noch die alten Seiten.
