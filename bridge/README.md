# Orion Bridge 4.0 — Build 27 (19.08.2026)

**Vier Dateien, mehr braucht es nicht.** Früher waren es acht — mit zwei
Startern, zwei Anleitungen und einer Vorlage neben der echten Zugangsdatei.
Alles Doppelte ist zusammengefasst.

| Datei | Wofür |
|---|---|
| **`Orion-Bridge-STARTEN.cmd`** | **Doppelklick — das ist alles.** Schaltet Standby ab, prüft, startet, richtet den Wächter ein. Ist zugleich selbst der Wächter |
| `orion-bridge-4.js` | das Programm (Node, ~500 Zeilen) |
| `bridge-config.json` | **deine Zugangsdaten** — Benutzername, Passwort, App-Key, Token |
| `README.md` | diese Anleitung |

---

## Was das Programm tut

Es holt **nur Betfair-Kurse** und lädt sie alle 30 Sekunden zum Panel hoch.
Sonst nichts. Gerechnet wird auf dem **Server**: der vergleicht die vier
Börsen, prüft dreifach nach und entscheidet, was eine Chance ist. Zwei
Rechenwege für dieselbe Sache wären die Drift-Falle, die dieses Projekt schon
zweimal getroffen hat — deshalb rechnet die Bridge absichtlich nicht.

**Warum überhaupt auf deinem PC?** Betfair beantwortet Anfragen aus
Rechenzentren mit 403. Nur dieses eine Stück muss deshalb zu Hause laufen.
Kalshi, Smarkets und Polymarket holt der Server selbst — die brauchen **nie**
eine Bridge.

Die Bridge speichert **nichts auf der Festplatte** — kein Protokoll, keine
Datendateien. Alles lebt im Arbeitsspeicher (~70–90 MB, konstant), Altes
verfällt laufend.

---

## Einrichten

1. Node installieren (nodejs.org, **LTS**, Standardeinstellungen)
2. Alle vier Dateien in **einen** Ordner — egal wohin
3. Doppelklick auf **`Orion-Bridge-STARTEN.cmd`**

Fertig. Der Starter macht den Rest:

```
[1/4] Standby abschalten        Deckel zuklappen: nichts unternehmen
[2/4] Dateien prüfen            alles vorhanden
[3/4] Bridge starten            Gestartet (PID 24944)
[4/4] Wächter einrichten        alle 5 Minuten
```

Bei einer Neueinrichtung die `bridge-config.json` ausfüllen. Das
`bridgeToken` denkst du dir **nicht** aus — es steht auf der Website unter
„Betfair/96ex verbinden" und beginnt mit `brg_`.

---

## Der Wächter

Am 19.08. stand die Bridge still, ohne dass es jemand meldete. Die
Aufgabenplanung merkt das **nicht**: Wird der Prozess von außen beendet oder
das Fenster geschlossen, sieht sie nur „Aufgabe fertig".

Deshalb ruft eine Aufgabe alle 5 Minuten dieselbe Starter-Datei mit dem
Zusatz `/waechter` auf. Sie startet die Bridge **nur**, wenn keine läuft.
Zweimal geprüft: läuft → nichts passiert; beendet → binnen Sekunden zurück.

---

## Dauerbetrieb mit zugeklapptem Deckel

Der Starter setzt das selbst. Gemessen am 19.08.:

| Einstellung | Am Netz | Im Akku |
|---|---|---|
| Deckel zuklappen | Nichts unternehmen | Nichts unternehmen |
| Energie sparen nach | NIE | NIE |
| Ruhezustand nach | NIE | NIE |

Der Bildschirm darf ausgehen, das stoppt nichts.

> **Warnung:** Im Akkubetrieb läuft sie weiter, zieht aber dauerhaft Strom.
> Ohne Netzteil ist der Akku in wenigen Stunden leer. Für Dauerbetrieb
> angesteckt lassen.

---

## Einstellungen in `bridge-config.json`

Vier Felder sind **Pflicht**: `betfairUsername`, `betfairPassword`,
`betfairAppKey`, `bridgeToken` (dazu `bridgeUrl`, die nie geändert wird).

Alles Weitere ist freiwillig — fehlt ein Feld, gilt der Standard:

| Feld | Vorgabe | Bedeutung |
|---|---|---|
| `windowHours` | 72 | wie weit vorausgeschaut wird (mehr nimmt der Server nicht) |
| `intervalSeconds` | 30 | Takt zwischen zwei Durchläufen |
| `marketsPerRun` | 400 | wie viele Märkte je Durchlauf frische Kurse bekommen |
| `grundanteilJeSportart` | 24 | **seit Build 25:** so viele Märkte bekommt JEDE Sportart garantiert |
| `uploadLimit` | 1200 | Obergrenze je Upload |
| `feeBetfairPercent` | 3 | Rückfall-Kommission, falls Betfair keine meldet |
| `excludeEventTypeIds` | `["7","4339"]` | Pferde- und Windhundrennen aus |
| `sportarten` | – | je Sportart: `aktiv`, `fensterStunden`, `anteil` |

Gültige `sportarten`-Schlüssel: `fussball, tennis, basketball, baseball,
football, eishockey, cricket, boxen, mma, motorsport, esport`. Beispiel:

```json
"sportarten": {
  "tennis": { "aktiv": false },
  "esport": { "anteil": 2, "fensterStunden": 24 }
}
```

