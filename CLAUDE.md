# Orion Panel Pro — Arbeitsanweisung

Diese Datei wird in JEDER Sitzung geladen. Sie ist die Kurzfassung der
harten Regeln. Die Langfassung mit allen Messungen steht in `UEBERGABE.md`
(Einstieg: die letzten Abschnitte), die Landkarte in `STRUKTUR.md`, die
Datenbank-Wahrheit in `supabase/datenbank.md`.

## Was das ist

Surebet-Scanner über vier Börsen (Polymarket, Kalshi, Smarkets, Betfair).
Alles läuft serverseitig auf Supabase `noexklrgtqveiclijdwp`: pg_cron ruft
Edge Functions, die schreiben nach `orion_funde`, die Website liest nur ab.
Nur Betfair braucht den Laptop des Auftraggebers, weil Betfair
Rechenzentren mit 403 sperrt (Bridge 4.0, Build 27, in
`C:\Users\Home\Desktop\ORION-BRIDGE`).

Live: `harryclaude-hub.github.io/orion-panel-pro`

## Wie mit Karam gearbeitet wird

- **Antworten auf Deutsch, militärischer Ton, beginnend mit „Jawohl, Chef".**
- **Kein Gedankenstrich (—) in irgendeiner Ausgabe.** Ausnahmslos.
- **Klartext statt Beschönigung.** Er findet Fehler zuverlässig selbst;
  ein geschöntes „läuft alles" fliegt auf und kostet Vertrauen.
- **Erst messen, dann bauen.** Ungemessenes ausdrücklich als ungemessen
  kennzeichnen. Eine Ursache ist erst belegt, wenn die Reparatur wirkt.

## Die eisernen Regeln

1. **Design ist eine eigene, löschbare Schicht.** Wer am Aussehen
   arbeitet, fasst keine Logik-Datei an. Fällt eine Design-Datei weg,
   fehlt Schmuck oder Ton, nie ein Wert und nie eine Rechnung.
2. **Funktions- und Logikbau NUR auf ausdrückliche Ansage.** Rechenwege,
   Scanner, Bridge und Takte werden bei Design- und UX-Arbeit nicht
   angefasst.
3. **Eine Änderung, die eine Schutzschicht LOCKERER macht (Wache,
   Melde-Filter, Sperren), braucht eine eigene Freigabe** — auch dann,
   wenn allgemein „setz die Verbesserungen um" gesagt wurde. Eine zu
   strenge Wache kostet Aufmerksamkeit, eine zu milde kostet Geld.
4. **Endpunkte und das Supabase-Projekt niemals umbenennen.** Laufende
   Bridges und Konten dürfen bei Updates nie brechen.

## Vor jedem Ausrollen

```
node pruefung/spiegel.test.js        Browser- und Server-Rechnung gleich
node pruefung/vollpruefung.test.js   die sieben Hürden greifen
node pruefung/zuordnung.test.js      Wortzerlegung und Paar-Belege
node pruefung/rechnung.test.js       Effektivquoten und Aufteilung
node pruefung/melder.test.js         Gruppierung der Telegram-Meldungen
```

Alle müssen grün sein. Der Spiegeltest beweist, dass beide Fassungen sich
GLEICH verhalten, nicht dass sie RICHTIG liegen; die Vollprüfung ist die
andere Hälfte.

## Ausrollen

| Was | Wie |
|---|---|
| Website | `git push` auf Harryclaude-hub, Pages baut |
| Scanner `orion-lauf` | Karam per Doppelklick auf `DEPLOY-JETZT.cmd` |
| Die zwei Telegram-Bots | `bridge/DEPLOY-MELDER.cmd` **oder** über die Supabase-MCP-Verbindung |
| SQL | Karam im SQL-Editor |

Einen `sbp_`-Access-Token gibt es nicht, auch nicht im Chat. Der
MCP-Deploy funktioniert: `files` ist ein echtes Array, das JSON vorher
maschinell bauen lassen statt von Hand schreiben.

**Cache-Marken (`?v=`) gehören zusammen.** Wird eine gemeinsame Datei
geändert (`stil.css`, `anzeige.js`, …), ziehen ALLE Betriebsseiten ihre
Marke mit, sonst laufen zwei Fassungen nebeneinander.

## Bei Design- und UX-Arbeit

- **Browser-Ansicht öffnen, bevor es losgeht.** Ohne sie schlägt jeder
  Screenshot fehl („the Browser pane is not displayed"), und dann misst
  man DOM-Werte statt zu sehen.
- **„Das Element ist im DOM" ist nicht „der Nutzer kommt dran".** Immer
  mit `document.elementFromPoint()` prüfen, was tatsächlich obenauf
  liegt. So blieb das Sperr-Overlay am 20.8. unbemerkt.
- **Wer `sperre.js` einbindet, ruft auch `Sperre.start()`** und lädt seine
  Daten erst im Erfolgs-Rückruf. Eine Datei zu LADEN heißt nicht, sie zu
  BENUTZEN.

## Fehlerklassen, die hier wirklich passiert sind

- **Stille Fehlschläge.** 40.000 Märkte verworfen, `fehler: 0` gemeldet.
  Wer nichts findet, muss sagen warum, statt Erfolg zu melden.
- **Drift zwischen zwei Fassungen.** Zwei Wege mit zwei Maßstäben; oder
  Seiten auf verschiedenen Cache-Marken. Es gibt EINE Stelle je Regel.
- **Zwei Zahlen vergleichen, die nicht zueinander gehören.** Der
  Spitzenwert von FRÜHER gegen den Kursstand von JETZT: 1051 Fehlurteile
  am 19.8.
- **Einen Feldnamen für die Wahrheit halten.** `pm_preis` und `bf_quote`
  tragen **buch_1 und buch**, nicht Polymarket und Betfair. Erst
  nachsehen, was drinsteht.
- **Namensgleichheit ohne Sachbezug.** „Eintracht Frankfurt" gibt es im
  Fußball UND in League of Legends.
- **Eine Türsperre wirkt nur, wenn ALLE sie als ERSTES nehmen.** Jede
  Funktion, die `orion_funde` massenhaft ändert, ruft
  `orion_schreibsperre()` als allererste Anweisung.
- **Vor dem Abschießen die Befehlszeile lesen, nie nach Prozessnamen
  gehen.** `Get-Process node | Stop-Process` erschlägt auch fremde
  Dienste.

## Wo Vorsicht gilt

- **Egress:** Das Free-Limit sind 5 GB/Monat, im August gerissen (339 %).
  Jede neue Abfrage im Browser-Takt und jeder Scanner-Lauf zählt. Vor
  neuen Takten den Datenabfluss abschätzen.
- **Betfair-Mengen (`bs`/`ls`) aus der Bridge sind UNGEMESSEN** in ihrer
  Währung (Kontowährung). Renditen sind davon nie betroffen, Quoten sind
  währungsfrei.
- **Tennis-Restrisiko:** Gibt ein Spieler NACH Matchbeginn auf, zahlt
  Polymarket den Weiterkommer, Betfair erklärt void. Dann zerfällt die
  Absicherung. Steht auch in `logik.html`.
