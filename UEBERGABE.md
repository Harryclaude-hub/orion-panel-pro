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
