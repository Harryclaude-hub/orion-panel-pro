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

**Grundsatz seit 10.8.2026: alles läuft auf Supabase, nichts auf einem
Heim-PC.** Das Programm ist für mehrere Leute gedacht; ein Buch, das einen
fremden eingeschalteten Rechner voraussetzt, ist damit unbrauchbar.
Zweiter Grundsatz: **keine Konten, keine Schlüssel**, soweit irgend möglich.

| Buch | Rolle | Konto nötig? | aus Supabase erreichbar? | Stand |
|---|---|---|---|---|
| **Kalshi** | Börse | nein | **ja** | läuft, ~220 Märkte |
| **Polymarket** | Börse | nein | **ja** | läuft, ~480 Märkte im 72h-Fenster |
| **Smarkets** | Börse | **nein** | **ja** | **läuft seit 10.8.**, ~820 Märkte aus 133 Spielen |
| ~~Betfair~~ | Börse | ja | **nein, 403** | **ABGESCHALTET 10.8.** — siehe unten |
| ~~Orbit / 96ex~~ | **Broker**, kein eigenes Buch | — | nein, 403 | mit Betfair entfallen |

Damit braucht der Scanner **keinen einzigen Zugangsdatensatz**. Drei Börsen,
sechs mögliche Paarungen, rund um die Uhr auf Supabase.

Die Anbietertafel sortiert **nach Umfang, das kleinste Buch zuerst**. Das
kleinste ist die Engstelle: was dort nicht liegt, kann nirgends gepaart
werden, weil eine Arbitrage immer zwei Bücher braucht. Die großen stehen
unten — sie bringen die Partien, die es sonst nirgends gibt.

### Betfair: abgeschaltet, und warum das endgültig ist

Betfair war das einzige Buch, das einen laufenden Heim-PC brauchte. Am
10.8.2026 wurden **alle** verbliebenen Wege gemessen und erschöpft.

**1. Die REST-API ist gesperrt.** 5 von 8 Wegen antworten mit 403 von
Cloudflare, auch die öffentliche Startseite, **vor** jeder Anmeldung.
Zugangsdaten ändern daran nichts.

**2. Der letzte offene Weg — Zertifikat → Stream — ist eine Sackgasse.**
Das ist keine Vermutung, sondern aus Betfairs eigenem Schema abgelesen
(`ESASwaggerSchema.json`, 37 kB):

```
RunnerDefinition:  sortPriority, removalDate, id, hc, adjustmentFactor, bsp, status
MarketDefinition:  eventId, eventTypeId, marketType, venue, marketBaseRate,
                   openDate, marketTime, runners, status, ...
```

**Kein einziges Feld im gesamten Schema trägt einen Namen.** Der Stream
liefert Preise zu `selectionId 47973`, ohne zu sagen, welche Mannschaft das
ist. Namen gibt es ausschließlich über `listMarketCatalogue` — auf
`api.betfair.com`, also 403.

Ohne Namen keine Zuordnung. Die Regeln 3, 4 und 5 hängen sämtlich an Namen.
Der Weg wäre also auch mit Konto, App-Key und Zertifikat wertlos gewesen.

*(Bittere Ironie: `marketBaseRate` steht im Stream — genau der echte
Kommissionssatz, den die Bridge nicht liefert. Nützt nur nichts, wenn man
den Markt nicht benennen kann.)*

**Der Code bleibt vollständig stehen.** Abgeschaltet wird an zwei Stellen:
`BETFAIR_AKTIV = false` in `orion-lauf` und `aktiv: false` in
`KONFIG.buecher.betfair`. Löst Betfair die Sperre je, reicht `true`.

**Orbit entfällt mit.** Gemessen am 10.8.: **403 aus Supabase**, API *und*
Website. Und selbst erreichbar liefert die Orbit-API **keine Quoten**, nur
Struktur, Läufer und Kommission. Orbit war nie ein Buch, sondern eine
Klick-Adresse für Betfair-Märkte — ohne Betfair gibt es nichts zu verlinken.

Nachmessen: `curl -s https://noexklrgtqveiclijdwp.supabase.co/functions/v1/bf-erreichbar`

### Betfair: die neun gemessenen Wege im Einzelnen

