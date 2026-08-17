# ÜBERGABE: Orion Bridge 4.0 — Startpunkt für die nächste Sitzung

> **Für die neue Sitzung:** Diese Datei zuerst lesen, dazu `UEBERGABE.md`
> Abschnitt 8j (Gesamtprojekt) und `supabase/datenbank.md`. Karam ist der
> Offizier, die Anrede ist militärisch, alles auf Deutsch.

## 1. Stand (16.08.2026, Ende der Sitzung)

Die Bridge 4.0 (Build 20) ist **fertig, getestet und läuft dauerhaft**:

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
   oder der Watchdog übernimmt). **NIE per Bash-Heredoc mit Backslashes/
   Regexen in die Datei schreiben** — das hat in dieser Sitzung zweimal
   Escapes zerlegt (`\s`→`s`). Edit-Tool oder node-Skript mit
   `String.fromCharCode(92)` benutzen.
4. Prüfung, ob sie läuft: SQL
   `SELECT now()-updated_at, stats FROM bridge_odds WHERE id=1;`
   (Alter muss < ~1 min sein; `stats.bridge` = "4.0").

## 3. DER NÄCHSTE AUFTRAG (Karams Worte, 16.08. spät)

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
2. Kalshi-Sammler um Krypto/Wetter/Wirtschaft erweitern (KXBTCD, KXETHD,
   KXHIGHNY, KXFED offen) — erst Last messen (61 s / HTTP-546-Gefahr).
3. Neue Marktart „Schwelle" mit strikter Paarung (gleiche Basis + gleiche
   Zahl + gleicher Stichzeitpunkt); Regel Karam VORHER zeigen. Warnung:
   Polymarket „erreicht X im Zeitraum" ≠ Kalshi „Preis am Stichtag".
4. **Nur-ein-Anbieter-Regel aktiv:** politik, krypto, wirtschaft, tech,
   welt, wetter, kultur, golf sind `aktiv=false` + Takte entfernt
   (12 Scanner laufen). Wieder einschalten, sobald zweite Quelle da ist.
   Doku: `supabase/datenbank.md`, Abschnitt „Nur-ein-Anbieter-Regel".
5. Secrets offen: `RESEND_API_KEY` (E-Mail), `ELEVENLABS_API_KEY`
   (Vorlese-Funktion) — beides Karam.

## 5. Startsatz für die neue Sitzung

„Lies `bridge/UEBERGABE-BRIDGE.md` in `C:\Users\Home\orion-panel-pro` und
dann besprechen wir, welche Konfigurationen in die Bridge kommen."
