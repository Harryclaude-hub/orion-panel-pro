# Was in der Datenbank lebt

Nicht alles steht im Repo. Ein Teil der Logik läuft als SQL-Funktion in
Supabase und wird von `pg_cron` getaktet — ohne Edge Function, ohne Deploy,
ohne eingeschalteten Rechner.

> **Die Datenbank ist für diese Funktionen die Wahrheit, nicht das Repo.**
> Sie hier zu kopieren wäre die Drift-Falle, die dieses Projekt schon zweimal
> getroffen hat (siehe UEBERGABE.md, Abschnitt 5 und 8c). Deshalb steht hier
> nur, **was** es gibt und **wie man den echten Stand abruft**.

## Aktuellen Stand exportieren

```sql
select string_agg(pg_get_functiondef(p.oid), E';\n\n' order by p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like 'orion\_%';
```

Laufende Takte ansehen:

```sql
select jobid, jobname, schedule, active, command from cron.job order by jobname;
```

## Tabellen

| Tabelle | wofür |
|---|---|
| `orion_funde` | jeder Fund, live und Verlauf. Spalten `art` und `bereich` seit 11.8.; `bereich` wird vom Bereichs-Scanner IMMER geschrieben |
| `orion_laeufe` | Protokoll jedes Scans, seit 11.8. spät mit Spalte `bereich` |
| `orion_wache` | Selbstkontrolle, jede Minute eine Zeile |
| `orion_bereiche` | **Register der 21 Bereiche** mit `pm_tags`, `takt_sek` und `aktiv` (= Freischaltung; `spielerwetten` steht aus, keine gemessene Quelle) |
| `orion_bf_sport` | **Betfair eventTypeId → Bereich** mit `name_erwartet` und `geprueft`. Ungemessen, bis Bridge Build 19 `stats.et_namen` liefert — dann setzt der Wächter `geprueft` bei Übereinstimmung |
| `orion_kurse` | Wechselkurs USD→EUR, von der Datenbank selbst geholt |
| `orion_kurs_anfrage` | offene pg_net-Anfrage, damit nicht doppelt gefragt wird |
| `kalshi_snapshot`, `smarkets_snapshot` | Kurse der Sammler |
| `bridge_odds` | Betfair, von der Bridge. **Format fix, nie umbauen** (Regel 6). Märkte tragen ab Build 18 `sz`, ab Build 19 `et` (beides additiv) |

## Funktionen

**Wächter** — `orion_waechter_lauf()`, getaktet als `orion-waechter-takt`,
jede Minute. Räumt auf, richtet Links, hält den Kurs frisch, protokolliert
nach `orion_wache`. Ruft:

- `orion_verwaiste_beenden(max_alter_s)` — Zeilen, die der Scanner seit über
  drei Minuten nicht mehr sah, auf `vorbei`. Geht nach **Zeit**, nicht nach
  einer Schlüsselliste; die wurde zu lang und schlug still fehl.
- `orion_links_richten()` — hängt den Schrägstrich an Smarkets-Links. Ohne
  ihn antwortet smarkets.com mit HTTP 308 und die Seite landet auf der
  Startseite. Repariert statt gemeldet, damit keine Dauerwarnung entsteht.
- `orion_kurs_einsammeln()` / `orion_kurs_anfragen(h)` — Wechselkurs über
  `pg_net`. Asynchron: erst einsammeln, dann neu anfragen. Die Anfrage-ID
  wird gemerkt, weil in `net._http_response` auch die Antworten der
  Cron-Jobs stehen.
- `orion_verdacht()` — **19 Prüfmuster** (seit 11.8. spät). Wichtigstes: die
  Zuordnung wird über `orion_kernwoerter()` **unabhängig vom Scanner
  nachgerechnet**. Neu dazugekommen: Bereich fehlt / widerspricht der
  Sportart, Kalshi-Link zeigt in fremden Bereich (Serie aus dem Link),
  Link zeigt auf falsches Buch, Einsatz-/Auszahlungs-/Gewinn-Plausibilität,
  Bereichslauf steht (je aktivem Bereich), Betfair-Sportkarte widerspricht
  den Bridge-Namen.