```
GEBLOCKT 403   api.betfair.com (json-rpc, rest, account)
GEBLOCKT 403   api-au.betfair.com, api.betfair.es, historicdata, betfair.com
GEBLOCKT 403   menu.json (öffentlich, ohne Anmeldung)
ERREICHBAR     identitysso-cert.betfair.com/api/certlogin  → CERT_AUTH_REQUIRED
ERREICHBAR     stream-api.betfair.com:443  → {"op":"connection","connectionId":...}
```

Die Sperre greift **vor** der Anmeldung. Zugangsdaten ändern daran nichts.

Die beiden erreichbaren Türen führen ins Leere: Supabase akzeptiert zwar
Client-Zertifikate (`createHttpClient` meldet „Unable to decode certificate",
liest die Felder also), und der Stream antwortet auf eine Anmeldung mit
`INVALID_APP_KEY` — er spricht mit uns. **Aber er nennt keine Namen**, siehe
oben. Damit ist auch dieser Weg erledigt, nicht bloß ungeprüft.

### Orbit war nie ein drittes Buch

`orbitexch.com/customer/api/market/{id}` antwortet ohne Schlüssel mit JSON,
enthält aber **keine Quoten** — nur Struktur, Läufer und `commission`.
57 JavaScript-Dateien der Seite durchsucht: nur Konto-Endpunkte, kein
öffentlicher Kursweg, kein WebSocket. Aus Supabase am 10.8. gemessen: **403**,
API und Website.

Orbit benutzte Betfairs Marktnummern unverändert — **eine zweite Tür zum
selben Raum**, nicht ein eigener Raum. `96ex.com` ist tot (HTTP 000). Mit
Betfair entfällt beides.

### Smarkets — gemessen am 10.8.2026

Echte Wettbörse, kein Buchmacher. Kein Konto, kein Heim-PC.

```
Spiele    200  314 ms   124 Fussballspiele im 72h-Fenster
Maerkte   200  364 ms   8967 gesamt, 163 verschiedene Markttypen
Quoten    200   42 ms   volle Tiefe
Sammler aus Supabase: 133 Spiele, 823 Maerkte mit Quoten (111 Sieger,
                      90 BTTS, 622 Ueber/Unter), 16 s
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

**Der beste Kurs im Buch kann ein STAUBAUFTRAG sein.** Gemessen am 10.8. in
einem BTTS-Markt:

```
YES offers:  price 5291, quantity 67        <- 0,0035 GBP
             price 5405, quantity 3700277   <- der echte Kurs
NO  offers:  price 4630, quantity 8279049
```

Der Auftrag über 67 zog die Kehrwertsumme auf **99,21 %** und hätte eine
Arbitrage vorgetäuscht, die mit dem nächsten echten Kurs bei 100,35 % liegt —
also keine ist. Deshalb `KONFIG.mindestEinsatz = 5`: Zeilen, in die weniger
als 5 hineinpassen, zählen **nicht** als Chance, werden aber auch **nicht
versteckt** — sie stehen unter „Knappste Paare" mit der Marke „zu dünn".
Unbekannte Menge zählt NICHT als zu dünn; das wäre eine Unterstellung.

Nebenbei gemessen: die Orderbücher der Verträge YES und NO sind **getrennt**,
nicht zwei Ansichten desselben Buches (YES-Angebote 5291/5405 gegen
10000−NO-Gebote 5536/5690).

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
pg_cron ──┬─ orion-lauf      jede Minute     sucht und rechnet (~3 s)
          ├─ pm-scan         jede Minute     (alt, läuft noch mit)
          ├─ orion-kalshi    alle 5 Minuten  holt Kalshi (52 s je Durchlauf)
          ├─ orion-smarkets  alle 5 Minuten  holt Smarkets (16 s je Durchlauf)
          ├─ orion-pruefer   alle 5 Minuten  Alter, Rechnung, Links
          ├─ orion-rauschen  alle 5 Minuten  löscht Minuszeilen im Verlauf
          └─ orion-wache     alle 10 Minuten prüft, ob das alles noch läuft

Website (alle 2 s)  →  liest orion_funde + orion_uebersicht, rechnet nichts

KEIN Heim-PC mehr beteiligt. bf-bridge und bridge_odds bleiben unangetastet
(Regel 6), werden aber nicht mehr gelesen: BETFAIR_AKTIV = false.
```

### Zwei Durchgänge (Umbau vom 10.8.2026, abends)

