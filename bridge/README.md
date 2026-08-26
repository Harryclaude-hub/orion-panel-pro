# Orion Bridge 4.0, Build 27

**Stand 26.08.2026.** Der Ordner wurde an diesem Tag aufgeraeumt: `ANLEITUNG.txt`
und `BEFEHLE.txt` sind geloescht. Sie waren doppelt zu dieser Datei, und
`BEFEHLE.txt` enthielt sogar noch den alten Deploy-Befehl ueber `npx supabase`,
der auf diesem Laptop nie lief und einen halben Tag gekostet hat.

**Es gilt: was hier steht, gilt. Sonst nichts.**

| Datei | Wofuer |
|---|---|
| **`Orion-Bridge-STARTEN.cmd`** | **Doppelklick, das ist alles.** Schaltet Standby ab, prueft, startet, richtet den Waechter ein. Ist zugleich selbst der Waechter |
| `Orion-Bridge-Pro-27.js` | das Programm (Node) |
| `bridge-config.json` | **deine Zugangsdaten**: Benutzername, Passwort, App-Key, Bridge-Token |
| `Orion-Waechter-Leise.vbs` | wird vom Starter selbst erzeugt, startet den Waechter ohne Fenster |
| `README.md` | diese Anleitung |
| `bridge-lauf.log` | **NEU 26.08.:** was die Bridge sagt. Vorher ging das ins Nichts, deshalb sah man nur "fetch failed" und nie den echten Grund |
| `bridge-fehler.log` | Fehlerkanal, normalerweise leer |
| `DEPLOY-ALLES.cmd` | rollt alle neun Server-Funktionen aus |
| `DEPLOY-JETZT.cmd` | rollt nur den Scanner aus |
| `DEPLOY-MELDER.cmd` | rollt nur die zwei Telegram-Bots aus |

Die drei `DEPLOY-*.cmd` sind **nur Weichen**. Der echte Inhalt liegt im
Repo-Ordner unter `orion-panel-pro\bridge\`. Aenderungen NUR dort, sonst
entstehen wieder zwei Fassungen, die auseinanderlaufen.

**Die drei Schluessel, die man leicht verwechselt:**

| Schluessel | wofuer | wohin |
|---|---|---|
| `sbp_...` | Ausrollen | ins schwarze Fenster der DEPLOY-Dateien |
| `sb_secret_...` | Datenbank-Vollzugriff | als Geheimnis `ORION_DB_KEY` bei Supabase |
| `sb_publishable_...` | oeffentlich, Website | steht schon im Code, kein Geheimnis |

---

## NOTWEG, eingebaut am 26.08.2026

Seit dem 25.08. um 21:33 UTC weist die Supabase-Datenbank ihre **eigenen**
Funktionen ab. PostgREST antwortet auf den Dienstschluessel mit
`JWT issued at future`, also HTTP 401. Auf status.supabase.com steht dazu
seit dem 14.08. die offene Meldung "401 errors due to JWT rejections".

**Fuer die Bridge hiess das:** sie meldet sich bei Betfair an, holt die
Sportkarte, holt Kurse, und scheitert erst beim Hochladen mit
"Token unbekannt oder Konto gesperrt". Der Token ist in Wirklichkeit
gueltig, die Gegenstelle kann ihn nur nicht nachschlagen.

**Der Ausweg:** die neuen Supabase-Schluessel (`sb_publishable_...`) sind
KEINE JWT und laufen an der kaputten Pruefung vorbei. Die Bridge liefert
deshalb ersatzweise direkt an die Datenbankfunktion
`orion_bridge_annehmen()`, die den Bridge-Token selbst prueft
(SECURITY DEFINER, gleiche Regel wie `wer()` in bf-bridge).

**Wichtig:**

* Der **normale Weg wird immer zuerst versucht.** Sobald Supabase den Fehler
  behoben hat, laeuft alles wieder wie vorher, ganz von selbst. Im Protokoll
  steht dann "Der normale Weg geht wieder."
* Der Notweg **ueberschreibt nie mit leeren Daten.** Kommen keine Maerkte,
  bleibt die letzte gute Aufnahme stehen. Das ist sogar besser als der
  normale Weg, der `updated_at` bedingungslos setzt (Fehlerklasse L5).
* Der publishable-Schluessel im Programm ist **kein Geheimnis.** Er steht
  genauso im Panel und ist im Browser jedes Besuchers lesbar. Ohne gueltigen
  Bridge-Token schreibt er nichts. Gegengeprueft am 26.08.: falscher Token
  abgewiesen, leere Maerkte abgewiesen, fehlende Maerkte abgewiesen.

Ist die Stoerung vorbei, kann `orion_bridge_annehmen()` in der Datenbank
ersatzlos geloescht und der Notweg-Block aus dem Programm entfernt werden.

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
[4/4] Wächter einrichten        jede Minute, ohne Fenster
```