- `orion_verdacht_zusatz()` — Zusatzregeln in EIGENER Funktion, damit die 19
  gewachsenen Muster oben unangetastet bleiben.

  **Seit 13.8. Regel 2: der ZEITRAUM muss auf beiden Seiten gleich sein.**
  Zwei Funde (11,48 % und 10,22 %) paarten Polymarkets „1st Half O/U 0.5"
  gegen Smarkets’ „Over 0.5 goals" — der Scanner verglich die Zahl und nicht
  den Zeitraum. An der Smarkets-Schnittstelle nachgemessen: sie führt beide
  Märkte getrennt und benennt sie eindeutig („Over/under 0.5" gegen „First
  half over/under 0.5" gegen „Second half over/under 0.5"), in 19 von 19
  geprüften Spielen. Der richtige Gegenmarkt hätte also existiert.
  Trockenlauf über 275 Zeilen: genau die 2 bekannten gefangen, 0 Fehlalarme.

  Regel 1 seit 12.8.: **zeigt der Smarkets-Link auf die richtige Partie?** Der Pfad trägt die
  Mannschaftsnamen im Klartext, also gegen den Titel prüfbar — ohne Netz.
  Nötig, weil smarkets.com auf JEDEN Pfad mit 200 antwortet und den Unsinn
  sogar in den Seitentitel schreibt; ein HTTP-Test beweist dort nichts.
- `orion_kernwoerter(t)` / `orion_stoppwort(w)` — Wortzerlegung in SQL,
  bewusst getrennt von der JS-Fassung. Zwei unabhängige Wege.

  > **12.8.2026 repariert: Akzente.** `[^a-z0-9]+` machte aus jedem
  > Sonderzeichen ein Leerzeichen — „león" zerfiel in „le" und „n", beide zu
  > kurz, beide weg. Jeder Name mit Akzent war für SQL unsichtbar, im
  > südamerikanischen Fußball die Mehrheit (50 von 177 Zeilen). Aufgefallen
  > durch einen Fehlalarm: „Inter Miami CF vs. Club León FC" gegen „Miami vs
  > Leon Winner?" galt als schwach belegt.
  >
  > Die Wege sollen sich **unabhängig kontrollieren, nicht systematisch
  > widersprechen** — JS normalisierte längst richtig. Jetzt macht SQL
  > dasselbe: `normalize(…, NFD)`, dann die Akzentzeichen streichen.
  >
  > **Offen und bewusst nicht angefasst:** Buchstaben mit Querstrich
  > (`ø đ ł ß æ œ`) sind keine Akzente, NFD zerlegt sie nicht. JS behält
  > `bodø`, SQL macht `bod`. Betrifft gemessen **eine** Zeile (Bodø/Glimt).
  > Die Reparatur läge in der PAARUNGSLOGIK, nicht im Prüfweg — sie würde
  > neue Paarungen erzeugen und gehört deshalb vor Karams Augen gemacht,
  > mit Trockenlauf, in allen drei Fassungen (js, ts, sql).
- `orion_bereich_pm(sport)` / `orion_bereich_kalshi(serie)` /
  `orion_link_passt(buch, link)` — dritte, unabhängige Zuordnungswege für
  den Wächter (neben JS- und TS-Spiegel).

**Betfair-Vorfilter** — `orion_bf_maerkte(fenster_h, bereich_p)`. Liefert
MATCH_ODDS und OVER_UNDER aus `bridge_odds`, seit 11.8. spät mit `et` und
`bereich` (über `orion_bf_sport`). **Mit gesetztem `bereich_p`: bis 72 h und
1000 Märkte, und nur Märkte mit passendem, bekanntem Bereich** (kein et →
nichts; alte Bridge vor Build 19 liefert also 0). Ohne `bereich_p` bleibt
der alte Notbehelf 12 h / 250 für bereichslose Aufrufe.

> Die echte Last je Bereich ist erst messbar, wenn Build 19 läuft und et
> mitkommt — dann den 546 nachmessen, bevor das Scanner-Fenster steigt.

## Takte

Stand 11.8.2026 spät abends. Der Sammel-Takt `orion-lauf-takt` ist WEG;
stattdessen **ein Takt je Bereich** (Body `{"bereich":"…"}`), Takt aus
`orion_bereiche.takt_sek`:

**Nachgemessen am 13.8.2026 abends, direkt aus `cron.job` — 26 aktive Takte:**