1. **Anker Polymarket** — zu jedem Polymarket-Markt ein Gegenstück. Dort gibt
   es immer zwei Belege: Partie und Läufer.
2. **Ohne Anker** — Smarkets direkt gegen Kalshi, für Partien, die Polymarket
   nicht führt. Gemessen war das nötig: von 110 Smarkets-Partien waren 78
   unsichtbar, von 225 Kalshi-Partien 204, von 21 gemeinsamen wurden 14 nie
   gepaart. Erster Lauf: **74 offene Partien, 11 Paare, 0 mehrdeutig.**

**Im zweiten Durchgang fällt ein Beleg weg. Ersatz ist die EINDEUTIGKEIT**
(`Z.direktPaare`): trifft eine Partie mehr als eine auf der Gegenseite — oder
wird selbst von mehr als einer getroffen — wird gar nicht gepaart. Das ist
strenger als „nimm den besten Treffer", und genau dieser Griff erzeugte am
9.8. die 16,02-%-Fehlpaarung. Gemessen bei 109 × 95 Vergleichen: 18
Kandidaten, 0 mehrdeutig auf beiden Seiten.

**KEIN enger Zeitfilter**, obwohl beide Bücher Zeiten liefern. Kalshis
Ticker-Datum liegt bei manchen Serien bis zu zwei Tage neben dem Anstoß:
`Ind. Medellín vs Millonarios` 47 h, `Unión Santa Fe vs Central Córdoba`
48 h — **beides richtige Paare**. Ein enger Filter hätte sie verworfen,
darunter eine laufende Chance. Die Schranke steht bei 5 Tagen und wehrt nur
Absurdes ab. `schliesst` taugt gar nicht: gerundeter Marktschluss, bis 54 h
nach dem Anstoß.

### Das Seiten-Modell

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
js/zuordnung.js       Marktpaarung                   222 Prüfungen
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
   gleiche) und `btts` (nur das Endergebnis). Ohne diese Regel meldete das
   Programm am 9.8. **663 Scheinchancen mit bis zu 184 %**.
   Der Anker muss EXAKT sein: am 10.8. standen im selben Ereignis, unter
   demselben Titel, "Both Teams to Score" (44), "... in First Half" (44) und
   "... in Second Half" (44) — unterschieden NUR durch den Teilnamen.
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
8. **Rendite ohne Menge ist keine Chance.** Unter `KONFIG.mindestEinsatz`
   (derzeit 5) zählt eine Zeile nicht als Chance, wird aber gezeigt und
   markiert. Grund: ein Staubauftrag über 0,0035 GBP täuschte am 10.8. eine
   Arbitrage vor, die keine war.
9. **Bei einem Siegermarkt darf der Namensweg nur auf HOME oder AWAY
   zeigen.** Ohne diese Fessel griff er den Vertrag "Yes" eines BTTS-Marktes
   ab — "Yes" gegen "Yes" ergibt Gleichheit 1,00 auf eine völlig andere Frage.

---

## 5. Was geprüft ist

