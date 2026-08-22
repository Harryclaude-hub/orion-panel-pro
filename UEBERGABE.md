# Orion Panel Pro — Übergabe

> **Diese Datei ist die Wahrheit über das Projekt. Halte sie aktuell.**
> Nach jeder wesentlichen Änderung — neue Quelle, neue Regel, neuer Messwert,
> erledigter Punkt aus Abschnitt 8 — wird sie im selben Commit nachgezogen.
> Sie aktualisiert sich NICHT von selbst. Eine veraltete Übergabe ist
> schlimmer als keine, weil man ihr glaubt.

Stand: **11. August 2026, spät abends**. Dieser Text reicht, um ohne Vorwissen
weiterzuarbeiten. Alle Zahlen darin sind gemessen; was nicht gemessen ist,
steht ausdrücklich als ungemessen da.

> **Wer neu dazukommt, liest zuerst Abschnitt 8e.** Der Auftrag aus 8d ist
> **umgesetzt**: jeder Bereich hat seinen eigenen Scanner (20 pg_cron-Takte),
> die Bridge liefert ab Build 19 die Sportart mit, die Anzeige zeigt ab 3 %
> als Chance. Was noch am Auftraggeber hängt (Build 19 per Doppelklick
> starten) und was danach nachzumessen ist, steht in 8e.
>
> **Nicht alles steht im Repo.** Ein Teil der Logik läuft als SQL-Funktion in
> Supabase — Wächter, Wechselkurs, Betfair-Vorfilter. Was es gibt und wie man
> den echten Stand abruft, steht in `supabase/datenbank.md`. Dort absichtlich
> keine Kopien der Funktionen: das wäre wieder die Drift-Falle.

**Vier Bücher aktiv:** Polymarket, Kalshi, Smarkets — und seit 11.8. wieder
**Betfair** über eine Bridge auf einem eigenen Laptop (mit drei
Einschränkungen, siehe 8c).

**Live:** https://harryclaude-hub.github.io/orion-panel-pro/
**Repo:** `harryclaude-hub/orion-panel-pro` · lokal `C:\Users\Home\orion-panel-pro`
**Supabase:** `noexklrgtqveiclijdwp` · Sperrwort der Website: `ARBRADAR2026`

---

## 1. Was das Programm ist

Ein Surebet-Scanner zwischen **Börsen** (nie Buchmachern): er sucht Paare,
bei denen zwei Bücher denselben Ausgang unterschiedlich bepreisen, sodass
beide Seiten zusammen unter 100 % liegen.

**Eine Arbitrage besteht immer aus GENAU ZWEI Büchern** — nicht einem, nicht
dreien. Gibt es zur selben Frage mehrere brauchbare Buchpaare, wird daraus
**je eine eigene Zeile**, denn jede hat eigene Links, Einsätze und Rendite.

**Es läuft vollständig auf Supabase, rund um die Uhr.** Kein Konto, kein
Schlüssel, kein eingeschalteter Rechner. Die Website rechnet nichts.

---

## 2. Die Bücher

**Zwei Grundsätze:** alles auf Supabase, nichts auf einem Heim-PC (das
Programm ist für mehrere Leute). Und: keine Konten, keine Schlüssel, soweit
irgend möglich.

| Buch | Konto? | aus Supabase? | Stand |
|---|---|---|---|
| **Kalshi** | nein | ja | läuft, ~200 Märkte |
| **Polymarket** | nein | ja | läuft, ~1157 Märkte im 72h-Fenster |
| **Smarkets** | nein | ja | läuft, ~835 Märkte aus ~143 Spielen |
| ~~Betfair~~ | ja | **nein, 403** | **ABGESCHALTET**, siehe unten |
| ~~Orbit / 96ex~~ | — | nein | Oberflächen auf Betfair, mit entfallen |

Die Anbietertafel sortiert **nach Umfang, das kleinste Buch zuerst**: es ist
die Engstelle, denn was dort nicht liegt, kann nirgends gepaart werden.

### Betfair: endgültig erledigt, ~50 Wege gemessen

**1. REST-API gesperrt.** 5 von 8 Wegen 403 von Cloudflare, auch die
öffentliche Startseite, **vor** jeder Anmeldung.

**2. Zertifikat → Stream ist eine Sackgasse.** Aus Betfairs eigenem Schema
(`ESASwaggerSchema.json`):

```
RunnerDefinition:  sortPriority, removalDate, id, hc, adjustmentFactor, bsp, status
MarketDefinition:  eventId, eventTypeId, marketType, venue, marketBaseRate, ...
```

**Kein einziges Feld im ganzen Schema trägt einen Namen.** Der Stream liefert
Preise zu einer `selectionId`, ohne die Mannschaft zu nennen. Namen gibt es
nur über `listMarketCatalogue` auf `api.betfair.com` — 403. Ohne Namen keine
Zuordnung; der Weg wäre auch mit Konto, App-Key und Zertifikat wertlos.

**3. Alle Ausweichwege geprüft, alle zu:** Länderdomains (au/it/ro/bg),
`sports.`/`ips.betfair.com`, der öffentliche Lese-Endpunkt
`/www/sports/exchange/readonly/v1/bymarket` (den der Browser OHNE Konto
benutzt), Orbit (403 CloudFront), 96ex (Verbindung abgelehnt, Server tot),
Matchbook (403), Betdaq (Werbeseite erreichbar, kein Kursweg, API braucht
Konto), Novig (403), Sporttrade/ProphetX (nicht erreichbar).

**Broker liefern grundsätzlich keine Kurse.** Sportmarket, AsianOdds,
Mollybet und BetConnect antworten mit 200 — das ist aber ihre **Werbeseite**.
40 Skripte durchsucht: keine einzige Kursadresse. Ein Broker verkauft Zugang,
nicht Daten. Sportmarkets Logo-Wand nennt Sharpbet, SBOBet, Smarkets, PS3838
und Betfair — eines davon lesen wir längst direkt an der Quelle.

Abgeschaltet an zwei Stellen: `BETFAIR_AKTIV = false` in `orion-lauf`,
`aktiv: false` in `KONFIG.buecher.betfair`. Löst Betfair die Sperre je,
reicht `true`.

Nachmessen: `curl -s .../functions/v1/bf-erreichbar` · `broker-machbar` ·
`buecher-suche` · `betdaq-suche` · `broker-tief`

### Smarkets — gemessen am 10.8.2026

**Preiskodierung, dreifach belegt:** `Quote = 10000 / price`. Der Preis ist
die implizite Wahrscheinlichkeit in Hundertstel-Prozent (4032 → 2,48).

1. **Quotenleiter** — jeder Preis landet exakt darauf (4167→2,40 · 2857→3,50
   · 5618→1,78 · 4762→2,10 · 3077→3,25), kein Ausreißer.
2. **Kehrwertsumme** — Back 101,03 % / Lay 98,72 %. Genau die Richtung, die
   eine Börse haben muss.
3. **Zweiter Endpunkt** — `last_executed_prices` meldet für 2899 `"28.99"`.

`offers` = Back-Seite, `bids` = Lay-Seite.

**Die Menge ist die AUSZAHLUNG, nicht der Einsatz.** Offizielles SDK:
`quantity = 400000 # 40.0000 GBP payout`. Also
`Einsatz = quantity * price / 10^8`. Verwechselt liegt man bei Quote 5,0 um
den **Faktor 5** daneben.

**Zwei Fallen:** `quantity = 2147483646` (2³¹−2) ist eine Platzhaltermarke,
keine Menge — nur an den Randpreisen 1 und 9999. Gültig ist die Leiter 1,01
bis 1000, also `price` zwischen 10 und 9901.

**Der beste Kurs im Buch kann ein STAUBAUFTRAG sein:**

```
YES offers:  price 5291, quantity 67        <- 0,0035 GBP
             price 5405, quantity 3700277   <- der echte Kurs
```