```
orion-lauf-fussball     20 seconds   Scanner NUR fussball (gemessen 3,7-4 s je Lauf)
orion-lauf-<bereich>    stuendlich versetzt: 17 leere Bereiche (Register takt_sek 3600!)
orion-lauf-baseball     */10 * * * * baseball und football alle 10 Minuten
orion-waechter-takt     * * * * *    Wächter (siehe oben)
orion-zeiten-takt       * * * * *    NEU 13.8.: Anpfiff + Buchstimmigkeit
orion-smarkets-takt     */2 * * * *  Smarkets-Sammler (gemessen 26 s bei Fenster 30 h)
orion-kalshi-takt       */2 * * * *  Kalshi-Sammler
orion-pruefer-takt      */5 * * * *  dritte, unabhängige Rechnung
orion-rauschen-takt     */5 * * * *  löscht Minuszeilen im Verlauf
```

> **Die alte Liste hier war falsch.** Sie führte `pm-scan-takt` und
> `orion-wache-takt` als laufende Altlasten und Fußball mit 20 Sekunden.
> Gemessen: **beide Altlasten existieren nicht mehr** (0 Treffer in
> `cron.job`), passend dazu ist `pm_snapshot` seit dem 11.8. 23:18 nicht mehr
> beschrieben worden. Fußball läuft `* * * * *`, Smarkets `*/10`.
>
> Das ist genau die Drift, vor der diese Datei oben warnt — deshalb steht
> jetzt hier: **im Zweifel `select jobname, schedule from cron.job` fragen,
> nicht diese Liste glauben.**

## Kursalter (seit 13.8.2026)

Zwei Spalten in `orion_funde`: **`pm_preis_seit`** und **`bf_quote_seit`** —
seit wann steht dieser Kurs unverändert? Gepflegt vom Auslöser
`orion_kursalter_mitfuehren()`, der beim Schreiben den neuen mit dem alten
Wert vergleicht. Bewegt sich nichts, bleibt der Zeitpunkt stehen.

> **Warum das gebraucht wird.** Sieben der acht Fehler vom 13.8. kamen von
> EINEM stehengebliebenen Betfair-Kurs. Drei Bücher sagten Guadalajara
> 59–61 %, Betfair sagte 47,6 % — bei in sich stimmigem eigenem Buch
> (Summe 100,2 %). Kein kaputter Kurs, ein **alter**.
>
> Nachgemessen: **kein** Schnappschuss trägt einen Zeitstempel je Markt,
> weder Kalshi noch Smarkets noch die Bridge. Niemand konnte sehen, dass
> ein Kurs seit Stunden klebt — auch ein Sprachmodell nicht, die
> Information existierte nicht.

Bewusst NICHT über einen neuen Takt gelöst, der alle Schnappschüsse
durchgeht: genau solche Last hat am 13.8. die Datenbank für 45 Minuten
lahmgelegt. Der Auslöser kostet einen Zahlenvergleich je geschriebener
Zeile und läuft im bestehenden Schreibvorgang mit.

## Takte gestreckt (13.8.2026) — und warum

Gemessen über 24 Stunden:

```
fussball          200 625 Paare, 208 Funde,  3 825 Läufe
19 andere               0 Paare,   0 Funde, ~17 000 Läufe
```

Und aus `pg_stat_statements`: **67 % der gesamten Datenbankzeit** ging für
`net.http_post` drauf, 531 ms im Schnitt. Das ist die Last, die am 13.8.
zum **45-Minuten-Ausfall** geführt hat (PGRST002, Verbindungspool
erschöpft, erst ein Neustart durch den Betreiber half).

> Sie kam aus einer Änderung vom 12.8.: aus einem Scanner wurden zwanzig.
> Der Gedanke war richtig — die Bereichstrennung verhindert Fehlpaarungen —
> aber der Takt für die leeren Bereiche war viel zu eng.

Die 19 leeren Bereiche laufen jetzt **alle 10 Minuten** statt jede ein bis
zwei; `fussball` bleibt bei 20 Sekunden. Sie liefern strukturell nichts
(E-Sport-Fragearten fehlen bei Polymarket, Welt-Bereiche haben nur ein
Buch), zehn Minuten genügen, um eine Änderung zu bemerken.

Nachgemessen über 5 saubere Minuten:

| | vorher | nachher |
|---|---|---|
| `net.http_post` Schnitt | 531 ms | **21,3 ms** |
| Anteil Gesamtzeit | 67 % | **6 %** |
| Auslastung | Ausfall | rund 3 % |

## Löschregel repariert (13.8.2026)

