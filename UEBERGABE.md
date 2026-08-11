# Orion Panel Pro — Übergabe

> **Diese Datei ist die Wahrheit über das Projekt. Halte sie aktuell.**
> Nach jeder wesentlichen Änderung — neue Quelle, neue Regel, neuer Messwert,
> erledigter Punkt aus Abschnitt 8 — wird sie im selben Commit nachgezogen.
> Sie aktualisiert sich NICHT von selbst. Eine veraltete Übergabe ist
> schlimmer als keine, weil man ihr glaubt.

Stand: **10. August 2026, spät abends**, Commit `d2fd551` + die Arbeit dieses
Abends. Dieser Text reicht, um ohne Vorwissen weiterzuarbeiten. Alle Zahlen
darin sind gemessen; was nicht gemessen ist, steht ausdrücklich als
ungemessen da.

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

### Offen (Stand 11.8. mittags)

1. **Smarkets-Marktlinks.** Gemessen: alle 16 Märkte einer Partie tragen
   **denselben** Link, er zeigt aufs Spiel statt auf den Markt. Bei allem
   außer Sieger landet man falsch. Jeder Markt hat einen eigenen `slug`
   (`winner`, `over-under-0.5`) — aber `/over-under-0.5` antwortet als URL
   **404**. Die API-Slugs sind nicht eins zu eins die Website-Pfade.
   **Erst messen, dann bauen** — sonst werden die Links schlechter.
2. **Smarkets Lay handelbar?** Die API liefert `bids`, die Kehrwertsummen
   verhalten sich wie bei einer Börse. Ob man als Nutzer dort tatsächlich
   dagegenhalten kann, ist **ungemessen** (kein Konto). Ein großer Teil der
   Funde ist `Smarkets Lay` — diese Auskunft entscheidet über deren Wert.
3. **Scanner-Bug an der Wurzel** (siehe oben, Wächter fängt es ab).
4. **Renderlast** — beim ersten Bridge-Betrieb ruckelte die Seite. Verdacht:
   alle 2 s werden bis zu 1500 Zeilen komplett neu gezeichnet. Ungemessen.
5. **Correct Score, Double Chance, Draw No Bet** — nie angefasst.
6. **Polymarkets Gebührenwiderspruch** — API sagt Exponent 1, Quellen sagen
   die Hälfte. Wir rechnen die höhere Variante (Regel 2).

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
