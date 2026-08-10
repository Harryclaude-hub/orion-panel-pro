# Orion Panel Pro — Übergabe

> **Diese Datei ist die Wahrheit über das Projekt. Halte sie aktuell.**
> Nach jeder wesentlichen Änderung — neue Quelle, neue Regel, neuer Messwert,
> erledigter Punkt aus Abschnitt 7 — wird sie im selben Commit nachgezogen.
> Sie aktualisiert sich NICHT von selbst. Eine veraltete Übergabe ist
> schlimmer als keine, weil man ihr glaubt.

Stand: 10. August 2026, Abend. Dieser Text reicht, um ohne Vorwissen
weiterzuarbeiten. Alle Zahlen darin sind gemessen, nicht geschätzt.

**Live:** https://saifokaram1-hub.github.io/orion-panel-pro/
**Repo:** `saifokaram1-hub/orion-panel-pro` · lokal `C:\Users\Home\orion-panel-pro`
**Supabase:** `noexklrgtqveiclijdwp` · Sperrwort der Website: `ARBRADAR2026`

---

## 1. Was das Programm ist

Ein Surebet-Scanner zwischen **Börsen** (nie Buchmachern): er sucht Paare,
bei denen zwei Bücher denselben Ausgang unterschiedlich bepreisen, sodass
beide Seiten zusammen unter 100 % liegen.

**Eine Arbitrage besteht immer aus GENAU ZWEI Büchern** — nicht einem, nicht
dreien. Gibt es zur selben Frage mehrere brauchbare Buchpaare, wird daraus
**je eine eigene Zeile**, denn jede hat eigene Links, eigene Einsätze und
eine eigene Rendite.

**Es läuft vollständig auf Supabase, rund um die Uhr.** Die Website rechnet
nichts, sie liest nur ab. Kein Browser muss offen sein.

---

## 2. Die Bücher, gemessen

| Buch | Rolle | Konto nötig? | aus Supabase erreichbar? | Stand |
|---|---|---|---|---|
| **Kalshi** | Börse | nein | **ja** | läuft, ~216 Märkte |
| **Polymarket** | Börse | nein | **ja** | läuft, ~390 Märkte im 72h-Fenster |
| **Smarkets** | Börse | **nein** | **ja** | **läuft seit 10.8.**, ~800 Märkte aus 125 Spielen |
| **Betfair** | Börse | **ja** | **nein, 403** | nur über Bridge auf dem Heim-PC, ~940 im Fenster |
| Orbit / 96ex | **Broker**, kein eigenes Buch | — | nein, 403 | nur Linkziel |

Die Anbietertafel sortiert **nach Umfang, das kleinste Buch zuerst**. Das
kleinste ist die Engstelle: was dort nicht liegt, kann nirgends gepaart
werden, weil eine Arbitrage immer zwei Bücher braucht. Die großen stehen
unten — sie bringen die Partien, die es sonst nirgends gibt.

### Betfair: neun Wege gemessen, acht gesperrt

```
GEBLOCKT 403   api.betfair.com (json-rpc, rest, account)
GEBLOCKT 403   api-au.betfair.com, api.betfair.es, historicdata, betfair.com
GEBLOCKT 403   menu.json (öffentlich, ohne Anmeldung)
ERREICHBAR     identitysso-cert.betfair.com/api/certlogin  → CERT_AUTH_REQUIRED
ERREICHBAR     stream-api.betfair.com:443  → {"op":"connection","connectionId":...}
```

Die Sperre greift **vor** der Anmeldung. Zugangsdaten ändern daran nichts.
Nachmessen: `curl -s https://noexklrgtqveiclijdwp.supabase.co/functions/v1/bf-erreichbar`