`orion_rauschen_loeschen(grenze)` hatte ein **ODER, wo ein UND gehört**:

```sql
ALT:  delete where rendite < grenze OR beste_rendite < grenze
NEU:  delete where beste_rendite < grenze
```

Eine Zeile, die einmal bei 2,5 % stand und am Ende auf −0,3 % fiel, wurde
damit **komplett gelöscht**. Nachgewiesen: von 231 Verlaufszeilen hatte
**keine einzige** eine negative Endrendite, die kleinste war exakt 0,00.
Kein Zufall — das war die Löschregel.

**Nachtrag 14.8.2026:** die Funktion verschont jetzt zusätzlich alles mit
`pruefung='falsch'` — nachgewiesen falsche Rechnungen gehören in den
Analyse-Reiter und wurden vorher stillschweigend mitgelöscht (gemessen:
9 Falsch-Zeilen mit Minus-Rendite, alle wären beim nächsten Takt weg
gewesen). Löschregel und Website-Anzeige sagen seither DASSELBE:
Rauschen = nie über 0 % UND nicht als falsch nachgewiesen.

**Dazu die zweite Ursache der springenden Archiv-Zahlen (14.8., gemessen
2.112 gelöschte von 2.319 eingefügten Zeilen):** die Website lud die
neuesten 500 Vorbei-Zeilen MITSAMT dem noch nicht gelöschten Rauschen.
An einem vollen Fußballabend schoben hunderte Rauschzeilen die echten
Verlaufszeilen aus dem Fenster (Verlauf 160 → 2 → 160). Fix in
`js/daten.js`: die Vorbei-Abfrage filtert Rauschen per
`or=(pruefung.eq.falsch,beste_rendite.gte.0,and(beste_rendite.is.null,rendite.gte.0))`
aus und lädt bis 1000 Zeilen. **Bekannte Grenze:** wachsen die drei
Archive (Verlauf + Falsch + Knapp-Archiv, Stand 14.8.: 442) über 1000,
fallen die ältesten wieder aus dem Fenster — dann braucht es getrennte
Abfragen oder eine höhere Grenze.

> Karam hat es bemerkt: „Ich hab eine Chance gesehen, die war kurz da, dann
> war sie weg — aber nicht im Verlauf."

Dazu gehört die Anzeige (`js/daten.js`): sie verlangte, dass **auch der
zuletzt** gesehene Wert über der Schwelle liegt. Jetzt zählt der **beste**
je gesehene Wert — der Verlauf beantwortet „hätte sich das gelohnt?", und
darauf antwortet der Höchststand, nicht der Zufallswert beim Verschwinden.

## Der Nachmittag des 13.8.2026 — was ich kaputtgemacht und wieder repariert habe

Zwei Ausfälle an einem Tag, beide von mir ausgelöst. Damit es niemand
wiederholt:

**Ausfall 1, 45 Minuten.** Zwanzig Bereichs-Scanner statt einem (Änderung vom
12.8.) erzeugten 67 % der Datenbankzeit in `net.http_post`. Verbindungspool
erschöpft, PGRST002, erst ein Neustart durch Karam half. Behoben: die 19
leeren Bereiche von 1–2 auf 10 Minuten gestreckt — sie lieferten in 24
Stunden **null** Paare bei ~17 000 Läufen.

**Ausfall 2, rund 25 Minuten.** Beim Versuch, vier weitere Marktarten
einzusammeln, wuchs die Smarkets-Aufnahme, und der Scanner fiel reihenweise
mit HTTP 546 `WORKER_RESOURCE_LIMIT` aus. Behoben durch Zurücknehmen und ein
kleineres Zeitfenster (72 h → 30 h).

### Drei Messwerte, die man kennen muss, bevor man hier etwas ändert

| | |
|---|---|
| Smarkets drosselt gleichzeitige Abrufe | sequenziell 2492 Kurse, 4 parallel nur **990** — unsichtbar, `hole()` gibt still auf |
| Der Sammler brauchte immer ~145 s | wurde aber **jede Minute** gerufen, lief also dauerhaft zwei- bis dreifach parallel |
| Der Scanner sitzt dicht an der Speichergrenze | 2065 Smarkets-Märkte gehen, 2667 nicht mehr |

**Die Zahl, an der jede Änderung am Sammler zu messen ist, heißt
`mit_quoten` — nicht `dauer_ms`.** Schneller und unvollständig ist schlechter
als langsam und vollständig.