Der Auftrag über 67 zog die Kehrwertsumme auf 99,21 % und täuschte eine
Arbitrage vor, die mit dem nächsten echten Kurs bei 100,35 % liegt. Daher
`KONFIG.mindestEinsatz = 5`: solche Zeilen zählen **nicht** als Chance,
werden aber **gezeigt und markiert** („zu dünn"). Unbekannte Menge zählt
NICHT als zu dünn — das wäre eine Unterstellung.

**Kommission 2 %** auf den Nettogewinn je Markt, gleiche Form wie Betfair.
**NICHT gemessen** — kein Konto, API gibt den Satz nicht heraus. Daneben
1 % (Pro) und **3 % (Select)**, Letzteres trifft besonders profitable Konten.
Wer dort landet, trägt in `KONFIG.smarketsGebuehr` und `rechnung.ts` `0.03`
ein.

**Fallstrick Paginierung:** `pagination.next_page` ist ein **Query-String**,
kein Pfad. An den Host gehängt bekommt man 50 Spiele statt 124.

### Die Gebühren — was sie kosten, in Geld

Seit dem 10.8. abends trägt **jede Zeile den Gebührenbetrag**, nicht nur den
Satz. Der Satz steckte immer schon in `qe`; sichtbar war er, der Betrag nie.

**Eine Formel für alle vier Gebührenarten:**

```
Betrag = Einsatz * (Quote OHNE Gebühr - Quote MIT Gebühr)
```

Das ist genau die Differenz der beiden Auszahlungen. Sie braucht weder Satz
noch Exponent, nur die Quote ohne Gebühr:

| Form | Buch | Quote ohne Gebühr | wie gerechnet wird |
|---|---|---|---|
| `anteil` | Polymarket | `1/Preis` | je Anteil, preisabhängig |
| `kontrakt` | Kalshi | `1/Preis` | je Kontrakt, preisabhängig |
| `back` | Börse Back | `Quote` | Kommission auf den Nettogewinn |
| `lay` | Börse Lay | `L/(L-1)` | Kommission auf den Nettogewinn |

Gegen echte Daten geprüft: **54 von 54 Zeilen** unabhängig nachgerechnet,
0 Abweichungen. `null` heißt „nicht ausrechenbar", NICHT 0 — dieselbe Regel
wie bei der unbekannten Menge.

**Der Befund, den das sichtbar macht** (live gemessen, 10.8. spät):

```
Frageart         Rendite    Gebühren   ohne Gebühren
sieger           -0,565 %    1,896        +1,331 %
unentschieden    -0,382 %    1,777        +1,394 %
```

**Die Bücher liegen im Schnitt 1,3 % auseinander — die Gebühren fressen das
vollständig auf.** Nicht die Zuordnung ist die Grenze und nicht das Tempo,
sondern die Gebühr. Das ist der wichtigste Satz dieser Übergabe.

### Die Sätze, Stand 10.8.2026

| Buch | Satz | Form | Herkunft |
|---|---|---|---|
| Polymarket | `rate 0,05` · `exponent 1` | je Anteil | **gemessen** an 929 Sportmärkten aus `feeSchedule`; dazu `takerOnly: true`, `rebateRate: 0,15` |
| Kalshi | 0,07 | `0,07 * C * P * (1-P)` | Formel in Kalshis Tarif bestätigt |
| Smarkets | 0,02 | Kommission je Markt | dokumentierter Standardtarif, **nicht gemessen** (kein Konto) |
| unbekannt | 0,07 | Rückfall | Regel 2 |

**Drei Dinge, die dabei ungemessen bleiben und Geld bedeuten:**

1. **Polymarket, Widerspruch.** Die API sagt `exponent 1`, also 2,50 je 100
   Anteile bei p = 0,50. Mehrere Sekundärquellen nennen für Sport 1,25 —
   das entspräche `rate * p * (1-p)` statt `rate * min(p,1-p)`. Nicht
   aufgelöst. Der Code rechnet die **höhere** Variante; ein zu hoher Satz
   kostet höchstens eine verpasste Chance, ein zu niedriger erfindet eine.
2. **Maker zahlt weniger.** Kalshis Maker-Gebühr ist ein Viertel der
   Taker-Gebühr, Polymarket nimmt von Makern gar nichts (`takerOnly`). Der
   Scanner rechnet immer als Taker — richtig, denn wer zum Briefkurs kauft,
   IST Taker. Wer mit Limit ins Buch legt, zahlt weniger, trägt aber das
   Risiko, nur auf einer Seite gefüllt zu werden.
3. **Smarkets 0 % für 60 Tage.** Neukunden bekommen mit Aktionscode 60 Tage
   ohne Kommission, Vieltrader dauerhaft 1 %. Bei einem Schnitt von 1,3 %
   Abstand zwischen den Büchern entscheidet genau das über Plus oder Minus.
   Der in Abschnitt 2 genannte Select-Tarif von 3 % ließ sich in der Suche
   vom 10.8. **nicht mehr bestätigen** — ungeklärt, deshalb bleibt 2 %.

### Währung

Smarkets rechnet in **GBP**, Polymarket und Kalshi in **USD**. Gemessen
**1 GBP = 1,3504 USD** — ungewichtet gemischt wäre `max_einsatz` um rund 35 %
verzerrt (die Rendite nie, sie ist ein Verhältnis). Der Sammler rechnet
**an der Quelle** um; Kurs von `api.frankfurter.dev` (EZB), Rückfall
`open.er-api.com`. Kurs, Stand und Quelle stehen in
`smarkets_snapshot.stats`. **Ohne Kurs wird NICHT geschrieben** — dann bleibt
die letzte gute Aufnahme stehen und Smarkets veraltet sichtbar, statt still
falsche Beträge zu liefern.

---

## 3. Aufbau

```
pg_cron ──┬─ orion-lauf      alle 15 Sek.    sucht und rechnet (3,8 s)
          ├─ pm-scan         jede Minute     (alt, läuft noch mit)
          ├─ orion-smarkets  jede Minute     holt Smarkets (24 s)
          ├─ orion-kalshi    alle 2 Minuten  holt Kalshi (53 s)
          ├─ orion-pruefer   alle 5 Minuten  Alter, Rechnung, Links
          ├─ orion-rauschen  alle 5 Minuten  löscht Minuszeilen im Verlauf
          └─ orion-wache     alle 10 Minuten prüft, ob das alles noch läuft

Website (alle 2 s)  →  liest orion_funde + orion_uebersicht, rechnet nichts

KEIN Heim-PC beteiligt. bf-bridge und bridge_odds bleiben unangetastet
(Regel 6), werden aber nicht mehr gelesen.
```

### Tempo — und warum 2 Sekunden Unsinn wären

```
orion-lauf (Scanner)    3,8 s     max 4,5 s
Smarkets-Sammler       24   s     (vorher 51 s)
Kalshi-Sammler         53   s
```

**Die Engstelle ist nicht der Scanner, sondern die Sammler.** Der Scanner
liest Kalshi und Smarkets aus SCHNAPPSCHÜSSEN. Ihn alle 2 Sekunden laufen zu
lassen hieße, denselben Schnappschuss 150-mal zu durchrechnen — Tempo, das
keins ist.

Der Smarkets-Sammler machte seine ~86 Abrufe **nacheinander**; jetzt in
Bündeln zu 8 parallel: **51 s → 24 s**. Weiter zu treiben hieße, Smarkets zu
hämmern; eine Sperre wäre schlimmer als der Zeitgewinn.

pg_cron 1.6 kann Sekunden, aber **nur 1–59** (`'15 seconds'`); für 60 s die
Cron-Schreibweise `'* * * * *'`. Jeder Takt hat Abstand zur Laufzeit — ein
kürzerer Takt ließe Durchläufe übereinander laufen.

### Zwei Durchgänge

1. **Anker Polymarket** — zu jedem PM-Markt ein Gegenstück. Zwei Belege:
   Partie und Läufer.
2. **Ohne Anker** — Smarkets direkt gegen Kalshi, für Partien, die
   Polymarket nicht führt. Gemessen nötig: von 110 Smarkets-Partien waren 78
   unsichtbar, von 225 Kalshi-Partien 204, und von 21 gemeinsamen wurden
   **14 nie gepaart**.

Im zweiten Durchgang fällt ein Beleg weg. **Ersatz ist die EINDEUTIGKEIT**
(`Z.direktPaare`): trifft eine Partie mehr als eine auf der Gegenseite — oder
wird selbst von mehr als einer getroffen — wird **gar nicht** gepaart. Das
ist strenger als „nimm den besten Treffer", und genau dieser Griff erzeugte
am 9.8. die 16,02-%-Fehlpaarung. Gemessen bei 109 × 95 Vergleichen: 18
Kandidaten, **0 mehrdeutig**.

**KEIN enger Zeitfilter**, obwohl beide Bücher Zeiten liefern: Kalshis
Ticker-Datum liegt bei manchen Serien bis zu zwei Tage neben dem Anstoß
(`Ind. Medellín` 47 h, `Unión Santa Fe` 48 h — **beides richtige Paare**).
`schliesst` taugt gar nicht: gerundeter Marktschluss, bis 54 h daneben.
Die Schranke steht bei 5 Tagen und wehrt nur Absurdes ab.

### Das Seiten-Modell

Zu jeder Frage liefert jedes Buch bis zu zwei Seiten:

```
JA    Polymarket JA-Anteil · Kalshi Yes · Börse BACK
NEIN  Polymarket NEIN-Anteil · Kalshi No · Börse LAY
```

Jede Seite trägt ihre Effektivquote **nach Gebühr**. Danach jede JA-Seite
gegen jede NEIN-Seite eines **anderen** Buches (`R.alleChancen`).
`R.chance` erzwingt: genau zwei Bücher, immer JA gegen NEIN.

### Genutzte Fragen — neun

`sieger` · `unentschieden` · `hz_sieger` · `hz_unentschieden` · `btts` ·
`ueber_unter` · `hz1_ueber_unter` · `hz2_ueber_unter` · `ecken_ueber_unter`

**Zwei Trennungen, an denen alles hängt:**

1. **Halbzeit gegen zweite Halbzeit** wird an der FRAGE unterschieden, nie am
   Teilnamen — die sind identisch (243 gegen 240 Märkte).
   `at halftime` gegen `second half`.
2. **Über/Unter gibt es in vier Ausführungen.** Anker vorn UND hinten:
   ```
   "O/U 2.5"                      276   gesamtes Spiel
   "1st Half O/U 0.5"             138   erste Halbzeit
   "2nd Half O/U 0.5"             138   zweite Halbzeit
   "Total Corners: O/U 7.5"       259   Ecken
   "1st Half Total Corners: O/U"  111   ANDERE Frage, keine Regel
   "FK Bodø/Glimt O/U 0.5"          9   Torkonto EINER Mannschaft
   ```
   Ohne `^` ginge „1st Half Total Corners" als Ecken des ganzen Spiels durch,
   ohne `$` das Torkonto einer Mannschaft als Spielsumme. Auf der
   Smarkets-Seite dasselbe: EXAKT beim Typnamen, nie als Präfix —
   `SECOND_HALF_HOME_TEAM_OVER_UNDER`, `AWAY_CORNERS_OVER_UNDER` und
   `CORNERS_HANDICAP` sind andere Fragen.

### Dateien

```
index.html            Panel mit drei Reitern
regelwerk.html        was jedes Buch bei Absage tut, mit Quellen
einstellungen.html    Weg B (Zertifikat + Secrets) und Weg A (Bridge)
logik.html            erklärt die Suche
js/konfig.js          Schwellen + die Bücher an EINER Stelle
js/rechnung.js        Quoten, Gebühren, Aufteilung   171 Prüfungen
js/zuordnung.js       Marktpaarung                   275 Prüfungen
js/filter.js          Filterfeld rechts
js/daten.js           liest ab, filtert, richtet Links
js/anzeige.js         Tafel, Karten, Gegenprobe, Puffer, Absage-Zeile
js/sperre.js          Sperrbildschirm
bridge/               Bridge für den Heim-PC, Build 18  158 Prüfungen
supabase/functions/   orion-lauf (+ Spiegel), orion-smarkets
```

### Datenbank

```
orion_funde       jeder Fund, live und Verlauf, mit Prüfergebnis
                  buch_1 = Buch der JA-Seite, buch = Buch der NEIN-Seite
                  pm_* = Seite 1, bf_* = Seite 2  (Namen historisch)
orion_laeufe      Protokoll jedes Scans
orion_wache       Selbstkontrolle
kalshi_snapshot   öffentliche Kalshi-Kurse
smarkets_snapshot öffentliche Smarkets-Kurse, inkl. Anpfiff + Wechselkurs
bridge_odds       Betfair (NICHT anfassen, Format fix, wird nicht gelesen)
orion_geheim      privater Schlüssel des Zertifikats, RLS ohne Policy
```

Funktionen: `orion_uebersicht()`, `orion_bf_maerkte()`,
`orion_pruefung_schreiben()`, `orion_rauschen_loeschen()`

---

## 4. Die Regeln, die nicht gebrochen werden dürfen

1. **Nur gleiche Frage gegen gleiche Frage.** Ohne diese Regel meldete das
   Programm am 9.8. **663 Scheinchancen mit bis zu 184 %**. Der Anker muss
   EXAKT sein, vorn und hinten.
2. **Unbekannte Gebühr niemals als 0.** Rückfall auf 7 %. Beleg: 0,49 gegen
   2,03 sieht ohne Gebühr nach +0,46 % aus, mit 4 % sind es −0,52 %.
3. **Zwei verschiedene Ähnlichkeitsmaße.** Partie durch den *kürzeren* Namen
   (0,50), Läufer durch den *längeren* (0,80).
   **Ausnahme Smarkets:** dort kommt der Läufer aus der Struktur
   (`contract_type`), und der Name ist **Vetorecht statt Pflicht** — zeigen
   beide Wege auf verschiedene Verträge, wird nicht gepaart. Grund: die
   strenge Schwelle verwarf 17 von 60 RICHTIGEN Paaren („CD Nacional" gegen
   „Nacional da Madeira" = 0,33). Gemessen: 124/124 Spielnamen entsprechen
   HOME/AWAY, **0 Widersprüche**.
4. **Die Partie kommt aus `ev`, nicht aus `k`.** `paar(k) || paar(ev)` fiel
   nie auf `ev` zurück → 0 Paare bei 849 gegen 865 Märkten.
5. **Vereinskürzel und Sportbegriffe zählen nicht als Namensbeleg.** Sonst
   traf „Cruzeiro EC vs CR Flamengo" das Spiel „Flamengo v EC Vitoria" —
   gemeldet mit 16,02 %.
6. **`bf-bridge`, das POST-Format und `profiles.bridge_token` sind
   unantastbar.** Nur erweitern, nie umbauen.
7. **Genau zwei Bücher je Zeile.** Erzwungen in `R.chance`, vom Prüfer
   nachkontrolliert.
8. **Rendite ohne Menge ist keine Chance.** Unter `KONFIG.mindestEinsatz`
   (5) zählt eine Zeile nicht, wird aber gezeigt und markiert.
9. **Bei einem Siegermarkt darf der Namensweg nur auf HOME oder AWAY
   zeigen.** Sonst griff er den Vertrag „Yes" eines BTTS-Marktes ab — „Yes"
   gegen „Yes" ergibt 1,00 auf eine völlig andere Frage.
10. **Im zweiten Durchgang gilt Eindeutigkeit statt zweitem Beleg.**
    Mehrdeutig heißt: gar nicht paaren.

---

## 5. Was geprüft ist

```
node pruefung/rechnung.test.js       171 Prüfungen
node pruefung/zuordnung.test.js      275 Prüfungen
node bridge/pruefung.js              158 Prüfungen
node pruefung/spiegel.test.js     13 985 Prüfungen   <- NEU
                                  ──────
                                  14 589 Prüfungen
```

**Der Spiegel-Prüfstand** hält die Browser-Fassung gegen die Server-Fassung:
gleiche Funktionen, gleiche Konstanten, gleiche Ergebnisse auf denselben
Eingaben — mit Rändern (null, NaN, Werte auf der Schwelle). Er schlägt in
drei Fällen an, und der erste ist der wichtigste:

1. **Eine Funktion fehlt auf einer Seite.** Genau das war am 10.8. der Fall.
2. Eine Konstante hat verschiedene Werte.
3. Dieselbe Eingabe liefert verschiedene Ergebnisse.

Absichtliche Unterschiede stehen in `NUR_SERVER` / `NUR_BROWSER` — **jeder
mit Grund**. Eine Ausnahme ohne Grund wird beim nächsten Mal blind erweitert.

**Er ist gegen den echten Fehler geprüft**, nicht nur gegen gedachte: mit
der alten `zuordnung.ts` aus `HEAD` meldet er 107 Abweichungen und Exitcode 1.
Dabei kam ein Fehler heraus, den niemand gesucht hatte — der alten
Repo-Fassung fehlten die **Sportbegriffe in der Stoppwortliste**:

```
aehnlichkeit("Under 3.5 Goals vs Over 3.5 Goals", "Under 2.5 Goals")
   Browser 0   gegen   Server 1
```

Zwei verschiedene Über/Unter-Märkte mit Ähnlichkeit 1,00 — die Fehlerklasse
aus Regel 5. Live war das nie, ein Deploy aus dem Repo hätte es erzeugt.

Jede Schutzregel hat einen Test, der sie **auslöst**, nicht nur einen, der
sie umgeht.

**Unabhängige Nachprüfung** durch `orion-pruefer` (dritte, getrennt
geschriebene Rechnung), alle 5 Minuten: zuletzt **58 Zeilen, 0 falsch,
0 nicht nachrechenbar**.

---

## 6. Stand der Anzeige

Drei Reiter: **Chancen**, **Knappste Paare**, **Verlauf**. Oben die
**Anbietertafel** (nach Umfang sortiert, kleinstes zuerst als Engstelle) und
eine Zeile **laufende Paarungen**.

**Filterfeld rechts**, auf- und zuklappbar, überlebt Auffrischung und
Neustart (`localStorage`, `orion-filter`): Fundzeit, Anpfiff, Mindestrendite,
handelbarer Mindesteinsatz, bekannte Menge, Bücher, Frageart, Sportart.

Zwei Regeln dabei:
1. **Der Filter blendet NUR aus.** Unter jedem Reiter steht, wie viele Funde
   versteckt sind — sonst sähe „0 Chancen" mit Filter aus wie ohne.
2. **Beim Buchfilter müssen BEIDE Seiten erlaubt sein.**

Fallstrick: `zeichne(e)` darf `e.chancen` **nicht überschreiben** — `app.js`
merkt sich genau dieses Objekt, die Liste würde bei jedem Klick weiter
schrumpfen.

**Absage-Zeile auf jeder Karte.** Unter der Gegenprobe steht der dritte Fall:
weder noch (Absage, Abbruch, Spieler tritt nicht an). Je Buch, was es tut,
und ob das **belegt** ist oder nur **je Markt** gilt. Quelle:
`KONFIG.buecher[*].absage`, ausführlich auf `regelwerk.html`.

**Anzeigeregel: abgeschaltet heißt keine Aktualität.** Bei `aktiv: false`
steht ein **—** und „wird nicht gelesen". Läuft die Bridge trotzdem noch,
sagt das der Hinweis. Grund: eine frische Zahl neben „abgeschaltet" wurde am
10.8. als Fehler missverstanden — war keiner.

Preise mit drei Nachkommastellen, Quoten mit zweien. Der Puffer nennt die
richtige Richtung: Anteilspreis darf steigen, Back-Quote muss fallen,
Lay-Quote darf steigen.

Gespeichert wird erst ab **−1 %** Rendite; darunter ist Rauschen. Der Verlauf
enthält nur Funde, die im Plus waren.

---

## 7. Der ehrliche Befund

Vor dem Umbau vom 10.8.:

```
Zeilen mit unbekannter Tiefe                       23
Zeilen mit bekannter Tiefe                         31
Zeilen mit Rendite >= 0,5 % UND bekannter Tiefe     0
größter je gemessener Maximalgewinn              0,08
```

Alle hohen Renditen der Vergangenheit (16,68 %, 11,19 %) stammen aus der Zeit
**vor** der Mengenmessung und haben `max_einsatz = null` — die Tiefe ist dort
**unbekannt**, nicht null. Der Staubauftrag-Fund legt nahe, warum.

Nach dem Umbau tauchten die **ersten zwei Zeilen** auf, die gleichzeitig
profitabel und nachweislich handelbar waren: beide `kalshi → smarkets`,
+1,12 % auf max. 14,64 und +0,71 % auf max. 33,74 — also **16 und 24 Cent**.
Der Mechanismus stimmt, die Beträge sind winzig.

**BTTS, Halbzeit und die drei neuen Über/Unter-Arten funktionieren, bringen
aber nichts:** alle mit Zuordnung 1,00 und richtigem Spiel, aber Renditen von
−3 % bis −10 %. Bei diesen Fragen stehen die Bücher weit auseinander. Die
Deckung kostet nichts und bleibt.

---

## 8. Offen

1. **Zeit.** Erst seit dem 10.8. wird die Tiefe *immer* mitgemessen und der
   Scanner läuft alle 15 s. Ob regelmäßig echte Chancen auftauchen, zeigt
   sich über Tage. **Das wollte der Auftraggeber selbst prüfen.**
2. **Weitere Fragen.** Smarkets bietet ~148 Markttypen, sieben haben eine
   geprüfte Regel. Nächste Kandidaten: `CORRECT_SCORE`, `DOUBLE_CHANCE`,
   `WINNER_DNB`, `ASIAN_HANDICAP`, Halbzeit-Ecken. Bei Polymarket ungenutzt:
   111 „1st Half Total Corners", 111 „2nd Half Total Corners", 80 „Neither",
   79 „Any Other Score".
3. **SX Bet — am 10.8. abends gemessen, jetzt der wichtigste Kandidat.**

   Der Grund ist Abschnitt 2: die Gebühren fressen den ganzen Abstand
   zwischen den Büchern. SX Bet nimmt laut eigener Dokumentation **0 %
   Kommission auf Einzelwetten** (5 % nur auf Parlay-Gewinn, den wir nicht
   nutzen). Ein Buch ohne Gebühr ist bei 1,3 % Abstand kein weiteres Buch,
   sondern ein anderer Rechenfall.

   **Gemessen** (Preiskodierung war der offene Punkt):
   ```
   percentageOdds ist ein Anteil von 10^20
       48500000000000000000 / 1e20 = 0,485
   isMakerBettingOutcomeOne sagt, auf welche Seite der STELLER setzt;
       der Nehmer zahlt (1 - p)
   totalBetSize in USDC mit 6 Dezimalen
       780530000 = 780,53 USDC   <- in EINEM Auftrag
   Kehrwertsumme  Nehmerseite 110,4 %  ·  Stellerseite 89,6 %
       dieselbe Richtung wie bei Smarkets (Back über, Lay unter 100 %)
   ```
   Die **Tiefe** ist der eigentliche Punkt: 780 USDC gegen die 2,94 und
   14,64, die wir bei Smarkets und Kalshi messen.

   Die Kodierung ist damit **zweifach** belegt (Wertebereich und Richtung
   der Kehrwertsummen), nicht dreifach wie bei Smarkets — es fehlt der
   Abgleich gegen einen zweiten Endpunkt.

   **Weiter ungemessen:** ob die 0 % auch für uns gelten (Quelle ist die
   Anbieterdoku, kein Konto), ob auf USDC-Schienen gehandelt werden soll,
   und wie zuverlässig die Tiefe über den Tag steht. `sx-proxy` liegt
   bereits als Edge Function vor.

   Der alte Stand, zur Einordnung — SX Bet war schon vorher erreichbar:
   Krypto-Sportbörse mit echtem Orderbuch, aus Supabase erreichbar,
   öffentliche API **ohne Schlüssel**:
   ```
   GET api.sx.bet/sports                    200  Soccer = sportId 5
   GET api.sx.bet/markets/active?sportIds=5 200
       teamOneName "Santa Clara"  teamTwoName "Nacional Madeira"
       gameTime 1786389300        outcomeVoidName "NO_CONTEST"
   ```
   **Namen und exakte Anstoßzeit** — mehr, als Betfairs Kursstrom je
   geliefert hätte. Der erste gefundene Markt ist eine Partie, die wir schon
   führen. Ungemessen: Preiskodierung, Tiefe, Gebühren, und ob auf
   Krypto-Schienen (USDC) gehandelt werden soll.
4. **Kaltstart-Fehler.** `orion-lauf` scheiterte früher gelegentlich mit
   `WORKER_RESOURCE_LIMIT`. Seit Smarkets ausgelagert ist, läuft er in 3,8 s.
   Ob der Fehler weg ist, ist **nicht über mehrere Tage gemessen**.
5. ~~**Die Spiegel laufen auseinander.**~~ **ERLEDIGT am 10.8. abends.**
   `pruefung/spiegel.test.js`, 13 985 Prüfungen, siehe Abschnitt 5.

   Dabei kam heraus, dass das Problem größer war als gedacht: nicht die
   Spiegel liefen auseinander, sondern **Repo und Deployment**. Die deployte
   `orion-lauf` v13 hatte neun Fragearten, `direktPaare`, `ouArt` und
   `kalshiZeit`; die Fassung im Repo hatte **nichts davon**. Ein Re-Deploy
   aus dem Repo hätte den Scanner von neun Fragen auf vier zurückgeworfen
   und den ankerlosen Durchgang stillgelegt — ohne dass ein Test angeschlagen
   hätte, denn die 604 Prüfungen testeten nur die JS-Seite.

   Repo und Deployment sind jetzt gleich (v14). **Wer künftig deployt,
   lässt vorher `node pruefung/spiegel.test.js` laufen.**
6. **Polymarket bleibt Anker für alles außer Sieger.** Halbzeit, BTTS und
   Über/Unter laufen nur über PM-Partien; Smarkets gegen Kalshi wird nur beim
   Siegermarkt direkt gepaart.
7. ~~**Die Marktart steht nicht in der Datenbank.**~~ **ERLEDIGT am 10.8.
   abends.** Spalte `orion_funde.art`, vom Scanner geschrieben, mit Index.

   Es war kein Schönheitsfehler, sondern ein falsch zählender Filter:
   `artVon()` kannte **vier** Arten, laufen tun **neun**. „Barcelona führt
   zur Halbzeit" und „1. Halbzeit Über/Unter 0.5" fielen still in „Sieger"
   bzw. „Über/Unter" — wer nach Sieger filterte, bekam Halbzeit-Wetten
   mitgeliefert, ohne es zu merken. Das Filterfeld bietet jetzt alle neun an.

   Der alte Weg bleibt als **Rückfall** für Zeilen mit `art = null`, die vor
   der Umstellung geschrieben wurden. Er bleibt so grob wie er war — für
   diese Zeilen IST die Art nicht besser bekannt.

8. **Correct Score, Double Chance, Draw No Bet — NICHT angefasst.**
   Am Abend des 10.8. bewusst liegen gelassen, nicht vergessen. Eine neue
   Frageart braucht Messung, Regel und einen Trockenlauf gegen echte Daten
   mit jeder Zuordnung einzeln; halb gemacht wäre sie ein Risiko für genau
   den Mehrtageslauf, der gerade läuft. Der Rahmen steht (`art`-Spalte,
   Spiegel-Prüfstand), der nächste kann direkt anfangen.

   Nach dem Gebührenbefund ist die Erwartung ohnehin gedämpft: BTTS,
   Halbzeit und die drei neuen Über/Unter liefern −3 % bis −10 %, und der
   Grund ist nicht die Frageart, sondern der Abstand zwischen den Büchern
   minus Gebühr. Eine zehnte Frageart ändert daran nichts. **Ein Buch ohne
   Gebühr schon.**

---

## 8b. Nachtrag 11. August 2026 — was seit dem 10.8. dazukam

**Die Gebühr steht jetzt in Geld auf jeder Karte.** Satz, Betrag, effektiver
Prozentsatz vom Einsatz, gemessen/angenommen. Eine Formel für alle vier
Gebührenarten (Abschnitt 2). Erklärt in `angaben.html`.

**Eine Chance ist eine Zeile, die GELD bringt.** Drei Bedingungen statt
einer: Rendite über der Schwelle, Menge **bekannt**, Gewinn über
`KONFIG.mindestGewinn` (5). Vorher rutschten Zeilen mit unbekannter Menge
durch — aus „unbekannt ist nicht zu dünn" (richtig) war „also ist es eine
Chance" geworden (falsch). Gemessen: von 2 Chancen blieben 0, größter
tatsächlicher Gewinn live 2,93.

**Marktart als Spalte** (`orion_funde.art`) — der Filter kannte vier von
neun Arten. **Sonar** im Kopfbereich, läuft nur bei laufendem Scanner.
**Kräftiger Rahmen je Wette**, damit man nicht auf die falsche Karte klickt.

### Die zwei Fehler vom 11.8. — beide vom Auftraggeber gefunden

**1. Fehlpaarung durch „Al".** Gemessen:

```
Polymarket:  Al Diraiyah Saudi Club vs Al Ahli    13.8.
Kalshi:      Al Jazira vs Al-Ittihad              11.8.   <- ANDERES Spiel
aehnlichkeit("Al Ahli","Al Jazira") = 0,50   Schwelle = 0,50   -> PAART
```

„al" ist arabisch der Artikel. Bei zwei Namen mit je zwei Wörtern ergibt
EIN gemeinsames Wort exakt 0,50. Behoben durch Stoppwörter (`al, el, la,
le, los, las, de, del, di, du, do, da, dos, das`), deployt als v15.
**Die Struktur besteht weiter** — mit einem anderen Wort kann es wieder
passieren. Deshalb der Wächter unten.

**2. Verwaiste Zeilen.** 82 Zeilen standen auf „live", der Scanner fand 40.
Er setzt nicht mehr gefundene Zeilen über eine URL mit ALLEN Schlüsseln auf
„vorbei" — die wird zu lang und schlägt **still** fehl (`beendet=0`, keine
Meldung). Ein Teil der gemeldeten Fehlpaarungen waren solche Leichen.
**Ursache im Scanner steht noch**, der Wächter räumt sie ab.

### Der Wächter (`orion_waechter_lauf`, pg_cron, jede Minute)

Läuft **komplett in der Datenbank**: kein Deploy, kein Heim-PC, keine
laufenden Kosten. Räumt auf und prüft neun Muster — und rechnet die
Zuordnung **unabhängig vom Scanner nach**:

| Prüfung | warum |
|---|---|
| kein gemeinsames Wort in den Titeln | **fängt den „Al"-Fall**, unabhängig gerechnet |
| nur ein gemeinsames Wort bei kurzen Namen | derselbe Mechanismus, schwächer |
| Zuordnung ≤ 0,55 | die Schwelle selbst |
| Rendite ≥ 5 % | war bisher **immer** ein Fehler, nie eine Chance |
| hohe Rendite ohne Menge | die Drei-Cent-Zeilen |
| Partie vorbei, Zeile live | Leichen |
| Chance ohne Gebührenbetrag | Rechnung unvollständig |
| beide Seiten dasselbe Buch | Bruch von Regel 7 |
| Marktart fehlt | Scanner unvollständig |

**Gegen den echten Fehler geprüft**, nicht nur gedacht: gegen den Verlauf
gehalten findet er genau die zwei Fehlpaarungen — mit 5,06 % und 6,20 %
Rendite, also genau die Zeilen, die als beste Chancen dastanden.

### Offen (Stand 11.8. nachmittags)

1. ~~**Scanner-Bug an der Wurzel.**~~ **ERLEDIGT, v16.** Die verwaisten
   Zeilen wurden über `?schluessel=not.in.(alle Schlüssel)` beendet — eine
   URL, die bei 40+ Zeilen zu lang wurde und STILL fehlschlug. Jetzt über
   eine **Zeitmarke**: gefundene Zeilen werden zuerst hochgestempelt, dann
   beendet die Aufräumung alles vor der Laufmarke. Feste kurze URL, und sie
   wirft jetzt einen Fehler statt zu schweigen. Verifiziert: `live` == `paare`,
   null Leichen. Der Wächter bleibt als zweite Sicherung.

2. ~~**Renderlast.**~~ **GEMESSEN und entschärft.** Ein volles Neuzeichnen
   kostet ~24 ms bei 85 Zeilen, alle 2 s — mit Betfair und schwachem Gerät
   das gemeldete Ruckeln. `content-visibility: auto` auf den Karten (die
   `anzeige.js` im Kopf selbst als fehlend nannte) lässt den Browser Layout
   und Paint für Karten außerhalb des Bildes überspringen. Reines CSS, kein
   Logikeingriff. Ein größerer Umbau (nur geänderte Karten neu zeichnen) ist
   möglich, war aber bei diesem Messwert nicht nötig.

3. ~~**Correct Score, Double Chance, Draw No Bet.**~~ **GEMESSEN, nicht
   gebaut — und zwar mit Grund.** Von 13 581 Polymarket-Fußballmärkten:

   ```
   Double Chance:  0      Polymarket führt sie GAR NICHT
   Draw No Bet:    0      Polymarket führt sie GAR NICHT
   Correct Score:  952    aber je Ergebnis ein eigener Markt, Tiefe ~1
   ```

   Smarkets hat alle drei. Aber DC und DNB haben bei Polymarket **kein
   Gegenstück** — nichts zu paaren. Correct Score ist in Hunderte
   Einzelergebnisse zersplittert mit minimaler Tiefe; bei der Gebührenlage
   wäre das Deckung ohne Ertrag, mit echtem Fehlpaarungsrisiko beim
   Ergebnis-Abgleich. **Das Messen hat das Bauen erspart.**

4. **Smarkets-Marktlinks.** Gemessen: alle Märkte einer Partie tragen
   **denselben** Link, er zeigt aufs Spiel. Jeder Markt hat einen eigenen
   `slug` (`winner`, `over-under-0.5`), und die URL-Form ist „Punkt wird
   Bindestrich, Schrägstrich am Ende" (`over-under-0-5/`). NICHT belegt ist,
   ob die Seite dann den richtigen Markt zeigt — smarkets.com antwortet auf
   jeden Pfad mit 200 und rendert erst im Browser; der ist hier gesperrt.
   **Bis zur Messung** nennt die Karte den zu wählenden Markt im Klartext.

5. **Smarkets Lay handelbar?** Die API liefert `bids`, die Kehrwertsummen
   verhalten sich wie bei einer Börse. Ob man als Nutzer dort tatsächlich
   dagegenhalten kann, ist **ungemessen** (kein Konto). Ein großer Teil der
   Funde ist `Smarkets Lay` — diese Auskunft entscheidet über deren Wert.

6. **Polymarkets Gebührenwiderspruch** — API sagt Exponent 1, Quellen sagen
   die Hälfte. Wir rechnen die höhere Variante (Regel 2: lieber eine
   verpasste Chance als eine erfundene). Bleibt bewusst konservativ offen.

**Der Befund über allem:** die Bücher liegen im Schnitt 1,3 % auseinander,
die Gebühren fressen das auf. Größter je gemessener handelbarer Gewinn: 2,93.
Kein offener Punkt oben ändert das. Ein Buch OHNE Kommission schon — SX Bet
nimmt 0 % auf Einzelwetten. Das ist der einzige Schritt mit Hebel.

---

## 8c. Nachtrag 11. August 2026, Abend — Betfair, Bereiche, Währung

### Betfair läuft wieder — über eine Bridge auf einem eigenen Laptop

Aus Supabase bleibt Betfair gesperrt (403). Die Bridge **umgeht das nicht**:
sie läuft an einem Privatanschluss, wo Betfair nicht sperrt, liest mit dem
Konto des Auftraggebers und schiebt über `bf-bridge` nach Supabase.

**Gemessen vor dem Scharfschalten:** `orion_bf_maerkte` liefert 1240 Märkte,
davon ~850 MATCH_ODDS und ~1100 OVER_UNDER. Erste Funde mit **echter Tiefe**:

```
ka>bf   −0,24 %   max 2213 €      ← gegen 2,94 € bei Smarkets
bf>pm   −0,28 %   max 2348 €
```

**Drei Einschränkungen, die in jeder Betfair-Zeile stecken:**

1. **App-Key ist `DELAYED`** — Kurse rund eine Minute alt. Bei laufenden
   Spielen ist die gesehene Quote meist schon weg.
2. **Konto ist für API-Wetten `SUSPENDED`.** Lesen geht, automatisch setzen
   nicht. Für einen Scanner, bei dem der Mensch klickt, kein Hindernis —
   **ungeklärt ist**, ob manuelles Wetten im Browser geht.
3. **Bridge Build 17 sendet den echten Kommissionssatz nicht mit.** Es wird
   mit 7 % gerechnet statt der echten 2–5 %. An einem echten Markt
   nachgerechnet kostet das **rund einen Prozentpunkt** Rendite:
   ```
   Betfair Back 1,64 gegen Kalshi Nein 0,40
     7 % angenommen  →  −3,26 %
     5 % echt        →  −2,79 %
     2 % echt        →  −2,09 %
   ```
   **Build 18 behebt das** und liegt fertig gebaut in `C:\Users\Home\orion-bridge\`
   als eigenständige `betfair-bridge.exe` (88 MB, Node eingebettet, Doppelklick).

### HTTP 546 — der Speicherfehler ist zurück, und er ist strukturell

Beim Zuschalten von Betfair brach der Scanner **sofort** mit
`WORKER_RESOURCE_LIMIT` ab und stand rund vier Minuten. Betfairs 1218 Märkte
(462 kB) kamen zu 1610 Polymarket-Märkten samt Orderbüchern, 949 Smarkets-
und 198 Kalshi-Märkten.

Notbehelf, beide in der Datenbank ohne Deploy: vergangene Spiele raus, nur
die gelesenen Felder, **Fenster auf 12 h, Obergrenze 250 Märkte**. Das ist
eine **Begrenzung, keine Lösung** — von 1060 Märkten sehen wir 250.

### Bereichstrennung — der wichtigste Fund des Tages

Vom Auftraggeber vorhergesagt, dann gemessen. Eine Fehlpaarung stand **live
mit 5,34 %**:

```
Polymarket:  FSV Frankfurt 1899 vs. Eintracht Frankfurt    FUSSBALL
Kalshi:      ROSSMANN Centaurs vs. Eintracht Frankfurt     LEAGUE OF LEGENDS
```

Verbunden allein dadurch, dass Eintracht Frankfurt auch eine E-Sport-Mannschaft
hat. **Die Namensprüfung kann das nicht fangen — die Namen sind wirklich
gleich.** Nur der Bereich ist ein anderer.

Von 369 Kalshi-Märkten sind **196 E-Sport** (CS2 106, LoL 60, Valorant 16,
Rocket League 14). Smarkets führt **ausschließlich Fußball**. Jede dieser
Prüfungen war sinnlos und riskant zugleich.

**Behoben:** `Z.bereichKalshi` liest den Bereich aus dem Serien-Ticker,
`Z.bereichPm` aus dem Polymarket-Tag, `Z.gleicherBereich` verlangt, dass
**beide bekannt und gleich** sind. Unbekannt heißt nicht „passt schon".

Gemessen in **einem** Lauf nach dem Deploy:
```
Bereich verworfen, Durchgang 1:  153 Paarungsversuche
Kalshi anderer Bereich, D2:      250 von 361 Märkten
```

### Wir scannen 6 von 29 Bereichen

Gemessen, was Polymarket führt (aktive Märkte):
```
golf 2106 · mlb 1550 · tennis 1189 · soccer 1052 · ucl 971 · nfl 761
lol 696 · weather 655 · ai 608 · cfb 604 · elections 544 · nba 526
valorant 501 · crypto 401 · pop-culture 346 · politics 342 · tech 274
world 267 · bitcoin 236 · geopolitics 219 · cricket 219 · mma 216
esports 213 · ethereum 211 · inflation 206 · f1 187 · science 179
fed 106 · nhl 94
```
Gescannt werden nur `soccer, ucl, mlb, nfl, nba, tennis`.

### Weitere Änderungen dieses Abends

**Beträge in Euro mit Einheit.** „max. Einsatz 94" ließ offen, ob Euro,
Dollar oder Skala. Alles steht in USD; die Anzeige rechnet um. Der Kurs kommt
aus der **Datenbank über pg_net** — `api.frankfurter.dev` sendet keinen
CORS-Header, der Browser darf ihn nicht holen. Gemessen 1 USD = 0,86655 EUR.
Ohne Kurs wird nicht geraten: dann steht `$` da.

**Smarkets-Links** führten zur Startseite. Gemessen: ohne Schrägstrich am
Ende → HTTP 308 Redirect, mit → 200. An der Quelle im Sammler behoben
(949 von 949). Der Marktlink selbst (`/over-under-2-5/`) bleibt **offen** —
smarkets.com antwortet auf jeden Pfad mit 200, sogar `/quatsch-markt/`.

**Smarkets ist eine echte Börse.** Gemessen am Orderbuch eines Siegermarkts
tragen beide Seiten Volumen (Kairat back 10,6 Mio / lay 19,4 Mio). Es heißt
dort nur **BUY und SELL**, nicht Back/Lay.

**Scanner-Wurzelfix:** verwaiste Zeilen werden über eine **Zeitmarke** beendet
statt über eine URL mit allen Schlüsseln — die wurde bei 40+ Zeilen zu lang
und schlug **still** fehl (82 live bei 40 gefundenen). Jetzt wirft sie einen
Fehler statt zu schweigen.

**Wächter** (`orion_waechter_lauf`, pg_cron, jede Minute): räumt verwaiste
Zeilen ab, richtet Links, hält den Kurs frisch und prüft **elf Muster** —
darunter die Zuordnung **unabhängig nachgerechnet** (`orion_kernwoerter`).
Gegen den Verlauf gehalten findet er genau die zwei „Al"-Fehlpaarungen.

---

## 8d. DER AUFTRAG für die nächste Sitzung — **UMGESETZT am 11.8. spät abends, siehe 8e**

> **Jeder Bereich bekommt einen eigenen Scanner.**
> Es gibt **kein „alle Bereiche"**. Man muss sich für einen entscheiden;
> solange keiner gewählt ist, zeigt die Seite eine **Auswahl** statt einer
> Mischung.

Begründung des Auftraggebers, und sie ist gemessen richtig: eine
Sammelansicht ist genau die Lage, in der Fußball neben League of Legends
steht und verwechselt wird.

**Was dafür fehlt, in dieser Reihenfolge:**

1. **Betfair muss seine Sportart mitschicken.** Der Snapshot enthält sie
   nicht — deshalb greift die Bereichssperre bei Betfair-Zeilen **noch
   nicht**. Eine Zeile in der Bridge, braucht einen neuen Build.
2. **Der Scanner braucht einen Bereichs-Parameter**, damit `pg_cron` ihn je
   Bereich mit eigenem Takt aufruft (`orion_bereiche.takt_sek`). Das löst
   nebenbei den 546er, an dem er heute zweimal scheiterte.
3. **Erst dann** die 23 fehlenden Bereiche zuschalten. Vorher erzeugt jeder
   neue Bereich neue Fehlpaarungen, weil Smarkets nur Fußball führt und
   Betfair keine Sportart meldet.
4. **Auswahlseite vor der Liste**, solange kein Bereich gewählt ist.

**Grundlage steht bereits:** Tabelle `orion_bereiche` (20 Bereiche, drei
Gruppen, je eigene `pm_tags` und `takt_sek`), Spalte `orion_funde.bereich`
mit Index, `Filter.bereichVon`, Auswahlfeld mit 21 Einträgen.

### Weiter offen

- **Marktlink bei Smarkets** (siehe oben, nicht verifizierbar per HTTP)
- **Betfair: manuelles Wetten trotz `SUSPENDED`?** — Auskunft des
  Auftraggebers steht aus
- **Polymarkets Gebührenwiderspruch** — API sagt Exponent 1, Quellen die
  Hälfte; wir rechnen konservativ die höhere Variante
- **Betfair-Begrenzung auf 250 Märkte** aufheben, sobald Punkt 2 steht

**Der Befund über allem, unverändert:** die Bücher liegen im Schnitt 1,3 %
auseinander, die Gebühren fressen das auf. Betfair bringt erstmals echte
Tiefe (2213 € statt 2,94 €) — mit Build 18 und dem echten Kommissionssatz
könnten die −0,24 % ins Plus drehen. **Das ist der nächste Hebel.**

---

## 8e. Nachtrag 11. August 2026, spät abends — Scanner je Bereich LÄUFT

Der Auftrag aus 8d ist umgesetzt, in der vorgegebenen Reihenfolge. Vor dem
Deploy lief `node pruefung/spiegel.test.js` (13 995 grün, plus 275 + 171 +
158 in den anderen Prüfständen).

### 1. Bridge Build 19 — Betfair schickt die Sportart mit

- `bridge/betfair-bridge.js`: jeder Markt trägt jetzt `et` (Betfair
  eventTypeId, stand längst im Katalog), und `stats.et_namen` liefert
  Betfairs **eigene** Namen je Id aus `listEventTypes` — damit ist die
  Zuordnung nachprüfbar statt geglaubt. Build 19, Version 3.8.
- `bf-bridge` v14 nimmt `et` additiv an (Regel 6 gewahrt: nur erweitert).
  Dabei fiel Drift auf: das `sz`-Feld (Build 18) war NUR im Deployment,
  nicht im Repo — jetzt synchron.
- Neue Tabelle **`orion_bf_sport`** (et → bereich, mit `name_erwartet` und
  `geprueft`). Herkunft: Betfairs dokumentierte Ids, **ungemessen bis
  Build 19 läuft** — der Wächter vergleicht dann gegen `stats.et_namen`
  und setzt `geprueft` erst bei Übereinstimmung.
- `orion_bf_maerkte(fenster_h, bereich_p)` reicht `et`/`bereich` durch und
  filtert je Bereich. **Die exe liegt fertig in `C:\Users\Home\orion-bridge\`
  (Build 19, 92,5 MB) — der Auftraggeber muss sie auf dem Bridge-Laptop
  starten (Doppelklick).** Die alte Quelldatei dort liegt als
  `betfair-bridge-alt-build17.js` daneben; eine Build-18-exe lag dort
  entgegen der Übergabe NICHT (vermutlich schon auf den Laptop kopiert).

**WICHTIG, bewusst so entschieden:** Bis Build 19 auf dem Laptop läuft,
paart **kein** Scanner mehr Betfair — die Bridge (Build 17) schickt kein
`et`, und unbekannter Bereich heißt „wird nicht gepaart" (dieselbe Regel
wie bei Kalshi; die alte Lage — Betfair ganz ohne Bereichssperre — war
exakt die Fehlerklasse der 5,34-%-Fehlpaarung). Die bestehenden
Betfair-Zeilen wurden dadurch als „nicht mehr gefunden" beendet. Sobald
Build 19 läuft, kommen sie mit echtem Kommissionssatz UND Bereichssperre
zurück.

### 2. Scanner je Bereich (orion-lauf v19)

- **Kein „alle Bereiche" mehr.** Jeder Aufruf verlangt `{"bereich":"…"}`;
  ohne Bereich: HTTP 400. 20 pg_cron-Takte `orion-lauf-<bereich>` nach
  `orion_bereiche.takt_sek` (fussball `20 seconds`, 6 × minütlich,
  13 × `*/2`). Der alte Sammel-Takt `orion-lauf-takt` ist weg.
- Je Lauf wird NUR geladen, was zum Bereich gehört: Polymarket über die
  `pm_tags` des Registers, Kalshi vorgefiltert über den Serien-Ticker,
  Betfair über `orion_bf_maerkte(12, bereich)`, Smarkets **nur** im
  Bereich fussball (in allen anderen wird der Schnappschuss gar nicht
  geladen — Speicher!). Durchgang 2 (sm↔ka direkt) nur im fussball-Lauf.
- Jede Zeile trägt `bereich`; die **Aufräumung über die Zeitmarke läuft je
  Bereich** (der Tennis-Lauf beendet keine Fußball-Zeilen). Altzeilen
  wurden per Migration aus der Sportart nachgefüllt.
- **Probelauf-Modus:** `{"bereich":"golf","probe":true}` rechnet alles,
  schreibt NICHTS und liefert jede Zuordnung einzeln zurück — der
  Trockenlauf, den jede Freischaltung braucht. Probe geht auch bei
  inaktiven Bereichen; ein inaktiver Bereich läuft sonst nicht.
- Das löst nebenbei den **546**: gemessen laufen alle Bereiche in
  0,24–7 s (fussball 3,6 s), kein WORKER_RESOURCE_LIMIT. Die
  Betfair-Begrenzung ist je Bereich auf **1000 Märkte / bis 72 h**
  gelockert (bereichslose Alt-Aufrufe behalten 250/12 h); die echte Last
  ist **erst messbar, wenn Build 19 et liefert** — dann nachmessen, bevor
  das Scanner-Fenster (heute 12 h im Aufruf) steigt.
- Feinere Kalshi-Bereiche, am Schnappschuss nachgemessen: `lol` und
  `valorant` sind eigene Bereiche (nicht mehr Sammel-`esport`), neu
  erkannt werden `KXR6GAME` (esport), `KXARGPREMDIVGAME` und
  `KXBRASILEIROBGAME` (fussball). Beide Spiegel + Prüfstand angepasst.

### 3. Bereiche zugeschaltet — mit ehrlichem Befund

Alle 15 restlichen Bereiche liefen im Probelauf sauber durch (karte_ok
überall) und sind zugeschaltet. **Stand heute liefern sie 0 Paare, und
zwar strukturell:**

```
lol/valorant/esport   Kalshi hat Märkte (62/20/98), aber Polymarkets
                      E-Sport-Fragen passen auf KEINE der neun Fragearten
golf/cricket/mma/     0 verwertbare PM-Märkte im 72-h-Fenster (Golfs 2106
motorsport/eishockey  Märkte sind Langzeit-Turnierfragen, nicht "win on
                      DATE"); Betfair-Seite kommt erst mit Build 19
politik…kultur        Polymarket ist dort das EINZIGE angebundene Buch —
                      ohne zweites Buch kann nie ein Paar entstehen
```

Die Scanner sind billig (0,3 s je Lauf) und werden scharf, sobald eine
der drei Lücken fällt (E-Sport-Frageart-Regeln, Build 19, weitere Bücher).

**21. Bereich `spielerwetten`:** im Register und im Filter, `aktiv=false`.
Gemessen am 11.8.: Polymarket führt KEINEN brauchbaren Tag (player-props,
props, nba-props, mlb-props, player-specials, goalscorer,
anytime-goalscorer — alle 0 Events); Kalshi/Smarkets ungemessen. Erst
Quelle messen, dann Trockenlauf, dann Takt.

### 4. Anzeige

- **„Alle Bereiche" ist wieder erlaubt** (Vorgabe des Auftraggebers):
  die Trennung passiert beim Scannen, nicht beim Anschauen. Der Filter
  behält die Ein-Bereich-Auswahl, Standard ist die Sammelansicht; jede
  Karte trägt jetzt einen **Bereichs-Chip** (roher Tag im Tooltip).
- **Chance ab 3,00 %, Live und Verlauf** (`KONFIG.mindestRendite`).
  Alles zwischen −1 % und 3 % steht unter „Knappste Paare". Serverseitig
  zählt `orion_uebersicht` gleich. **Gemessener Vorbehalt, dem
  Auftraggeber ausdrücklich hinzuweisen:** Bücher liegen im Schnitt 1,3 %
  auseinander, größte je handelbare Rendite +1,12 %, alles ≥ 5 % war
  bisher Fehlpaarung → der Chancen-Reiter wird meist leer sein, und was
  auftaucht, verdient die Gegenprobe doppelt. Es wird NICHTS gelöscht —
  nur anders einsortiert (orion_rauschen_loeschen blieb bei 0,0).
- `orion_uebersicht.polymarket` und die Datenschicht aggregieren jetzt
  über den **jüngsten Lauf je Bereich** (eine einzelne letzte Zeile
  gehört immer nur einem Bereich und ließe die Tafel flackern). Neu:
  `orion_uebersicht.laeufe` und `statistik.je_bereich_lauf` je Bereich.

### 5. Wächter: „Ist die vorgeschlagene Wette wirklich wahr?"

`orion_verdacht()` prüft jetzt **19 Muster** (vorher 12). Neu:

| Prüfung | fängt |
|---|---|
| Bereich fehlt an der Zeile | Zeilen fremder/alter Schreiber |
| Bereich ↔ Sportart widersprechen sich | Karten-/Registerdrift |
| **Kalshi-Link zeigt in fremden Bereich** | die 5,34-%-Klasse am LINK (Serie aus dem Link, dritter unabhängiger Weg) |
| Link zeigt auf falsches Buch (Host-Abgleich) | Klick landet beim falschen Anbieter |
| Einsatzaufteilung ≠ 100 / Auszahlung ≠ 100+Rendite / max_gewinn ≠ max_einsatz·Rendite | mathematisch hübsche, aber unwahre Zeilen |
| Bereichslauf steht (je aktivem Bereich, 3 Takte Toleranz) | ein einzelner stehender Scanner, dessen Zeilen frisch aussehen |
| Betfair-Sportkarte ↔ `stats.et_namen` der Bridge | falsche et→Bereich-Zuordnung, sobald Build 19 läuft |

Auslöse-Tests der neuen Helfer (orion_bereich_pm/-kalshi, orion_link_passt)
gegen falsche UND richtige Eingaben: bestanden. Gegen die 29 Live-Zeilen:
0 Fehlalarme. Der Wächter setzt außerdem `orion_bf_sport.geprueft`, sobald
die Bridge-Namen die Karte bestätigen.

### Nach dieser Sitzung offen

1. **Build 19 starten** (Doppelklick auf `orion-bridge\betfair-bridge.exe`
   auf dem Bridge-Laptop). Bis dahin: keine Betfair-Paarungen (bewusst).
2. **Nach dem Start nachmessen:** greift die Bereichssperre (et_namen im
   Wächter grün, `orion_bf_sport.geprueft` = true)? Bleibt der 546 bei
   1000 Märkten je Bereich fern? Erst dann Scanner-Fenster über 12 h.
3. **Aufruf-Bilanz ungemessen:** 20 Takte ergeben rechnerisch ~24 000
   orion-lauf-Aufrufe/Tag (~720 000/Monat) plus Sammler. Ob das zum
   Supabase-Tarif passt, ist NICHT geprüft — bei Bedarf Welt-Takte auf
   */5 strecken, das kostet dort nichts (0 Paare, siehe oben).
4. **E-Sport-Fragearten fehlen:** Kalshi hat lol/valorant/esport-Märkte,
   Polymarket auch — aber `marktArt()` erkennt nur die neun
   Team-Fragemuster. Eigene Regeln + Trockenlauf nötig, sonst bleiben
   diese Bereiche leer.
5. **Spielerwetten-Quellen messen** (siehe oben, Bereich steht bereit).
6. Unverändert offen aus 8b/8c/8d: Smarkets-Marktlink (per HTTP nicht
   verifizierbar), Polymarkets Gebührenwiderspruch (konservativ höhere
   Variante), Smarkets Lay handelbar?, manuelles Wetten trotz SUSPENDED,
   Altlast-Takte `pm-scan-takt` und `orion-wache-takt` ungemessen.
7. **Angekündigt vom Auftraggeber:** Dateien zu Broker-Gebühren folgen;
   danach Gebührenmodell je Buch erneut gegen die Unterlagen halten.

**Der Befund über allem, unverändert:** die Bücher liegen im Schnitt 1,3 %
auseinander, die Gebühren fressen das auf. Betfair bringt erstmals echte
Tiefe — Build 19 (echter Kommissionssatz statt 7 %) ist der Hebel, und er
liegt jetzt fertig auf der Platte. **Starten muss ihn ein Mensch.**

---

## 8f. Nachtrag 11. August, Nacht — DIE GEBÜHREN SIND BELEGT

Der Auftraggeber hat die Gebührenordnungen aller vier Bücher beschafft.
Damit ist der **größte offene Punkt des Projekts aufgelöst** — und er war
ein Rechenfehler zu unseren Ungunsten.

### Polymarket: wir haben die DOPPELTE Gebühr gerechnet

Anbieterdoku (docs.polymarket.com/Fees), wörtlich:

```
fee = C × feeRate × p × (1 - p)
```

Das Programm rechnete `Satz × min(p, 1-p)`. Bei p = 0,50 also 0,025 je
Anteil statt 0,0125. **Der monatelange Widerspruch („API sagt Exponent 1,
Quellen sagen die Hälfte") ist entschieden: die Quellen hatten recht.** Der
Exponent kommt in der Anbieterformel überhaupt nicht vor; unsere Funktion
nimmt ihn nur noch entgegen und ignoriert ihn.

Gegengerechnet an der Tabelle der Doku, jede Zeile ein eigener Test: Sport,
100 Anteile zu 0,50 → 1,25 USD. Krypto → 1,75. Politik → 1,00. Rand 0,99 →
0,05. Alles trifft.

**Sätze je Marktart** (galt bisher pauschal 7 % als Rückfall):

| Marktart | Satz | Bereiche bei uns |
|---|---|---|
| Krypto | 7 % | krypto |
| Sport, Wirtschaft, Kultur, Wetter, sonstige | 5 % | alle Sportbereiche, welt |
| Finanzen, Politik, Technik | 4 % | politik, tech |
| **Geopolitik** | **0 %** | — noch kein Bereich |

Nur **Taker** zahlen. Wer zum Briefkurs kauft, ist Taker — also wir.

### Kalshi: unsere Rechnung war richtig, aber neun Serien sind gratis

Gebührenordnung (PDF vom 7. Juli 2026), das PDF war nicht auslesbar und
wurde über die eingebetteten Schriftschlüssel entziffert:

```
Taker: fees = round up(M × 0.07 × C × P × (1-P))
Maker: fees = round up(M × 0.0175 × C × P × (1-P)),  M dort 0
```

M ist der Multiplikator der Serie; ohne Eintrag in der Sondertabelle gilt 1.
**Unsere Sport-Serien stehen NICHT in der Tabelle** — 7 % bestätigt.
Nachgerechnet an Kalshis eigener Tabelle: p = 0,50 → 1,75 je 100, p = 0,20
→ 1,12. Trifft.

**Neu und wertvoll: neun Serien tragen M = 0 und sind gebührenfrei** —
`KXBTCY`, `KXETHY`, `KXCITRINI`, `KXDOED`, `KXELECTIRAN`,
`KXGAMBLINGREPEAL`, `KXGREENLAND`, `KXLAYOFFSYINFO`, `KXPAHLAVIHEAD`. Ein
Buch ohne Gebühr ist bei 1,3 % Abstand kein weiteres Buch, sondern ein
anderer Rechenfall — dieselbe Logik wie bei SX Bet. Sie stehen namentlich
im Code und werden mit 0 % gerechnet.

Wir rechnen ungerundet weiter; Kalshi rundet je Order auf, der Fehler
liegt unter einem Cent je Order.

### Smarkets: 2 % bestätigt, Schwellen der anderen Tarife stehen jetzt da

Aus der Commission FAQ: Standard **2 %** auf den Nettogewinn **je Markt**,
bei Verlust in einem Markt fällt nichts an. Das war bisher als „nicht
gemessen" gekennzeichnet — jetzt belegt. Dazu die Schwellen, damit man
merkt, wann man hineinrutscht: **1 % Pro** ab 1500 Wetten oder 1 Mio £
Einsatz je Monat (muss gewählt werden), **3 % Select** ab 25 000 £
Nettogewinn in 12 Monaten.

### Betfair-Seite = ORBIT, und Orbit nimmt 3 %

Der wichtigste praktische Punkt. betfair.com ist aus Österreich gesperrt,
**jeder Betfair-Link dieser Seite zeigt auf Orbit**, und dort wird gesetzt.
Orbit nimmt laut eigener Doku **pauschal 3 %** auf den Nettogewinn je
Markt, keine Premium-Gebühr, 0 % auf Verluste.

Bis heute rechnete diese Seite mit dem 7-%-Rückfall — **mehr als das
Doppelte**. Betfairs eigener `marketBaseRate` gilt nur für ein direktes
Betfair-Konto und wird nur noch mitgeführt (`bfEigen`).

### Was das zusammen ausmacht, gemessen

Probelauf Fußball direkt nach dem Deploy, 39 Paare: die beste Zeile steht
bei **+0,40 %** (`sm>ka`, Boca Juniors). Vor der Korrektur war die beste
Zeile des gleichen Bereichs negativ. Der Abstand zwischen den Büchern hat
sich nicht geändert — nur rechnen wir die Gebühr nicht mehr doppelt.

**Das ändert den Befund über allem NICHT:** 1,3 % Abstand, und die
Gebühren fressen den größten Teil. Aber die Zeilen stehen jetzt dort, wo
sie hingehören, und die Schwelle von 3 % ist damit ehrlich messbar.

### Warum „maximaler Einsatz" nur ein paar hundert Euro sagt

Gefragt und beantwortet, weil die Zahl sonst falsch verstanden wird:
`max_einsatz` ist **das Geld auf der BESTEN Preisstufe beider Bücher**,
nicht die Tiefe des Marktes. Dahinter liegt fast immer mehr — aber zu
schlechteren Kursen, und mit jeder Stufe fällt die Rendite; ein bis zwei
Stufen tiefer ist die Arbitrage regelmäßig weg. Begrenzend ist immer die
dünnere der beiden Seiten; die Karte nennt sie jetzt beim Namen
(**Engstelle**, `daten.js` → `engstelleVon`).

Dazu kommt: Kalshi, Smarkets und Betfair liefern über ihre Schnittstellen
**nur diese eine Stufe**. Was darunter liegt, ist damit **nicht gemessen**
— nicht null. Nur bei Polymarket hätten wir das ganze Orderbuch; eine
Tiefen-Treppe („wie viel bei 2 %, wie viel bei 1 %") wäre dort baubar,
bringt aber nichts, solange die Gegenseite nur eine Stufe zeigt.

**Wer ein paar tausend Euro setzen will, braucht ein Buch mit echter
Tiefe** — und das ist bislang genau eines: Betfair über Orbit, gemessen
2213 € auf einer einzigen Stufe gegen 2,94 € bei Smarkets. Das ist der
zweite Grund, warum Build 19 auf dem Laptop laufen muss.

---

## 8g. Nachtrag 12. August, nachts — Release, Linkprüfung, Nachrechnung

### Build 19 ist veröffentlicht

Die exe liegt als Release **`bridge-v19`** in DIESEM Repo. Geprüft: der
Direktlink antwortet mit HTTP 200 und 92 500 992 Bytes, exakt der gebauten
Datei. `version.json` und beide Download-Knöpfe auf `bridge-setup.html`
zeigen darauf; live bestätigt.

**Dabei fiel eine stille Falle auf:** der Knopf zeigte auf ein Release des
**Vorgänger-Projekts** (`orion-panel`, Tag `bridge-v1`) und lieferte eine
exe vom 8. August. Wer sich von der Website die „neueste" Bridge holte,
bekam also eine alte.

### Welche Bridge läuft — und was das bedeutet

Gemessen: es läuft **Build 18 (Fassung 3.7)** aus
`C:\Users\Home\Downloads\betfair-bridge.exe`. Sie lädt frisch hoch (3608
Märkte aus einem Katalog von 7361, Alter unter einer Minute), aber
**0 Märkte tragen eine Sportart** → `orion_bf_maerkte(12,'fussball')`
liefert **0** → **Betfair wird derzeit gelesen, aber nicht gepaart.**

Das ist gewollt (unbekannter Bereich = nicht paaren) und kein Fehler, es
heißt nur: solange 3.7 läuft, sind alle Zahlen im Panel **ohne Betfair**.
Die Build-19-Datei liegt startbereit in `C:\Users\Home\orion-bridge\`,
die Zugangsdatei daneben ist vollständig ausgefüllt.

### „Ist die Arbitrage wirklich eine Arbitrage?" — vierter, unabhängiger Weg

Alle Live-Zeilen wurden **komplett neu in SQL gerechnet**, aus den
gespeicherten Rohwerten (Preis, Quote, Gebührensatz, Seite), ohne eine
Zeile JS oder TS anzufassen:

```
29 Zeilen geprüft
  Rendite stimmt          29/29     größte Abweichung 0.000000
  Kehrwertsumme stimmt    29/29
  Einsatzaufteilung = 100 29/29
  Auszahlung = 100+Rendite 29/29
  ECHTE Arbitrage (inv<1)  0/29
```

Die letzte Zeile ist die ehrliche: **die Rechnung stimmt exakt, aber gerade
ist keine einzige Zeile eine echte Arbitrage.** Alle 29 liegen bei oder
unter null (beste −0,15 %). Das Panel behauptet also nichts Falsches — es
gibt schlicht nichts zu holen, solange Betfair fehlt.

### Führen die Links wirklich hin? Nur einer der drei ist prüfbar

37 verschiedene Links aus den Live-Zeilen über HTTP geprüft — **mit
Kontrollproben aus erfundenen Adressen**, sonst wäre die Prüfung wertlos:

| Buch | echte Links | Kontrolle (Unsinn-Adresse) | Aussage |
|---|---|---|---|
| Polymarket | 16/16 → HTTP 200, richtige Partie im Seitentitel | **404** | **belegt richtig** |
| Kalshi | 9/9 → HTTP 429 | ebenfalls 429 | **nicht prüfbar** (Bot-Sperre „Vercel Security Checkpoint") |
| Smarkets | 12/12 → HTTP 200 | **ebenfalls 200** | **Existenz nicht prüfbar** |

Smarkets ist der interessante Fall: die erfundene Adresse
`/quatsch-vs-unsinn/` liefert 200 **und baut den Unsinn sogar in den
Seitentitel** („Quatsch Vs Unsinn | Smarkets Predictions"). Ein 200 von
dort beweist also gar nichts — der in 8b/8c dokumentierte offene Punkt ist
damit erneut und schärfer belegt.

**Was daraus folgte, statt es auf sich beruhen zu lassen:** der Smarkets-Pfad
trägt die Mannschaftsnamen im Klartext. Ob er auf die *richtige Partie*
zeigt, ist deshalb ohne Netz prüfbar — gegen den Titel der Zeile, mit
derselben unabhängigen SQL-Wortzerlegung wie beim Nachrechnen der
Zuordnung. Neue Wächterregel in **`orion_verdacht_zusatz()`** (eigene
Funktion, damit die 19 gewachsenen Muster unangetastet bleiben).
Ausgelöst und gegengeprüft: richtiger Link geht durch, ein vertauschter
wird gefangen, Akzente stören nicht. Gegen die echten Daten: 20 von 20
Smarkets-Zeilen passen, 0 Verdacht.

### Was morgen zu prüfen ist, in dieser Reihenfolge

1. **Steht in der Anbietertafel „Build 19"?** Wenn nicht, lief die Nacht
   ohne Betfair und alles Weitere ist ohne Aussagekraft.
2. **Kommen Betfair-Zeilen mit echter Tiefe?** Das ist der eigentliche
   Test: 2213 € auf einer Stufe gegen 2,94 € bei Smarkets.
3. **Bleibt der Chancen-Reiter leer?** Bei 3 % Schwelle ist das der
   Normalfall. Was dort auftaucht, erst gegenprüfen — jede Zeile ab 5 %
   war bisher eine Fehlpaarung, der Wächter markiert sie weiterhin.
4. **Wächter grün?** `select * from orion_wache order by geprueft_am desc
   limit 1` — `alles_gut` muss true sein.

### Geplant, noch nicht gebaut

Der Auftraggeber will die Bridge künftig auf einem **eigenen Laptop rund um
die Uhr** laufen lassen, nur dafür da. Dann fällt die Einschränkung „läuft
nur, wenn ein Fenster offen ist" weg. Für den Betrieb heißt das: die
Frischeschwelle `KONFIG.bridgeMaxAlterS` (300 s) bleibt der Wächter über
diesen Rechner — steht die Bridge dort, sieht man es im Panel.

---

## 8h. Nachtrag 12. August, 00:30 — der Verlauf log, und warum

Vor dem Nachtlauf wurden **alle** Zeilen samt Links durchgegangen. Drei
Dinge kamen heraus, die vorher niemand gesehen hatte.

### 1. Die drei Fehlpaarungen standen als „beste Funde" im Verlauf

Von 52 Verlaufszeilen liegen **11 über 3 %**, sieben über 5 %, die höchste
bei 24,52 %. Seit der neuen 3-%-Schwelle sind genau das die Zeilen, die der
Verlauf-Reiter als das Beste zeigt, was das Programm je gefunden hat. Unter
ihnen:

```
6,20 %  Al Diraiyah vs. Al Ahli      GEGEN  Al Jazira vs. Al-Ittihad   <- andere Partie
5,06 %  Al Shabab vs. Al Qadisiyah   GEGEN  Al Jazira vs. Al-Ittihad   <- andere Partie
4,23 %  FSV Frankfurt vs. Eintracht  GEGEN  ROSSMANN Centaurs (LoL)    <- anderer Sport
```

**Alle drei stehen mit `zuordnung = 1,00` in der Datenbank.** Wer der
gespeicherten Zuordnung glaubt, sieht drei perfekte Treffer.

Behoben, ohne Geschichte umzuschreiben: die Anzeige rechnet die Zuordnung
jetzt **auch im Verlauf unabhängig nach** und nimmt solche Zeilen aus der
Liste „was sich gelohnt hätte" heraus. Gelöscht wird nichts, und
verschwiegen auch nicht — über dem Verlauf steht, wie viele Zeilen
ausgeschieden sind und warum.

**Zwei Wege, weil einer nicht reicht** (`daten.js` → `fehlpaarung`):

1. *Kein gemeinsames unterscheidendes Wort.* Fängt beide „Al"-Fälle.
2. *Der Kalshi-Link verrät die Serie, die Serie verrät den Bereich.* Zeigt
   er in einen anderen Bereich als die Zeile, ist es eine Fehlpaarung.

Weg 2 ist nicht Zierde: der League-of-Legends-Fall **rutscht durch Weg 1
hindurch**, weil beide Titel wirklich das Wort „Frankfurt" enthalten. Erst
sein Link (`kalshi.com/markets/kxlolgame/…`) verrät ihn. Gegengeprüft an
allen sechs echten Fällen: 2 gefangen, 4 richtig durchgelassen, und eine
korrekte Kalshi-Zeile (`kxleaguescupgame`) schlägt nicht fälschlich an.

### 2. Build 19 lief, aber die Anmeldung schlug fehl

Um 00:12:47 gestartet, um 00:19:01 meldete er sich zum ersten Mal — mit
`bf_ok: false`, „Benutzername oder Passwort in der Zugangsdatei ist
falsch", Katalog 0, 0 Märkte. Der Fehler-Upload hat dabei die 4038 Märkte
von Build 18 durch eine leere Liste ersetzt.

Ursache, durch Vergleich der Zugangsdateien gefunden (nur Prüfsummen, keine
Werte gelesen): **es gibt drei verschiedene `bridge-config.json`**, und die
neben Build 19 trug einen **anderen Betfair-Benutzernamen**. Passwort,
App-Key und Bridge-Token waren identisch — nur der Benutzername wich ab.
Die dritte Datei (Desktop) unterscheidet sich in allen vier Feldern.

| Ort | Zustand |
|---|---|
| `Downloads\bridge-config.json` | **die funktionierende** (Build 18 lief damit) |
| `orion-bridge\bridge-config.json` | anderer Benutzername → Anmeldung scheitert |
| `Desktop\bridge-config.json` | durchweg andere Werte, Herkunft unklar |

Behoben durch Zusammenlegen statt Bearbeiten: Build 19 liegt jetzt als
`Downloads\betfair-bridge-build19.exe` **neben der funktionierenden
Zugangsdatei**. Keine Datei wurde überschrieben, Build 18 bleibt daneben
liegen. Zum Starten genügt ein Doppelklick darauf.

> **Lehre, die bleibt:** die Bridge liest ihre Zugangsdatei aus dem Ordner
> der exe. Wer die exe verschiebt, wechselt damit unbemerkt die Zugangsdaten.
> Genau das ist hier passiert.

### 3. Die Links, dritter Durchgang

Alle 37 Links der Live-Zeilen erneut geprüft (`pruefung/linkpruefung.js`),
Ergebnis unverändert: Polymarket 16/16 belegt richtig (Kontrolle 404),
Kalshi nicht prüfbar (429, Bot-Sperre), Smarkets nicht prüfbar (200 auf
jeden Pfad). Zeilenweise stimmen Titel und beide Links überein — geprüft an
acht Paaren einzeln, `rsljua` ↔ real-salt-lake-vs-fc-juarez und so fort.

---

## 8i. Betriebsstand 12. August, 01:35 — wo die Bridge wohnt

**Die Bridge hat genau EIN Zuhause:**

```
C:\Users\Home\Desktop\Orion-Bridge-3.8\
    orion-bridge-3.8.exe     Build 19 / Fassung 3.8
    bridge-config.json       Name MUSS so bleiben
```

Alle anderen Kopien sind gelöscht — auch die des Vorgängerprojekts. Der
Bridge-Token wurde am 12.8. **neu erzeugt**; der alte wird vom Endpunkt
jetzt mit HTTP 401 abgewiesen (geprüft). Damit ist jede Streukopie wertlos,
und die Bridge des alten Projekts kann nicht mehr hochladen.

**Nur noch Pro-Takte aktiv:** 25 Stück — 20 Bereichs-Scanner plus Kalshi,
Smarkets, Prüfer, Rauschen, Wächter. `pm-scan-takt` und `orion-wache-takt`
sind entfernt (beide vorher nachgemessen: pm-scan schrieb nirgendwohin).
Die zugehörigen Edge Functions liegen noch in Supabase, werden aber von
niemandem mehr aufgerufen; löschen geht nur im Dashboard.

### Zwei Fallen, die eine ganze Nacht gekostet haben

**1. Die Zugangsdatei gehört zur exe, nicht zum Projekt.** Die Bridge liest
`bridge-config.json` aus dem Ordner der exe. Wer die exe verschiebt,
wechselt unbemerkt die Zugangsdaten. Genau so entstand die Lage, in der
drei verschiedene Zugangsdateien mit drei verschiedenen Benutzernamen
herumlagen.

**2. Ein Buchstabe.** Die Anmeldung scheiterte zuletzt an
`khalilalras**c**hed@gmail.com` statt `khalilalrashed@gmail.com`. Betfair
meldet das als „Benutzername oder Passwort ist falsch" — dieselbe Meldung
wie bei einem falschen Passwort, deshalb sucht man an der falschen Stelle.
**Wenn die Anmeldung scheitert: zuerst den Benutzernamen Zeichen für
Zeichen vergleichen, erst danach das Passwort verdächtigen.**

---

## 8j. STAND 13. August, abends — hier weiterlesen bei neuer Sitzung

> **NEU 15.8.: [STRUKTUR.md](STRUKTUR.md) ist die Landkarte** — welche
> Datei zu welcher Schicht gehoert (Logik/Design/Server) und wer mit wem
> redet. Vor jeder Aenderung dort nachsehen.

Dieser Abschnitt ist die Startseite für jede neue Sitzung. Er ersetzt kein
Gespräch, aber er bringt jemanden in fünf Minuten auf den Stand.

### Was das Programm ist

Ein Surebet-Scanner zwischen **Börsen** (nie Buchmachern): Polymarket,
Kalshi, Smarkets und Betfair. Er sucht Paare, bei denen zwei Bücher
denselben Ausgang unterschiedlich bepreisen, sodass beide Seiten zusammen
weniger als einen Euro für einen sicheren Euro kosten.

Alles läuft **serverseitig auf Supabase** — pg_cron ruft Edge Functions,
diese schreiben nach `orion_funde`, die Website liest nur ab. Nur Betfair
braucht einen laufenden Rechner (Ländersperre), dafür die Bridge.

### Der Betriebszustand, gemessen am 13.8. abends

```
25 Takte aktiv · 141 Live-Zeilen · 7 Chancen über 2 % · Wächter grün
Fußball scannt jede Minute in ~3,9 s · alle anderen Bereiche alle 10 Minuten
Bridge Build 19 (Fassung 3.8), bf_ok true
Geprüfte Urteile: 15 falsch · 11 richtig · kein „fraglich" mehr
```

### Das Wichtigste, was heute gelernt wurde

**Alle richtigen Funde lagen zwischen 2,07 und 3,27 %. Alle falschen über
4,48 %.** Von 15 geprüften Verlaufszeilen waren 8 falsch. Die Rechnung war
dabei nie das Problem — 21 von 22 Zeilen rechnen auf 0,0000 genau nach.
Falsch war immer, **welche zwei Kurse** verglichen wurden.

Zwei Ursachen, beide jetzt behoben oder messbar:

1. **Ein alter Kurs.** Sieben Fehler kamen von einem Betfair-Kurs, der
   stundenlang klebte. Beweis: neun Paarungen MIT Betfair lagen bei
   3,8–14,8 %, die vier OHNE Betfair bei 0,01–1,31 %.
2. **Halbzeit gegen ganzes Spiel.** Polymarkets „1st Half O/U 0.5" wurde
   gegen Smarkets' Ganzspiel-Markt gepaart.

### Zwei Prüfungen, die jederzeit laufen können

```bash
node pruefung/linkpruefung.js       # Links, mit Kontrollen auf Unsinn-Adressen
node pruefung/spiegel.test.js       # vor JEDEM Deploy
```

Und die stärkste Probe, bisher von Hand: **verschwindet der Vorteil, wenn
man ein Buch weglässt?** Liegen alle auffälligen Paarungen einer Partie an
einem Buch und die ohne dieses Buch bei null, ist das Buch schuld, nicht
die Partie. Diese Probe gehört als Regel in den Wächter — noch offen.

### Offene Aufgaben, nach Wichtigkeit

| | |
|---|---|
| **Kursalter-Sperre** | Die Spalten `pm_preis_seit`/`bf_quote_seit` laufen seit 13.8. Sobald ein paar ungestörte Stunden Daten da sind: Trockenlauf, dann Regel „ist der ältere Kurs über 15 Minuten alt, keine Chance". Behebt 7 der 8 Fehlerklassen. |
| **Ein-Buch-gegen-alle als Regel** | Siehe oben. Fängt genau das, was das Kursalter nicht sieht. |
| **Kurse zum Bestwert speichern** | Heute speichert eine Zeile nur die zuletzt gesehenen Kurse — der Höchstwert ist dadurch nachträglich von niemandem prüfbar. Zwei Spalten. |
| **KI-Tor** | NICHT gebaut. Idee: nur die 5–20 Kandidaten am Tag, die über die Schwelle kommen, von einem Modell prüfen lassen — gefragt wird „finde einen Grund abzulehnen". Braucht einen API-Schlüssel als Supabase-Secret, den nur der Auftraggeber einträgt. Geschätzt 1–5 Cent am Tag. Gehört HINTER die festen Regeln, nicht an deren Stelle. |
| **Vier weitere Marktarten** | halbzeit, hz1/hz2_ueber_unter, ecken_ueber_unter. Der Scanner versteht sie längst, Polymarket liefert 1000 Märkte dafür, Smarkets führt die Gegenmärkte — aber der Sammler wirft sie weg. Erster Versuch am 13.8. brachte den Scanner zum Absturz. Nächster Anlauf: **eigener Sammler mit eigenem Takt**. |
| **Spielerwetten** | 21. Bereich, steht im Register, ausgeschaltet. Sieben Polymarket-Kennungen geprüft, alle 0 Ereignisse. Erst Quelle finden, dann einschalten. |

### Fallen, die heute Blut gekostet haben

- **`verify_jwt` beim Deploy von Edge Functions MUSS aus bleiben.** pg_cron
  schickt keinen Authorization-Kopf. Sonst: 401 bei jedem Takt, lautlos.
- **Smarkets drosselt gleichzeitige Abrufe.** Sequenziell 2492 Kurse, vier
  parallel nur 990 — ohne jede Fehlermeldung.
- **Der Scanner sitzt dicht an der Speichergrenze.** 2065 Smarkets-Märkte
  gehen, 2667 nicht (HTTP 546 `WORKER_RESOURCE_LIMIT`).
- **Die Bridge liest ihre Zugangsdatei aus dem Ordner der exe.** Wer die exe
  verschiebt, wechselt unbemerkt die Zugangsdaten.
- **Der Rechner darf nicht schlafen**, sonst steht die Bridge. Deckel
  zuklappen ist erlaubt.

### Wie der Auftraggeber arbeitet

Erst messen, dann bauen. Nichts behaupten, was nicht gemessen ist;
Ungemessenes ausdrücklich so kennzeichnen. Vor jedem Ausrollen ein
Trockenlauf gegen echte Daten. Er findet Fehler zuverlässig selbst — die
verschwundene Chance und die League-of-Legends-Fehlpaarung hat er beide
bemerkt, bevor sie gemessen waren. Klartext ist ihm lieber als Beschönigung.

---

## 8k. STAND 13. August, spät abends — HIER ANFANGEN

Ersetzt 8j als Startseite. 8j bleibt gültig, was den Befund vom Vormittag
angeht; hier steht, was am Abend dazukam.

### Der wichtigste neue Messwert

**Ein Buch, das sich selbst widerspricht, erzeugt Scheinchancen.**

Die Summe der Gegenwahrscheinlichkeiten aller Ausgänge EINES Marktes auf der
Back-Seite muss über 1,00 liegen. Liegt sie darunter, könnte man bei diesem
einen Buch alle Ausgänge gleichzeitig backen und sicher gewinnen — das gibt
es nicht. Dann ist der Schnappschuss in sich unstimmig, meist wegen eines
stehengebliebenen Kurses.

| Klasse | Zeilen | über 2 % | Anteil | mittlere Rendite |
|---|---|---|---|---|
| Buch stimmig | 50 | 2 | 4 % | **−0,43 %** |
| Buch **unstimmig** | 21 | 4 | **19 %** | **+0,99 %** |
| nicht messbar | 49 | 5 | 10 % | +0,12 % |

Fünfmal so oft über 2 Prozent, und 1,4 Punkte mehr mittlere Rendite. Das ist
derselbe Fehler wie am Vormittag („ein alter Kurs"), aber **von innen
sichtbar: ohne Vorgeschichte, ohne zweites Buch, sofort.** Steht als
`buch_summe` in jeder Zeile und als rote Marke auf der Karte. **Gesperrt wird
noch nichts** — erst messen, dann sperren.

### Was neu auf der Karte steht

Drei Zeitpunkte, die vorher durcheinandergingen: **gefunden**, **Anpfiff**,
**Wette endet**. Der Anpfiff kommt aus dem Gegenbuch; Polymarkets
`gameStartTime` ist dafür gemessen unbrauchbar (78 von 594 Märkten, teils im
Widerspruch zum Wettende). 80 von 120 Live-Zeilen bekommen einen, der Rest
sagt ehrlich „nicht angegeben".

Gemessen und wichtig: **`endet_am` ist NICHT das Spielende.** Bei 59 von 64
Zeilen liegt es innerhalb einer Stunde am Anpfiff. Die alte Karte schrieb
dafür „endet in 2,1 h" — das las sich wie das Spielende und war der Anpfiff.
Steht jetzt ausdrücklich dabei.

Die Karte hat außerdem Abschnitte statt einer Wand: *Wann · Die zwei Seiten ·
Was dabei herauskommt · Beide Ausgänge*, und alles, was man erst unmittelbar
vor dem Handeln braucht (Gebühren, Absageregeln, Smarkets-Marktwechsel,
Nachkontrolle), liegt hinter einem Aufklapper. Ansehen ohne Sperre:
`pruefung/karte-probe.html` zeichnet echte Zeilen mit derselben Funktion.

### Die 21 Bereiche — jetzt gemessen statt vermutet

`node pruefung/bereiche.js` fährt die Filterkette des Scanners gegen die
echte Schnittstelle und sagt, an welchem Schritt die Märkte verloren gehen.
Ergebnis vom 13.8.:

```
Bereich        Ereign Maerkte handelb mit Art Fenster  PAARUNG
fussball         2174   29726   16390    4566    1564     1564  traegt
football          549    5941    4382     220      48       48  traegt
baseball          177    2913    1946      69      27       27  traegt
tennis            137    2320    1758       0       0        0  leer
esport            777   10560    5839       0       0        0  leer
politik          3838   46732   20263       0       0        0  leer
… 15 weitere ebenso
```

**3 von 21 Bereichen tragen einen Anker.** Die Trennung der Bereiche ist in
Ordnung — was fehlt, fehlt an der Quelle, nicht an der Logik:

- **tennis, basketball, eishockey, cricket, mma, motorsport, lol**: reichlich
  Märkte, aber **null** im 72-Stunden-Fenster. Polymarket führt dort nur
  Turniersieger, keine Einzelpartien. Kein Scannerfehler.
- **golf, politik, krypto, wetter, tech, kultur, wirtschaft, welt**: Märkte
  im Fenster, aber kein Titel der Form „A gegen B". Die ganze Paarungslogik
  hängt an zwei Mannschaften. Für diese Bereiche wäre Kalshi der natürliche
  Gegenpart — das ist **eine eigene Bauaufgabe**, kein Nachziehen.
- **valorant und esport** haben 343 bzw. 807 Märkte im Fenster, alle mit
  „A gegen B" im Titel — aber es sind Sondermärkte (Map-Rundenzahlen,
  Handicaps, Baron/Drache). Betfair führt im selben Fenster **2** Märkte.
  Auch mit passender Marktart entstünde dort nichts.

### Betfair-MMA war nie erreichbar

`orion_bf_sport` trug für `mma` die eventTypeId `26420`, die Bridge meldet
`26420387`. Ein Zeichen zu wenig, und kein einziger Betfair-MMA-Markt kam je
im Bereich an — lautlos. Korrigiert. Auffällig war es nur daran, dass
`geprueft` bei dieser einen Zeile auf `false` stand.

### Smarkets: der Marktlink geht nicht, der Markt existiert

des Auftraggebers Verdacht („bei Smarkets immer die falschen Links") ist zur Hälfte
bestätigt, und die andere Hälfte ist wichtiger:

- **Der Markt existiert.** Die Smarkets-Schnittstelle führt je Partie 103
  Märkte mit eigenem Namen und eigenem Kürzel (`winner`, `over-under-2.5`,
  `both-teams-score`). Der Gegenmarkt ist also echt, nicht erfunden.
- **Ein Link direkt auf den Markt ist von außen nicht baubar.** Smarkets'
  eigenes Kürzel trägt einen **Punkt** (`over-under-2.5`) — ein direkter
  Aufruf damit antwortet **404**. Die Bindestrich-Form antwortet 200, aber
  **die erfundene Kontrolladresse ebenso**, und beide Seiten sind
  byteweise identisch (nur die Sentry-Kennung unterscheidet sich). Der
  Server sagt also nichts darüber, welcher Markt geöffnet wird; die Auswahl
  passiert erst im Browser.
- Deshalb bleibt der Link auf der **Partie**, und die Karte nennt weiterhin
  ausdrücklich den Markt, auf den dort zu wechseln ist.

> **Offene Frage an der Auftraggeber, ein Klick genügt:** öffnet
> `…/ac-omonia-nicosia-vs-lincoln-red-imps-fc/over-under-2-5/` bei dir den
> richtigen Markt oder den Standardmarkt? Wenn ja, kann der Sammler die
> Marktadresse bauen. Von hier aus ist es nicht messbar, smarkets.com ist im
> Browser dieser Sitzung gesperrt.

### Was NICHT gemacht wurde und warum

- **Die Kursalter-Sperre ist nicht scharf.** Grund: die Spalten wurden am
  13.8. um 15:43 mit einem einzigen `update` vorbelegt — 204 Zeilen tragen
  denselben Mikrosekundenstempel. Echte Beobachtung gibt es erst seit dann,
  und die 26 geprüften Urteilszeilen sind ÄLTER als die Messung. Ein
  Trockenlauf gegen die Urteile ist damit unmöglich. Gegen den Live-Bestand
  hätte die Regel „älterer Kurs über 15 Minuten" **9 von 9** Kandidaten über
  2 % gesperrt, auch die im Band 2,07–3,27, das du selbst als richtig
  gemessen hast. Die Buchstimmigkeit trifft dieselbe Fehlerklasse, ohne
  Vorgeschichte zu brauchen.
- **Der Scanner wurde nicht angefasst.** Anpfiff und Stimmigkeit stehen
  bereits in den Schnappschüssen; sie in SQL nachzutragen kostet kein
  Ausrollen und erzeugt keine zweite Fassung, die auseinanderlaufen kann.

---

## 9. Arbeitsweise, die sich bewährt hat

**Erst messen, dann bauen.** Jeder ernste Fehler wurde gefunden, weil jemand
nachgerechnet hat — nicht durch Nachdenken:

- die 663 Scheinchancen: erst im echten Lauf sichtbar
- die 16,02-%-Fehlpaarung: durch eine Rückfrage des Auftraggebers
- `paar(k) || paar(ev)`: durch 0 Paare bei 849 gegen 865
- Smarkets' `next_page`: 50 statt 124 Spiele
- die Menge als *Auszahlung*: ohne Blick ins SDK Faktor 5 daneben
- der Staubauftrag über 0,0035 GBP: nur im rohen Orderbuch sichtbar
- Betfairs Stream ohne Namen: nur im offiziellen Schema sichtbar

**Drei Zustände, nie zwei.** Richtig, falsch, *oder nicht prüfbar*. Eine
fehlende Menge ist nicht „unbegrenzt". Eine Zeile ohne gespeicherte
Gebührensätze ist nicht „falsch gerechnet".

**Ein Widerspruch ist kein Grund, sich zu entscheiden.** Zeigen zwei
unabhängige Wege auf Verschiedenes, wird nicht der plausiblere genommen,
sondern gar nicht gehandelt.

**Vor dem Ausrollen ein Trockenlauf gegen echte Daten**, mit jeder Zuordnung
einzeln zum Nachsehen. Hat bei BTTS, Halbzeit, Ecken und dem ankerlosen
Durchgang jedes Mal getragen.

**Zwei Fallen beim Schreiben von Code über die Shell** — beide am 10.8.
getreten, beide vom Prüfstand gefangen:
- `\b` in einem Template-Literal wird zum **Backspace-Zeichen** (0x08)
- Backslashes überleben ein Bash-Heredoc nicht (`\/` → `/`, `\d` → `d`)

**Regex-lastigen Code direkt in die Datei schreiben, nie über die Shell.**

**Was nicht gemessen wurde, wird als ungemessen gekennzeichnet.**

## 8k. OFFEN (16.8.2026): Esport-Erweiterung wartet auf den Scanner-Deploy

**Fertig, geprüft und committet** (Commit 9de40e7):
- `zuordnung.ts` **und** `js/zuordnung.js`: neue Marktart-Regel für
  Esport-Matches (Teilname exakt `match winner` **und** `(BOx)` in der
  Frage) + `esportRein()` (Titel auf die reine Partie kürzen) +
  PM_BEREICH um `league-of-legends`, `rocket-league`, `cs2`, `dota`.
- Register `orion_bereiche` in der DB ist **bereits umgestellt**:
  `lol → ['league-of-legends']`, `esport → ['rocket-league','cs2','dota']`.
- Trockenlauf gegen echte Daten bestanden, Spiegel-Prüfstand grün.

**Es fehlt genau ein Schritt: der Deploy von `orion-lauf`.**
Ohne ihn erkennt der Server die Esport-Märkte weiter nicht (pm_maerkte 0).

```bash
npx supabase login --token <PERSONAL_ACCESS_TOKEN>
npx supabase functions deploy orion-lauf --project-ref noexklrgtqveiclijdwp
```

Token erstellen: supabase.com/dashboard/account/tokens → „Generate new
token". Der MCP-Weg (deploy_edge_function) verlangt alle drei Dateien
(75 KB) inline im Chat — teuer und fehleranfällig; die CLI lädt sie
direkt von der Platte.

**Nach dem Deploy zuerst prüfen** (der Scanner hat einen Probelauf-Modus,
der rechnet, aber nichts schreibt):
```bash
curl -s -X POST -H "content-type: application/json" \
  -d '{"bereich":"valorant","probe":true}' \
  https://noexklrgtqveiclijdwp.supabase.co/functions/v1/orion-lauf
```
Erwartet: `pm_maerkte` > 0 (statt 0) und jede Zuordnung einzeln
ausgewiesen. Danach Fußball gegenprüfen — `pm_maerkte` muss dort
unverändert bei rund 1263 liegen.

**Danach offen (Punkt 2 und 3 des Bauplans):** Kalshi-Sammler um
Krypto/Wetter/Wirtschaft erweitern (`KXBTCD`, `KXETHD`, `KXHIGHNY`,
`KXFED` sind offen und wurden am 16.8. direkt bei Kalshi nachgewiesen)
und die Marktart „Schwelle". **Warnung, gemessen:** Polymarket fragt
„erreicht BTC 78 000 **im Zeitraum**", Kalshi „Preis **am Stichtag**" —
verschiedene Fragen. Nur bei gleichem Fragetyp, gleicher Schwelle und
gleichem Stichzeitpunkt darf gepaart werden.

**Nachtrag 16.8., gemessen:** Der MCP-Weg `deploy_edge_function` kennt
**keinen Teil-Deploy** — zweimal getestet, beide Male
`Entrypoint path does not exist`, sobald `index.ts` fehlt. Er ersetzt die
Funktion vollständig und verlangt alle drei Dateien (75.000 Zeichen)
wörtlich im Aufruf. Genau dieser Weg hat heute schon einmal Regex-Zeichen
zerlegt (`\s` → `s`), was erst durch den Trockenlauf auffiel. Bei einem
Scanner, der im 20-Sekunden-Takt Geld-Entscheidungen vorbereitet, ist das
kein vertretbares Risiko. **Deshalb: Deploy nur per CLI mit Token.**

---

## 8l. DIE STICHZEIT-MATRIX, gemessen am 19.8.2026 — HIER ANFANGEN

Auftrag war: „miss die matrix". Gemessen wurde, was in jedem der vier Bücher
das Zeitfeld **wirklich bedeutet** — denn nur wenn beide Seiten denselben
Moment meinen, ist eine Paarung eine Wette auf dasselbe Ereignis. Alle Zahlen
unten sind gemessen, nicht geschätzt.

### Der Kern in einem Satz

Kein Buch meint mit seinem Zeitfeld dasselbe. Betfair und Smarkets liefern den
**Anpfiff**, Kalshi bei Spielen eine **Abrechnungsfrist zwei bis drei Tage
später**, Polymarket je nach Sportart mal den Anpfiff und mal das
**Turnierende sieben Tage später**.

### Die Matrix

| Basisart | Polymarket `endDate` | Betfair `st` | Smarkets `st` | Kalshi `schliesst` |
|---|---|---|---|---|
| Spiel Fußball | = Anpfiff (5019 von 5306 identisch) | Anpfiff | Anpfiff | Anpfiff **+65…76 h** |
| Spiel Tennis | Anpfiff **+168 h** (Turnierende) | Anpfiff | — | — |
| Spiel Baseball | teils Anpfiff, teils **+168 h** | Anpfiff | — | Anpfiff **+72 h** |
| Spiel E-Sport | Anpfiff **+4…6 h** | Anpfiff | — | Anpfiff **+48 h** |
| Schwelle Krypto/Rohstoff | = Stichzeit | — | — | **= Stichzeit, Versatz 0,00 h** |
| Schwelle Index | = Stichzeit | — | — | Stichzeit **+16 h** |
| Wetter | = Stichzeit | — | — | Stichzeit **+25…28 h** |
| Wahl/Politik | **75,1 % auf Punkt Mitternacht** = Kalendertag, keine Uhrzeit | — | — | — |

Vollständigkeit der Zeitangabe, gemessen:

| Buch | Märkte | mit Zeitfeld | davon auf Mitternacht |
|---|---|---|---|
| Betfair | 560 | 560 (100 %) | 9 (1,6 %) |
| Smarkets | 840 | 840 (100 %) | 9 (1,1 %) |
| Kalshi | 1104 | 1104 (100 %) | — |
| Polymarket | 1427 | 1268 (88,9 %) | **950 (66,6 %)** |

### Der teuerste Einzelfund: Tennis ist zu 100 % unsichtbar

`orion-lauf` filtert Polymarket auf `endDate` im 72-h-Fenster (Zeile 163).
Polymarket setzt bei Tennis `endDate` aber auf das **Turnierende**. Ergebnis,
live gemessen am 19.8.:

| Bereich | Spiele mit Anpfiff im 72-h-Fenster | gefangen | **verloren** | Verlust |
|---|---|---|---|---|
| Tennis | 4079 | 0 | **4079** | **100 %** |
| Baseball | 375 | 305 | 70 | 18,7 % |
| Valorant | 278 | 244 | 34 | 12,2 % |
| LoL | 1431 | 1385 | 46 | 3,2 % |
| Fußball | 374 | 374 | 0 | 0 % |
| Football | 25 | 25 | 0 | 0 % |

Umgekehrt genauso falsch: **451 Wetter-**, 71 LoL- und 39 Valorant-Märkte
haben ihr `endDate` im Fenster, obwohl das Ereignis **außerhalb** liegt — die
werden gescannt und gepaart, obwohl sie gar nicht dran sind.

Das erklärt den Bestand: von 46 lebenden Funden sind **46 Fußball**. Tennis
hat nie einen einzigen geliefert, und zwar nicht aus Mangel an Märkten,
sondern weil der Filter sie vorher wegwirft.

### Die Reparatur, die daraus folgt

Polymarket liefert eine echte Anpfiffzeit — **`gameStartTime`, 17.272 Märkte**
im Messlauf. `orion-lauf` liest sie **nicht** (Zeile 162 liest nur
`m.endDate || m.endDateIso`). Deckung je Bereich: Tennis 93,5 %, Wetter 81,9 %,
Fußball 80,0 %, LoL 79,8 %, Valorant 65,1 %, Baseball 47,9 %, Football 8,9 %,
Basketball/Eishockey/MMA 0 %.

Zu bauen, in dieser Reihenfolge:
1. `orion-lauf` Zeile 162/163: Stichzeit = `gameStartTime ?? endDate`, und
   **danach** filtern. Fällt beides weg, Markt nicht aufnehmen.
2. Kalshi-Spiele: `schliesst` ist **keine** Stichzeit. Entweder aus dem
   Ticker (`KXNPBGAME-26AUG190500ORISAI` → 19.8. 05:00 **New York**) lesen
   oder Kalshi-Spiele nur über Betfair/Smarkets zeitprüfen.
3. Politik/Wahl: bei 75,1 % Mitternachtsdaten ist eine 3-h-Zeitprüfung
   sinnlos. Dort muss die **Frage** zusammenpassen, nicht die Uhr.

### Zwei Fallen, die bei dieser Messung Zeit gekostet haben

- **`at time zone` dreht in die falsche Richtung.** `to_timestamp(...) at time
  zone 'America/New_York'` nimmt eine *timestamptz* und gibt Wanduhrzeit —
  alle Werte lagen um genau 8 h daneben. Richtig ist erst `::timestamp`
  (nackt machen), **dann** `at time zone`. Ein Versatz, der überall gleich
  ist, sieht aus wie ein echter Befund. Kontrollrechnung von Hand rettet.
- **`pm_snapshot` ist eine tote Ablage.** Geschrieben nur von `pm-scan`, ohne
  Cron-Takt, seit 8 Tagen kalt, von niemandem gelesen. Wer dort misst, misst
  Vergangenheit. Der lebende Polymarket-Weg sitzt in `orion-lauf` und holt
  direkt bei `gamma-api.polymarket.com`.

### Nebenbei repariert: Kalshi lieferte null Märkte

`orion-kalshi` v3 lief über `/markets?status=open` mit Seitenblättern. Kalshi
hat den Endpunkt mit Kombinationsmärkten geflutet (`KXMVECROSSCATEGORY-…`,
Kurse 0,0000/1,0000). Gemessen: 40 Seiten, 40.000 Märkte gesehen, **40.000
verworfen, 0 abgelegt — und `fehler: 0` gemeldet.** Wieder eine stille
Fehlklasse. v4 geht zurück auf den Serienweg (`?series_ticker=`), vierfach
parallel. Nachher: 259 Sport-Serien → **497 Märkte**, 25 Welt-Serien →
**607 Märkte**, 0 einseitig verworfen.

---

## 8m. VOLLPRUEFUNG IN ZWEI STUFEN, 19.8.2026

Auftrag woertlich: „Es muss wirklich beide Teams gleich sein. Gleiche
Sportart, gleiches Datum, gleiche Liga. Mit zwei Stufen pruefen, mit der
Wache noch. Es bleibt keine Moeglichkeit fuer Verlust."

### Warum ueberhaupt umgebaut

Die Pruefungen gab es zum Teil schon — aber **verstreut, und jeder Weg
kannte einen anderen Teil**:

| | Bereich | Kennung | Liga | Zeit | Namen sym | Trennschaerfe |
|---|---|---|---|---|---|---|
| `besterTreffer` (PM gegen BF/SM) | nein | ja | nur als Ersatz | **liess Fehlende durch** | nein | nein |
| `direktPaare` (Buch gegen Buch) | nein | ja | **nein** | **liess Fehlende durch** | nein | nein |
| Kalshi-Zweig | ja | ja | nein | ja | nein | nein |

Zwei Wege mit zwei Massstaeben sind genau die Drift, die hier schon
mehrfach Geld gekostet hat. Jetzt gibt es **eine** Stelle: `pruefeSpiel()`
in `js/zuordnung.js` und spiegelgleich in `zuordnung.ts`.

### Stufe 1: `pruefeSpiel()` — sieben Huerden beim Paaren

1. **Bereich** — „Eintracht Frankfurt" gibt es im Fussball UND in LoL (11.8.)
2. **Mannschaftsklasse** — Pachuca gegen Pachuca U21, Namen zu 100 % gleich (18.8.)
3. **Liga-Klasse** — NEU. Nur die Kennung wird verglichen, nie der Name:
   dieselbe Liga heisst bei jedem Buch anders
4. **Zeit — jetzt PFLICHT.** NEU und die wichtigste Aenderung: bisher galt
   „ungemessen ist nicht falsch", eine **fehlende** Zeit liess durch. Das
   war das offene Tor
5. **Name symmetrisch** — der CSD-Municipal-Fall (9.8., 663 Scheinchancen)
6. **Name asymmetrisch, beide Seiten** — eine Mannschaft zu treffen genuegt nie
7. **Trennschaerfe** — NEU. Jede Mannschaft muss zu IHRER Gegenueber besser
   passen als zur anderen

Huerde 7 kam erst durch den Verhaltenstest ans Licht: der CSD-Fall kam
trotz Huerde 5 durch. Huerde 5 hochzudrehen waere falsch gewesen — dann
faellt Shanghai Haigang/Shanghai Port (derselbe Verein, zwei Namen,
symmetrisch nur 0,40). Huerde 7 trennt beide Faelle sauber: CSD hat
Abstand 0, Shanghai hat 0,67.

### Stufe 2: `orion_wache_stufe2()` — jede Minute, ohne Stufe 1 zu glauben

Leitet jede Huerde **neu aus der gespeicherten Zeile** ab. Eine Stufe, die
der anderen glaubt, ist keine zweite Stufe, sondern eine Wiederholung. Sie
kann zudem etwas, das Stufe 1 nicht kann: sie laeuft **spaeter** — eine
beim Paaren saubere Zeile kann inzwischen faul sein.

Zusaetzlich zu den Huerden prueft sie: Anpfiff schon vorbei (oder unter
5 min), Buchsumme ueber 1,00 trotz positiver Rendite, fehlender Marktlink.
Eigene Urteile nimmt sie zurueck, wenn die Zeile wieder sauber ist —
fremde nie.

**Erster Lauf, sofort scharf:** 21 geprueft, **4 gesperrt** —
2 ohne belegten Anpfiff, 1 Reserve-gegen-Profi, und eine Zeile mit
**Buchsumme 1,0210 bei behaupteten 1674,43 % Rendite**. Die stand live.

### Was das kostet

Gemessen: 2 von 23 lebenden Zeilen fallen durch die Zeitpflicht, **beide
mit negativer Rendite**. Der Preis ist also praktisch null.

### Neu: `pruefung/vollpruefung.test.js`

Der Spiegeltest beweist, dass beide Fassungen sich **gleich** verhalten —
nicht, dass sie **richtig** liegen. Zwei gleich falsche Fassungen bestehen
ihn anstandslos. Der neue Test ist die andere Haelfte: 26 Faelle, jede
Huerde mit einem Fall der durchgehen MUSS und einem der scheitern MUSS.
Jeder Sperrfall ist ein echter Schaden aus dem Betrieb.

    node pruefung/spiegel.test.js       15188 Pruefungen
    node pruefung/vollpruefung.test.js  26 Faelle

### Ebenfalls drin: Polymarket liest endlich `gameStartTime`

Aus der Matrix (8l): `orion-lauf` filterte auf `endDate` und verlor damit
**4079 von 4079 Tennisspielen**. Jetzt gilt `gameStartTime ?? endDate`, und
die Zeile fuehrt mit `anpfiffEcht` mit, ob die Zeit ein echter Anpfiff war
oder nur ein Rueckfall. Das repariert zweierlei auf einmal: die Abdeckung
UND die Genauigkeit der Zeitsperre, die vorher Anpfiff gegen Turnierende
verglich.

### NICHT gemacht, bewusst

**`orion-lauf` ist noch nicht deployt.** Stufe 1 und die
`gameStartTime`-Reparatur wirken erst danach. Bis dahin traegt Stufe 2
(laeuft, jede Minute) plus die Browserpruefung in `daten.js` die Last.
Das ist kein Versehen, sondern der bekannte Engpass — der Deploy umfasst
drei Dateien und gehoert eigenstaendig geprueft.

---

## 8n. NACHTPRUEFUNG 19.8.2026, mittags

Auftrag: „Ueberpruef, ob irgendwelche Fehler vorgekommen sind" und „dass die
App immer auf hundert Prozent ist, auch wenn's Nacht ist."

### Die Nacht war lueckenlos

Neue Funde je Stunde, 23:00 bis 13:00, **jede Stunde besetzt und jede mit
Betfair dabei**: 1, 4, 3, 4, 7, 2, 2, 9, 15, 4, 9, 12, 13, 17, 22.

Dass nachts weniger kommt, ist **kein** Ausfall: um 03:00 laufen weniger
Partien als um 13:00. Der Scanner lief durchgehend -- `orion-lauf-fussball`
2151 Laeufe in 12 h bei 2160 moeglichen (Takt 20 s).

Standby ist auf Netz UND Akku aus (beide `0x00000000`), der Laptop schlaeft
nicht.

### Fehler 1: vier Deadlocks in 12 Stunden

    orion-wache2-takt   3x  (05:54, 07:51, 08:22)
    orion-zeiten-takt   1x  (06:03)

Beide laufen jede Minute und aendern massenhaft Zeilen in `orion_funde`, aber
in unterschiedlicher Reihenfolge. Treffen sie sich, schiesst Postgres einen ab.

**Warum das nicht harmlos ist:** der abgeschossene Lauf hat NICHTS geprueft.
Faellt die Wache in genau der Minute aus, in der eine Fehlpaarung entsteht,
steht sie eine Minute laenger in den Chancen. Selten (3 von 643), aber es ist
die stille Sorte -- pg_cron meldet es nur im Protokoll.

**Behoben:** `orion_schreibsperre()`, eine gemeinsame Beratungssperre. Wer
`orion_funde` massenhaft aendert, nimmt sie zuerst; beide Takte koennen
einander nicht mehr ueberholen. Bewusst blockierend statt `try_`: ein Takt,
der eine Minute wartet, ist richtig; ein stillschweigend uebersprungener
waere wieder ein stiller Ausfall. Dazu schreibt die Wache jetzt in fester
Reihenfolge (`order by schluessel`) als zweiter Riegel.

### Fehler 2: bis zu 12 Minuten Bridge-Luecke

Die Bridge starb gegen 13:23. Der Waechter lief um 13:20 (korrekt: sie lebte
noch) und waere erst 13:35 wieder drangewesen. **Waechter steht jetzt auf
jede Minute** statt alle fuenf (`schtasks /ri 1`).

### Falsche Faehrte, festgehalten damit sie niemand nochmal laeuft

Beim Pruefen sahen sechs `node.exe` nach sechs parallelen Bridges aus. Es
waren PDF-Server der Werkzeugumgebung (`@modelcontextprotocol/server-pdf`).
**Ein `Get-Process node | Stop-Process` haette die mit erschlagen.** Vor dem
Abschiessen immer die Befehlszeile lesen, nie nach Prozessnamen gehen.

### Was die Wache in diesen Laeufen gefangen hat

    33 geprueft -> 10 gesperrt      (nachts)
    59 geprueft -> 15 gesperrt      (mittags)

Darunter Rechenwidersprueche mit 3042 % und 3087 % bei Buchsumme 1,0121, und
weiter regelmaessig „Anpfiff nicht belegt" (11 von 15). Letzteres ist der
Beleg dafuer, dass die Zeitpflicht taeglich greift.

### Was NUR am fehlenden Deploy haengt

`orion-lauf` steht weiter auf **Version 21**. Nicht scharf sind damit:

  1. **Stufe 1** (`pruefeSpiel`, alle sieben Huerden) -- laeuft nur im
     Browser und in der Wache, nicht im Scanner selbst
  2. **`gameStartTime`** -- Tennis bleibt unsichtbar, gemessen 4079 von
     4079 Spielen
  3. Bereichsuebergabe an `besterTreffer`

Alles andere ist ausgerollt und arbeitet: Kalshi v4, Wache Stufe 2,
`orion_bereich_bf` (E-Sport-Trennung), die Deadlock-Sperre.

---

## 8o. DEPLOY IST DURCH (v22) + KORREKTUR ZUM TENNIS-BEFUND

### Ausgerollt und nachgemessen

`orion-lauf` steht auf **Version 22**. Belegt im ausgelieferten Code:
`pruefeSpiel`, `gameStartTime`, `trenn` (Huerde 7), `STRENG_SYM`,
`anpfiffEcht`. Probelauf Fussball: **pm 1332, bf 393, sm 863, ka 173,
56 Paare.**

### KORREKTUR: die Tennis-Ursache war nicht die, die ich genannt habe

Am 19.8. stand hier, der `endDate`-Filter verliere 4079 von 4079
Tennisspielen. Das war **unvollstaendig**. Nach dem Deploy liefert Tennis
weiterhin **pm = 0**. Nachgemessen:

    Tennis-Maerkte gesamt:          4876
    davon in einer "vs"-Partie:     4562
    davon Anpfiff im 72-h-Fenster:  1925
    davon von marktArt erkannt:        0   <-- HIER bricht es

`marktArt()` kennt nur fussballfoermige Fragen (`win on YYYY MM DD`,
`end in a draw`, Tore-Ueber/Unter). Tennis fragt anders:

    Australian Open Women's: Laura Siegemund vs Liudmila Samsonova
    Siegemund vs. Samsonova: Total Sets O/U 2.5
    Set 1 Winner: Siegemund vs Samsonova

Der Markt wird also schon **vor** der Zeitpruefung verworfen. Beide
Aussagen stimmen einzeln (der endDate-Filter haette sie auch verloren),
aber die Reihenfolge im Code entscheidet: `marktArt` kommt zuerst.

**Lehre:** eine Ursache ist erst belegt, wenn die Reparatur wirkt. Ich
hatte gemessen, dass Filter B sie verwirft, ohne zu pruefen, ob Filter A
davor sie schon verworfen hat.

**Offen:** `marktArt` um die Tennis-Formen erweitern (Satzsieger,
Games-Ueber/Unter, Saetze-Ueber/Unter) und die Betfair-Gegenstuecke
zuordnen. 1925 Spiele im Fenster warten darauf.

### Alle vier Buecher kreuzen jetzt

    kalshi   <-> smarkets    19 Paare
    polymarket <-> smarkets  18
    kalshi   <-> polymarket   8   (ALLE von der Wache gesperrt)
    smarkets <-> polymarket   5
    smarkets <-> kalshi       3
    betfair  <-> smarkets     2

Die acht Kalshi-Polymarket-Paare haben **kein einziges belegtes Anpfiff**
und werden deshalb von Stufe 2 vollstaendig gesperrt. Das ist die
Stichzeit-Matrix (8l) im Betrieb: Kalshis `close_time` ist bei Spielen
eine Abrechnungsfrist, kein Anstoss. Die Wache tut damit genau das
Richtige.

---

## 8p. PUNKT 1 ABGESCHLOSSEN + EIN FEHLURTEIL, DAS ICH SELBST GEBAUT HABE

### Der Befund

In 24 h ueberschritten 106 Zeilen die 2-Prozent-Marke, 101 davon lagen
ueber 10 % -- und **75 standen unbeanstandet da**. Die Wache fing sie
nicht, aus zwei Gruenden: sie prueft nur `status='live'` (ein
Verlaufseintrag wird nie beurteilt) und nur `rendite` (den Momentanwert),
nicht `beste_rendite` (den Spitzenwert, der angezeigt wird).

Von den 75: **65 hatten Buchsumme >= 1,00.** Das ist kein Verdacht,
sondern Arithmetik -- liegt die Buchsumme ueber 1, kann es keinen Vorteil
geben.

### Mein Fehler dabei, und die Korrektur

Erster Versuch: Regel auf `greatest(rendite, beste_rendite)` erweitert und
auf den ganzen Verlauf losgelassen. Ergebnis **1051 von 1213 gesperrt,
87 %**. Das war falsch.

**Der Denkfehler:** `beste_rendite` ist der Spitzenwert von FRUEHER,
`buch_summe` der Kursstand von JETZT. Zwei verschiedene Zeitpunkte. Eine
Zeile, die um 09:00 echte 2 % hatte, wurde verurteilt, weil die Kurse bis
20:00 weitergelaufen waren. Genau der Fehlschluss, vor dem dieses Projekt
sonst warnt: zwei Zahlen vergleichen, die nicht zueinander gehoeren.

Die 1051 Fehlurteile sind zurueckgenommen. Die Regel gilt jetzt nur noch
fuer LEBENDE Zeilen, wo alle Zahlen aus demselben Moment stammen.

### Was mit dem Verlauf stattdessen geschieht

Ein Spitzenwert laesst sich nachtraeglich **nicht** nachrechnen -- die
Kurse von damals sind nicht gespeichert. Er ist also nicht widerlegbar,
nur einordenbar. Verlaufseintraege ueber 5 % bekommen deshalb das Urteil
**`zweifelhaft`**, nicht `falsch`, mit Verweis auf die Messung vom 13.8.
Die Wache soll nur sagen, was sie belegen kann.

### Stand danach

    zweifelhaft (Verlauf, Spitze ueber 5 %)   996
    falsch (Verlauf, von den Sperren)         133
    sauber, live                               48
    sauber, Verlauf (Spitze unter 5 %)         26
    falsch, live                                9

Die **26** sauberen Verlaufseintraege unter 5 % sind der glaubwuerdige
Bestand. Das deckt sich mit der Messung vom 13.8.: alle bestaetigt
richtigen lagen zwischen 2,07 und 3,27 %.

### Offen bleibt

Damit ein Spitzenwert kuenftig nachrechenbar ist, muessten die BEIDEN
Kurse zum Zeitpunkt des Hoechststands mitgespeichert werden. Ohne das
bleibt jeder Verlaufseintrag eine Behauptung. Das waere der naechste
saubere Schritt -- und er kostet nur eine Spalte.

### Nachtrag: der Spitzenwert ist ab jetzt beweisbar

Neue Spalten in `orion_funde`: `beste_pm_preis`, `beste_bf_quote`,
**`beste_buch_summe`**, `beste_am`. Der Trigger friert sie im Moment des
Hoechststands ein.

Eine Falle dabei, gleich beim Bauen aufgefallen: der Trigger feuert BEIM
SCHREIBEN, `buch_summe` wird aber erst danach in einem eigenen Takt
berechnet -- der Beleg war deshalb immer leer. `orion_beleg_nachtragen()`
traegt ihn nach, aber NUR solange die Zeile noch auf ihrem Hoechststand
steht (`rendite = beste_rendite`). Zieht der Kurs weiter, wird nichts mehr
nachgetragen: eine spaetere Buchsumme waere kein Beleg, sondern genau der
Zeitpunkt-Mischfehler von vorhin.

`orion_verlauf_urteil()` entscheidet danach:
  mit Beleg und Buchsumme >= 1,00  ->  **falsch** (bewiesen)
  ohne Beleg, Spitze ueber 5 %     ->  **zweifelhaft** (nur eingeordnet)

**Der Altbestand bleibt zweifelhaft und bekommt keine erfundenen Belege.**
Von 65 lebenden Zeilen trug beim Umbau genau 1 einen Beleg -- die
uebrigen standen nicht mehr auf ihrem Hoechststand. Ab jetzt bekommt jede
neue Zeile ihren Beweis im richtigen Moment.

### Was NICHT gebaut wurde und warum

Tennis (`marktArt` erweitern) und die Marktart Schwelle sind NICHT
gebaut. Beides braucht eine Messung davor und einen Deploy danach, und
beides in einem Rutsch durchzuziehen haette geheissen, ohne Messung zu
bauen -- nach dem Fehlurteil ueber 1051 Zeilen heute abend genau das
Falsche. Sie stehen als naechstes an.

### Nachtrag zum Nachtrag: die Tuersperre war wertlos, bis ALLE sie nahmen

Nach dem Einbau von `orion_beleg_nachtragen()` stiegen die Deadlocks von
4 in 12 Stunden auf **9 in EINER Stunde** -- also schlimmer als vor der
Sperre, die sie verhindern sollte. Die Meldung nannte den Grund genau:

    Process A wartet auf ExclusiveLock on advisory lock, blockiert von B
    Process B wartet auf ShareLock on transaction,       blockiert von A

`orion_beleg_nachtragen()` nahm ZEILENsperren (sein UPDATE), OHNE vorher
an die Tuer zu gehen. `orion_zeiten_stimmigkeit()` nahm die Tuer zuerst
und wollte dann dieselben Zeilen. Zwei Reihenfolgen, also Deadlock --
diesmal MIT der Sperre im Spiel.

**Eine Tuersperre wirkt nur, wenn ALLE sie als ERSTES nehmen. Wer eine
Zeile anfasst, bevor er an der Tuer war, macht die Tuer wertlos.**

REGEL: jede Funktion, die `orion_funde` massenhaft aendert, ruft
`orion_schreibsperre()` als allererste Anweisung. Ohne Ausnahme.

Nachgemessen nach der Korrektur: **0 Fehlschlaege**, und der Beleg
fuellt sich (11 von 65 lebenden Zeilen tragen ihn schon, Tendenz
steigend -- jede neue Zeile bekommt ihn im Moment ihres Hoechststands).

---

## 8q. TENNIS GEBAUT + SCHWELLEN GEMESSEN UND BEWUSST NICHT GEBAUT (19.8., abends)

> **DEPLOY IST DURCH (spaeter am Abend): orion-lauf Version 23**, ausgerollt
> ueber die Supabase-MCP-Verbindung (ohne Access-Token; DEPLOY-JETZT.cmd
> bleibt der Weg fuer kuenftige Deploys). Das Wache-SQL hat Karam im
> SQL-Editor angewendet, alle sechs Proben gruen. Scharfer Lauf:
> 68 Tennis-Sieger erkannt (vorher 0), sieger_ohne_ausgang 0, erstes
> lebendes Paar "Cincinnati Open: Diana Shnaider vs Elena Rybakina" gegen
> Betfairs abgekuerztes "Di Shnaider v E Rybakina" — Rendite -0,52 %
> (keine Chance, korrekt gerechnet), beginnt_am vom Zeiten-Takt aus
> Betfair belegt (Abstand 0 min), buch_summe 1,0077 nachgerechnet.
> Damit ist die ganze Kette im Betrieb bewiesen. ABENDSTUNDE: nur 29
> Betfair-Maerkte im Fenster; die vollen Zahlen kommen mit dem
> Vormittagsprogramm. AB JETZT: BETRIEBSRUHE (Karams Ansage) — keine
> Updates an Bridge, Panel, PC oder Verwaltung, nur beobachten.

### Tennis: gemessen, dann gebaut

**Messung zuerst** (alle Zahlen vom 19.8., gegen die echten Schnittstellen):

    Betfair (bridge_odds, Bereich tennis):   46 Maerkte, ALLE MATCH_ODDS,
                                             Laeufer = volle Spielernamen
    Polymarket, 72-h-Fenster:  Satz-Games-O/U 678 | Match-Games-O/U 339
                               MATCHSIEGER 130 (129 Partien) | Satzsieger 226
                               Satz-Handicap 215 | Saetze-O/U 113
                               dazu 130 "Completed Match" (Ja/Nein!)

Nur der **Matchsieger** hat also ein Betfair-Gegenstueck. Seine Form:

    "Cincinnati Open: Iga Swiatek vs Diane Parry"
    — question = Eventtitel, GENAU EIN Doppelpunkt, KEIN groupItemTitle,
      outcomes = DIE SPIELERNAMEN (nicht Yes/No), outcomes[0] <-> tokens[0]

Die Falle daneben: "Cancun: Completed Match: A vs B" (wird das Match
beendet?) hat fast dieselbe Form — zwei Doppelpunkte, Teilname gesetzt,
outcomes Yes/No. 130 gegen 130, exakt haelftig.

**Gebaut** (Spiegel gleichzeitig, Tests zuerst):

1. `marktArt(frage, teil, bereich)` — dritter Parameter. Tennis-Sieger
   NUR im Bereich tennis (kein Unentschieden; im Fussball waere die
   Zwei-Ausgangs-Form falsch). Zwei unabhaengige Sicherungen: Teilname
   leer UND Blockliste im Praefix (set/winner/handicap/total/completed/
   game/o u). In js/zuordnung.js UND zuordnung.ts.
2. `turnierRein(titel)` — NEU in beiden Spiegeln, in `paar()` eingebaut:
   steht nach dem LETZTEN Doppelpunkt eine vs-Partie, zaehlt nur dieser
   Teil. Sonst verwaessert das Turnier die Namenspruefung, und "ITF W35
   Krakow **Women**" traegt die Frauen-Kennung in die Partie — die
   Kennungssperre haette RICHTIGE Paare verworfen.
3. `orion-lauf/index.ts`: bereich an marktArt; beim Tennis-Sieger wird
   `teil = outcomes[0]` gesetzt (JA-Seite; laeuferZu findet damit den
   Betfair-Laeufer, gemessen identische Namen). outcomes ohne zwei
   Namens-Ausgaenge -> Zaehler `sieger_ohne_ausgang` in der Antwort,
   nichts faellt stumm.
4. SQL: `orion_partie_von_titel()` (Spiegel von turnierRein) und beide
   Kennungssperren (`orion_wache_stufe2`, `orion_kennung_pruefen`)
   reinigen den Titel vor dem Vergleich. **Liegt in
   supabase/wache-tennis-turnier.sql, MUSS im SQL-Editor angewendet
   werden** — der Deploy-Knopf rollt nur die Edge-Funktion aus. Ohne
   diesen Schritt sperrt die Wache jede Frauen-Tennis-Zeile.
5. Pruefstaende: zuordnung.test.js 296, vollpruefung.test.js 36 (neuer
   Tennis-Ende-zu-Ende-Block), spiegel.test.js 19896, rechnung.test.js
   195 — alle gruen. bereiche.js mitgezogen (Bereich an marktArt,
   Stichzeit gameStartTime wie v22 — das Werkzeug mass vorher den ALTEN
   Filter).

**Trockenlauf lokal** (neue Spiegel, echte Daten): 127 Sieger im Fenster
erkannt (vorher 0), **19 vollstaendige Paare** gegen die 46 Betfair-
Maerkte, 0 Laeufer-Ausfaelle, Frauen-Turniere gehen durch. Die uebrigen
Betfair-Partien (ITF-Kleinturniere, Doppel) fuehrt Polymarket nicht.

**Zwei Bestandsfunde nebenbei:**
- `zuordnung.test.js` stand seit der Zeitpflicht (8m) ROT und niemand
  sah es — das Deploy-Tor prueft nur spiegel+vollpruefung. Repariert:
  die Faelle tragen jetzt Zeiten; ein neuer Fall prueft die Zeitpflicht
  selbst.
- Seit direktPaare durch pruefeSpiel laeuft, weist die 180-min-Sperre
  auch die frueher gemessenen 47-h-Kalshi-Faelle ab (Ticker ohne
  Uhrzeit = Mitternacht). Das ist die bewusste Haertung — im Test jetzt
  als PREIS festgehalten, nicht mehr als Wunschverhalten.

**RESTRISIKO Tennis, nicht wegbaubar, KARAM MUSS ES KENNEN:** Gibt ein
Spieler NACH Matchbeginn auf, wertet Polymarket den Weiterkommer als
Sieger (steht woertlich in allen 282 gemessenen Marktregeln), Betfair
erklaert Match-Odds bei nicht zu Ende gespieltem Match fuer ungueltig.
In dem Fall zerfaellt die Absicherung: eine Seite gewinnt oder verliert
ALLEIN. Walkover (Rueckzug VOR Beginn): Polymarket 50-50, Betfair void.
Aufgaben sind im Tennis nicht selten (ITF-Ebene mehr als ATP/WTA).
Steht auch in logik.html.

**Deploy noetig:** DEPLOY-JETZT.cmd (rollt orion-lauf aus, macht den
Tennis-Probelauf) UND EINMAL supabase/wache-tennis-turnier.sql im
SQL-Editor. Reihenfolge egal, beides vor dem ersten Tennis-Fund.

### Schwellen: gemessen — die Zahl rechtfertigt den Bau NICHT

Auftrag: erst messen, wie viele Kalshi-Schwellen ein Polymarket-
Gegenstueck mit gleicher Basisgroesse UND Stichzeit haben; klein heisst
nicht bauen. Gemessen am 19.8. (Schnappschuss id=2, 696 auswertbare
Schwellen; Polymarket ueber die Register-Tags PLUS stocks/commodities):

    Indizes (Dow/S&P/Nasdaq, 356 = groesster Block):  0 Gegenstuecke
      (Polymarket fuehrt keine Intraday-Index-Schwellen)
    Rohstoffe ausser WTI (Gold/Silber/Gas/Kupfer/Brent, 233):  0
      (Polymarket fragt Monats-HOCH/TIEF — "hit $67 in August" ist eine
      ANDERE Frage als Kalshis "Tagesschluss ueber $67")
    Wetter (20):  0  (Polymarket: globale Temperatur je Monat, Kalshi:
      Tageshoechstwert je Stadt — andere Basisgroesse)
    Krypto BTC/ETH-Stundenmaerkte:  8 exakte Paare um 13:07 —
      und 0 um 13:50. Beide Buecher legen die Schwellen um den
      wandernden Kurs; die Ueberlappung ist FLUECHTIG und einstellig.
    WTI-Tagessettlement:  ~18 Paare ueber zwei Tage ("Above $83.99
      settlement" gegen "closes above $84 on August 19") — aber NUR
      ueber den Tag `commodities`, der NICHT im Register steht, und
      mit Sonderregel (Kalshi schliesst 18:30Z, Polymarket 21:00Z —
      dasselbe Settlement, Zuordnung muesste ueber den Kalendertag).

**Urteil: NICHT gebaut.** ~26 von 696 (unter 4 %), davon 8 fluechtig.
Der Bau waere gross: Schwellen haben keine Partie, der ganze
Durchgang-1-Fluss haengt an `paar(titel)` — es braeuchte eine neue
Marktart mit eigenem Paarungsweg, neue Tags im Register und je
Kategorie eigene Stichzeitregeln (8l-Matrix). Die Rendite ist
ungemessen und bei Kalshis 7-%-Krypto-Gebuehr fraglich.

**Falls Karam doch will:** der einzige tragfaehige Kandidat ist das
WTI-Settlement (18 stabile Paare/2 Tage, dieselbe Frage, belegbare
Stichzeit). Das waere ein eigener, kleiner, messbarer Bau — Tag
`commodities` ins Register, Marktart "schwelle" nur fuer diesen Weg,
Kalendertag-Zuordnung. Vorher Renditeprobe ueber ein paar Tage.

---

## 8r. TELEGRAM, WAEHRUNG, BEITRAGSSEITE, DESIGN-RUECKBAU (19.-20.8.)

Kompakt — die Einzelheiten stehen in den Commits und in
bridge/NAECHSTE-SITZUNG.txt.

**TELEGRAM-MELDER** (orion-melder-telegram, Takt Job 92 minuetlich):
Zwilling des Mail-Melders, Ziel = Karams Direktchat mit dem Bot
(orion_telegram id=1, Geheimnis TELEGRAM_BOT_TOKEN). Nachricht mit
Farbpunkten je Buch (Panel-Farben), Direktlinks zu beiden Anbietern,
Minirechnung, Beitragslink. **v6 nach zwei Fehlalarmen in der ersten
Nacht verschaerft** (Cincinnati, Buchsumme 1,0088 — der Melder pruefte
das Wache-Urteil nicht): jetzt pruefung=leer PFLICHT, Buchsummen-
Doppelgurt, Bewaehrung 120 s. {"einrichten":true} listet Chats,
{"test":true} funkt ein Muster.

**WAEHRUNG BEIDSEITIG** (Vorgabe: zwei Buecher fuehren Dollar, zwei
Euro): geld() zeigt immer beide — "81,40 EUR ($ 94,00)". Dabei
Bestandsfehler behoben: die Aufteilungszeile drehte die waehrungsfreien
Anteile durch den Kurs (Summe 86 statt 100). UNGEMESSEN offen: die
Waehrung der Betfair-MENGEN (bs/ls) aus der Bridge (= Kontowaehrung).

**BEITRAGSSEITE + SPEICHER**: beitrag.html?fund=<schluessel> zeigt
genau eine Karte (5-s-Takt, Zurueck-Knopf); der Telegram-Link fuehrt
dorthin. Speichern-Knopf auf jeder Karte legt den SCHNAPPSCHUSS in
orion_gespeichert (RLS, anon lesen/anlegen/loeschen); gespeichert.html
zeigt den Bestand, Menuelink im Panel. js/speicher.js, Anzeige.setzeKurs
exportiert.

**DESIGN-RUECKBAU 20.8.** (Karams Vorgabe "viel schlichter, den
Bloedsinn loeschen"): buehne.js + partikel.js GELOESCHT — Flanken samt
Wacht/Jets/Raketen/Boom, Kino, Partikel, Scroll-Aufbau. 94 CSS-Regeln
+ 21 Keyframes raus (stil.css 2923 -> 2676 Zeilen). Der
Animationsstufen-Schalter ueberlebte als js/anim.js (drosselt
Radar/LED/Avatar — Funktion, keine Deko). ORANGE ist abgeschafft:
Token --orange traegt Scanner-Tuerkis #7FC2B6 (Papier-Modus #2A6459),
die Statistik-Ausnahme vom 18.8. ist aufgehoben. Bestandsfunde:
zuordnung.test.js stand seit der Zeitpflicht rot (repariert);
ein nie geschlossener CSS-Kommentar verschluckte eine Regel.

**AUFRAEUM-TAKT** Job 91 (taeglich 03:20): cron-Protokoll 3 Tage,
orion_laeufe/orion_wache 30 Tage. Datenbank 191 -> 98 MB von 500.

**Bridge-Waechter** laeuft jede Minute UNSICHTBAR
(Orion-Waechter-Leise.vbs; das minuetliche Terminal-Aufblitzen war
der sichtbare cmd-Aufruf). Der Starter erzeugt die vbs selbst.

**MORGEN (Karams Ansage vom 20.8. abends):** User Experience,
Administratives, Promotion — eine LANDINGPAGE fuer das Programm und
die Frage, wie alles angezeigt wird. Funktionsbau nur auf Ansage.

---

## 8s. LANDINGPAGE, UX-DURCHGANG, ZWEI BESTANDSFUNDE (20.8., Abendphase)

Auftrag: „User Experience, Administratives, Promotion", anfangen mit einer
Landingpage; Funktionsbau nur auf Ansage. Gemessen wurde vor dem Bau, und
was Funktion ist, wurde NICHT angefasst, sondern belegt und gemeldet.

### Gebaut: start.html + css/start.css

Vollstaendig additiv, zwei neue Dateien, am Panel **null Aenderungen** dafuer.
Die Seite spricht weder mit Supabase noch mit der Bridge (im Browser
nachgemessen: ausser der eigenen CSS-Datei und den Hausschriften stellt sie
KEINE einzige Netzanfrage), traegt `noindex` wie alle anderen Seiten,
`robots.txt` bleibt `Disallow: /`.

Aufbau: Kopf mit Wappen und vier nackten Merkzahlen, dann „Der Gegenstand"
(warum das Paaren und nicht das Rechnen der schwierige Teil ist), „Der
Bestand" (zwoelf Faehigkeiten als Raster), „Der Weg eines Fundes"
(Sammeln, Paaren, Rechnen, Nachpruefen, Melden), „Klartext" (fuenf Punkte,
was das Programm ausdruecklich NICHT tut) und „Zugang".

Bewusste Festlegungen, weil auf die drei Rueckfragen keine Antwort kam:
- **Ort:** eigene `start.html`, das Panel bleibt unangetastet auf
  `index.html`. Nichts bricht: keine Telegram-Links, keine Lesezeichen,
  keine Bridge-Pruefung.
- **Ton:** die Sache wird sachlich benannt, **die vier Anbieter aber nicht**.
  Es steht „vier Boersen", nirgends ein Anbietername, nirgends ein Logo,
  nirgends eine Renditezahl. Wer Klartext will, sagt es; das sind
  Textzeilen, keine Struktur.
- **Sichtbarkeit:** alles bleibt gesperrt. Die Landing ist nur ueber den
  Link erreichbar, den Karam selbst weitergibt.
- **Kein Rueckweg ins Menue:** die Landing verlinkt zum Panel, das Panel
  nicht zur Landing. Sonst haette der Gefechtsstand einen dreizehnten Knopf
  fuer etwas, das im Betrieb niemand braucht.
- **Verlinkt sind nur kennwortfreie Seiten** (angaben, regelwerk). `logik.html`
  bewusst nicht: sie laedt `sperre.js`, der Leser waere in die Kennwortwand
  gelaufen.

Gegengeprueft im Browser: Farben identisch mit den Panel-Tokens
(#0A1220 / #0E1B2A / #7FD4FF), 12 Felder, 5 Stufen, drei Links, alle intern,
kein Querscrollen, bei 375 px steht kein einziges Element ueber.

### UX repariert: die Cache-Marken liefen auseinander

**Gemessen:** index/beitrag/gespeichert standen auf `v=71`, aber
angaben/logik/knoepfe/regelwerk/einstellungen auf `v=54` (CSS) und `v=22`
(JS). Wirkung: wer eine dieser Seiten schon einmal besucht hatte, bekam
`stil.css` **aus dem alten Cache**, also die Farbwelt von VOR dem Rueckbau
vom 20.8. Das abgeschaffte Orange lebte dort weiter. Schlimmer noch bei
`js/sperre.js?v=22`: das ist das Kennwort-Tor, ausgeliefert in einer
Fassung von vor dem 19.8.

Das ist genau die bekannte Fehlerklasse „Drift zwischen zwei Fassungen",
nur diesmal nicht im Code, sondern in der Auslieferung.

**Behoben:** alle Betriebsseiten stehen auf einer gemeinsamen Marke.
(Am selben Tag noch zweimal weitergezogen: 8t hob sie auf `v=72`, der
Egress-Feldzug auf **`v=74`**, das ist der Stand beim Push.)
`muster-hud.html` bleibt auf `v=52` (Musterseite, nicht im Betrieb, nirgends verlinkt).
REGEL, jetzt in STRUKTUR.md: wird eine gemeinsame Datei geaendert, ziehen
ALLE Seiten ihre Marke mit.

### UX repariert: toter Doppel-Link

`bridge-setup.html` trug in der Kopfleiste zwei Links auf dasselbe Ziel,
einer davon unter dem Namen „Alle Funktionen" -- Rest der am 15.8.
geloeschten `funktionen.html`. Entfernt.

### BESTANDSFUND 1, NICHT REPARIERT (Funktion, wartet auf Ansage)

**`bridge-setup.html` kann das Bridge-Token nicht mehr anzeigen.**

Belegt im Browser, nicht vermutet:

    GET /config.js?v=22            -> 404 File not found
    Uncaught TypeError: window.arRequireAuth is not a function
                                      (bridge-setup.html:340)
    tokIn   = "…wird geladen…"     (steht dauerhaft so da)
    tokShow = "…"

`config.js` gibt es im ganzen Repo nicht; `arRequireAuth` kommt genau
einmal vor, naemlich beim Aufruf. Beides ist Altlast aus dem
Vorgaenger-Repo. Der Statusteil derselben Seite laeuft einwandfrei (er
meldete im Test korrekt „Bridge laeuft, Fassung 27, aktuell") -- nur die
Anmeldung und damit `SB.rpc('my_bridge_token')` laufen nie.

**Wirkung:** wer die Bridge nach der eigenen Anleitung einrichten will,
kommt beim Schritt „Dein persoenliches Bridge-Token" nicht weiter. Fuer
Karam selbst folgenlos, solange sein Token im bestehenden
`bridge-config.json` steht.

**Vorschlag (nicht ausgefuehrt):** die Anmeldung dort auf denselben Weg
legen, den `sperre.js` ohnehin geht, statt eine Datei zu laden, die es
nicht gibt. Das ist Funktion und wartet auf ausdrueckliche Ansage.

### BESTANDSFUND 2, NICHT REPARIERT (beruehrt die laufende Bridge)

**`version.json` hinkt acht Builds hinterher.**

    version.json:  bridgeBuild 19, bridgeVersion "3.8",
                   exe -> Release bridge-v19
    Laptop:        Orion-Bridge-Pro-27.js, VERSION '4.0', BUILD 27

Die Datei ist die Stelle, gegen die sich **Website UND Bridge beide
pruefen** (steht so in ihrem eigenen Hinweistext). Zwei Folgen: eine
Bridge mit Build 20 bekaeme faelschlich „aktuell" gemeldet, und der
Herunterladen-Knopf liefert eine exe von Build 19.

**Nicht angefasst**, weil die harte Regel gilt: laufende Bridges duerfen
bei Updates nie brechen. Das gehoert gemeinsam entschieden -- entweder
Datei nachziehen UND ein Release bridge-v27 hochladen, oder den
exe-Knopf ausbauen, falls der Node-Weg jetzt der einzige ist.

### Beide Pflichtpruefungen vor der Abgabe

    node pruefung/spiegel.test.js       19896 von 19896   gruen
    node pruefung/vollpruefung.test.js  36 von 36         gruen

Erwartungsgemaess unveraendert: an Logik wurde nichts angefasst. Gelaufen
sind sie trotzdem, weil die Regel keine Ausnahme fuer „ist ja nur Design"
kennt.

---

## 8t. DATUMSSTEMPEL + ZWEITER BOT „KNAPPE PAARE" (20.8., Mittagsphase)

### Nachtbilanz, gemessen

Karams Frage „war ueber Nacht wirklich nichts?" aus den Buechern
beantwortet: Melder lief 720 von 720 Laeufen fehlerfrei, null Meldungen
seit der v6-Verschaerfung (die 3 markierten Zeilen sind die bekannten
Cincinnati-Fehlalarme von VOR der Verschaerfung). 260 neue Zeilen, 66 mit
Spitze ueber 2 % — 64 davon ueber 5 % (Messlehre: falsch), die zwei
plausiblen (4,91 % / 3,07 %) hat die Wache mit Buchsumme ueber 1
ueberfuehrt. Die Stille war das korrekte Ergebnis.

### Datumsstempel (Vorgabe Karam)

`uhrzeit()` in js/anzeige.js: Eintraege von HEUTE zeigen die Uhrzeit,
aeltere zeigen NUR noch das Datum („19.08.") statt Datum+Uhrzeit. Volle
Angabe bleibt im Tooltip (`zeitpunkt()`), ebenso in den „Gefunden:"-Zeilen.
Cache-Marke aller Betriebsseiten: v=71 -> **v=72**.

### Zweiter Telegram-Bot: orion-melder-knapp v1

Auftrag: „ein Bot fuer die Chance und ein Bot fuer die knappsten Paare".
GEMESSEN vor dem Bau (24 h, gepruefte und 120 s bewaehrte Zeilen):
Band -0,25..0 %: 1 | -0,5..-0,25 %: 5 | -1..-0,5 %: 34 | 0..2 %: 0.
Deshalb Band **rendite -0,5 bis unter 2** (~6 Meldungen/Tag); bis -1
waeren 40/Tag gewesen — Spam, bewusst nicht gebaut.

Bauweise: Drilling von orion-melder-telegram v6 mit eigenem Geheimnis
(TELEGRAM_BOT_TOKEN_KNAPP), eigener Zielzeile (orion_telegram id=2,
angelegt, aktiv=false) und eigener Markierungsspalte
(orion_funde.knapp_gemeldet, angelegt). Gleiche Schutzgurte: pruefung
leer, 120 s Bewaehrung, einmal je Fund; Buchsummen-Deckel 1,02. Die
Nachricht sagt ehrlich „noch keine Chance" und nennt den Abstand zur
Gewinnzone. Ohne Geheimnis antwortet die Funktion ehrlich
(„TELEGRAM_BOT_TOKEN_KNAPP fehlt") — getestet.

**ERLEDIGT (Nachmittagsphase):** Karam hat Bot (@OrionKnappBot) und
Geheimnis angelegt; einrichten zeigte den Bot per getMe (v3 nennt jetzt
den Bot hinter dem Schluessel — ein falscher Token fliegt sofort auf),
chat_id 6795362180 nach orion_telegram id=2, Funkprobe zugestellt,
Takt-Job 93 **orion-knapp-takt** laeuft `*/5 * * * *` (bewusst
5-minuetlich, siehe Egress-Kapitel).

### EGRESS-BREMSE: Supabase drohte Drosselung ab 21.8.

Karams Meldung: ab 21.8. Drosselung des Kontos, Limits ueberschritten.
GEMESSEN (Logs 24 h + Antwortgroessen): der Verlauf wog **2 MB je
Abruf** und wurde bei offenem Panel **alle 10 s** geholt — 12 MB/min,
bis 700 MB je Stunde Panelbetrieb; dazu Fussball-Takt alle 20 s mit
85-KB-Marktlisten (orion_bf_maerkte) je Lauf. Das Free-Limit sind 5 GB
Datenabfluss im Monat. Das zweite Projekt (orion-pruefstand) ist
unschuldig: 7 Logzeilen in 24 h.

Behoben, Funktion unangetastet:
1. holeVerlauf: 1000 Zeilen alle 10 s -> **400 Zeilen alle 60 s**
   (Anzeige zeigt ~160; Verlauf aendert sich nur, wenn etwas endet).
2. Job 73 orion-lauf-fussball: `20 seconds` -> zunaechst minuetlich.
3. Knapp-Takt bewusst */5 statt minuetlich.

### EGRESS-FELDZUG II (gleicher Tag, spaeter): der Zaehlerstand kam

Karam lieferte die Zahlen: **Egress 16,9 von 5 GB = 339 %**, ALLE
anderen Zaehler gruen (DB 24 %, Aufrufe 22 %). Sein Befehl: Gratis-Plan
MUSS halten, gleiche Scan-Qualitaet, notfalls Verlauf nach einem Tag
loeschen; Laptop/eigener Server nur als Zukunftsgedanke, Supabase hat
Prioritaet.

GEMESSEN: jeder Bereichslauf holte den GANZEN Kalshi-Schnappschuss
(208 KB, ~90 % wurden im Edge-Code weggeworfen) und der Fussball-Lauf
zusaetzlich den ganzen Smarkets-Schnappschuss (484 KB, Quoten mit 16
Gleitkomma-Stellen). Alle 946 Smarkets-Maerkte liegen im Fenster, ein
Zeitfilter braechte nichts.

Gebaut (orion-lauf **v26**, Trockenlauf bestanden: Kalshi fussball
36 = 36, Gurt meldet 0 Fremde, alle 9 Paarungsrichtungen liefern,
Tennis laeuft):
1. RPC **orion_kalshi_maerkte(bereich_p)**: Datenbank filtert je
   Bereich VOR dem Versand, ueber den BESTEHENDEN dritten
   Zuordnungsweg orion_bereich_kalshi — keine neue Logik, 11 statt
   208 KB. TS-Gurt bleibt.
2. RPC **orion_sm_maerkte()**: Quoten auf 6 Stellen gerundet
   (484 -> 437 KB), Inhalt sonst identisch.
3. Job 73 fussball auf **alle 2 Minuten** (Takt der Boersensammler
   kalshi/smarkets */2 — dazwischen kaemen identische Boersendaten;
   Bewaehrung ist 120 s, Wache minuetlich).
4. Browser: holeLive in 15-s-Puffer (Scanner schreibt hoechstens alle
   1-2 min); Sofort-ablesen-Knopf leert die Puffer ehrlich
   (Daten.frisch()).
5. **Verlauf-Loeschung nach 24 h** (Karams Freigabe) im Aufraeum-Takt
   Job 91; Erstlauf sofort ausgefuehrt: 1367 Zeilen weg, Live und
   orion_gespeichert unberuehrt.
Textstellen (index/angaben/logik/start/puls/anzeige/daten) auf
\"alle 2 Minuten\" nachgezogen, Cache v=74.

EHRLICH OFFEN: der Monat ist schon gerissen — Supabase kann bis zum
Zyklusende trotzdem drosseln, die Bremsen wirken auf die ZUKUNFT.
Erwarteter Verbrauch nach Bremsen: grob 100-150 MB/Tag, also 3-4,5 GB/
Monat — knapp unter der Grenze; naechste Tage am Zaehler NACHMESSEN.
NOTFALLPLAN (nur dokumentiert, nicht gebaut): alles auf einen
dauerlaufenden Laptop/Server umziehen, Preis: Geraet muss 24/7 an sein,
und der Kernvorteil (laeuft bei ausgeschaltetem Geraet) faellt.

---

## 8u. JEDER LINK INS EIGENE HAUS + EIGENE SEITE JE KARTE (20.8., Abend)

Karams Ansage: „kannst du bitte so machen, dass diese Links, die verlinkt
werden, nicht die von den Anbietern, sondern die von Pro sind, dass du
direkt zu diesem Angebot kommst und es einfach so ein eigener Bereich
ist. Und wenn man auf eine Chance drueckt, dass man auf eine eigene Page
kommt, dass man sich nicht dafuer durchscrollen muss."

### Was vorher war, gemessen

Beide Telegram-Bots schickten drei Links je Meldung. **Zwei davon fuehrten
direkt zum Anbieter** (`pm_link`, `bf_link`), nur der dritte auf
beitrag.html. Damit landete der Leser mit einem Klick bei Polymarket oder
Smarkets, ohne dass irgendjemand den Kurs nochmal angesehen hatte.

Das ist die gefaehrliche Richtung: der Kurs in der Telegram-Nachricht ist
**eingefroren im Moment des Versands**, der auf der Seite laeuft weiter.
Zwischen Meldung und Klick koennen Minuten liegen. Wer direkt beim
Anbieter landet, setzt gegen eine Zahl, die niemand mehr geprueft hat.

### Gebaut

1. **Beide Bots**: die zwei Buchzeilen zeigen jetzt auf
   `beitrag.html?fund=<schluessel>&zu=1` bzw. `&zu=2` statt auf den
   Anbieter. Beschriftung „ansehen" statt „oeffnen", sie tut jetzt auch
   etwas anderes. Die Schlusszeile sagt ausdruecklich, dass alle Links
   dorthin fuehren und der Absprung auf der Seite steht.
2. **beitrag.html** versteht `?zu=1` / `?zu=2` und zeichnet darueber einen
   ZIELBLOCK: welches Buch gemeint war, welche Seite (JA/Lay/Back/UNTER),
   und der Absprung zum Anbieter als **eigener Klick**, mit der Warnung,
   dass die Kurse darunter der Stand von jetzt sind. Alles andere im
   `zu`-Feld wird ignoriert statt geraten (geprueft mit `zu=9`).
3. **Jede Karte im Panel** traegt als ersten Knopf „▤ Eigene Seite" und
   fuehrt auf beitrag.html. Damit ist Karams zweiter Punkt erledigt: man
   scrollt nicht mehr durch eine Liste bildschirmhoher Karten. Auf
   beitrag.html selbst faellt der Knopf weg (Pfaderkennung, keine Fahne,
   die jemand zu setzen vergisst).
4. `buch1`/`buch2` aus anzeige.js **exportiert**, damit der Zielblock
   denselben Buchnamen und denselben Broker-Umweg nennt wie die Karte.
   Eine zweite Namenstabelle waere genau die Doppelwahrheit, gegen die
   hier sonst gearbeitet wird. Belegt: Betfair-Fall zeigt korrekt
   „Betfair ueber Orbit oeffnen".

### Bestandsfund: der Knapp-Bot lag NICHT im Repo

`orion-melder-knapp` existierte nur als ausgerollte Edge-Funktion auf dem
Server. Im Repo fehlte er ganz. Ein Neuaufsetzen haette ihn verloren, und
niemand haette es gemerkt, weil er weiterlaeuft. Jetzt liegt er unter
`supabase/functions/orion-melder-knapp/index.ts`.

### DEPLOY IST DURCH, ueber die MCP-Verbindung

    orion-melder-telegram   Version 7 -> 8
    orion-melder-knapp      Version 3 -> 4

**Der erste Fehlschlag lag an mir, nicht am Werkzeug.** Beim ersten
ToolSearch kam das Schema der Deploy-Funktion LEER zurueck
(`parameters: {type: object}`, ohne Eigenschaften); ohne Schema wurde
mein Dateiarray als Text durchgereicht, und der Server lehnte ab
("expected array, received string"). Ich habe daraus geschlossen, der
Weg sei versperrt, und das auch so gemeldet. Beim zweiten Laden kam das
volle Schema mit `files: {type: array}` und derselbe Aufruf ging durch.

LEHRE: eine Fehlermeldung ueber ein FORMAT ist kein Beleg, dass ein Weg
verschlossen ist. Erst pruefen, ob die eigene Uebergabe stimmt, bevor
man einen Weg fuer tot erklaert. Vorher noch das JSON maschinell bauen
und zurueckrechnen lassen (Laenge, Rueckvergleich, rohe Steuerzeichen)
statt es von Hand zu schreiben.

**Nachgelesen im AUSGEROLLTEN Servercode** (nicht im Repo-Stand): beide
Bots tragen jetzt `<a href="${beitrag}&amp;zu=1">ansehen</a>` und
`&amp;zu=2`. Beide Funkproben zugestellt, Kanal 6795362180, je
`{"ok":true,"funkprobe":"gesendet"}`.

**`DEPLOY-MELDER.cmd`** bleibt trotzdem liegen (Repo `bridge/` und
Arbeitskopie in `Desktop\ORION-BRIDGE`): der Doppelklick-Weg fuer den
Fall, dass die MCP-Verbindung mal fehlt. Er rollt beide Bots aus und
funkt danach beide Proben.

### Zwei eigene Fehler, festgehalten

- Im Kopfkommentar des Knapp-Bots stand die Cron-Schreibweise im
  Klartext. Der Stern-Schraegstrich darin **schliesst den
  Blockkommentar** mitten im Satz, die Datei waere beim Deploy
  gescheitert. Selbst gefunden und behoben, aber es zeigt: auch ein
  Kommentar ist Code.
- Danach ein Pruefwerkzeug gebaut, das genau diese Klasse fangen sollte.
  Es taugte nichts: die Gegenprobe blieb gruen (der Fehler erzeugt keinen
  unbalancierten Zustand, sondern gueltigen Unsinn), und an den echten
  Dateien meldete es drei Falsch-Positive, weil es Regex-Literale wie
  `/"/g` fuer Zeichenketten hielt. **Weggeworfen statt geflickt.** Ein
  Werkzeug, das mehr Fehlalarme erzeugt als es faengt, ist schlimmer als
  keines, man gewoehnt sich an rote Meldungen.

### Nachgemessen

    spiegel.test.js       19896 / 19896   gruen
    vollpruefung.test.js  36 / 36         gruen
    zuordnung.test.js     296 / 296       gruen
    rechnung.test.js      195 / 195       gruen

Am lebenden Panel gegen echte Funde geprueft: `zu=1` Polymarket,
`zu=2` Smarkets und Polymarket (je nach Buchreihenfolge des Funds),
ohne `zu` kein Block, `zu=9` kein Block. Cache-Marke **v=74 -> v=75**
auf allen neun Betriebsseiten (anzeige.js ist eine gemeinsame Datei).

### AUCH KORRIGIERT: das Gedaechtnis stand auf Build 21

Der Eintrag `orion-bridge-betrieb` nannte Bridge-Build **21** und den
laengst geloeschten Ordner `C:\Users\Home\OrionBridge`, waehrend
`orion-bridge-ordner` den richtigen Desktop-Pfad fuehrte. Zwei
Gedaechtniseintraege ueber dieselbe Sache mit verschiedenen Staenden
sind schlimmer als einer. In der Programmdatei nachgesehen und auf
**4.0 / Build 27** richtiggestellt.

---

## 8v. DAS TOR WAR NIE ANGESCHALTET (21.8., Karams Fund)

Karams Meldung: „wenn man den Link bei der Nachricht oeffnet, dass man
diesen Code eingeben kann, den normalen Code fuer das Programm, aber es
funktioniert irgendwie nicht."

### Der Befund

`beitrag.html` und `gespeichert.html` **luden** `sperre.js`, riefen aber
nie `Sperre.start()` auf. Ohne diesen Aufruf bekommt der Oeffnen-Knopf
keinen Horcher: man tippt das Wort, drueckt, und es passiert **nichts**.
Keine Meldung, kein Fehler, keine Reaktion.

Gemessen am lebenden Objekt:

    Overlay vorhanden      ja
    position               fixed
    z-index                2147483647
    was unter dem Mauszeiger liegt, wo der Absprung-Knopf steht:  "sperre"

Das Overlay deckt die ganze Seite und schluckt jeden Klick. Der Inhalt
darunter wurde korrekt gezeichnet, war aber unerreichbar.

Sechs Seiten laden `sperre.js`. Vier riefen richtig auf (index ueber
app.js, einstellungen ueber einstellungen.js, knoepfe und logik direkt),
**zwei nicht**.

### Warum das besonders teuer war

Seit dem 20.8. (8u) fuehrt **jeder Link aus beiden Telegram-Bots** auf
`beitrag.html`. Der ganze Link-Umbau lief also gegen eine verschlossene
Tuer. Der Umbau selbst war richtig, nur kam niemand dahinter.

### Mein Anteil daran, klar benannt

Ich habe den Umbau am 20.8. fuer geprueft erklaert. Geprueft hatte ich
aber nur DOM-Werte im iframe: Zielblock da, Karte da, Buchname richtig.
Alles stimmte auch. Was ich nicht geprueft habe: ob die Seite
**bedienbar** ist. Ein Blick auf die Seite haette das Overlay sofort
gezeigt.

LEHRE: „das Element ist im DOM" ist nicht „der Nutzer kommt dran".
Bei einer Seite, die ein Overlay kennt, gehoert die Frage dazu, was
ueber dem Inhalt liegt, nicht nur ob der Inhalt existiert.

### Repariert und nachgewiesen

Beide Seiten starten das Tor jetzt und laden ihre Daten ERST danach
(vorher hat die Seite nichts anzuzeigen, und eine Abfrage fuer jemanden
ohne Wort ist obendrein verschenkter Datenabfluss).

    falsches Wort eingetippt   -> Overlay bleibt, Meldung "Falsch."
    Zugang im Speicher, beitrag -> Overlay weg, Karte UND Zielblock da
    Zugang im Speicher, gespeichert -> Overlay weg, Bestand geladen

Kontrolle ueber alle sechs Seiten: jede, die `sperre.js` laedt, ruft
jetzt auch `Sperre.start()`.

    spiegel 19896/19896 · vollpruefung 36/36 · zuordnung 296/296
    rechnung 195/195   alle gruen

### Die allgemeine Regel daraus

**Eine Datei zu LADEN heisst nicht, sie zu BENUTZEN.** Ein
`<script src=...>` sieht nach Funktion aus und ist doch nur eine
Lieferung. Wer `sperre.js` einbindet, ruft auch `Sperre.start()`.
Dasselbe gilt fuer jede andere Schicht, die einen Startaufruf braucht.

---

## 8w. SCAN-DURCHSICHT 7 TAGE + EINE PARTIE, EINE MELDUNG (21.8.)

### Wie gescannt wurde, gemessen

| Tag | Funde | Partien | gesperrt | Spitze ueber 2 % | gemeldet |
|---|---|---|---|---|---|
| 18.8. | 2 | 1 | 100 % | 2 | 0 |
| 19.8. | 220 | 46 | 100 % | 10 | 3 Chancen |
| 20.8. | 228 | 63 | 90 % | 3 | 11 knapp |

Zwoelf Paarungsrichtungen im Betrieb, alle vier Buecher kreuzen.

### Die 90 bis 100 Prozent Sperrquote sind KEIN Fehler

Erst sah es nach einem aus. Aufgeschluesselt nach Sperrgrund loest es
sich auf: von 400 Sperren durch die Wache sind

    186  "Anpfiff ist vorbei"          normale Alterung
     87  "Anpfiff in unter N Minuten"  normale Alterung
     74  "Anpfiff nicht belegt"        Zeitpflicht greift
     30  "Widerspruch: Buchsumme"      echter Fang
     15  "Widerlegt im Hoechststand"   echter Fang, mit Beleg
      3  "Mannschaftsklasse ungleich"  echter Fang

68 % sind schlicht der Lebenszyklus: eine Zeile lebt, das Spiel faengt
an, sie wird geschlossen. Im Schnitt 17 Stunden nach dem ersten Sehen.
**Die hohe Quote ist die Wache bei der Arbeit, nicht ein Fehler.**

### Was daran WIRKLICH auffaellt

Sieben Meldungen gingen an Zeilen raus, die die Wache SPAETER widerlegt
hat: 4 bei "Anpfiff vorbei" (harmlos, das Spiel lief einfach an),
**2 bei "Widerspruch Buchsumme" und 1 bei "Widerlegt im Hoechststand"**.
Die drei letzten sind echte Fehlalarme: die Meldung behauptete einen
Vorteil, den es nicht gab.

OFFEN, nicht gebaut: ein WIDERRUF. Wird eine bereits gemeldete Zeile
spaeter widerlegt, koennte der Bot eine zweite Nachricht schicken
("die Chance von 21:04 war keine, Grund X"). Heute erfaehrt Karam es
nie. Das waere der naechste ehrliche Schritt.

### GEBAUT: eine Partie, eine Meldung

Karams Beobachtung, woertlich: "immer die gleiche Benachrichtigung".
Gemessen stimmte das genau:

    Botafogo FR vs. CS Cienciano   5 Knapp-Meldungen fuer EIN Spiel
      betfair>polymarket, kalshi>betfair, kalshi>smarkets,
      polymarket>betfair, smarkets>betfair
    LDU de Quito vs. Mirassol FC   3 Meldungen
    FC Cincinnati vs. NYC FC       2 Meldungen

Jede Zeile war fuer sich richtig. Als Nachricht war es dasselbe
Ereignis, fuenfmal.

Beide Bots gruppieren jetzt nach `titel` und melden die BESTE Zeile je
Partie. Die uebrigen werden in der Nachricht genannt ("steht noch ueber
N weitere Buchpaarungen im Panel") und MITMARKIERT, damit sie nicht im
naechsten Takt einzeln nachkommen. Die Antwort meldet beides getrennt:
`gemeldet` (Nachrichten) und `zeilen_markiert` (Zeilen).

Geprueft mit fuenf Faellen gegen den echten Botafogo-Datensatz: aus 5
wird 1, die beste (-0,13) gewinnt, 4 weitere werden genannt;
verschiedene Partien fallen NICHT zusammen; Einzelfund bleibt
unveraendert; leere Liste stuerzt nicht ab; bei gleicher Rendite
gewinnt genau eine.

    orion-melder-telegram   Version 8 -> 9
    orion-melder-knapp      Version 4 -> 5
    beide Funkproben zugestellt

### NICHT gebaut, mit Begruendung

**Die 0,05-Schwelle in `orion_verlauf_urteil`.** Sie steht auf
`>= 0.05` und meint damit 0,05 Prozent, waehrend 8p ausdruecklich
"ueber 5 %" sagt. Gemessen: 17 von 19 "zweifelhaft"-Urteilen betreffen
Spitzen unter 5 %, 15 davon unter 1 %, die kleinste 0,064 %. Der Fund
steht.

Umgesetzt habe ich ihn NICHT: die Korrektur wuerde die Wache
LOCKERER machen, und das ist keine Richtung, die ich ohne eigene
Freigabe gehe. Eine zu strenge Wache kostet Aufmerksamkeit, eine zu
milde kostet Geld.

**Der offene Buchsummen-Gurt.** Beide Bots lassen `buch_summe IS NULL`
durch, gedacht fuer die eine Minute vor der Messung. Gemessen bleiben
Zeilen aber STUNDEN ohne Buchsumme (eine stand 199 min). Auch das ist
eine Verschaerfungsfrage und wartet auf Ansage.

### Ein Fehlalarm von mir, festgehalten

Ich hatte 113 Zeilen mit "arithmetisch unmoeglicher Quote unter 1"
gefunden und war dabei, das als schweren Fund zu melden. Falsch:
`pm_preis` und `bf_quote` tragen nicht Polymarket und Betfair, sondern
**buch_1 und buch**. Nachgemessen liegt alles im richtigen Bereich
(polymarket 0,010-0,979 als Preis, smarkets 1,020-95,238 als Quote).

Genau die Fehlerklasse, vor der dieses Projekt sonst warnt: einen
Feldnamen fuer die Wahrheit halten, statt nachzusehen, was drinsteht.

---

## 8x. CLAUDE.md UND DER FUENFTE PRUEFSTAND (21.8.)

Karams Ansage: „Fueg alles hinzu, was du hinzufuegen kannst."

### CLAUDE.md, neu

Das Projekt hatte **keine** `CLAUDE.md`. Jede neue Sitzung musste sich
die Regeln aus 110 KB `UEBERGABE.md` zusammensuchen, und was dabei
untergeht, gilt in der naechsten Sitzung nicht mehr. Jetzt liegt eine
Kurzfassung im Wurzelverzeichnis, die AUTOMATISCH in jeder Sitzung
geladen wird: Tonfall, die vier eisernen Regeln, die fuenf Pruefstaende,
die Deploy-Wege, die Cache-Marken-Regel, die Design-Regeln inklusive
`elementFromPoint`, die sieben Fehlerklassen und die drei Stellen, an
denen Vorsicht gilt (Egress, Betfair-Mengen, Tennis-Restrisiko).

Sie ersetzt die Uebergabe nicht, sie ist der Einstieg dorthin.

### Neu: Regel 3, aus der heutigen Erfahrung

    Eine Aenderung, die eine Schutzschicht LOCKERER macht (Wache,
    Melde-Filter, Sperren), braucht eine eigene Freigabe, auch wenn
    allgemein "setz die Verbesserungen um" gesagt wurde.

Anlass ist die 0,05-Schwelle: sachlich ein Fund, aber die Korrektur
haette die Wache milder gemacht. Diese Richtung braucht immer eine
ausdrueckliche Ansage.

### pruefung/melder.test.js, der fuenfte Pruefstand

Die Gruppierung von 8w war nur in einem Wegwerf-Skript geprueft. Jetzt
liegt sie im Repo, mit ZWEI Teilen:

  Teil A  VERHALTEN gegen echte Faelle (Botafogo 5 -> 1, verschiedene
          Partien fallen nicht zusammen, Einzelfund, leere Liste,
          Gleichstand)
  Teil B  ABGLEICH: steht in BEIDEN Meldern derselbe Block, markieren
          beide ALLE geholten Zeilen, melden beide die gruppierte Liste

Teil B ist der wichtigere. Die Funktion im Test ist ein NACHBAU; ein
Nachbau, den niemand gegen das Original haelt, ist genau die Drift
zwischen zwei Fassungen. Ohne Teil B bliebe der Test gruen, waehrend
der echte Melder etwas anderes tut.

**Gegenprobe gelaufen** (die Lehre aus dem weggeworfenen Werkzeug von
8u: ein Test, der nie rot wird, ist wertlos): kuenstliche Drift in
orion-melder-knapp eingebaut, Test wird ROT mit Exit-Code 1 und nennt
beide betroffenen Punkte; nach dem Zuruecksetzen wieder gruen mit
Exit-Code 0, Datei Byte fuer Byte wiederhergestellt.

    spiegel 19896 · vollpruefung 36 · zuordnung 296
    rechnung 195 · melder 12 + Abgleich      alle gruen

---

## 8y. ZWEI MELDUNGEN FUER EINE PARTIE + MELDUNG INS LEERE (21.8.)

Karams Meldung: „Durch den Bot zwei Benachrichtigungen bekommen fuer eine
Chance, davon war nix mehr in den Chancen und es war auch nix im
Verlauf." Zwei getrennte Fehler in einem Satz, beide bestaetigt.

### Fehler 1: die Gruppierung verglich Titel BUCHSTAEBLICH

Die Zusammenfassung von 8w gruppierte nach `titel` als Zeichenkette. Das
genuegt nicht, weil dieselbe Partie unter ZWEI Titeln laeuft:

    "Botafogo FR vs. CS Cienciano"
    "Botafogo FR vs. CS Cienciano - More Markets"

Gemessen ueber drei Tage: **164 von 453 Zeilen (36 %)** tragen den
Zusatz. Die Gruppierung sah zwei Partien, wo eine war, und meldete
zweimal.

Behoben mit `partieSchluessel()` in BEIDEN Meldern: schneidet den Zusatz
am Ende ab, ebnet Gross- und Kleinschreibung ein. Abgeschnitten wird NUR
fuer den Vergleich; in der Nachricht steht weiter der volle Titel, denn
er sagt, welcher Markt gemeint ist.

### Fehler 2, der schwerere: der Bot meldete Unauffindbares

„nix in den Chancen und nix im Verlauf" stimmte woertlich. Der Grund
steht in `js/konfig.js`:

    rauschGrenze: 0.0
    /* Ab hier abwaerts ist es Rauschen und wird gar nicht mehr gezeigt. */

Das Panel zeigt eine Zeile nur, wenn sie **aktuell bei mindestens 0**
steht ODER **je eine Chance war** (`besteVon(f) >= mindestRendite`). Der
Knapp-Bot meldete aber ab **-0,5 %**. Alles zwischen -0,5 und 0 war
damit gemeldet und gleichzeitig unsichtbar: nicht in Chancen, nicht in
Knapp, nicht im Verlauf.

Die gemeldeten Botafogo-Zeilen lagen bei -0,10 bis -0,94 %. Genau in der
Luecke.

**Das ist die Fehlerklasse „zwei Wege mit zwei Massstaeben"**, diesmal
zwischen Server und Browser. Die Messung vom 20.8., die das Band
-0,5..2 begruendete, sah nur die DATENBANK und nie das Panel.

Behoben: der Bot richtet sich nach dem Panel, Untergrenze **0**. Eine
Meldung ueber etwas Unauffindbares ist schlimmer als keine Meldung.

**PREIS, ehrlich gesagt:** im 24-h-Fenster vom 20.8. lagen NULL Zeilen im
Band 0..2 %. Der Knapp-Bot wird also selten melden. Wer das aendert,
senkt die `rauschGrenze` im Panel UND zieht die Bot-Zeile mit. Eine
Zahl, zwei Stellen, immer gemeinsam. Der Pruefstand erzwingt das jetzt.

### Der Pruefstand wacht ueber beides

`pruefung/melder.test.js` hat einen dritten Teil bekommen:

    Teil A  Verhalten (jetzt 7 Faelle, neu: der Doppelmeldungs-Fall und
            die Frage, ob der Zusatz nur am ENDE abgeschnitten wird)
    Teil B  Abgleich gegen BEIDE Melder-Dateien: gleicher Block,
            partieSchluessel definiert, gleiche Abschneide-Regel
    Teil C  NEU: liest die rauschGrenze aus js/konfig.js UND die
            Untergrenze aus dem Knapp-Bot und vergleicht sie

Teil C ist der Riegel gegen genau diesen Fehler: laufen die zwei Zahlen
je wieder auseinander, wird der Test rot und sagt es im Klartext
(„Bot ab -0.5, Panel zeigt ab 0").

**Gegenprobe gelaufen:** altes Band -0,5 wieder eingebaut -> ROT,
Exit-Code 1, mit der genannten Meldung. Zurueckgesetzt -> gruen.

    spiegel 19896 · vollpruefung 36 · zuordnung 296
    rechnung 195 · melder 7 Faelle + Abgleich + Schwellenprobe

    orion-melder-telegram   Version 9  -> 10
    orion-melder-knapp      Version 5  -> 6
    beide Funkproben zugestellt, beide echten Laeufe ohne Absturz

### Nebenbefund, NICHT gebaut

24 lebende Zeilen tragen ein `vorbei_grund` („nicht mehr gefunden
(Waechter)"), obwohl sie auf `status='live'` stehen und alle unter fuenf
Minuten frisch sind. Das Feld wird bei der Rueckkehr einer Zeile nicht
geleert und erzaehlt deshalb eine falsche Geschichte. Ausgewertet wird
es derzeit nur bei `status='vorbei'`, ein Schaden entsteht also nicht.
Aufraeumen waere ein eigener kleiner Bau.

---

## 8z. WAS GEMELDET WURDE, VERSCHWINDET NIE (21.8., Karams Kernforderung)

Karams Ansage, woertlich: „Die Chancen muessen immer angezeigt werden,
und wenn ich mich neu einlogge ... dann soll sie angezeigt werden oder in
den Verlauf getan werden. Das ist die erste Wichtigkeit der App."

Er hatte drei Meldungen bekommen; der Verlauf war nicht gewachsen und in
den Chancen stand nichts.

### Gemessen: von acht gemeldeten Zeilen waren ACHT unsichtbar

Nicht eine war irgendwo auffindbar. DREI unabhaengige Loecher, die alle
dasselbe bewirkten:

**1. Die Loeschregel (das schwerste).** `orion_rauschen_loeschen` laeuft
alle FUENF MINUTEN und loeschte jede beendete Zeile mit Spitze unter 0
ohne `falsch`-Urteil. Gemeldete Zeilen fielen genau darunter: beim
Versand knapp ueber der Grenze, danach gesunken, beendet, und fuenf
Minuten spaeter aus der Datenbank verschwunden. Der Telegram-Link zeigte
dann auf „Diesen Fund gibt es nicht mehr in der Datenbank".

**2. Die Verlaufs-Abfrage.** `holeVerlauf` holte nur `pruefung=falsch`
oder `beste_rendite >= 0`. Eine gemeldete Zeile mit negativer Spitze
wurde gar nicht erst geladen.

**3. Die Anzeige-Filter.** In der Live-Ansicht blendete die Rauschgrenze
sie aus; im Verlauf warf `beste < 0 && pruefung !== 'falsch'` sie weg.

### Gebaut: eine Regel, an allen vier Stellen

    Was gemeldet wurde, verschwindet nie.

  - `orion_rauschen_loeschen` verschont gemeldete Zeilen (Migration
    `gemeldete_funde_nie_loeschen`, bereits angewendet)
  - `holeVerlauf` holt gemeldete Zeilen immer mit
  - der Live-Filter zeigt sie vor allen Grenzen
  - der Verlaufs-Filter behaelt sie

Die Loeschregel und der Anzeige-Filter sind bewusst GEKOPPELT: im Code
steht an beiden Stellen der Verweis auf die andere. Sonst zeigt das
Panel etwas an, das die Datenbank fuenf Minuten spaeter wegwirft.

### Nachgemessen am echten Bestand

    vorher:   0 von 8 gemeldeten Zeilen sichtbar
    nachher:  15 von 15 sichtbar

      7 unter Knappste Paare
      7 unter Falsche Rechnungen (die mit Urteil)
      1 im Knapp-Archiv

Und: eine gemeldete Zeile stand beim Messen bereits auf der Loeschliste
des naechsten Takts. Sie ist jetzt geschuetzt.

    spiegel 19896 · vollpruefung 36 · zuordnung 296
    rechnung 195 · melder alle       gruen
    Cache-Marke v=75 -> v=76

### Was das kostet, ehrlich

Gemeldete Zeilen bleiben in der Datenbank, bis der 24-Stunden-Takt
(Job 91) sie mitnimmt. Das ist eine Handvoll Zeilen am Tag, also
praktisch nichts. Der Egress-Feldzug bleibt davon unberuehrt.

**Der 24-Stunden-Takt greift weiter auch bei gemeldeten Zeilen.** Fuer
„ich logge mich neu ein" reicht das; wer laenger zurueckblaettern will,
muss Job 91 anfassen. Das ist Karams Freigabe vom 20.8. und bleibt, bis
er etwas anderes sagt.

---

## 9a. VERTEILER: NICHT MEHR NUR EIN EMPFAENGER (21.8.)

Karams Meldung: „nur ich bekomm das. Jeder, der diesem Bot beigetreten
ist, kriegt die nicht." Auf Nachfrage: Kanal UND Abonnenten, und
„stell sicher, dass jeder Community-Teilnehmer die Meldungen bekommt".

### Der Befund

`orion_telegram` trug GENAU EINE Zeile je Bot, beide mit Karams
chat_id. Der Code holte `id=eq.1` und sendete an diese eine Adresse.
Ein Verteiler existierte nicht.

Beweis aus dem Betrieb: beide Bots kannten den Chat **6921758376
(„Felix_2044")**. Er hatte beiden geschrieben und bekam nie etwas.

### Gebaut

**Neue Tabelle `orion_telegram_empfaenger`** (Migration
`telegram_empfaengerliste`, angewendet). Je Bot beliebig viele Zeilen:

    art='direkt'   Karams eigener Chat
    art='kanal'    ein Telegram-Kanal, in dem der Bot Admin ist
    art='abo'      jemand, der dem Bot selbst geschrieben hat

Die alte Tabelle bleibt unangetastet stehen. Sie zu loeschen waere ein
unnoetiges Risiko an einer laufenden Kette.

**Beide Melder** senden an alle aktiven Empfaenger, mit vier
Vorkehrungen, die ein Verteiler zwingend braucht:

  1. **Ratenbremse** 150 ms (Telegram nimmt rund 30 je Sekunde)
  2. **Stilllegen** bei 403/400 mit Grund und Zeit. Voruebergehende
     Fehler (429, 500) kosten den Empfaenger NICHT
  3. **Markierung erst nach Zustellung** an mindestens einen. Sonst
     gilt ein Fund als gemeldet, den niemand gesehen hat
  4. **Beitragslink je Empfaenger** (`mit_beitragslink`): beitrag.html
     liegt hinter dem Kennwort, Fremde liefen dort an die Wand. Sie
     bekommen die volle Information, nur ohne Verweise

Neu: `{"abholen": true}` traegt alle, die dem Bot geschrieben haben, als
`abo` ein. `{"einrichten": true}` nennt jetzt ausdruecklich, WER nichts
bekommt.

### Der Knapp-Bot wird ERZEUGT, nicht gepflegt

`pruefung/bau-knapp.py` baut ihn aus dem Chancen-Bot und aendert nur die
Unterschiede (Botnummer, Geheimnis, Band, Markierungsspalte, Muster).
Zwei handgepflegte Drillinge laufen auseinander; jetzt steht an EINER
Stelle, worin sie sich unterscheiden duerfen. Das Skript bricht ab, wenn
eine erwartete Stelle in der Quelle fehlt.

### Pruefstand

`melder.test.js` prueft jetzt zusaetzlich je Melder: liest die
Empfaengerliste, KEIN Einzelziel mehr, Ratenbremse, Stilllegen,
Markierung erst nach Zustellung, Beitragslink je Empfaenger. Er hat den
Umbau selbst gefangen: „meldet die gruppierte Liste" wurde rot, weil
sich die Zeile geaendert hatte. Genau sein Zweck.

### OFFEN: der Deploy braucht Karams Doppelklick

Der Supabase-MCP-Deploy scheitert bei diesen Dateien reproduzierbar
(dreimal versucht): ab etwa 15 KB kommt das Dateiarray als Text an und
Zod lehnt ab. Kleinere Dateien gingen vorher durch, diese nicht mehr.

**`DEPLOY-MELDER.cmd` erledigt jetzt alles in einem Durchgang:** beide
Bots ausrollen, danach `abholen` (traegt neue Abonnenten ein) und
`einrichten` (zeigt, wer noch nichts bekommt). Die Funkprobe wurde
BEWUSST entfernt, siehe 8y.

Bereits eingetragen und wartend:

    Bot 1  6795362180  direkt  Karam        mit Beitragslink
    Bot 1  6921758376  abo     Felix_2044   ohne Beitragslink
    Bot 2  6795362180  direkt  Karam        mit Beitragslink
    Bot 2  6921758376  abo     Felix_2044   ohne Beitragslink

Bis zum Doppelklick lesen die laufenden Fassungen weiter die ALTE
Tabelle und senden nur an Karam.

### Fuer den Kanal

Kanal anlegen, beide Bots als Admin hinzufuegen, EINE Nachricht in den
Kanal schreiben (sonst sieht getUpdates ihn nicht), dann
DEPLOY-MELDER.cmd erneut doppelklicken. Der Kanal wird als `art='kanal'`
automatisch eingetragen.

---

## 9b. FUSSBALL-SCANNER TOT, ELF STUNDEN LANG (22.8.)

Karams Meldung: „warum ist alles in den knappsten Paaren und Verlauf weg
und es nichts gekommen oder verschwunden."

### Zwei Ursachen, eine davon mein Versaeumnis

**1. Der Aufraeum-Takt loeschte die gemeldeten Zeilen.**
Job 91 lief um 05:20 und nahm alle beendeten Funde aelter als 24 h mit,
AUCH die gemeldeten. Von 456 Zeilen blieben 56, gemeldete: **null**.
Damit fuehrte jeder aeltere Telegram-Link ins Leere.

Ich hatte diese Luecke in 8z selbst benannt und offen gelassen. Karams
Regel „was gemeldet wurde, verschwindet nie" galt an drei von vier
Stellen. Eine Regel, die nicht ueberall gilt, ist keine Regel.

BEHOBEN: Job 91 verschont gemeldete Zeilen und haelt sie **sieben Tage**.
Nachgeprueft, die Ausnahme steht im Job und er ist aktiv. Die bereits
geloeschten Zeilen sind unwiederbringlich weg.

**2. Der Fussball-Scanner starb an WORKER_RESOURCE_LIMIT.**

    letzter erfolgreicher Fussball-Lauf   21.08. 23:36
    Befund beim Probelauf                 WORKER_RESOURCE_LIMIT
    andere Bereiche (Tennis/Baseball/     laufen in 361-660 ms durch
    Football/Golf)

**Das Perfide: pg_cron meldete durchgehend „succeeded"**, 30 Laeufe in
60 Minuten, null Fehler. Der Job setzt den Aufruf nur ab; die Funktion
stirbt danach. Elf Stunden ohne einen einzigen Fussball-Fund, und kein
Takt, kein Fehlerzaehler, kein Waechter hat es gezeigt. Die
Fehlerklasse „stiller Fehlschlag" in Reinform, diesmal eine Ebene
hoeher als sonst: nicht im Code, sondern zwischen Cron und Funktion.

Gefunden nur, weil der Probelauf von Hand aufgerufen wurde. LEHRE: ein
gruener Takt beweist, dass der ANRUF ging, nicht dass jemand abgehoben
hat.

### Warum ausgerechnet Fussball

Fussball ist der groesste Datensatz UND der einzige Bereich, der
zusaetzlich den Smarkets-Schnappschuss laedt (rund 900 Maerkte) und
einen zweiten Paarungsdurchgang faehrt. Gemessen im letzten geglueckten
Lauf: 1014 Polymarket-Maerkte, 512 von der Bridge, dazu Kalshi und
Smarkets. Der Kopfkommentar der Datei kennt den Fehler schon von
frueher: die Bereichstrennung vom 11.8. war die damalige Antwort
darauf. Jetzt ist Fussball allein zu gross geworden.

### Gebaut: stueckweise statt alles auf einmal (Karams Wahl)

1. **Orderbuecher blockweise.** Vorher: erst eine vollstaendige
   Token-Liste (ueber 2000 Eintraege), daraus je Block eine slice-Kopie,
   daraus nochmal ein Objekt-Array — drei Haltungen derselben Daten.
   Jetzt wird Block fuer Block direkt aus `maerkte` gefuellt, ein Rumpf
   von hoechstens 250 Eintraegen lebt zur Zeit und wird sofort
   freigegeben. Ergebnis identisch, Spitzenbedarf faellt.
2. **Betfair-Rohliste freigeben.** `bfSieger` und `bfOu` sind eigene
   Kopien; die Rohliste danebenliegen zu lassen war bei Fussball eine
   Doppelhaltung von ueber 500 Maerkten. Zahl gemerkt, Liste geleert.
3. **Smarkets-Rohliste freigeben.** Dasselbe mit rund 900 Maerkten,
   ausgerechnet im Bereich, der ohnehin am meisten laedt.

An den Rechenwegen, an der Paarung und an den Schwellen **keine Zeile**.

### Noch nicht bewiesen

Ob die Entlastung reicht, zeigt erst der Trockenlauf nach dem Deploy.
**DEPLOY-JETZT.cmd prueft jetzt FUSSBALL statt Tennis** — genau den
Bereich, der gestorben ist. Kommt dort „ok": true mit pm_maerkte, ist
es weg; kommt wieder WORKER_RESOURCE_LIMIT, reicht es nicht und der
naechste Schritt waere, das Zeitfenster fuer Fussball zu verengen.

**Nicht ausgeschlossen:** Supabase kann die Rechenleistung gedrosselt
haben, weil das Egress-Limit im August gerissen wurde (339 %). Dann
hilft kein Umbau, sondern nur der Zaehler. Das ist UNGEMESSEN.

    spiegel 19896 · vollpruefung 36 · zuordnung 296
    rechnung 195 · melder alle        gruen
    Klammernbalance der geaenderten Datei geprueft: ausgeglichen

### Telegram: gleiche Nachricht fuer alle

Karams Vorgabe: „ich will, dass jeder die gleiche Nachricht bekommt,
auch mit allen Links." Umgesetzt ohne Deploy, reine Datenaenderung:
alle vier Empfaengerzeilen auf `mit_beitragslink = true`, und der
Standard fuer neue Abonnenten steht jetzt ebenfalls auf true.

Damit landen Fremde beim Klick auf die Kennwortwand von beitrag.html.
Das ist Karams bewusste Entscheidung; wer die Links nutzen soll,
braucht das Kennwort von ihm.

---

## 9c. DIE EGRESS-RECHNUNG, ENDLICH AUSGERECHNET (22.8.)

Karams Auftrag: alles nach 24 h loeschen ausser Gespeichertem, Takte so
hoch wie moeglich, solange das Free-Abo haelt. Dazu die Frage, ob ein
eigener Server Grenzen haette.

### Erste Erkenntnis: SPEICHER ist nicht das Problem

    Datenbank gesamt   99 MB von 500 MB Free-Limit
      orion_funde       7,3 MB   (56 Zeilen)
      orion_laeufe       13 MB   Protokoll
      orion_wache       9,8 MB   Protokoll
      orion_gespeichert  32 kB   (bleibt immer)

Die PROTOKOLLE sind groesser als die Funde. Loeschen der Funde bringt
also fast nichts fuer den Speicher. Trotzdem umgesetzt, weil Karam es
so will und es die Datenbank schlank haelt.

### Umgesetzt: Job 91, stuendlich statt nachts

    Takt          03:20 taeglich  ->  jede Stunde (Minute 7)
    orion_funde   vorbei + 24 h, OHNE Ausnahme
    orion_laeufe  30 Tage -> 3 Tage
    orion_wache   30 Tage -> 3 Tage
    cron-Protokoll 3 Tage -> 2 Tage
    orion_gespeichert   wird NIE angefasst

Stuendlich, weil bei einem Lauf um 03:20 eine Zeile, die um 03:30
endete, fast 48 Stunden herumlag. Erst stuendlich macht die
24-Stunden-Grenze scharf.

**Damit faellt die 7-Tage-Schonung fuer gemeldete Zeilen von heute
frueh.** Sie war meine Idee, nicht Karams. FOLGE, die er kennt: ein
Telegram-Link zeigt nach 24 h auf „gibt es nicht mehr". Wer eine
Meldung behalten will, drueckt auf der Karte Speichern.

### Zweite Erkenntnis: der Takt kann NICHT hoch, er ist schon zu hoch

GEMESSEN, was EIN Fussball-Lauf aus der Datenbank holt:

    orion_sm_maerkte   851 KB
    orion_kalshi_maerkte 93 KB
    ------------------------
    Summe              944 KB je Lauf

    Takt alle 2 min  =  720 Laeufe am Tag
    944 KB x 720     =  680 MB PRO TAG, nur Fussball

    Free-Limit 5 GB/Monat = 171 MB pro Tag Budget

**Fussball allein verbraucht das Vierfache des gesamten Budgets.** Dazu
kommen die anderen Bereiche und das offene Panel. Das erklaert die
339 % vom 20.8. vollstaendig, und es heisst: der Takt kann nicht hoch,
er muesste runter.

Nachgesehen, ob sich das wegoptimieren laesst:

    Zeitfilter auf 72 h   bringt NICHTS (alle 1851 Maerkte liegen drin)
    Quoten-Rundung        wirkt bereits (941 KB roh -> 851 KB)
    link-Feld             221 KB (23 %), waere der groesste Einzelposten
    r-Feld (Laeufer)      446 KB (47 %), wird gebraucht

Selbst wenn man den Link ganz einspart, bleiben ueber 400 MB am Tag.
**Mit Feintuning ist das nicht zu retten.**

KORREKTUR meiner eigenen Zwischenmeldung: ich hatte behauptet, die
Quoten-Rundung wirke nicht. Falsch — ich hatte die Rohtabelle gemessen
statt die Funktion. Sie rundet.

### Die drei ehrlichen Wege

1. **Takt senken.** Fussball von 2 auf 10 Minuten bringt 680 -> 136 MB
   am Tag. Passt ins Budget, kostet aber Reaktionszeit: eine Chance,
   die drei Minuten lebt, wird verpasst.
2. **Smarkets serverseitig paaren**, statt 851 KB je Lauf zu holen. Die
   Datenbank wuerde die Zuordnung machen und nur Treffer zurueckgeben.
   Grosser Bau, aber er trifft die Ursache.
3. **Eigener Server.** Kein Egress-Limit, kein WORKER_RESOURCE_LIMIT,
   Takt frei waehlbar. Siehe unten.

### Zur Frage nach dem eigenen Server

Supabase-seitig faellt jede Grenze weg, die heute weh tut: kein
Datenabfluss-Limit, kein Speicherlimit der Edge Functions, kein
Rechenzeit-Deckel. Der Scanner koennte im Sekundentakt laufen.

Was BLEIBT:
  - Die Boersen selbst haben Ratenlimits. Polymarket, Kalshi und
    Smarkets vertragen keinen Sekundentakt ohne Sperre. UNGEMESSEN,
    wo genau ihre Grenzen liegen.
  - Das Geraet muss 24/7 laufen. Faellt es aus, faellt alles aus.
  - Der Kernvorteil des heutigen Aufbaus faellt weg: dass gesucht wird,
    waehrend Karams Geraete AUS sind. Betfair braucht ohnehin schon
    einen laufenden Rechner, ein zweiter Dienst dort ist also kein
    grundsaetzlich neuer Nachteil.

---

## 9d. WIE SCHNELL GEHT ES MIT PRO? (22.8., gemessen)

Karams Frage: „Wie schnell können wir mit dem Pro-Abo bei allen
Bereichen gehen, weil so langsam wird nichts gefunden."

### Die Limits, aus der Supabase-Doku nachgeschlagen

    Free   5 GB Egress im Monat   =   171 MB am Tag
    Pro  250 GB Egress im Monat   =  8533 MB am Tag   (50-fach)
    Pro kostet 25 $/Monat (25 Plan + 10 Compute - 10 Compute-Credits)
    Ueber 250 GB: 0,09 $ je GB, mit Spend Cap wird stattdessen gedrosselt

### Was eine Runde ueber ALLE Bereiche kostet, gemessen

    komplette Runde   981 KB
      davon Fussball  924 KB  = 94 Prozent
      alle 19 anderen  57 KB  = 6 Prozent

**Fussball ist praktisch die ganze Last**, weil er als einziger den
Smarkets-Schnappschuss holt (847 KB). Kalshi steuert 77 KB bei, die
uebrigen Bereiche zusammen nur 57 KB.

### Die Antwort

| Takt (alle Bereiche) | Verbrauch/Tag | Free | Pro |
|---|---|---|---|
| 10 Sekunden | 8277 MB | 4850 % | **97 %** knapp |
| 20 Sekunden | 4139 MB | 2425 % | **48 %** |
| 30 Sekunden | 2759 MB | 1617 % | **32 %** |
| 1 Minute | 1380 MB | 808 % | 16 % |
| 2 Minuten (heute) | 690 MB | 404 % | 8 % |
| 10 Minuten | 138 MB | **81 %** | 2 % |

**Mit Free ist nur der 10-Minuten-Takt tragbar.** Alles darunter
sprengt das Limit, der heutige 2-Minuten-Takt um das Vierfache.

**Mit Pro sind 20 Sekunden fuer ALLE Bereiche der sichere Punkt**
(48 % Auslastung). Das waere sechsmal schneller als heute. 10 Sekunden
gingen rechnerisch auch, lassen aber keinen Puffer fuer das Panel und
kuenftiges Wachstum.

### WICHTIG: Pro loest den Speicherfehler NICHT automatisch

`WORKER_RESOURCE_LIMIT` ist ein Limit der Edge Function, nicht des
Egress-Kontingents. Ob Pro dort mehr gibt, ist UNGEMESSEN. Der Umbau
aus 9b (stueckweise Verarbeitung) zielt genau darauf und muss ohnehin
ausgerollt werden — ein schneller Takt nuetzt nichts, solange der Lauf
gar nicht durchkommt.

### Empfehlung

1. Erst `DEPLOY-JETZT.cmd` — sehen, ob der Fussball-Lauf wieder
   durchlaeuft.
2. Dann Pro buchen, **Spend Cap ANLASSEN** (dann drosselt Supabase,
   statt still Kosten zu machen).
3. Dann Takte auf 20 Sekunden fuer alle Bereiche.
4. Nach zwei Tagen den Zaehler nachsehen und gegen diese Rechnung
   halten. Die 981 KB sind eine Momentaufnahme; an einem vollen
   Fussballabend liegt Smarkets hoeher.

---

## 9e. BETFAIR-FUSSBALL LIEFERT NUR TOTE MAERKTE (22.8., schwerer Fund)

Beim Durchrechnen der Takte aufgefallen: `orion_bf_maerkte(12,'fussball')`
liefert ein LEERES Array, obwohl die Bridge 569 Maerkte haelt.

### Die Kette, Schritt fuer Schritt nachgemessen

    Bridge haelt insgesamt              569 Maerkte
    davon Marktart passend              569
    davon mit Zeitangabe                569
    Zuordnung auf Bereich klappt        461 ergeben "fussball"
    davon im 12-h-Fenster                 0
    davon im 24-h-Fenster                 0

Die Zuordnung ist also in Ordnung. Der Grund liegt woanders:

    Bereich      Maerkte   Anpfiff vorbei   Anpfiff kommt
    fussball        461         461               0
    tennis           25           9              16
    cricket          25          16               9
    mma              18           0              18
    football         13           0              13
    lol              13           1              12

**Alle 461 Fussball-Maerkte haben ihren Anpfiff in der VERGANGENHEIT**
(11:30 bis 13:30, gemessen um 16:55). Kein einziges kommendes Spiel.
Andere Sportarten haben sehr wohl kommende Partien.

An einem Samstagnachmittag muss es kommende Fussballspiele geben. Die
Bridge laedt sie nicht.

### Verdacht, NICHT bewiesen

Die Bridge hat eine Verfallsregel (Orion-Bridge-Pro-27.js, Zeile 418):

    NACH_ANPFIFF_STD = 3    Anpfiff mehr als 3 h her  -> raus
    VERFALL_MIN     = 30    30 min nicht gesehen      -> raus

Maerkte mit Anpfiff 11:30 haetten um 14:30 verfallen muessen. Um 16:55
liegen sie noch da. **Die zuAlt-Regel greift offenbar nicht.** Moeglich
waere, dass `Date.parse(m.start)` fehlschlaegt und NaN jeden Vergleich
false macht — das ist ein VERDACHT, nicht gemessen. Der Speicher der
Bridge ist von hier aus nicht einsehbar, sie laeuft auf Karams Laptop.

**Folge, sicher:** Betfair faellt fuer Fussball komplett aus. Von vier
Buechern bleiben im wichtigsten Bereich drei. Das erklaert einen
grossen Teil von „es wird nichts gefunden" — zusammen mit dem
Scanner-Absturz aus 9b.

### Zu pruefen, wenn Karam die Bridge anfasst

1. Startbild der Bridge lesen: wieviele Fussball-Maerkte holt sie je
   Runde, und mit welchem Fenster?
2. `aufraeumen()` beobachten: wieviele fliegen je Lauf raus?
3. Ob `start` beim Aktualisieren erhalten bleibt.

NICHT von hier aus geaendert: die Bridge ist Karams Laufzeit, ein
Eingriff waehrend des Betriebs braucht seine Ansage.

---

## 9f. REINIGUNG DER WEBSITE (22.8., Karams Auftrag)

Karams Ansage: „Tu alle unnoetigen ueberfluessigen Codezeilen rausnehmen,
behalt dein Design gleich, behalt die Logik gleich." Dazu: Loeschung auf
36 Stunden.

### Neu: pruefung/totes-finden.js

Ein Werkzeug, das toten Code sucht und **nie etwas aendert**. Es meldet
CSS-Klassen ohne Fundstelle, unbenutzte und doppelte Keyframes, Seiten
ohne eingehenden Link und Funktionen ohne Aufruf.

Warum nur melden: ein Selektor, der dynamisch zusammengesetzt wird
(`'bk-' + name`), sieht tot aus und ist es nicht. Jeder Fund gehoert von
Hand geprueft. Genau das hat sich sofort ausgezahlt, siehe unten.

### Entfernt, jedes Stueck einzeln nachgewiesen

**Die alte Ring-Optik des Pulses, 58 Zeilen.** `p-ring`, `p-bogen`,
`p-led`, `p-punkt`, `p-welle` und ihre vier Keyframes. Das Sonar hat sie
laengst ersetzt; `puls.js` schreibt seither ausschliesslich `s`-Klassen.
Mit Wortgrenzen gegen alle HTML- und JS-Dateien geprueft: keine einzige
Fundstelle. Am lebenden Panel nachgemessen: **0 Elemente mit p-Klasse,
59 mit s-Klasse.**

**`.rendite-gut` und `.rendite-schlecht`** — tot, zwei Zeilen.

**`@keyframes flug-rauf` und `flug-runter`** — Reste der am 20.8.
geloeschten buehne.js.

**Zwei doppelte Keyframes** (`hero-scan-zug`, `kachel-streif`): die
ERSTE Definition faellt, die spaetere gewann ohnehin. Nachgeprueft, dass
beide jetzt genau einmal dastehen.

**`muster-hud.html`, 30 KB.** Musterseite, nirgends verlinkt, nicht im
Betrieb.

    stil.css   124 565 -> 121 039 Bytes
    Dateien    eine weniger

### NICHT entfernt, mit Begruendung

**`fu-log` und `fu-eingabe`** sahen tot aus. Sie gehoeren zum lebenden
Funker-Chat, den `stimme.js` baut (`fu-zeile`, `fu-kopf`, `fu-stumm`,
`fu-zu` sind dort nachweisbar). Sechs Zeilen Gewinn sind das Risiko
nicht wert, ein laufendes Fenster zu zerlegen.

**`w3`** war ein Falsch-Positiv: es stammt aus `www.w3.org` in einer
eingebetteten SVG-Grafik, nicht aus einem Klassennamen.

**`.marker`** steht in einer Regel zusammen mit `.urteil.rot`. Nur den
toten Selektor herauszuschneiden waere Feinarbeit an einer lebenden
Regel, fuer eine halbe Zeile Gewinn.

**Die beiden `.puls`-Definitionen** bleiben beide stehen. Die zweite
(Sonar) ueberschreibt die erste, aber ob sie WIRKLICH jede Eigenschaft
neu setzt, ist ungeprueft. Karams Vorgabe war „Design gleich lassen".

### Nachgewiesen

    spiegel 19896 · vollpruefung 36 · zuordnung 296
    rechnung 195 · melder alle                       gruen
    Panel geladen: Puls, Kopf, Kacheln, Bereichskarten, Statistik,
                   Fuss - alle sichtbar, Hoehen unveraendert
    Konsole: keine Fehler

### Aufraeumtakt jetzt 36 Stunden

    Funde         vorbei + 36 h  (war 24 h)
    Gespeichertes wird nie angefasst, geprueft ueber das Kommando selbst

---

## 9g. PRO IST AKTIV, TAKTE HOCHGESETZT (22.8. abends)

Bestaetigt ueber die Verwaltungsschnittstelle: `plan: "pro"`.

### Vorher gepruefte Voraussetzungen

Bevor irgendein Takt hochging, beide Blockierer nachgemessen:

    Fussball-Probelauf   ok: true, 3615 ms, 536 pm, 211 Betfair,
                         1840 Smarkets, 61 Paare
    Bridge               358 Fussball-Maerkte mit Anpfiff in der ZUKUNFT
                         (vorher 0, siehe 9e)

Beides repariert. Einen kaputten Scanner schneller zu takten haette
nichts gebracht.

### DER FUND, der die Rechnung geaendert hat: ZWEI Limits

Bis hierher hatte ich nur den Egress gerechnet. Pro hat aber auch ein
**Aufruflimit: 2 Millionen Edge-Function-Aufrufe im Monat**, danach
2 $ je Million.

Karams Wunsch war „alle paar Sekunden". Gerechnet:

    19 Bereiche alle 3 s  =  16,4 Mio Aufrufe/Monat  gegen 2 Mio frei
                          =  28 $ Aufpreis

**Der Sekundentakt scheitert nicht am Abfluss, sondern an den
Aufrufen.** Fussball ist teuer im Abfluss (900 KB je Lauf) und billig
in Aufrufen; die 19 anderen sind zusammen billig im Abfluss (53 KB),
kosten aber je Bereich einen eigenen Aufruf. Deshalb muessen die beiden
Gruppen unterschiedlich getaktet werden.

### Gesetzt

    orion-lauf-fussball        15 seconds   (war 2 min)
    alle 19 anderen Bereiche   40 seconds   (waren stuendlich)

    Egress   5174 MB/Tag  =  61 % von 250 GB
    Aufrufe  46800/Tag    =  70 % von 2 Mio

Fussball 8-mal haeufiger als vorher, alle anderen **90-mal haeufiger**.
Genau die 18 Bereiche, die in sieben Tagen null Funde hatten.

Warum nicht enger: der Fussball-Lauf dauert gemessen 3,6 bis 4,4 s. Bei
15 s bleiben knapp vier Takte Puffer, und an vollen Abenden waechst
Smarkets weiter.

### Nachgemessen, drei Minuten nach der Umstellung

    Laeufe in 3 Minuten          87
    davon Fussball               11
    verschiedene Bereiche        20 von 20
    Cron-Fehlschlaege             0
    live-Zeilen                  62   (vorher 0)
    neue Zeilen in 5 Minuten     21
    Betfair im letzten Lauf     211 Maerkte
    Dauer letzter Fussball-Lauf 4383 ms

### Was NICHT die Ursache war

Karams Vermutung, die Datenbank sei voll gewesen: nein. Sie lag bei
99 von 500 MB. Die Funde blieben aus, weil der Scanner an
WORKER_RESOURCE_LIMIT starb (9b) und Betfair nur tote Maerkte lieferte
(9e). Beide Ursachen sind behoben.

### Offen, fuer mehr Maerkte

Karam will „mehr Bereiche, mehr Maerkte". Zwei Wege stehen bereit:

1. **`spielerwetten`** steht im Register auf `aktiv=false` mit NULL
   Polymarket-Tags. Der Bereich existiert nur als leerer Eintrag. Er
   braucht Tags und einen Trockenlauf.
2. **Weitere Tags je Bereich.** Fussball hat heute `soccer` und `ucl`.
   Was Polymarket sonst noch fuehrt, ist ungemessen.

Beides ist ein eigener, messbarer Bau und wartet auf Ansage.

---

## 9h. AUF 80 PROZENT + MEHR MAERKTE (22.8. spaet)

Karams Ansage: 80 % fuellen, 20 % fuer andere Miniprojekte, und beides
bauen (mehr Bereiche, mehr Maerkte).

Sein Puffergedanke ist richtig: das Kontingent gilt fuer die ganze
ORGANISATION, nicht je Projekt. Der Pruefstand teilt es mit.

### Gesetzt

    orion-lauf-fussball        15 seconds
    alle 19 anderen Bereiche   33 seconds

    Egress   61 %    Aufrufe  83 %

### Warum der Abfluss NICHT auf 80 % geht

Erst standen 12 s / 35 s (76 % / 81 %). Nach drei Minuten gemessen:

    Fussball-Lauf im Schnitt   4554 ms
    LANGSAMSTER Lauf           9721 ms
    Takt                      12000 ms   ->  2,3 s Puffer, 19 %

Ein Lauf, der den naechsten einholt, laesst zwei Faelle gleichzeitig auf
orion_funde schreiben — genau die Lage, aus der am 19.8. die vier
Deadlocks kamen. Deshalb zurueck auf 15 s (5,3 s Puffer beim
langsamsten Lauf) und die kurzen Bereiche dafuer enger auf 33 s.

**Der Engpass ist die LAUFZEIT des Fussball-Scanners, nicht das
Kontingent.** Wer den Abfluss wirklich auf 80 % bringen will, muss die
851 KB Smarkets je Lauf angehen (serverseitig paaren statt holen), nicht
den Takt. Das ist der naechste sinnvolle Bau.

### Mehr Maerkte: gemessen, was es ueberhaupt gibt

Alle Polymarket-Tags des Registers gegen die API geprueft. Ergebnis:

**SOFORT scharf, ohne Deploy:** der esport-Bereich stand auf
`rocket-league` und `dota`, die beide NULL Maerkte liefern. Der Tag
`esports` fuehrt 1154 und stand bereits in BEIDEN Spiegeln — er fehlte
nur im Register. Probelauf danach: **87 Maerkte statt 0**, karte_ok true.

**Vorbereitet, wartet auf den naechsten Deploy** (in beiden Spiegeln
eingetragen):

    dota2    -> esport        204 Maerkte  ('dota' liefert 0)
    hockey   -> eishockey     101
    movies   -> kultur       1289
    music    -> kultur       1207
    awards   -> kultur       2827
    business -> wirtschaft    965
    stocks   -> wirtschaft    908

**BEWUSST NICHT aufgenommen:** der Sammeltag `sports` (1887) sowie
`baseball`, `basketball`, `football`. Das sind Oberkategorien, die
Maerkte mehrerer Bereiche mischen. Die Bereichstrennung ist Schutz, kein
Formalismus — die Fehlpaarung vom 11.8. (Eintracht Frankfurt im Fussball
gegen Eintracht Frankfurt in League of Legends) kam genau daher.

**`spielerwetten`:** kein passender Polymarket-Tag gefunden. Geprueft
wurden player-props, props, nba-player-props, nfl-player-props und
sports-betting — alle leer. Der Bereich bleibt ein leerer Eintrag.

### FEHLER, den ich dabei gemacht und sofort zurueckgenommen habe

Ich habe die neuen Tags ins Register eingetragen, BEVOR die
Zuordnungstabelle ausgerollt war. Ergebnis, sofort gemessen:

    kultur / wirtschaft / eishockey:  karte_ok FALSE, pm-Maerkte 0

Ein Tag im Register, den die ausgerollte `zuordnung.ts` nicht kennt,
setzt karteOk auf false UND kostet die Maerkte des ganzen Bereichs. Die
Bereiche waren schlechter dran als vorher. Zurueckgenommen, danach alle
wieder karte_ok true.

**REGEL: Register und Zuordnungstabelle wandern GEMEINSAM.** Erst
deployen, dann die Tags eintragen.

### Neuer Pruefstand: pruefung/tagtabelle.test.js

Beim Nachtragen traf meine Ersetzung nur `js/zuordnung.js`, die
Server-Fassung hatte einen anderen Wortlaut — **und spiegel.test.js
blieb GRUEN.** Er prueft `bereichPm` mit einem einzigen Beispiel
('soccer'); die ganze Tabelle war ungeprueft.

Der neue Stand vergleicht beide Tabellen Eintrag fuer Eintrag, in beide
Richtungen. Gegenprobe gelaufen: kuenstliche Drift (hockey -> fussball)
wird rot mit Exit 1, Zuruecksetzen gruen.

    Tagtabelle: 42 von 42 Eintraegen identisch

### Nach dem naechsten Deploy zu tun

1. `DEPLOY-JETZT.cmd` (rollt zuordnung.ts mit den sieben neuen Tags aus)
2. Danach die Tags ins Register:
   esport `{esports,cs2,dota2}`, eishockey `{nhl,hockey}`,
   kultur `{pop-culture,movies,music,awards}`,
   wirtschaft `{economics,inflation,fed,business,stocks}`
3. Je Bereich einen Probelauf: karte_ok MUSS true bleiben
4. kultur bekommt dadurch rund 5300 Maerkte statt 964 — Laufzeit
   beobachten, sonst droht dort WORKER_RESOURCE_LIMIT wie bei Fussball

---

## 9i. BRIDGE-ORDNER AUFGERAEUMT + WARUM DER TAKT BLEIBT (22.8.)

### Frage 1: Bridge auf die neue Geschwindigkeit anpassen? NEIN.

Die Bridge laeuft mit `intervalSeconds`, Standard **30 s**; die
Zugangsdatei setzt den Wert nicht. Der Scanner liest jetzt alle 15 s,
sieht also jede Betfair-Lieferung zweimal.

Trotzdem bleibt der Takt, und zwar aus einem harten Grund:

    orion-lauf, Kopfkommentar Zeile 39:
    "App-Key DELAYED (Kurse ~1 min alt)"

**Betfair liefert mit diesem Schluessel ohnehin nur Kurse, die rund eine
Minute alt sind.** Ein 15-Sekunden-Takt holt dieselben veralteten Zahlen
nur oefter ab. Er wuerde Karams Laptop mehr belasten und die
Betfair-Ratenlimits naeher ruecken, ohne einen einzigen frischeren Kurs
zu liefern. Der 30-Sekunden-Takt ist bereits doppelt so schnell wie die
Quelle.

UNGEMESSEN geblieben: wie alt die Kurse WIRKLICH sind. Die eine Minute
steht als Notiz im Code, nachgemessen wurde sie nie. Wer den Takt je
aendern will, misst zuerst das.

### Frage 2: Ordner aufgeraeumt

VORHER 12 Dateien. Zuerst gesichert, was nur auf dem Laptop lag oder
dort neuer war — Loeschen ohne Sicherung waere der teuerste Fehler
gewesen:

    DEPLOY-JETZT.cmd           war GAR NICHT im Repo
    Orion-Waechter-Leise.vbs   war GAR NICHT im Repo
    Orion-Bridge-STARTEN.cmd   lokal neuer (19.08. 20:13 gegen 03:55)
    README.md                  lokal neuer

Danach geloescht:

    UEBERGABE.md (90 KB)   Kopie vom 19.08.; die gueltige liegt im Repo
                           und ist inzwischen 170 KB gross. ZWEI
                           Uebergaben nebeneinander sind schlimmer als
                           eine - man liest die falsche.
    DEPLOY-ANLEITUNG.txt   identisch im Repo; DEPLOY-JETZT.cmd erklaert
                           sich beim Doppelklick ohnehin selbst
    NAECHSTE-SITZUNG.txt   Stand 19.08., im Repo liegt der vom 20.08.

NACHHER 9 Dateien, und **alle acht Programm- und Anleitungsdateien sind
jetzt Byte fuer Byte identisch mit dem Repo**. `bridge-config.json`
bleibt wie immer unberuehrt und ungetrackt.

### Kontrolle: laeuft nur EINE Bridge?

Die Prozessliste zeigte drei `node.exe`. Nach der Regel vom 19.08. NICHT
nach dem Namen gegangen, sondern die Befehlszeilen gelesen:

    12744  node.exe Orion-Bridge-Pro-27.js      <- die Bridge
    16472  npx-cli.js                            Werkzeugumgebung
     2476  npm-cache/_npx/...                    Werkzeugumgebung

Genau eine Bridge. Haette man nach dem Namen abgeschossen, waere die
Werkzeugumgebung mitgegangen.
