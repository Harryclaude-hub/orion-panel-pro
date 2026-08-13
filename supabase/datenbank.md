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

```
orion-lauf-fussball     20 seconds   Scanner NUR fussball
orion-lauf-tennis       * * * * *    ebenso je Bereich:
orion-lauf-basketball   * * * * *    baseball, football, lol,
orion-lauf-…            …            valorant, krypto minütlich;
orion-lauf-<bereich>    */2 * * * *  die übrigen 13 alle 2 Minuten
orion-smarkets-takt     * * * * *    Smarkets-Sammler
orion-waechter-takt     * * * * *    Wächter (siehe oben)
pm-scan-takt            * * * * *    alt, läuft noch mit
orion-kalshi-takt       */2 * * * *  Kalshi-Sammler
orion-pruefer-takt      */5 * * * *  dritte, unabhängige Rechnung
orion-rauschen-takt     */5 * * * *  löscht Minuszeilen im Verlauf
orion-wache-takt        */10 * * * * ältere Selbstkontrolle
```

Zwei Altlasten, beide harmlos, aber jemand sollte sie prüfen:
`pm-scan-takt` ruft den alten Scanner `pm-scan` auf, und `orion-wache-takt`
läuft neben dem neuen `orion-waechter-takt`. Ob sie noch etwas beitragen,
ist **ungemessen**. Neu dazu: die Aufruf-Bilanz der 20 Bereichs-Takte
(~24 000 Läufe/Tag) gegen den Supabase-Tarif ist **ungemessen** — bei
Bedarf die Welt-Takte auf `*/5` strecken, dort entstehen ohnehin 0 Paare.

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
