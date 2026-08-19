# ÜBERGABE: Orion Bridge 4.0 — Startpunkt für die nächste Sitzung

> **Für die neue Sitzung:** Diese Datei zuerst lesen, dazu `UEBERGABE.md`
> Abschnitt 8j (Gesamtprojekt) und `supabase/datenbank.md`. der Auftraggeber ist der
> Offizier, die Anrede ist militärisch, alles auf Deutsch.

## 1. Stand (17.08.2026, Ende der Sitzung)

**Build 23 ist gebaut, getestet, installiert und läuft.** Neu in 23:
`stats.et_namen` kommt wieder aus Betfairs `listEventTypes` (wie Build
19) statt aus unseren deutschen Anzeigenamen. Hintergrund: Der Wächter
prüft die et→Bereich-Zuordnung gegen `orion_bf_sport.name_erwartet`
(„Soccer", „Boxing" …) — die 4.0 schickte seit dem 16.8. deutsche Namen,
dadurch schlug der Wächter **1.262-mal in 24 h Dauer-Fehlalarm** und
ersäufte echte Vermischungs-Alarme im Rauschen. Gefunden bei des Auftraggebers
Prüfauftrag am 17.08. („keine Vermischungen wie damals"). Solange die
Sportkarte noch nicht geholt ist, lässt die Bridge `et_namen` weg — die
Prüfung pausiert dann sichtbar, statt Unsinn zu melden. Neu in 22:
`stats.speicher_mb`, der eigene Speicherverbrauch bei jedem Upload
(des Auftraggebers Sorge nach der stets wachsenden 3.8; gemessen: 80 MB, Ordner
enthält nur 5 Programmdateien ohne Protokolle — es wächst nichts, und
das ist jetzt jederzeit per SQL ablesbar). Neu in 21: die
Sportarten-Schalter. In `bridge-config.json` darf ein Feld
`sportarten` stehen (je Schlüssel: `aktiv`, `fensterStunden`, `anteil`;
gültige Schlüssel: fussball, tennis, basketball, baseball, football,
eishockey, cricket, boxen, mma, motorsport, esport). Fehlt das Feld,
läuft alles exakt wie Build 20 — im Trockenlauf mit des Auftraggebers unveränderter
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
gestartet). ACHTUNG: Am 17.08. hat der Auftraggeber versehentlich den kompletten
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
2. **`bridge-config.json` bleibt kompatibel** — des Auftraggebers Zugangsdatei wird
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
5. **Die Bridge nie hinter uns lassen (des Auftraggebers Ansage, 17.08. abends):**
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

**Erledigt 17.08. spät (Auswahl „c"):** Scanstand-Kopf im Panel (alle
21 Bereiche mit Zustand, Daten aus neuer Lesefunktion
`orion_scanstand()`, 30-s-Puffer) und Karten in Chancen/Knapp nach
Bereichen gebündelt. Im echten Browser gegen die Live-Daten
verifiziert, null Konsolenfehler. Nebenbefund für später: die
Anbietertafel zeigt bei Betfair „? von ? hochgeladen" — die
Übersichts-Funktion liest noch die 3.8-stats-Schlüssel (`bf_katalog`,
`hochgeladen`), die Bridge 4.0 sendet stattdessen `maerkte`/`vorrat`.

