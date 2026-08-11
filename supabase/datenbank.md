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
| `orion_funde` | jeder Fund, live und Verlauf. Spalten `art` und `bereich` seit 11.8. |
| `orion_laeufe` | Protokoll jedes Scans |
| `orion_wache` | Selbstkontrolle, jede Minute eine Zeile |
| `orion_bereiche` | **Register der 20 Bereiche** mit `pm_tags` und `takt_sek` |
| `orion_kurse` | Wechselkurs USD→EUR, von der Datenbank selbst geholt |
| `orion_kurs_anfrage` | offene pg_net-Anfrage, damit nicht doppelt gefragt wird |
| `kalshi_snapshot`, `smarkets_snapshot` | Kurse der Sammler |
| `bridge_odds` | Betfair, von der Bridge. **Format fix, nie umbauen** (Regel 6) |

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
- `orion_verdacht()` — **elf Prüfmuster**. Wichtigstes: die Zuordnung wird
  über `orion_kernwoerter()` **unabhängig vom Scanner nachgerechnet**. Teilen
  zwei Titel kein unterscheidendes Wort, ist die Paarung verdächtig — egal
  was der Scanner als `zuordnung` eingetragen hat.
- `orion_kernwoerter(t)` / `orion_stoppwort(w)` — Wortzerlegung in SQL,
  bewusst getrennt von der JS-Fassung. Zwei unabhängige Wege.

**Betfair-Vorfilter** — `orion_bf_maerkte(fenster_h)`. Liefert MATCH_ODDS und
OVER_UNDER aus `bridge_odds`, **begrenzt auf 12 Stunden und 250 Märkte**.

> Diese Begrenzung ist ein **Notbehelf**, keine Lösung. Ohne sie bricht
> `orion-lauf` mit HTTP 546 (`WORKER_RESOURCE_LIMIT`) ab. Von rund 1060
> Märkten sehen wir 250. Sie gehört aufgehoben, sobald der Scanner je
> Bereich läuft — siehe UEBERGABE.md 8d, Punkt 2.

## Takte

Abgefragt am 11.8.2026, alle `active`:

```
orion-lauf-takt       15 seconds     Scanner
orion-smarkets-takt   * * * * *      Smarkets-Sammler
orion-waechter-takt   * * * * *      Wächter (siehe oben)
pm-scan-takt          * * * * *      alt, läuft noch mit
orion-kalshi-takt     */2 * * * *    Kalshi-Sammler
orion-pruefer-takt    */5 * * * *    dritte, unabhängige Rechnung
orion-rauschen-takt   */5 * * * *    löscht Minuszeilen im Verlauf
orion-wache-takt      */10 * * * *   ältere Selbstkontrolle
```

Zwei Altlasten, beide harmlos, aber jemand sollte sie prüfen:
`pm-scan-takt` ruft den alten Scanner `pm-scan` auf, und `orion-wache-takt`
läuft neben dem neuen `orion-waechter-takt`. Ob sie noch etwas beitragen,
ist **ungemessen**.