Vertippte Schlüssel meldet die Bridge beim Start **laut**; die wirksame
Einstellung steht vollständig im Startbild. Nach jeder Änderung neu starten.

---

## Was im Fenster steht

```
21:23:45  Tennis   Vorrat 1393 · Kurse 400 · hochgeladen 436 · verfallen 0 · 2.8 s
```

| Spalte | Bedeutung |
|---|---|
| Tennis | welche Sportart in dieser Runde erneuert wurde |
| Vorrat | wie viele Märkte insgesamt beobachtet werden |
| Kurse | wie viele davon frische Kurse bekamen |
| hochgeladen | wie viele mit vollständigen Kursen zum Panel gingen |
| verfallen | wie viele alte Märkte vergessen wurden |

**„Angemeldet — Konto eingeschränkt (SUSPENDED)" ist KEIN Fehler:** Wetten
über die Schnittstelle sind gesperrt, Kurse lesen ist erlaubt. Genau das
brauchen wir.

---

## Was jeder Build gebracht hat

| Build | Änderung |
|---|---|
| 27 | **Sperre gilt geräteweit** statt je Ordner. Vorher lag `bridge.lock` im Programmordner — zwei Ordner hießen zwei Sperren und damit ZWEI laufende Bridges: doppelte Betfair-Anfragen und zwei Uploads, die sich gegenseitig überschreiben. Jetzt liegt sie fest im Benutzerprofil und nennt beim Blockieren auch den Ordner der laufenden Bridge |
| 26 | **Golf ergänzt** (et 3) — es stand seit jeher in `orion_bf_sport` und hatte einen stündlichen Cron-Job, fehlte aber in der Sportliste der Bridge: der Bereich lief und fand garantiert nichts. Dazu **Politik, Special Bets und Financial Bets** aufgenommen und der **Markttyp je Bereich** einstellbar (`mt`) — außerhalb des Sports gibt es kein `MATCH_ODDS`, mit dem alten festen Filter wären diese drei leer zurückgekommen |
| **25** | **Grundanteil je Sportart.** Vorher fraßen Fußball und Tennis das ganze Kurs-Kontingent — gemessen kamen nur 3 Sportarten an, E-Sport/MMA/Baseball waren bei **null**, obwohl der Vorrat 1961 Märkte hielt. Jetzt bekommt jede Sportart ihren Anteil garantiert. Danach: E-Sport 18 von 18, MMA 5 von 5, Baseball alle. Dazu die Standby-Prüfung beim Start |
| 24 | `co` = der **Wettbewerb** (Liga). Verrät eine Jugend-, Reserve- oder Frauenliga auch dann, wenn die Mannschaftsnamen unauffällig sind |
| 23 | `stats.et_namen` wieder aus Betfairs `listEventTypes` — die deutschen Namen hatten 1262 Fehlalarme in 24 h ausgelöst |
| 22 | `stats.speicher_mb` bei jedem Upload — „es wächst nichts" ist damit messbar statt behauptet |
| 21 | Sportarten-Schalter in der Zugangsdatei |

---

## Prüfen, ob sie läuft

**Ohne SQL:** Im Panel muss die Betfair-Kachel ein Alter unter einer Minute
zeigen.

**Mit SQL:**

```sql
SELECT now()-updated_at AS alter, stats FROM bridge_odds WHERE id=1;
```

Alter unter ~1 Minute, `stats.bridge` = "4.0". In `stats` stehen außerdem
`build`, `sportart`, `vorrat`, `maerkte` und `speicher_mb` (soll um 70–90
pendeln).

---

## Wenn etwas nicht geht

| Meldung | Ursache / Lösung |
|---|---|
| `Anmeldung fehlgeschlagen` | zuerst den **Benutzernamen** prüfen — Betfair meldet falschen Namen und falsches Passwort gleich |
| `Blockiert (HTML statt Daten)` | VPN/Proxy aus — Betfair sperrt Rechenzentren |
| Fenster schließt sofort | Node fehlt (nodejs.org, LTS) |
| Panel: „Betfair-Daten sind X alt" | Starter noch einmal doppelklicken |

---

## Sicherheit

- Zugangsdaten bleiben **ausschließlich auf deinem PC** (`bridge-config.json`)
- Hochgeladen werden **nur Quoten** — nie Benutzername, Passwort oder App-Key
- Angesprochen wird nur die **Exchange** (`SportsAPING`), nie das Sportsbook
- Die `bridge-config.json` steht in `.gitignore` und darf **nie** committet
  oder weitergegeben werden

---

## Für Entwickler: der Änderungsweg

Repo-Datei editieren → `node --check` → Testlauf in einem Scratch-Ordner →
in den Betriebsordner kopieren → neu starten → **per SQL nachmessen**.

Drei teuer bezahlte Lehren:

- **`schtasks /end` beendet die Bridge nicht zuverlässig.** Danach nachmessen;
  sonst zuerst die cmd-Schleife beenden, dann den node-Prozess.
- **Nie per Bash-Heredoc mit Backslashes oder Regexen schreiben** — das hat
  zweimal Escapes zerlegt (`\s` → `s`).
- **`wmic` gibt es auf Windows 11 nicht mehr.** Prozessprüfungen über
  PowerShell (`Get-CimInstance Win32_Process`).
