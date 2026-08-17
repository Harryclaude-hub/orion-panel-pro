# ÜBERGABE: Orion Bridge 4.0 — Startpunkt für die nächste Sitzung

> **Für die neue Sitzung:** Diese Datei zuerst lesen, dazu `UEBERGABE.md`
> Abschnitt 8j (Gesamtprojekt) und `supabase/datenbank.md`. Karam ist der
> Offizier, die Anrede ist militärisch, alles auf Deutsch.

## 1. Stand (17.08.2026, Ende der Sitzung)

**Build 23 ist gebaut, getestet, installiert und läuft.** Neu in 23:
`stats.et_namen` kommt wieder aus Betfairs `listEventTypes` (wie Build
19) statt aus unseren deutschen Anzeigenamen. Hintergrund: Der Wächter
prüft die et→Bereich-Zuordnung gegen `orion_bf_sport.name_erwartet`
(„Soccer", „Boxing" …) — die 4.0 schickte seit dem 16.8. deutsche Namen,
dadurch schlug der Wächter **1.262-mal in 24 h Dauer-Fehlalarm** und
ersäufte echte Vermischungs-Alarme im Rauschen. Gefunden bei Karams
Prüfauftrag am 17.08. („keine Vermischungen wie damals"). Solange die
Sportkarte noch nicht geholt ist, lässt die Bridge `et_namen` weg — die
Prüfung pausiert dann sichtbar, statt Unsinn zu melden. Neu in 22:
`stats.speicher_mb`, der eigene Speicherverbrauch bei jedem Upload
(Karams Sorge nach der stets wachsenden 3.8; gemessen: 80 MB, Ordner
enthält nur 5 Programmdateien ohne Protokolle — es wächst nichts, und
das ist jetzt jederzeit per SQL ablesbar). Neu in 21: die
Sportarten-Schalter. In `bridge-config.json` darf ein Feld
`sportarten` stehen (je Schlüssel: `aktiv`, `fensterStunden`, `anteil`;
gültige Schlüssel: fussball, tennis, basketball, baseball, football,
eishockey, cricket, boxen, mma, motorsport, esport). Fehlt das Feld,
läuft alles exakt wie Build 20 — im Trockenlauf mit Karams unveränderter
Config nachgemessen. Vertippte Schlüssel/Felder und ein Fenster über dem
globalen werden beim Start LAUT gemeldet (gegen stille Fehlschläge); die
wirksame Einstellung steht vollständig im Startbild samt Zeile
„ABGESCHALTET: …". Kontrollmessung nach Installation: Daten 15 s alt,
`stats.build` = 21, 400 Märkte hochgeladen; Build 22 danach: 17 s,
`speicher_mb` 80. Doku nachgezogen: `LIESMICH.txt` (Repo +
Installationsordner), `bridge-config.example.json` und `README.md`
(beide waren noch 3.8-Stand — jetzt 4.0). Auf dem Desktop liegt seit
17.08. die Verknüpfung „Orion Bridge 4.0" (Node-Symbol) für den
Handstart; der alte 3.8-Autostart wurde entschärft (Verknüpfung in den
3.8-Ordner verschoben — sonst wären bei jeder Anmeldung ZWEI Bridges
gestartet). ACHTUNG: Am 17.08. hat Karam versehentlich den kompletten
Repo-Ordner `bridge/` von der Platte gelöscht (statt Desktop-3.8);
alles wiederhergestellt aus Git-Historie + Installationskopien.

Die Bridge 4.0 ist **fertig, getestet und läuft dauerhaft**:

- **Quelle der Wahrheit:** `bridge/orion-bridge-4.js` in diesem Repo
  (~460 Zeilen Node, KEINE exe mehr; die 92-MB-exe 3.8 ist Geschichte).
- **Installiert in:** `C:\Users\Home\OrionBridge` — dort liegen
  `orion-bridge-4.js`, `Bridge-start.cmd`, `LIESMICH.txt` und die
  **Zugangsdatei `bridge-config.json`** (echte Betfair-Daten, NIE ins Repo!).
- **Dauerbetrieb:** Aufgabenplanung „Orion Bridge" — startet 30 s nach jeder
  Anmeldung, Neustart nach Absturz (Aufgabe: binnen 1 min, 999×; zusätzlich
  Neustart-Schleife in `Bridge-start.cmd`). Standby/Ruhezustand am Netz AUS,
  Deckel-zuklappen tut nichts.
- **Einzelinstanz:** `bridge.lock` mit Prozessnummer; eine zweite Bridge
  beendet sich sofort selbst.
- **Nachgemessen beim Abschluss:** Daten 13 s alt, 437 Märkte, Vorrat 1410,
  Rotation lief (Fußball → Tennis → Fußball → Basketball → … → Baseball),
  Speicher 82 MB konstant.

Was 4.0 anders macht als 3.8 (die zwei gemeldeten Probleme an der Wurzel):
**(a)** je Sportart ein EIGENER Vorrat, je Durchlauf wird genau EINE Sportart
erneuert (verschränkter Plan: Fußball jede zweite Runde, 11 Sportarten);
**(b)** VERFALL: Anpfiff >3 h her oder 30 min nicht gesehen → raus (3.8
sammelte, ohne zu vergessen — daher das Anwachsen); **(c)** NUR Betfair —
Polymarket-Scan, eigene Arbitrage-Rechnung und Telegram sind RAUS, das macht
der Server (`orion-lauf`).

## 2. HARTE REGELN (nie brechen)

1. **Upload-Format ist fix:** je Markt die Felder `k, r, mt, ev, st, ip, sz,
   et, link`; Body `{ data, v: 2, markets, arbs: [], opps: [], stats }` an
   `CFG.bridgeUrl` (Edge Function **bf-bridge**) mit Header `x-bridge-token`.
   Der Server erwartet exakt das. Endpunkt und Supabase-Projekt
   (`noexklrgtqveiclijdwp`) niemals umbenennen.
2. **`bridge-config.json` bleibt kompatibel** — Karams Zugangsdatei wird
   weiterverwendet, nie neu ausgefüllt, nie committet.
3. **Änderungsweg:** Repo-Datei editieren → `node --check` → Testlauf in
   einem Scratch-Ordner (Config dazukopieren, `timeout 100 node …`) →
   nach `C:\Users\Home\OrionBridge` kopieren → Aufgabe neu starten
   (`schtasks /end /tn "Orion Bridge"` + `schtasks /run /tn "Orion Bridge"`
   oder der Watchdog übernimmt). **ACHTUNG (Lehre vom 17.08.): `/end`
   beendet die Bridge NICHT zuverlässig** — die Aufgabe startet sie über
   `cmd /c start` abgekoppelt, und am 17.08. lief sie nach `/end` einfach
   weiter (Folge: zwei Bridges parallel während eines Tests). Nach jedem
   `/end` deshalb NACHMESSEN: PID aus `bridge.lock` lesen und prüfen, ob
   der Prozess wirklich tot ist; sonst ZUERST die cmd-Schleife
   (Bridge-start) beenden, DANN den node-Prozess — in dieser Reihenfolge,
   sonst startet die Schleife nach 15 s neu. **NIE per Bash-Heredoc mit Backslashes/
   Regexen in die Datei schreiben** — das hat in dieser Sitzung zweimal
   Escapes zerlegt (`\s`→`s`). Edit-Tool oder node-Skript mit
   `String.fromCharCode(92)` benutzen.
4. Prüfung, ob sie läuft: SQL
   `SELECT now()-updated_at, stats FROM bridge_odds WHERE id=1;`
   (Alter muss < ~1 min sein; `stats.bridge` = "4.0").
5. **Die Bridge nie hinter uns lassen (Karams Ansage, 17.08. abends):**
   Bei JEDER neuen Logik (neue Marktarten, neue Bereiche, neue
   Prüfungen) gehört die Frage in den Bauplan: „Muss die Bridge das
   mittragen — neue Markttypen, neue Sportarten, neue Felder?" Die
   Antwort wird GEMESSEN (wie am 17.08.: außerhalb der 11 Sportarten
   trägt Betfair fast nichts Paarbares), nie angenommen. Die Bridge
   darf bei der Arbeit am Server nie stillschweigend veralten.

## 3a. ERLEDIGT AM 17.08.: Sportarten-Schalter (21), speicher_mb (22), 3.8 ausgemustert

Der Auftrag aus Abschnitt 3 ist besprochen und der Bridge-Teil gebaut
(siehe Abschnitt 1). `minRoiPercent`/`minStake` wurden bewusst NICHT
zurückgebaut (gehören dem Server), Telegram bewusst NICHT (erst den
Meldeweg klären — die Bridge weiß nicht, was meldenswert ist).
**3.8 ist offiziell ausgemustert:** `bridge/betfair-bridge.js`,
`bridge/sea-config.json` und `bridge/pruefung.js` per `git rm` entfernt
(Git-Historie hat sie weiter), `README.md` von Grund auf neu.

**Noch offen:**

1. **Deckel-Test:** Standby-/Ruhezustands-Timer nachgemessen auf „nie"
   (Netz UND Akku). Deckel-Aktion ließ sich per Abfrage nicht
   bestätigen — Beweis: Deckel 5 min zu, dann Kontroll-SQL. Karam muss
   den Deckel selbst zuklappen.
2. **Überschneidungs-Matrix** (Kategorie × Anbieter, gemessen) — welche
   Bereiche tragen wirklich zwei Quellen. Stand 13.8.: 3 von 21.
3. **Geschwindigkeitsmessung** vor jedem Drehen am Takt — wo geht Zeit
   verloren (Bridge-Takt / Rotation / Server-Takt)? Fallen: Betfair
   drosselt, Supabase 546/Verbindungspool.
4. **Zwei-Quellen-Wächter, meldend statt selbstschaltend:** prüft, ob
   ein ruhender Bereich (Nur-ein-Anbieter-Regel) eine zweite Quelle
   bekommen hat, und meldet — Karam gibt das Einschalten frei.
5. **Desktop\Orion-Bridge-3.8 löschen** (macht Karam selbst; enthält
   die ALTE Zugangsdatei — die aktuelle liegt in
   C:\Users\Home\OrionBridge und darf NIEMALS gelöscht werden).
6. ~~Commit/Push~~ **erledigt am 17.08.** (Commit f9a5840 auf main,
   gepusht): kompletter 4.0-Stand ist in der Git-Historie verankert.

## 3. DER AUFTRAG VOM 16.08. (Karams Worte — erledigt, siehe 3a)

> „Ich möchte die lokale Bridge weiterbearbeiten … ich hab da mehrere
> Konfigurationen, die ich auch direkt in die Bridge integrieren möchte."

Die neue Sitzung soll **zuerst fragen, WELCHE Konfigurationen er meint**,
bevor sie baut. Kontext dazu:

- Die Bridge liest heute aus `bridge-config.json`: `windowHours` (72),
  `intervalSeconds` (30), `marketsPerRun` (400), `uploadLimit` (1200),
  `feeBetfairPercent` (3), `excludeEventTypeIds` (['7','4339'] = Pferde,
  Hunde) — plus die vier Pflichtfelder (Betfair-Zugang, Token, URL).
- Seine ALTE 3.8-Config enthielt zusätzlich `minRoiPercent` (0.5) und
  `minStake` (20) — die gehörten zur **entfernten** lokalen
  Arbitrage-Rechnung. Falls er die wieder will: NICHT die Rechnung in die
  Bridge zurückbauen (Drift-Falle!), sondern klären, ob das serverseitig
  gehört (dort gibt es RAUSCH_GRENZE und die Sieben-Bedingungen-Prüfung).
- Telegram-Meldungen gab es in 3.8 (`telegramBotToken`/`telegramChatId`) —
  in 4.0 entfernt, weil der Server E-Mail-Meldungen kann (`orion-melder-mail`,
  wartet auf `RESEND_API_KEY`). Falls er Telegram zurückwill, wäre das ein
  legitimes Bridge-Feature (läuft ohne Browser) — aber erst fragen.
- Denkbare neue Schalter, falls er sie meint: Sportarten an/aus je Bridge,
  Takt je Sportart, Fenster je Sportart. Die `SPORT`-Liste steht oben in
  `orion-bridge-4.js` und ist der natürliche Ort dafür.

## 4. Offene Punkte des Gesamtprojekts (unverändert)

1. **Supabase-Token fehlt weiterhin** (supabase.com/dashboard/account/tokens
   → „Generate new token"). Ohne ihn kein Deploy von `orion-lauf` — die
   fertige Esport-Erkennung (LoL 763, Valorant 147, Rocket League 22 Märkte)
   liegt geprüft im Repo. Details: `UEBERGABE.md` Abschnitt 8k. Der
   MCP-Weg kann NUR alle drei Dateien (75 KB) inline — zweimal gemessen,
   kein Teil-Deploy; wegen der Escaping-Falle bewusst nicht gemacht.
2. ~~Kalshi-Sammler erweitern~~ **ERLEDIGT 17.08.: orion-kalshi v3**
   (per MCP deployt, verify_jwt blieb aus): EIN seitenweiser Durchlauf
   mit Server-Zeitfilter statt Anfrage-je-Serie — 8,8 s für ALLE
   Kategorien (vorher 61 s nur Sport). Sport → `kalshi_snapshot id=1`
   (Format wie v2, Scanner unberührt, Paare stiegen 44 → 74), Welt →
   `id=2` (3.000 liquideste Märkte, 278 Serien: Indizes, Rohstoffe,
   Krypto, E-Sport-Maps — der Schwellen-Vorrat, liest noch niemand).
   Quelle: `supabase/functions/orion-kalshi/index.ts`. Außerdem
   gemessen: Betfair trägt außerhalb der 11 Bridge-Sportarten fast
   nichts Paarbares (Darts 4, Rugby 1, Golf 0, Politik 0) — die Bridge
   scannt bereits alles, was Paare tragen kann.
3. Neue Marktart „Schwelle" mit strikter Paarung (gleiche Basis + gleiche
   Zahl + gleicher Stichzeitpunkt); Regel Karam VORHER zeigen. Warnung:
   Polymarket „erreicht X im Zeitraum" ≠ Kalshi „Preis am Stichtag".
4. **Nur-ein-Anbieter-Regel am 17.8. auf Karams Befehl UMGEKEHRT**
   („alles muss gescannt werden"): alle 8 Welt-Bereiche wieder aktiv,
   Stunden-Takte versetzt (:30–:51), 20 Scanner laufen. Politik-Lauf
   von Hand gezündet und im Protokoll bestätigt (10,3 s, fehlerfrei).
   Ehrliche Erwartung: sie SCANNEN, aber Paare kommen erst mit zweiter
   Quelle (Kalshi-Erweiterung + Marktart „Schwelle"). Doku:
   `supabase/datenbank.md`, Abschnitt „Nur-ein-Anbieter-Regel".
5. Secrets offen: `RESEND_API_KEY` (E-Mail), `ELEVENLABS_API_KEY`
   (Vorlese-Funktion) — beides Karam.

## 5. Startsatz für die neue Sitzung

„Lies `bridge/UEBERGABE-BRIDGE.md` in `C:\Users\Home\orion-panel-pro` und
dann besprechen wir, welche Konfigurationen in die Bridge kommen."