**Neue definierte Bauaufgabe (des Auftraggebers Nachfrage 17.08. nachts):
Marktart „WAHL" — Betfair-Politik gegen Polymarket-Binärfragen.**
Gemessen 17.08. nachts: Betfair et 2378961 führt **117 Märkte**, alle
Art NONSPORT, Stichtage = Wahltermine (Nov. 2026–2029, weit außerhalb
jedes 72-h-Fensters), darunter Zwei-/Drei-Läufer-Klassiker (US-Senat 2,
Repräsentantenhaus 3, Winning Party 3, Trump-Specials 2 Läufer) mit
hoher Liquidität. Warum sie heute NIRGENDS ankommen: (a) Bridge lädt
nur MATCH_ODDS/OVER_UNDER, (b) das gesamte System denkt in 72 h —
Bridge, Kalshi-Sammler, PM-Abruf, (c) die Paarung kennt nur „A gegen
B"-Partien. Der Bauplan: Bridge lädt NONSPORT-Politik mit eigenem
langem Fenster (sportarten-Schalter existiert; die 72-h-Kappung
braucht eine Politik-Ausnahme), Server paart Kandidaten-/Parteinamen
NUR über Weißliste (Kandidatennamen = schärfste Namensgleichheits-
Falle; „Trump" steht in dutzenden Fragen), PM-Seite: Binärfrage gegen
Back/Lay auf den Läufer (der Lay-Fall war im 3.8-Regelwerk vorgedacht).
**Regel der Auftraggeber VORHER vorlegen, wie bei der Schwelle.** Messskript:
Scratchpad bf-politik-messung.js (Muster im UEBERGABE-Verlauf).

**des Auftraggebers Feature-Auftrag (17.08. tief nachts) — ERSTER BAU DER
NÄCHSTEN SITZUNG: das Drei-Tage-Archiv.** Seine Worte sinngemäß:
Hauptanzeige schlank halten; alles, was älter als 3 Tage in Verlauf,
Knapp-Archiv oder Falschen Rechnungen steht, wandert in ein ARCHIV —
ein eigenes Fach, in dem man jede Rechnung nachschlagen kann, das
aber NICHT im 2-Sekunden-Takt mitläuft („das Live-Mitziehen von allem
ist anstrengend fürs Programm"). Bauplan: (a) holeVerlauf bekommt
den Schnitt `vorbei_seit >= now()-3 Tage` — das verkleinert zugleich
die teuerste Abfrage (gemessen 1,4 s bei 450+ Zeilen); (b) fünfter
Reiter „Archiv", der NUR BEIM ÖFFNEN einmal lädt (kein Auto-Takt,
einmal gezeichnet, chronologisch); (c) WICHTIG: Schnitt und
Archiv-Reiter nur ZUSAMMEN ausrollen — der Schnitt allein würde
Zeilen unsichtbar machen (verschweigen ist schlimmer). Dazu seine
zwei Beobachtungen prüfen: Veraltetes soll nicht mitgeschleppt
werden (Stand: Knapp schließt Veraltete schon aus; der
Veraltet-über-Schwelle-Block über den Chancen bleibt als ehrliche
Warnung) und „vieles rutscht in die Knappsten Paare und Chancen
flackern weg" — das ist eine MESSAUFGABE (Bewährungszeit 25 s,
Mindestrendite 2 %, Lebensdauer der Chancen auswerten), bevor an
Schwellen gedreht wird.