Bei einer Neueinrichtung die `bridge-config.json` ausfüllen. Das
`bridgeToken` denkst du dir **nicht** aus — es steht auf der Website unter
„Betfair/96ex verbinden" und beginnt mit `brg_`.

---

## Der Wächter

Am 19.08. stand die Bridge still, ohne dass es jemand meldete. Die
Aufgabenplanung merkt das **nicht**: Wird der Prozess von außen beendet oder
das Fenster geschlossen, sieht sie nur „Aufgabe fertig".

Deshalb ruft eine Aufgabe **jede Minute** dieselbe Starter-Datei mit dem
Zusatz `/waechter` auf. Sie startet die Bridge **nur**, wenn keine läuft.
Zweimal geprüft: läuft → nichts passiert; beendet → binnen Sekunden zurück.

**Seit 19.08. abends ohne Fenster:** Vorher rief die Aufgabe die cmd-Datei
direkt auf — jeder Lauf riss ein sichtbares Konsolenfenster auf, im
Minutentakt ein dauerndes Aufblitzen. Jetzt läuft der Aufruf durch
`Orion-Waechter-Leise.vbs` (startet dasselbe, nur mit verstecktem
Fenster). Die vbs wird vom Starter bei jedem vollen Start frisch erzeugt —
Änderungen also immer in der cmd machen, nie in der vbs.

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

---

## HARTE REGELN, nie brechen

Zusammengefasst am 26.08.2026 aus `UEBERGABE-BRIDGE.md`, die danach geloescht
wurde. Der volle Wortlaut steht fuer immer in der Git-Historie.

1. **Das Upload-Format ist fest.** Je Markt die Felder `k, r, mt, ev, st, ip,
   sz, et, link`. Der Server erwartet exakt das. Endpunkt und
   Supabase-Projekt niemals umbenennen.

2. **`bridge-config.json` bleibt kompatibel.** Die Zugangsdatei wird
   weiterverwendet, nie neu ausgefuellt, **nie ins Repo eingecheckt.**

3. **Der Aenderungsweg:** Datei aendern, `node --check`, dann die Bridge neu
   starten.
   **ACHTUNG, Lehre vom 17.08.:** `schtasks /end` beendet die Bridge NICHT
   zuverlaessig. Die Aufgabe startet sie ueber `cmd /c start` abgekoppelt, und
   am 17.08. lief sie nach `/end` einfach weiter, mit zwei Bridges parallel.
   Deshalb nach jedem Stoppen **nachmessen**, ob der Prozess wirklich tot ist,
   und in dieser Reihenfolge beenden: zuerst die cmd-Schleife, dann node.
   Sonst startet die Schleife nach 15 Sekunden neu.
   **Lehre vom 26.08.:** die Sperrdatei liegt in
   `%LOCALAPPDATA%\orion-bridge.lock` und enthaelt `PID|Ordner`. Wer den
   Prozess hart abschiesst, muss sie mit entfernen, sonst haelt die naechste
   Bridge sie fuer belegt.

4. **Nie mit Bash-Heredoc voller Backslashes in die Datei schreiben.** Das hat
   Escapes schon zweimal zerlegt (`\s` wurde zu `s`). Stattdessen ein
   Python- oder Node-Skript mit sauberen Ankern benutzen.

5. **Pruefen, ob sie laeuft:**
   `select now()-updated_at, stats from bridge_odds where id=1;`
   Das Alter muss unter einer Minute liegen, `stats.bridge` muss `4.0` sein.
   Seit 26.08. gibt es zusaetzlich `bridge-lauf.log` im Ordner, dort steht im
   Klartext, was sie tut.

6. **Die Bridge nie hinter uns lassen.** Bei JEDER neuen Logik am Server, also
   neue Marktarten, neue Bereiche, neue Pruefungen, gehoert die Frage in den
   Bauplan: muss die Bridge das mittragen? Die Antwort wird **gemessen**, nie
   angenommen. Die Bridge darf bei der Arbeit am Server nie stillschweigend
   veralten.

7. **EIN Paket, nie zwei parallel.** Am 26.08. lagen zwei Fassungen der
   Deploy-Dateien herum, eine davon mit dem alten `npx supabase`-Weg, der auf
   diesem Laptop nie lief. Das hat einen halben Tag gekostet. Seitdem sind die
   Dateien auf dem Desktop nur noch **Weichen** auf die Repo-Fassung.