## Anpfiff und Buchstimmigkeit (13.8.2026 abends)

Zwei neue Spalten in `orion_funde`, eine neue Funktion, ein neuer Takt.

| Spalte | was drinsteht |
|---|---|
| `beginnt_am` | **Anpfiff des Ereignisses**, wie ihn das Gegenbuch nennt. NULL = kein Buch nennt ihn |
| `beginnt_quelle` | welches Buch (`smarkets` oder `betfair`) |
| `buch_summe` | **Stimmigkeitsprobe** des Gegenbuchs, nur bei Siegermärkten |

Gepflegt von `orion_zeiten_stimmigkeit()`, Takt `orion-zeiten-takt`, jede
Minute. Dazu `orion_karteileichen_beenden()` im selben Takt.

**Warum in der Datenbank und nicht im Scanner.** Beides steht bereits in
`smarkets_snapshot` und `bridge_odds`; die Fundzeile trägt mit `bf_partie`
den exakten Ereignisnamen des Gegenbuchs, über den der Scanner gepaart hat.
Der Weg über SQL braucht deshalb keinen zweiten Datenbestand, kein Ausrollen
und erzeugt keine zweite Fassung, die auseinanderlaufen kann.

### Warum Polymarket den Anpfiff NICHT liefert

Gemessen gegen die echte Schnittstelle: `gameStartTime` steht bei **78 von
594** Fußballmärkten, und wo er steht, widerspricht er teils dem `endDate`
(ein Markt mit endDate 13.03. trug gameStartTime 08.05.). Als Quelle
unbrauchbar. Betfair (`marketStartTime`) und Smarkets (`start_datetime`)
nennen ihn verlässlich, Kalshi nur mit Uhrzeit im Ticker.

Gemessen: **80 von 120** Live-Zeilen bekommen dadurch einen Anpfiff. Die
übrigen paaren gegen Polymarket oder Kalshi — dort steht ehrlich
„nicht angegeben".

### Die Stimmigkeitsprobe

Die Summe der Gegenwahrscheinlichkeiten aller Ausgänge **eines** Marktes auf
der Back-Seite muss über 1,00 liegen — das Übergewicht, von dem eine Börse
lebt. Liegt sie darunter, könnte man bei diesem einen Buch alle Ausgänge
gleichzeitig backen und sicher gewinnen. Das gibt es nicht. Also ist nicht
der Markt großzügig, sondern der Schnappschuss **in sich unstimmig**, meist
weil ein Kurs stehengeblieben ist.

Gemessen über 109 Smarkets-Siegermärkte: Median **1,0258**, 93 darüber,
16 darunter (min 0,9573). Und über die Live-Zeilen:

| Klasse | Zeilen | davon über 2 % | Anteil | mittlere Rendite |
|---|---|---|---|---|
| Buch stimmig | 50 | 2 | 4 % | **−0,43 %** |
| Buch **unstimmig** | 21 | 4 | **19 %** | **+0,99 %** |
| nicht messbar | 49 | 5 | 10 % | +0,12 % |