**des Auftraggebers Feature-Auftrag 2 (17.08. tief nachts, „letzte Sache") —
BAU 2 DER NÄCHSTEN SITZUNG: das GESETZT-Fach.** Seine Worte
sinngemäß: an jedem Eintrag ein kleiner, dezenter Speichern-Knopf
(„darauf habe ich gesetzt"). Gespeichert wird: der Fund samt seiner
Rechnung zum Zeitpunkt des Setzens (Schnappschuss, nicht Verweis —
die Zeile ändert sich ja weiter!), der EIGENE eingesetzte Betrag,
später das Urteil „war die Rechnung des Programms richtig?"
(ja/nein/offen) und freie Notizen. Dazu eine eigene Ansicht aller
Gespeicherten, und an gespeicherten Karten ein sichtbares
„gesetzt"-Zeichen. **der Auftraggeber hat entschieden (17.08. tief nachts): Variante (b) —
Datenbank, auf jedem Gerät verfügbar.** Bauskizze: Tabelle
`orion_einsaetze` (schluessel, nr, schnappschuss jsonb, einsatz_eur,
urteil offen/richtig/falsch, notiz, erstellt_am, geaendert_am), RLS
komplett dicht für anon; Lesen UND Schreiben ausschließlich über
eine kleine Edge Function `orion-einsaetze` mit `x-bridge-token` als
Ausweis (dasselbe Muster wie bf-bridge: Vergleich gegen
`profiles.bridge_token`); das Panel erfährt den Token einmalig über
die Einstellungen-Seite und behält ihn lokal. So bleibt die Tabelle
trotz öffentlichem Panel-Schlüssel geschützt, und die Einsätze
gehören nachweislich der Auftraggeber.

**VORRANG vor allem anderen (des Auftraggebers Schlussansage 17.08. nachts):
das WANDERN der Karten beim Lesen.** Diagnose (nicht raten — sie
steht hier fest): Der Scroll-Anker von heute hält die SEITE fest,
aber die Live-Listen werden bei jedem Takt neu nach Rendite
SORTIERT — ändert sich eine Rendite, tauschen Karten die Plätze,
und die gelesene Karte rutscht relativ zum Anker weg. Der Bauplan:
**ORDNUNGS-RUHE** — solange der Nutzer auf der Liste steht, behält
jede vorhandene Karte ihren Platz (nur ihre WERTE ändern sich);
Neuzugänge werden an ihrer Sortierstelle eingefügt; komplett neu
sortiert wird erst beim Reiterwechsel, beim Neuladen oder nach
längerer Ruhe. Muss mit der Bereichs-Gruppierung (17.08., „c")
zusammenspielen. Danach erst Archiv und Gesetzt-Fach.

**ERLEDIGT 17.08. tief nachts (des Auftraggebers Planänderung, „erste
Priorität"):** Funker-Chat STILLGELEGT — der Knopf bleibt als
Platzhalter und tut nichts; `antwort()` bleibt im Code für später.
Seine Nachprüfung läuft jetzt als DEFAULT bei jedem Takt für jede
Zeile (grüner Chip „nachgerechnet" / rote Warnung „RECHNUNG WEICHT
AB"). Statt der Rechnungsnummer trägt jede Karte den
KOPIEREN-Knopf: vollständiger Prüfbericht als Text in die
Zwischenablage (Spiel, beide Seiten mit Kurs/Gebühr/Effektivquote/
Formel/Menge/Link, Kehrwertsumme, Rendite, Einsätze, Zeiten,
Absage-Bilanz, Buchprobe, Währungskurs, Nachprüfung). Skript-Version
auf v=57. Browser-verifiziert, Commit 3c48f13.

**Künftiges Kapitel (des Auftraggebers Ansage vor der Planänderung): der FUNKER
als EIGENES Projekt** — eigenes Repo auf GitHub, eigener Link, mit
dem Panel verbunden/synchronisiert („eine komplett größere Aufgabe,
die separat ist"). Der stillgelegte Knopf im Panel ist der spätere
Einstiegspunkt; `funker.js` hält antwort() als Ausgangsmaterial.

**Actions aufgeräumt (17.08. spät, des Auftraggebers Auftrag „nur grüne
Workflows"):** Alle 16 Repos geprüft — **kein Workflow war pausiert,
deaktiviert oder verwaist**, alle Workflow-Dateien vorhanden, nichts
war versehentlich gelöscht (also nichts wiederherzustellen). Entfernt
wurden **71 rote Protokolleinträge** (orion-panel-pro 25, finder 34,
fach-iq 5, appload 3, orion-panel 3, muslim-atlas 1); danach: 0
nicht-grüne Läufe in allen Repos, alle fünf Live-Seiten HTTP 200.
Ursache der roten Läufe war NIE unser Code, sondern GitHubs 429/503
beim Ausliefern der eigenen Action-Pakete — ausgelöst durch mehrere
Pushes binnen Minuten. Ein dadurch abgebrochener Lauf hatte
`pages.status` auf „errored" stehen lassen, obwohl die Seite korrekt
lief; mit `gh api -X POST .../pages/builds` neu gebaut → „built".
**Regel daraus: Änderungen sammeln, in EINEM Push schicken.**

**Noch offen:**

1. **Deckel-Test:** Standby-/Ruhezustands-Timer nachgemessen auf „nie"
   (Netz UND Akku). Deckel-Aktion ließ sich per Abfrage nicht
   bestätigen — Beweis: Deckel 5 min zu, dann Kontroll-SQL. der Auftraggeber muss
   den Deckel selbst zuklappen.
2. **Überschneidungs-Matrix** (Kategorie × Anbieter, gemessen) — welche
   Bereiche tragen wirklich zwei Quellen. Stand 13.8.: 3 von 21.
3. **Geschwindigkeitsmessung** vor jedem Drehen am Takt — wo geht Zeit
   verloren (Bridge-Takt / Rotation / Server-Takt)? Fallen: Betfair
   drosselt, Supabase 546/Verbindungspool.
4. **Zwei-Quellen-Wächter, meldend statt selbstschaltend:** prüft, ob
   ein ruhender Bereich (Nur-ein-Anbieter-Regel) eine zweite Quelle
   bekommen hat, und meldet — der Auftraggeber gibt das Einschalten frei.
5. **Desktop\Orion-Bridge-3.8 löschen** (macht der Auftraggeber selbst; enthält
   die ALTE Zugangsdatei — die aktuelle liegt in
   C:\Users\Home\OrionBridge und darf NIEMALS gelöscht werden).
6. ~~Commit/Push~~ **erledigt am 17.08.** (Commit f9a5840 auf main,
   gepusht): kompletter 4.0-Stand ist in der Git-Historie verankert.

## 3. DER AUFTRAG VOM 16.08. (des Auftraggebers Worte — erledigt, siehe 3a)

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
3. Marktart „Schwelle": **Regel am 17.08. abends von der Auftraggeber GENEHMIGT**
   (nur Stichtag-gegen-Stichtag; Weißliste statt Wortähnlichkeit; exakt
   gleiche Zahl; exakt gleiche Minute; alle bestehenden Prüfungen;
   Start klein mit BTC). **Erste Anwendung der Regel, gemessen:**
   Polymarkets Tagesschwellen (Bitcoin/Ethereum above ___ on <Tag>)
   stechen um 16:00Z = 12:00 New York; Kalshis KXBTCD/KXETHD schließen
   13:00Z und 21:00Z (9:00/17:00 New York). **Kein gemeinsamer
   Stichzeitpunkt → regelkonforme BTC/ETH-Paare heute: NULL.** Das ist
   die Regel bei der Arbeit — eine 12:00-gegen-17:00-Paarung sähe wie
   Geld aus und wäre reines Risiko. Zweites, grundsätzlicheres
   Hindernis (bei der Regelvorlage noch übersehen, der Auftraggeber noch NICHT
   vorgelegt): die REFERENZQUELLEN differieren (Polymarket löst über
   Binance auf, Kalshi über CF Benchmarks) — nahe der Schwelle können
   beide Bücher GEGENSÄTZLICH abrechnen; selbst zeitgleiche Märkte
   wären nicht streng dieselbe Frage. **der Auftraggeber hat 17.08. spät
   „STRENG" entschieden:** gepaart wird nur bei gleicher
   Referenzquelle; die Weißliste führt sie mit.
   **Stichzeit-Matrix KOMPLETT gemessen (17.08. spät) — Ergebnis:
   NULL streng-konforme Paarungen im heutigen Angebot.** Jeder
   Kandidat scheitert an genau einer Achse: Krypto → Minute (PM
   12:00 New York, Kalshi 9/17 Uhr) UND Quelle (Binance vs CF
   Benchmarks); S&P → Basisgröße (PM fragt den SPY-ETF ~640, Kalshi
   den Index ~7700) trotz identischer Minute 16:00 NY; Nasdaq/Dow →
   PM führt KEINE Schwellenfrage; Einzelaktien (PM „closes above"
   16:00 NY, elf Titel!) → Kalshi führt im Fenster keine
   Einzelaktien-Serien; WTI → Minute (Kalshi 14:30 = NYMEX-
   Settlement, PM 17:00); Gold/Silber/Gas → PM nur „Up or Down"
   ohne feste Schwelle. **Konsequenz und nächster Bau: der
   SCHWELLEN-WÄCHTER statt des Scanners** — eine kleine eigene
   Funktion, die die Matrix periodisch neu misst (beide Börsen
   ändern ihr Angebot laufend); sobald irgendwo Minute + Zahl +
   Quelle zusammenlaufen, MELDET er — erst dann wird der
   Paarungs-Scanner gebaut. orion-lauf bleibt unberührt. Vorrat
   liegt bereit (id=2, Schwellenzahl in jaName, notfalls
   floor_strike im Sammler nachrüsten).
4. **Nur-ein-Anbieter-Regel am 17.8. auf des Auftraggebers Befehl UMGEKEHRT**
   („alles muss gescannt werden"): alle 8 Welt-Bereiche wieder aktiv,
   Stunden-Takte versetzt (:30–:51), 20 Scanner laufen. Politik-Lauf
   von Hand gezündet und im Protokoll bestätigt (10,3 s, fehlerfrei).
   Ehrliche Erwartung: sie SCANNEN, aber Paare kommen erst mit zweiter
   Quelle (Kalshi-Erweiterung + Marktart „Schwelle"). Doku:
   `supabase/datenbank.md`, Abschnitt „Nur-ein-Anbieter-Regel".
5. Secrets offen: `RESEND_API_KEY` (E-Mail), `ELEVENLABS_API_KEY`
   (Vorlese-Funktion) — beides der Auftraggeber.

## 5. Startsatz für die neue Sitzung

„Lies `bridge/UEBERGABE-BRIDGE.md` in `C:\Users\Home\orion-panel-pro` und
dann besprechen wir, welche Konfigurationen in die Bridge kommen."

## 6. BRIDGE-MELDEPFLICHT (des Auftraggebers Regel, 18.08.2026)

**Bei JEDER Änderung ausdrücklich sagen, ob eine NEUE BRIDGE nötig ist.**
des Auftraggebers Worte: „wenn wir Änderungen machen und diese Änderung auch in der
lokalen Bridge geändert werden soll, dass Du mir sagst, dass ich eine
neue Bridge hab."

Also am Ende jeder Änderung einen der zwei Sätze schreiben:

- **„Neue Bridge nötig"** — dann die Datei aushändigen und den
  Installationsweg nennen (Datei nach `C:\Users\Home\OrionBridge`,
  Aufgabe neu starten, per SQL nachmessen).
- **„Keine neue Bridge nötig"** — dann dazusagen, warum nicht (Änderung
  lag im Panel, im Server oder in der Datenbank).

Faustregel, was eine neue Bridge braucht: alles in
`bridge/orion-bridge-4.js` — Upload-Felder, Sportarten, Takte, Fenster,
Speicherverhalten, `stats`. Panel, `orion-lauf`, SQL-Funktionen und
Sammler laufen ohne Bridge-Wechsel.

**Die anderen drei Anbieter brauchen NIE eine Bridge.** Nur Betfair
verlangt einen Rechner zu Hause (Rechenzentren bekommen 403); Kalshi,
Smarkets und Polymarket holt der Server selbst. Frische am 18.08.
gemessen: Bridge 15 s (Build 23), Kalshi Sport und Welt je 66 s
(Sammler v3), Smarkets 52 s, Polymarket 12 s — alle vier aktuell.

## 7. BUILD 24 — der Wettbewerb (18.08.2026)

**NEUE BRIDGE, bereits installiert und laufend.** Build 24 holt von
Betfair zusätzlich `COMPETITION` und sendet sie als Feld `co` mit.

**Warum:** Eine Liga verrät eine Jugend-, Reserve- oder Frauenmannschaft
auch dann, wenn die Mannschaftsnamen unauffällig sind. Live belegt:
Betfair führte „Argentinian Primera Division **Reserves**" — die Liga
zeigte es, die Namen nicht.

**Kette vollständig:** Bridge sendet `co` → `bf-bridge` lässt es durch
(Version 15 ausgerollt, rein additiv) → `zuordnung` mischt die
Liga-Kennung in die Betfair-Seite.

**Nachgemessen nach der Installation:** Daten 20 s alt, Build 24, **400
von 400 Märkten tragen ihre Liga**.

**Alte Bridges bleiben lauffähig:** `co` ist additiv, fehlt es, bleibt
alles wie zuvor (`null` heißt „unbekannt", nicht „passt schon").

## 8. BUILD 25 — der Grundanteil (19.08.2026)

**NEUE BRIDGE, installiert und laufend.** des Auftraggebers Verdacht („vielleicht
haben wir E-Sport und die anderen Bereiche vernachlässigt") war richtig,
und es war ein **stiller Fehlschlag**.

**Gemessen vorher:** Von 497 hochgeladenen Märkten kamen nur DREI
Sportarten an — Fußball 399, Tennis 94, Basketball 4. E-Sport, MMA,
Baseball, Eishockey, Cricket, Boxen, Motorsport: **null**, obwohl der
Vorrat 1.961 Märkte hielt und die Rotation lief.

**Ursache:** `dringlichste()` nahm die 400 dringlichsten Märkte ALLER
Sportarten. Fußball und Tennis fraßen das Kontingent. Die kleinen
Sportarten wurden katalogisiert, bekamen aber nie einen Kurs — und
`bauen()` lädt nur hoch, was einen Kurs hat.

**Fix:** zwei Durchgänge. Erst Grundanteil je Sportart (Standard 24,
als `grundanteilJeSportart` einstellbar), dann der Rest global nach
Dringlichkeit.

**Gemessen nachher, gegen Betfairs echtes Angebot im 72-h-Fenster:**

| Sportart | Betfair bietet | Bridge lädt |
|---|---|---|
| E-Sport | 18 | **18** |
| MMA | 5 | **5** |
| Baseball | 25 | **26** |
| Basketball | 6 | **6** |
| Am. Football | 3 | **3** |
| Cricket | 45 | 25 |
| Tennis | 157 | 94 |
| Fußball | 1.791 | 399 (Kontingent) |

Eishockey, Boxen, Motorsport, Golf: Betfair bietet dort **null** —
kein Defekt, kein Angebot.

**Nicht geladen, weil der Server sie keinem Bereich zuordnen kann:**
Darts (15), Rugby League (5), Rugby Union (2), Australian Rules (2).
Wer sie will, trägt sie in `SPORT` (Bridge) UND `orion_bf_sport`
(Datenbank) ein — beides, sonst verwirft der Scanner sie stumm.

**Standby-Prüfung** (Build 25): Die Bridge kann den Ruhezustand nicht
selbst verhindern (Adminrechte), aber sie sieht beim Start nach und
meldet LAUT, wenn der Rechner einschlafen würde — samt der zwei
`powercfg`-Befehle. Gemessen: „Standby: AUS (Netz und Akku)".