Offen wäre nur der Weg **Zertifikat → Stream**. Beide Bausteine sind
vorhanden: Supabase akzeptiert Client-Zertifikate (`createHttpClient` meldet
„Unable to decode certificate", liest die Felder also), und der Stream
antwortet auf eine Anmeldung mit `INVALID_APP_KEY` — er spricht mit uns.
Ungeprüft ist, ob die Marktsuche allein über den Stream-Filter funktioniert.

### Orbit ist kein drittes Buch

`orbitexch.com/customer/api/market/{id}` antwortet ohne Schlüssel mit JSON,
enthält aber **keine Quoten** — nur Struktur, Läufer und `commission`.
57 JavaScript-Dateien der Seite durchsucht: nur Konto-Endpunkte, kein
öffentlicher Kursweg, kein WebSocket. Aus Supabase ohnehin 403.

Orbit benutzt Betfairs Marktnummern unverändert. Es ist **eine zweite Tür
zum selben Raum**. `96ex.com` ist tot (HTTP 000), deshalb zeigen alle
Betfair-Links auf `orbitexch.com`.

### Smarkets — gemessen am 10.8.2026

Echte Wettbörse, kein Buchmacher. Kein Konto, kein Heim-PC.

```
Spiele    200  314 ms   124 Fussballspiele im 72h-Fenster
Maerkte   200  364 ms   8967 gesamt, 992 davon Sieger/Ueber-Unter
Quoten    200   42 ms   volle Tiefe
Sammler aus Supabase: 125 Spiele, 797 Maerkte mit Quoten, 7 s
```

**Preiskodierung — dreifach belegt, nicht angenommen:**

`Quote = 10000 / price`. Der Preis ist die implizite Wahrscheinlichkeit in
Hundertstel-Prozent: 4032 → 40,32 % → Quote 2,48.

1. **Quotenleiter.** Jeder gemessene Preis landet exakt auf der
   Smarkets-Leiter (4167→2,40 · 2857→3,50 · 5618→1,78 · 4762→2,10 ·
   3077→3,25). Kein Ausreißer.
2. **Kehrwertsumme.** Back-Seite 101,03 %, Lay-Seite 98,72 % (Siegermarkt);
   103,35 % / 97,62 % (Über/Unter). Genau die Richtung, die eine Börse haben
   muss. Bei falscher Kodierung käme das nicht in die Nähe von 100 %.
3. **Zweiter Endpunkt.** `last_executed_prices` meldet für Preis 2899 den
   Wert `"28.99"`.

`offers` = Back-Seite (dort wird gekauft), `bids` = Lay-Seite. Back lag bei
jedem Läufer unter Lay — korrekte Spanne.

**Die Menge ist die AUSZAHLUNG, nicht der Einsatz.** Offizielles SDK:
`quantity = 400000 # 40.0000 GBP payout`, `price = 2500 # 25.00%`.
Also `Einsatz = quantity * price / 10^8`. Wer das verwechselt, liegt bei
Quote 5,0 um den **Faktor 5** daneben.

**Zwei Fallen:** `quantity = 2147483646` (2³¹−2) ist eine Platzhaltermarke,
keine Menge — sie steht nur an den Randpreisen 1 und 9999. Gültig ist nur
die Leiter 1,01 bis 1000, also `price` zwischen 10 und 9901. Beides wird
verworfen, sonst wird „unbekannt" zu „unbegrenzt".

**Kommission: 2 % — dokumentiert, NICHT gemessen.** Standard-Tarif auf den
Nettogewinn je Markt, gleiche Form wie bei Betfair, deshalb gelten `qeBack`
und `qeLay` unverändert. Es gibt kein Konto und die öffentliche API gibt den
Satz nicht heraus. Jeder Fund trägt `bf_gebuehr_echt = false`.
**Achtung:** daneben bestehen 1 % (Pro) und **3 % (Select)** — Letzterer
trifft genau die besonders profitablen Konten. Wer dorthin rutscht, muss
`KONFIG.smarketsGebuehr` und `rechnung.ts` auf `0.03` setzen, sonst rechnen
sich dünne Funde still ins Plus.

**Smarkets liefert die Struktur mit** — als einziges Buch:
`market_type` = `WINNER_3_WAY` bzw. `OVER_UNDER` mit `param: "2.5"`,
`contract_type` = `HOME`/`DRAW`/`AWAY`/`OVER`/`UNDER`. Bei Betfair muss die
Linie aus `OVER_UNDER_25` geklaubt werden. Außerdem liefert Smarkets die
**Anpfiffzeit** (`start_datetime`), die Betfair nicht mitschickt — sie wird
im Schnappschuss als `st` mitgespeichert (Anzeige steht noch aus, Punkt 3).

**Fallstrick bei der Paginierung:** `pagination.next_page` ist ein
**Query-String**, kein Pfad. Wer ihn an den Host hängt, bekommt 50 Spiele
statt 124 und merkt es nicht. Genau das ist beim ersten Anlauf passiert.

---

## 3. Wie es aufgebaut ist

```
pg_cron ──┬─ orion-lauf      jede Minute     sucht und rechnet
          ├─ pm-scan         jede Minute     (alt, läuft noch mit)
          ├─ orion-kalshi    alle 5 Minuten  holt Kalshi (52 s je Durchlauf)
          ├─ orion-smarkets  alle 5 Minuten  holt Smarkets (7 s je Durchlauf)
          ├─ orion-pruefer   alle 5 Minuten  Alter, Rechnung, Links
          ├─ orion-rauschen  alle 5 Minuten  löscht Minuszeilen im Verlauf
          └─ orion-wache     alle 10 Minuten prüft, ob das alles noch läuft

Website (alle 2 s)  →  liest orion_funde + orion_uebersicht, rechnet nichts
Bridge auf Heim-PC  →  bf-bridge  →  bridge_odds  (nur für Betfair)
```

### Das Seiten-Modell (Umbau vom 10.8.2026)

Vorher suchte `orion-lauf` genau zwei Paarungen: Polymarket gegen Betfair und
Polymarket gegen Kalshi. Mit dem dritten Buch wären das sechs — und Betfair
gegen Smarkets ist genauso eine Arbitrage. Die Hälfte liegen zu lassen wäre
Unsinn gewesen.

Zu jeder Frage („Gewinnt Team A?") liefert jedes Buch bis zu **zwei Seiten**:

```
JA    Polymarket JA-Anteil · Kalshi Yes · Betfair/Smarkets BACK
NEIN  Polymarket NEIN-Anteil · Kalshi No · Betfair/Smarkets LAY
```

Jede Seite trägt ihre Effektivquote **nach Gebühr**. Danach wird jede
JA-Seite gegen jede NEIN-Seite eines **anderen** Buches gerechnet
(`R.alleChancen`). Erzwungen wird dabei: genau zwei Bücher, immer JA gegen
NEIN, nie dasselbe Buch gegen sich selbst.

Gemessen im ersten Lauf: **acht verschiedene Paarungen gleichzeitig live**,
darunter `kalshi → smarkets` und `smarkets → kalshi` — Kombinationen, die es
vorher gar nicht geben konnte.

**Anker ist weiterhin Polymarket.** Die Partien werden über den
Polymarket-Titel gefunden; Betfair gegen Smarkets entsteht *transitiv* über
eine Partie, die Polymarket ebenfalls führt. Partien, die es NUR auf Betfair
und Smarkets gibt, werden noch nicht gepaart (Punkt 5).

### Dateien

```
index.html            Panel mit drei Reitern
einstellungen.html    Weg B (Zertifikat + Secrets) und Weg A (Bridge)
logik.html            erklärt die Suche, als Textdatei herunterladbar
js/konfig.js          alle Schwellen + die Bücher an EINER Stelle
js/rechnung.js        Quoten, Gebühren, Aufteilung   171 Prüfungen
js/zuordnung.js       Marktpaarung                   179 Prüfungen
js/daten.js           liest ab, filtert, richtet Broker-Links
js/anzeige.js         Tafel, Karten, Gegenprobe, Puffer
js/sperre.js          Sperrbildschirm, Overlay wird ENTFERNT + Wache
bridge/               Bridge für den Heim-PC, Build 18  158 Prüfungen
supabase/functions/   orion-lauf (+ Spiegel), orion-smarkets, …
```

### Datenbank

```
orion_funde       jeder Fund, live und Verlauf, mit Prüfergebnis
                  buch_1 = Buch der JA-Seite, buch = Buch der NEIN-Seite
                  pm_*   = Seite 1, bf_* = Seite 2  (Namen historisch)
orion_laeufe      Protokoll jedes Scans
orion_wache       Selbstkontrolle
kalshi_snapshot   öffentliche Kalshi-Kurse
smarkets_snapshot öffentliche Smarkets-Kurse, inkl. Anpfiffzeit
bridge_odds       Betfair, von der Bridge  (NICHT anfassen, Format ist fix)
orion_geheim      privater Schlüssel des Zertifikats, RLS ohne Policy
```

Funktionen: `orion_uebersicht()`, `orion_bf_maerkte()`,
`orion_pruefung_schreiben()`, `orion_rauschen_loeschen()`

---

## 4. Die Regeln, die nicht gebrochen werden dürfen

1. **Nur gleiche Frage gegen gleiche Frage.** Zugelassen sind `sieger`,
   `unentschieden`, `ueber_unter` (nur die Gesamtlinie, gleiche Linie gegen
   gleiche). Ohne diese Regel meldete das Programm am 9.8. **663
   Scheinchancen mit bis zu 184 %**.
2. **Unbekannte Gebühr niemals als 0.** Rückfall auf 7 %.
   Beleg: 0,49 gegen 2,03 sieht ohne Gebühr nach +0,46 % aus, mit 4 % sind
   es −0,52 %.
3. **Zwei verschiedene Ähnlichkeitsmaße.** Partie durch den *kürzeren* Namen
   (Schwelle 0,50), Läufer durch den *längeren* (0,80).
   **Ausnahme Smarkets, seit 10.8.:** dort kommt der Läufer aus der
   Struktur (`contract_type`), und die Namensprüfung ist **Vetorecht statt
   Pflicht** — zeigen beide Wege auf *verschiedene* Verträge, wird gar nicht
   gepaart. Begründung und Messwerte in Abschnitt 5.
4. **Die Partie kommt aus `ev`, nicht aus `k`.** Bei MATCH_ODDS steht sie in
   `k`, bei allen anderen Typen stehen dort die Läufer. `paar(k) || paar(ev)`
   fiel nie auf `ev` zurück → 0 Paare bei 849 gegen 865 Märkten.
5. **Vereinskürzel und Sportbegriffe zählen nicht als Namensbeleg.**
   Sonst: „Cruzeiro EC vs CR Flamengo" traf „Flamengo v EC Vitoria" — zwei
   verschiedene Spiele, gemeldet mit 16,02 %.
6. **`bf-bridge`, das POST-Format und `profiles.bridge_token` sind
   unantastbar.** Nur erweitern, nie umbauen. Auf zwei PCs laufen Bridges.
7. **Genau zwei Bücher je Zeile.** Nicht eins, nicht drei. Wird in
   `R.chance` erzwungen und vom Prüfer noch einmal nachkontrolliert.

---

## 5. Was geprüft ist

```
node pruefung/rechnung.test.js     171 Prüfungen
node pruefung/zuordnung.test.js    179 Prüfungen
node bridge/pruefung.js            158 Prüfungen
                                   ───
                                   508 Prüfungen
```

Jede Schutzregel hat einen Test, der sie **auslöst**, nicht nur einen, der
sie umgeht. Der Veto-Test etwa stellt Struktur (Bayern) gegen Name
(Dortmund) und verlangt, dass gar nicht gepaart wird.

**Unabhängige Nachprüfung aller Funde** (dritte, getrennt geschriebene
Rechnung im `orion-pruefer`), 10.8. nach dem Umbau:

```
210 Zeilen geprüft (23 live + 187 Verlauf)
210 einwandfrei
  0 falsch
  0 nicht nachrechenbar
```

### Die Läuferzuordnung bei Smarkets, gemessen

125 Spiele gegen 351 Polymarket-Märkte:

| | |
|---|---|
| Spielname „X vs Y" entspricht HOME/AWAY | **124 / 124**, 0 Abweichungen |
| mehrdeutige Partien (>1 Spiel über 0,50) | **0** |
| Widerspruch Struktur gegen Name | **0** |
| Paare, beide Wege einig | 43 |
| Paare, die **nur** die Struktur findet | **17** |

Die strenge 0,80-Namensschwelle verwirft **17 von 60 richtigen Paaren**,
weil die Bücher verschieden lang benennen: „CD Nacional" gegen „Nacional da
Madeira" ergibt 0,33, „Minnesota United FC" gegen „Minnesota Utd" ergibt
0,50. Die 24 Paare mit schwachem Partie-Score wurden einzeln angesehen —
alle richtig („Nottingham Forest"↔„Nottm Forest", „Aarhus GF"↔„AGF Aarhus").

Zurück auf streng geht über `smLaeufer(..., namePflicht = true)`; ein Test
deckt beide Richtungen ab.

---

## 6. Stand der Anzeige

Drei Reiter: **Chancen**, **Knappste Paare**, **Verlauf**.
Ganz oben eine **Anbietertafel**, nach Umfang sortiert (kleinstes Buch
zuerst, als Engstelle markiert), mit Ampel, Aktualität, Umfang, Funden,
Tempo und dem Zustand von Supabase und allen Takten. Darunter eine Zeile
**laufende Paarungen**, damit auffällt, wenn eine ganze Buchpaarung
stillsteht.

Jede Karte trägt: Uhrzeit oben rechts, **beide Bücher namentlich** (nicht
mehr „Polymarket gegen Gegenbuch"), Rendite in Worten samt Vergleich ohne
Gebühren, **Gegenprobe** beider Ausgänge, Aufteilung in Prozent, maximalen
Einsatz aus der Markttiefe, Puffer, Prüfzeile, beide Links mit Kopierknopf.

Preise werden mit drei Nachkommastellen gezeigt, Quoten mit zweien — je nach
Buch. Der Puffer nennt die richtige **Richtung**: ein Anteilspreis darf
steigen, eine Back-Quote muss fallen, eine Lay-Quote darf steigen.

**Verlauf enthält nur Funde, die im Plus waren** — beide Werte (zuletzt und
beste) müssen ≥ 0 sein. Alles andere wird gelöscht, serverseitig alle
5 Minuten. Gespeichert wird ohnehin erst ab −1 % Rendite; alles darunter ist
Rauschen und würde bei sechs Paarungen je Markt Zehntausende Zeilen je
Minute erzeugen.

---

## 7. Offen, nach Wichtigkeit

1. **Bridge auf Build 18 starten.** Liegt fertig im Repo, läuft aber nicht
   (die Tafel zeigt Build 17). Bringt: 8.000 statt ~3.500 hochgeladene
   Märkte und den **echten Kommissionssatz je Markt** statt des
   7-%-Rückfalls. Das ist jetzt der größte Hebel.
2. **Anpfiffzeit anzeigen.** Ein Markt, der in 8 Stunden endet, dessen Spiel
   aber in 20 Minuten beginnt, ist etwas völlig anderes. Smarkets liefert
   `st` bereits mit und es wird gespeichert — es fehlt nur die Anzeige und
   der gleiche Wert von Betfair.
3. **Währungen werden gemischt.** Smarkets rechnet in **GBP**, Polymarket
   und Kalshi in **USD**, Betfair je nach Konto. `max_einsatz` und
   `max_gewinn` mischen das ungewichtet. Die **Rendite bleibt richtig** —
   sie ist ein Verhältnis —, aber die Mengenbegrenzung ist um den
   Wechselkurs daneben, derzeit rund 25 %. Ungemessen, unkorrigiert.
4. **Partien, die Polymarket nicht führt.** Betfair gegen Smarkets entsteht
   heute nur transitiv über eine Polymarket-Partie. Betfair hat ~940 Märkte
   im Fenster, Smarkets ~800 — die Überschneidung ohne Polymarket ist
   ungemessen und wird nicht gesucht. Bräuchte einen eigenen, gemessenen
   Zuordner Betfair↔Smarkets.
5. **Weitere Markttypen.** Ungenutzt: bei Betfair 125 BOTH_TEAMS_TO_SCORE,
   121 DOUBLE_CHANCE, 119 DRAW_NO_BET, 100 HALF_TIME; bei Smarkets
   zusätzlich CORRECT_SCORE, BTTS, WINNER_AND_OVER (rund 8.000 Märkte
   liegen dort ungenutzt). Jeder braucht eine eigene Zuordnungsregel plus
   Prüfstand.
6. **Nicht-Sport (Politik, Krypto).** Gemessen und **bewusst nicht gebaut**:
   4.779 gegen 4.990 Märkte ergaben 13 vermeintliche Treffer, **alle falsch**
   ($64.000 gegen $64.750, teils verschiedene Tage). Titelähnlichkeit ist
   dort das falsche Werkzeug.
7. **Kaltstart-Fehler.** `orion-lauf` scheiterte gelegentlich direkt nach dem
   Aufspielen mit `WORKER_RESOURCE_LIMIT`. Seit Smarkets in einen eigenen
   Sammler ausgelagert wurde, läuft der Scanner in ~4 s statt vorher länger —
   ob das den Fehler beseitigt, ist **noch nicht über mehrere Tage gemessen**.
8. **Die Spiegel laufen auseinander.** `rechnung.ts`/`zuordnung.ts` sind
   Kopien der JS-Dateien. Am 10.8. wurde festgestellt: `maxEinsatz` gab es
   nur serverseitig, `kalshiIndex`/`aehnlichkeitW` ebenso. Beides wurde
   nachgezogen, aber es fehlt weiterhin ein Prüfstand, der beide Fassungen
   gegeneinander hält. Das ist der Grund, warum es überhaupt passieren konnte.

---

## 8. Arbeitsweise, die sich bewährt hat

**Erst messen, dann bauen.** Jeder ernste Fehler in diesem Projekt wurde
gefunden, weil jemand nachgerechnet oder nachgemessen hat — nicht durch
Nachdenken:

- die 663 Scheinchancen: erst im echten Lauf sichtbar
- die 16,02-%-Fehlpaarung: durch eine Rückfrage des Auftraggebers
- `paar(k) || paar(ev)`: durch 0 Paare bei 849 gegen 865
- der tote 96ex-Link: durch einen HTTP-Aufruf statt einer Annahme
- die Kaltstart-Ausfälle: durch einen Blick ins Protokoll
- Smarkets' `next_page`: 50 statt 124 Spiele, aufgefallen nur, weil die
  erwartete Zahl aus einer früheren Messung bekannt war
- die Menge als *Auszahlung*: hätte ohne Blick ins offizielle SDK bei
  Quote 5,0 um den Faktor 5 danebengelegen

**Drei Zustände, nie zwei.** Richtig, falsch, *oder nicht prüfbar*. Ein Link,
den man nicht prüfen kann, ist nicht „tot". Eine Zeile ohne gespeicherte
Gebührensätze ist nicht „falsch gerechnet". Eine fehlende Menge ist nicht
„unbegrenzt".

**Ein Widerspruch ist kein Grund, sich zu entscheiden.** Wenn zwei
unabhängige Wege auf verschiedene Ergebnisse zeigen, wird nicht der
plausiblere genommen, sondern gar nicht gehandelt.

**Was nicht gemessen wurde, wird als ungemessen gekennzeichnet.**