```
node pruefung/rechnung.test.js     171 Prüfungen
node pruefung/zuordnung.test.js    222 Prüfungen
node bridge/pruefung.js            158 Prüfungen
                                   ───
                                   551 Prüfungen
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

### Filterfeld (10.8.2026)

Rechts, auf- und zuklappbar, Einstellung überlebt Auffrischung und Neustart
(`localStorage`, Schlüssel `orion-filter`). Gefiltert wird nach:
Fundzeit (15 min / 1 h / 6 h / 24 h), Anpfiff bzw. Ende der Partie
(3 / 12 / 24 h), Mindestrendite, handelbarem Mindesteinsatz, bekannter Menge,
Büchern, Frageart und Sportart.

**Zwei Regeln, die dabei nicht gebrochen werden dürfen:**

1. **Der Filter blendet NUR aus, er sucht nichts ab.** Unter jedem Reiter
   steht deshalb, wie viele Funde gerade versteckt sind. Ein Filter, der
   stillschweigend etwas verschluckt, ist eine Falle — dann sähe „0 Chancen"
   mit Filter genauso aus wie „0 Chancen" ohne.
2. **Beim Buchfilter müssen BEIDE Seiten erlaubt sein.** Eine Arbitrage
   braucht zwei Bücher; eine Zeile zu zeigen, deren Gegenseite man abgewählt
   hat, wäre wertlos.

Fallstrick beim Bauen, hier festgehalten: `zeichne(e)` darf `e.chancen`
und Geschwister **nicht überschreiben**. `app.js` merkt sich genau dieses
Objekt als `welt.letztesErgebnis`; wer hineinschreibt, filtert beim nächsten
Zeichnen eine bereits gefilterte Liste noch einmal, und die Liste schrumpft
bei jedem Klick weiter. Es wird mit lokalen Variablen gearbeitet.

Die Marktart steht **nicht** in der Datenbank, sondern wird in `filter.js`
aus dem Anzeigetext `mannschaft` abgelesen. Das ist die schwächste Stelle
des Filters — eine eigene Spalte wäre sauber (offener Punkt).


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

**Der eigentliche Befund vom 10.8.2026, ehrlich:**

```
Zeilen mit unbekannter Tiefe                       23
Zeilen mit bekannter Tiefe                         31
Zeilen mit Rendite >= 0,5 % UND bekannter Tiefe     0
beste Rendite bei bekannter Tiefe                0,36 %
groesster je gemessener Maximalgewinn             0,08
```

Alle hohen Renditen der Vergangenheit (16,68 %, 11,19 %, 6,19 %) stammen aus
der Zeit **vor** der Mengenmessung und haben `max_einsatz = null` — die Tiefe
ist dort **unbekannt**, nicht null. Es gibt bisher **keine einzige Zeile, die
gleichzeitig profitabel und nachweislich handelbar war.** Der Staubauftrag-Fund
(Abschnitt 2) legt nahe, warum. Erst seit dem 10.8. wird die Tiefe *immer*
mitgemessen; ein Urteil braucht Tage, nicht Stunden.

1. **Mehr Deckung — der einzige gemessene Hebel.** Arbitrage findet man über
   Masse, nicht über Genauigkeit. Gemessen am 10.8.: Polymarket hat **4805**
   handelbare Märkte im Fenster, genutzt werden **534**. Verworfen werden
   4271, die größten Töpfe:
   ```
   137  Draw (Halbzeit / 2. Halbzeit)   -> Smarkets HALF_TIME_WINNER_3_WAY
    63  Any Other Score                 -> Smarkets CORRECT_SCORE
    63  Neither
    44  Both Teams to Score 1./2. Hz    -> ungeprueft
    44  1st/2nd Half O/U 0.5/1.5/2.5    -> ungeprueft
    38  Total Corners O/U 7.5 ... 12.5  -> ungeprueft
   ```
   Smarkets bietet **163 verschiedene Markttypen** an; drei haben eine
   geprüfte Regel. Nächster Schritt: **Halbzeit-Ergebnis**
   (`HALF_TIME_WINNER_3_WAY`), gleiche Struktur wie das Endergebnis, die
   geprüfte Maschine passt unverändert.
2. **Anpfiffzeit anzeigen.** Ein Markt, der in 8 Stunden endet, dessen Spiel
   aber in 20 Minuten beginnt, ist etwas völlig anderes. Smarkets liefert
   `st` bereits mit und es wird gespeichert — es fehlt nur die Anzeige.
3. **Währungen werden gemischt.** Smarkets rechnet in **GBP**, Polymarket
   und Kalshi in **USD**. `max_einsatz` und `max_gewinn` mischen das
   ungewichtet. Die **Rendite bleibt richtig** — sie ist ein Verhältnis —,
   aber die Mengenbegrenzung ist um den Wechselkurs daneben, rund 25 %.
   Ungemessen, unkorrigiert.
4. **96ex und Orbit: endgültig erledigt.** Am 10.8. abends frisch gemessen:
   96ex antwortet mit **Connection refused** — der Server lehnt die
   TCP-Verbindung ab, da läuft nichts mehr. Orbit gibt auf allen vier Wegen
   **403 von CloudFront**, inklusive Startseite. Ein Konto ändert daran
   nichts: der Block greift vor jeder Anmeldung. Nachmessen:
   `curl -s .../functions/v1/broker-machbar`
5. **BTTS ist gebaut, bringt aber nichts.** Gemessen: 42 Paare, alle mit
   Zuordnung 1,00 und richtigem Spiel — aber Renditen von **−4 % bis −8 %**.
   Die beiden Bücher bepreisen „beide treffen" weit auseinander. Die Deckung
   kostet nichts und bleibt, eine Chance ist bisher nicht dabei.
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