**Eine Zeile auf einem unstimmigen Buch zeigt fünfmal so oft über 2 Prozent
wie eine auf einem stimmigen** — und die mittlere Rendite springt um 1,4
Punkte. Das ist derselbe Fehler wie am 13.8. vormittags („ein alter Kurs"),
nur von innen sichtbar: ohne Vorgeschichte, ohne zweites Buch, sofort.

> **Es wird nichts gesperrt.** Der Wert wird mitgeschrieben und auf der Karte
> als Warnung gezeigt. Erst messen, dann sperren.

Nur Siegermärkte: je Partie führt Smarkets mehrere Über/Unter-Linien unter
demselben Ereignisnamen, ein Zugriff über (ev, art) träfe eine beliebige.
Eine falsche Zahl wäre schlechter als keine, deshalb steht dort NULL.

### Karteileichen

`orion_karteileichen_beenden()` beendet Live-Zeilen, deren Anpfiff über
**6 Stunden** zurückliegt. Der Scanner beendet über `endet_am`, und das liegt
bei Polymarket gemessen bei **59 von 64** Zeilen innerhalb einer Stunde am
Anpfiff — der Fall ist also meist abgedeckt. Nicht abgedeckt: eine Zeile,
deren Gegenbuch einen späteren Termin nennt. Sechs Stunden statt vier, weil
Cricket und Kampfabende länger laufen.

## Betfair-Sportkarte: MMA war nie erreichbar (13.8.2026)

`orion_bf_sport` trug für `mma` die eventTypeId **26420**. Die Bridge meldet
in `stats.et_namen` aber **26420387** für „Mixed Martial Arts". Ein Zeichen
zu wenig, und damit kam kein einziger Betfair-MMA-Markt je im Bereich an —
lautlos, weil unbekannter Bereich planmäßig „nichts" bedeutet. Korrigiert;
im Rohbestand liegen 13 solche Märkte.

Das ist auch die Erklärung dafür, dass `geprueft` bei dieser Zeile als
einziger auf `false` stand. **Die Spalte hat funktioniert — es hat nur
niemand hingesehen.**

## Buchprobe auf ALLE Wettarten erweitert (13.8.2026, spät)

`orion_zeiten_stimmigkeit()` prüfte anfangs nur Siegermärkte — gemessen
fehlte die Summe bei 30 von 30 Über/Unter- und 2 von 2 BTTS-Zeilen. Der
Schlüssel zur Erweiterung ist die **Linie**: der Smarkets-Schnappschuss
trägt sie als eigenes Feld (759 von 759 Ü/U-Märkten), die Betfair-Marktart
enthält sie im Namen (`OVER_UNDER_35` → 3.5), die Fundzeile am Ende von
`mannschaft`. Über (Ereignis, Art, Linie) ist der Markt eindeutig — die
Sorge, eine beliebige Linie zu treffen, ist damit gegenstandslos.

Gemessen nach der Erweiterung: 85 von 94 Live-Zeilen messbar, 26 weitere
unstimmige gesperrt. Jede Karte zeigt das Ergebnis jetzt in der Prüfzeile
(stimmig / UNSTIMMIG / nicht messbar).

## Chancen leben jetzt (13.8.2026, nachts)

Eine Chance muss dauerhaft beobachtet werden und beim Verschwinden sofort
in den Verlauf. Drei Schrauben, alle vorher gemessen:

| Schraube | vorher | nachher | Beleg |
|---|---|---|---|
| Fußball-Scanner | jede Minute | **alle 20 s** | 3,7 s je Lauf, 0 Fehler in 60 Läufen; lief bis 12.8. so (3825 Läufe/Tag) |
| Smarkets-Sammler | alle 10 min | **alle 2 min** | 26 s je Lauf bei Fenster 30 h — keine Überlappung möglich (die Drosselung am 13.8. kam von MINÜTLICHEM Aufruf bei 145 s Dauer) |
| Register `takt_sek` | 600 bei den 17 leeren Bereichen | **3600** | der Wächter misst „Bereichslauf steht" an `takt_sek × 3` — Register und cron müssen übereinstimmen, sonst stündlicher Fehlalarm |

Damit: eine verschwundene Fußball-Chance ist nach **spätestens 40 s** im
Verlauf, eine Smarkets-Seite sitzt auf höchstens 2–3 min alten Kursen, die
Website fragt ohnehin alle 2 s ab. Schneller geht serverseitig nicht ohne
die bekannten Lastfallen (546, Verbindungspool).

> Die Fehlalarm-Falle zum Mitschreiben: **wer einen cron-Takt ändert, muss
> `orion_bereiche.takt_sek` mitändern.** Der Wächter liest das Register,
> nicht die cron-Tabelle.

## Durchgang 3: Betfair direkt (13.8.2026, nachts — Scanner v21)

Gemessen: alle 12 Paarungsrichtungen kamen in 24 h vor, aber Betfair nur
über den Polymarkt-Anker. Führte Polymarket eine Partie nicht, wurde
Betfair dort mit niemandem verglichen. Jetzt läuft ein dritter Durchgang:
Betfair-Siegermärkte ohne Polymarkt-Anker direkt gegen Smarkets (Fußball)
und Kalshi (jeder Bereich), über dieselbe `direktPaare`-Eindeutigkeitsregel
wie Durchgang 2. Schlüsselform `bf>sm@<partie>#<seite>`.

Trockenlauf vor dem Ausrollen (Node gegen die echten Schnappschüsse, mit
den gespiegelten Bausteinen): 30 Paare, 0 mehrdeutig, jede Seite traf
denselben Ausgang, Renditen −0,94 bis +1,78 %. Nach dem Ausrollen: Fußball
3,9–4,1 s je Lauf (unverändert), Tennis 0,5 s, 0 Fehler, erste
Direkt-Zeilen live (Hearts–Benfica, Fylkir–Afturelding, Santos–Macara —
alles Partien, die Polymarket nicht führt).

## Rechnungsnummern vergibt die Datenbank (14.8.2026)

Vorher errechnete der Browser die #Nummer als djb2-Hash des Schlüssels
(90.000er-Raum). **Gemessen an 507 echten Zeilen: eine Kollision** —
#73641 gehörte zwei verschiedenen Funden, der Funker hätte den falschen
geprüft. Deshalb:

- Folge `orion_nr_folge` ab 10000, Spalte `orion_funde.nr` (bigint,
  eindeutiger Teilindex `orion_funde_nr_eindeutig`).
- `orion_nummern_vergeben()` nummeriert alle Zeilen ohne Nummer, älteste
  zuerst — hängt als vierter Aufruf im Minutentakt `orion-zeiten-takt`.
- **Kein Spalten-Default:** der 20-Sekunden-Upsert würde bei JEDEM Lauf
  für jede gesehene Zeile eine Nummer verbrennen (ON CONFLICT zieht den
  Default trotzdem) — die Nummern wären binnen Tagen siebenstellig.
- Eine Nummer wird nie neu vergeben (auch nicht nach Rauschen-Löschung);
  ein wiederbelebter Fund behält seine (der Upsert schreibt `nr` nicht).
- Frische Zeilen haben bis zu eine Minute lang keine Nummer — die Karte
  zeigt den Chip dann nicht, der Funker sagt es dazu.

## E-Mail-Meldungen (15.8.2026)

- Tabelle `orion_mail` (eine Zeile, id=1): `email`, `aktiv` — gepflegt vom
  Browser per Rechtsklick auf den Meldungen-Knopf (RLS: anon darf lesen
  und ändern; private, passwortgeschützte Seite).
- Spalte `orion_funde.gemailt` — jeder Fund wird höchstens einmal gemailt.
- Edge-Funktion `orion-melder-mail` (verify_jwt false), Takt
  `orion-mail-takt` minütlich: serverseitige Näherung der Chance
  (live, Rendite 2–5 %, ≥25 s bewährt, Menge bekannt, Gewinn ≥5 $),
  Versand über Resend. **Braucht das Geheimnis `RESEND_API_KEY`**
  (Dashboard → Project Settings → Edge Functions → Secrets); ohne meldet
  sie ehrlich `RESEND_API_KEY fehlt`. Absender `onboarding@resend.dev`
  darf beim Gratis-Resend nur an die eigene Konto-Adresse senden —
  Empfänger-Mail = Resend-Konto-Mail.

## Nur-ein-Anbieter-Regel (16.8.2026)

Vorgabe des Auftraggebers: *„Wenn ein Markt nur bei einem der Anbieter da
ist, soll er nicht gescannt werden."* Eine Arbitrage braucht immer **zwei**
Bücher — ein Bereich mit nur einer Quelle kann per Definition nie eine
ergeben und kostet trotzdem Rechenzeit.

Gemessen, wer welche Bereiche führt:

| Quelle | Bereiche |
|---|---|
| Betfair (Bridge, `orion_bf_sport`) | fussball, baseball, basketball, cricket, eishockey, esport, football, golf, mma, motorsport, tennis |
| Kalshi (`KALSHI_BEREICH`) | dieselben Sportarten + lol, valorant, esport |
| Smarkets | nur fussball |
| Polymarket | alle |

**Abgeschaltet** (`aktiv = false`) und Cron-Takt entfernt:
`politik, krypto, wirtschaft, tech, welt, wetter, kultur, golf`.
Golf ist dabei, weil Betfair zwar Golf führt, `orion_bf_maerkte` aber nur
MATCH_ODDS und OVER_UNDER lädt — Turniersieger-Märkte kommen nie an, also
standen dort 791 Polymarket-Märkte ohne jedes Gegenstück.

**Aktiv bleiben 12 Bereiche.** Scanner-Takte: 20 → 12.

**Umkehrbar:** `UPDATE orion_bereiche SET aktiv = true WHERE bereich = '…'`
plus `cron.schedule('orion-lauf-<bereich>', …)`. Genau das ist der letzte
Schritt, sobald der Kalshi-Sammler Krypto/Wetter/Wirtschaft mitholt.
