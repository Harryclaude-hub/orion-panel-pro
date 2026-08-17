# Orion Bridge 4.0 — läuft auf deinem PC

**Hauptversion seit 17.08.2026.** Die alte 3.8 (92-MB-exe mit eigener
Arbitrage-Rechnung) ist ausgemustert; ihre Quellen liegen nur noch in der
Git-Historie.

## Was macht das Programm?

Es holt **nur Betfair-Kurse** und lädt sie alle 30 Sekunden zum Panel hoch.
Sonst nichts. Gerechnet wird auf dem **Server** (`orion-lauf`): der vergleicht
die vier Börsen, prüft dreifach nach und entscheidet, was eine Chance ist.
Zwei Rechenwege für dieselbe Sache wären die Drift-Falle, die dieses Projekt
schon zweimal getroffen hat — deshalb rechnet die Bridge absichtlich nicht.

**Warum lokal?** Betfair beantwortet Anfragen aus Rechenzentren mit 403.
Nur dieses eine Stück muss deshalb auf einem Rechner zu Hause laufen.

## Die Dateien — mehr ist es nicht

| Datei | Zweck |
|---|---|
| `orion-bridge-4.js` | das ganze Programm, eine Node-Datei (~500 Zeilen) |
| `bridge-config.json` | dein Zugang — bleibt lokal, steht in `.gitignore`, **nie committen** |
| `Bridge-start.cmd` | Starter mit Neustart-Schleife |
| `bridge-config.example.json` | Vorlage zum Ausfüllen |
| `LIESMICH.txt` | Betrieb auf dem eingerichteten PC (Aufgabenplanung, Anhalten, Fehlerbilder) |

Die Bridge speichert **nichts auf der Festplatte** — kein Protokoll, keine
Datendateien. Alles lebt im Arbeitsspeicher (~70–90 MB, konstant), Altes
verfällt laufend (Anpfiff über 3 h her oder 30 min nicht gesehen → raus).

## Einrichtung auf einem neuen PC

1. Node installieren (nodejs.org, LTS)
2. Ordner anlegen, `orion-bridge-4.js`, `Bridge-start.cmd` und
   `bridge-config.example.json` hineinkopieren
3. Vorlage zu `bridge-config.json` umbenennen und die vier
   `HIER_…`-Felder ausfüllen (das `bridgeToken` steht auf der Website
   unter „Betfair/96ex verbinden", beginnt mit `brg_`)
4. Doppelklick auf `Bridge-start.cmd`, Fenster offen lassen

## Einstellungen in `bridge-config.json`

Alles freiwillig — fehlt ein Feld, gilt der Standard:

| Feld | Vorgabe | Bedeutung |
|---|---|---|
| `windowHours` | 72 | wie weit vorausgeschaut wird (mehr nimmt der Server nicht) |
| `intervalSeconds` | 30 | Takt zwischen zwei Durchläufen |
| `marketsPerRun` | 400 | wie viele Märkte je Durchlauf frische Kurse bekommen |
| `uploadLimit` | 1200 | Obergrenze je Upload |
| `feeBetfairPercent` | 3 | Rückfall-Kommission, falls Betfair keine meldet |
| `excludeEventTypeIds` | `["7","4339"]` | Pferde- und Windhundrennen aus |
| `sportarten` | – | je Sportart: `aktiv`, `fensterStunden`, `anteil` (seit Build 21) |

Gültige `sportarten`-Schlüssel: `fussball, tennis, basketball, baseball,
football, eishockey, cricket, boxen, mma, motorsport, esport`. Beispiel:

```json
"sportarten": {
  "tennis": { "aktiv": false },
  "esport": { "anteil": 2, "fensterStunden": 24 }
}
```

Vertippte Schlüssel und unbekannte Felder meldet die Bridge beim Start
**laut** als WARNUNG; die wirksame Einstellung steht vollständig im
Startbild. Nach jeder Änderung die Bridge neu starten.

## Prüfen, ob sie läuft

```sql
SELECT now()-updated_at AS alter, stats FROM bridge_odds WHERE id=1;
```

Alter unter ~1 Minute, `stats.bridge` = "4.0". In `stats` stehen außerdem
`build`, `sportart` (der letzten Runde), `vorrat`, `maerkte` und
`speicher_mb` (seit Build 22 — soll dauerhaft um 70–90 pendeln).

## Sicherheit

- Zugangsdaten bleiben **ausschließlich auf deinem PC** (`bridge-config.json`)
- Hochgeladen werden **nur Quoten** — nie Benutzername, Passwort oder App-Key
- Angesprochen wird nur die **Exchange** (`SportsAPING`), nie das Sportsbook

## Wenn etwas nicht geht

| Meldung | Ursache / Lösung |
|---|---|
| `Anmeldung fehlgeschlagen` | zuerst den **Benutzernamen** prüfen — Betfair meldet falschen Namen und falsches Passwort gleich |
| `Angemeldet — Konto eingeschränkt (SUSPENDED)` | **kein Fehler**: Wetten gesperrt, Kurse lesen geht — genau das brauchen wir |
| `Blockiert (HTML statt Daten)` | VPN/Proxy aus — Betfair sperrt Rechenzentren |
| Fenster schließt sofort | Node fehlt (nodejs.org, LTS) |
| Panel: „Betfair-Daten sind X alt" | Bridge läuft nicht oder der Rechner schläft — siehe LIESMICH.txt |
