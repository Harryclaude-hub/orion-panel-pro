# Orion Bridge 4.0 — läuft auf deinem PC

**Stand: Build 25, 19.08.2026.** Die alte 3.8 (92-MB-exe mit eigener
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
Kalshi, Smarkets und Polymarket holt der Server selbst — die brauchen **nie**
eine Bridge.

## Die sieben Dateien

| Datei | Zweck |
|---|---|
| `Orion-Bridge-STARTEN.cmd` | **Doppelklick — mehr braucht es nicht.** Schaltet Standby ab, prüft alles, startet die Bridge, richtet den Wächter ein. Arbeitet in seinem eigenen Ordner, egal wo der liegt |
| `orion-bridge-4.js` | das Programm selbst (~500 Zeilen Node) |
| `bridge-config.json` | dein Zugang — bleibt lokal, steht in `.gitignore`, **nie committen** |
| `Bridge-waechter.ps1` | holt die Bridge zurück, falls sie stehenbleibt (alle 5 min) |
| `Bridge-start.cmd` | schlichter Starter mit Neustart-Schleife (Alternative) |
| `bridge-config.example.json` | Vorlage zum Ausfüllen |
| `LIESMICH.txt` | Betrieb im Klartext: Fehlerbilder, Schalter, Anhalten |

Die Bridge speichert **nichts auf der Festplatte** — kein Protokoll, keine
Datendateien. Alles lebt im Arbeitsspeicher (~70–90 MB, konstant), Altes
verfällt laufend (Anpfiff über 3 h her oder 30 min nicht gesehen → raus).

## Einrichtung

1. Node installieren (nodejs.org, LTS)
2. Alle Dateien in **einen** Ordner entpacken
3. `bridge-config.json` ausfüllen (oder die vorhandene weiterverwenden)
4. **Doppelklick auf `Orion-Bridge-STARTEN.cmd`**

Das `bridgeToken` denkst du dir nicht aus — es steht auf der Website unter
„Betfair/96ex verbinden" und beginnt mit `brg_`.

## Einstellungen in `bridge-config.json`

Alles freiwillig — fehlt ein Feld, gilt der Standard:

| Feld | Vorgabe | Bedeutung |
|---|---|---|
| `windowHours` | 72 | wie weit vorausgeschaut wird (mehr nimmt der Server nicht) |
| `intervalSeconds` | 30 | Takt zwischen zwei Durchläufen |
| `marketsPerRun` | 400 | wie viele Märkte je Durchlauf frische Kurse bekommen |
| `grundanteilJeSportart` | 24 | **seit Build 25:** so viele Märkte bekommt JEDE Sportart garantiert, bevor der Rest global verteilt wird |
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
Startbild. Nach jeder Änderung neu starten.

## Was jeder Build gebracht hat

| Build | Änderung |
|---|---|
| **25** | **Grundanteil je Sportart.** Vorher fraßen Fußball und Tennis das ganze Kurs-Kontingent — gemessen kamen nur 3 Sportarten an, E-Sport/MMA/Baseball waren bei **null**, obwohl der Vorrat 1961 Märkte hielt. Jetzt: erst Grundanteil für jede Sportart, dann der Rest nach Dringlichkeit. Dazu die **Standby-Prüfung** beim Start |
| 24 | `co` = der **Wettbewerb** (Liga). Verrät eine Jugend-, Reserve- oder Frauenliga auch dann, wenn die Mannschaftsnamen unauffällig sind |
| 23 | `stats.et_namen` wieder aus Betfairs `listEventTypes` — die deutschen Namen hatten 1262 Fehlalarme in 24 h ausgelöst |
| 22 | `stats.speicher_mb` bei jedem Upload — „es wächst nichts" ist damit messbar statt behauptet |
| 21 | Sportarten-Schalter in der Zugangsdatei |

## Prüfen, ob sie läuft

```sql
SELECT now()-updated_at AS alter, stats FROM bridge_odds WHERE id=1;
```

Alter unter ~1 Minute, `stats.bridge` = "4.0". In `stats` stehen außerdem
`build`, `sportart` (der letzten Runde), `vorrat`, `maerkte` und
`speicher_mb` (soll um 70–90 pendeln).

Ohne SQL: im Panel muss die Betfair-Kachel ein Alter unter einer Minute
zeigen.

## Dauerbetrieb mit zugeklapptem Deckel

Der Starter setzt das selbst — gemessen am 19.08.:

| Einstellung | Am Netz | Im Akku |
|---|---|---|
| Deckel zuklappen | Nichts unternehmen | Nichts unternehmen |
| Energie sparen nach | NIE | NIE |
| Ruhezustand nach | NIE | NIE |

Der Bildschirm darf ausgehen, das stoppt nichts. **Warnung:** Im Akkubetrieb
läuft sie zwar weiter, zieht aber dauerhaft Strom — ohne Netzteil ist der
Akku in wenigen Stunden leer. Für Dauerbetrieb angesteckt lassen.

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
| Panel: „Betfair-Daten sind X alt" | Bridge läuft nicht oder Rechner schläft — Starter noch einmal doppelklicken |

## Für Entwickler: der Änderungsweg

Repo-Datei editieren → `node --check` → Testlauf in einem Scratch-Ordner
(Config dazukopieren, `timeout 100 node …`) → in den Betriebsordner kopieren →
neu starten → **per SQL nachmessen**.

Zwei harte Lehren, beide teuer bezahlt:

- **`schtasks /end` beendet die Bridge nicht zuverlässig.** Nach jedem `/end`
  nachmessen; sonst zuerst die cmd-Schleife beenden, dann den node-Prozess.
- **Nie per Bash-Heredoc mit Backslashes oder Regexen in Dateien schreiben** —
  das hat zweimal Escapes zerlegt (`\s` → `s`). Edit-Werkzeug oder ein
  node-Skript mit `String.fromCharCode(92)` benutzen.
- **`wmic` gibt es auf Windows 11 nicht mehr.** Prozessprüfungen über
  PowerShell (`Get-CimInstance Win32_Process`), nie über wmic.
