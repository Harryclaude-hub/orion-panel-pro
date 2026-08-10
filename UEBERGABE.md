# Orion Panel Pro — Übergabe

> **Diese Datei ist die Wahrheit über das Projekt. Halte sie aktuell.**
> Nach jeder wesentlichen Änderung — neue Quelle, neue Regel, neuer Messwert,
> erledigter Punkt aus Abschnitt 7 — wird sie im selben Commit nachgezogen.
> Sie aktualisiert sich NICHT von selbst. Eine veraltete Übergabe ist
> schlimmer als keine, weil man ihr glaubt.

Stand: 10. August 2026, Nachmittag. Dieser Text reicht, um ohne Vorwissen
weiterzuarbeiten. Alle Zahlen darin sind gemessen, nicht geschätzt.

**Live:** https://saifokaram1-hub.github.io/orion-panel-pro/
**Repo:** `saifokaram1-hub/orion-panel-pro` · lokal `C:\Users\Home\orion-panel-pro`
**Supabase:** `noexklrgtqveiclijdwp` · Sperrwort der Website: `ARBRADAR2026`

---

## 1. Was das Programm ist

Ein Surebet-Scanner zwischen **Börsen** (nie Buchmachern): er sucht Paare,
bei denen zwei Bücher denselben Ausgang unterschiedlich bepreisen, sodass
beide Seiten zusammen unter 100 % liegen.

**Es läuft vollständig auf Supabase, rund um die Uhr.** Die Website rechnet
nichts, sie liest nur ab. Kein Browser muss offen sein.

---

## 2. Die Bücher, gemessen

| Buch | Rolle | Konto nötig? | aus Supabase erreichbar? | Stand |
|---|---|---|---|---|
| **Polymarket** | Börse | nein | **ja** | läuft, ~400 Märkte im 72h-Fenster |
| **Kalshi** | Börse | nein | **ja** | läuft, ~206 Märkte |
| **Betfair** | Börse | **ja** | **nein, 403** | nur über Bridge auf dem Heim-PC |
| Orbit / 96ex | **Broker**, kein eigenes Buch | — | nein, 403 | nur Linkziel |
| **Smarkets** | Börse | **nein** | **ja, gemessen** | **noch nicht eingebaut** |

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

Orbit benutzt Betfairs Marktnummern unverändert (3 von 3 IDs trafen den
richtigen Wettbewerb). Es ist **eine zweite Tür zum selben Raum**.

`96ex.com` ist tot: HTTP 000, dreimal 21 s Zeitüberschreitung, auch die
Startseite. Deshalb zeigen alle Betfair-Links auf `orbitexch.com`.

### Smarkets — der wichtigste offene Fund

Echte Wettbörse, kein Buchmacher. **Aus Supabase gemessen am 10.8.:**

```
Fussballspiele  200  314 ms   50 Events
Maerkte         200  364 ms  917 Maerkte
Quoten          200   42 ms   45 Quoten mit voller Tiefe
URTEIL: keine Sperre
```

124 Fußballspiele im 72h-Fenster, 1758 Märkte, 129 Siegermärkte.
**31 von 51 Polymarket-Partien gibt es auch dort** (Kalshi: 17, Betfair: 39).

Ungeprüft: Preiskodierung (`price: 2000` ist vermutlich 20,00 % → Quote 5,0),
Kommissionssatz, Läuferzuordnung.
Nachmessen: `curl -s https://noexklrgtqveiclijdwp.supabase.co/functions/v1/smarkets-machbar`

---

## 3. Wie es aufgebaut ist

```
pg_cron ──┬─ orion-lauf      jede Minute     sucht und rechnet
          ├─ pm-scan         jede Minute     (alt, läuft noch mit)
          ├─ orion-kalshi    alle 5 Minuten  holt Kalshi (52 s je Durchlauf)
          ├─ orion-pruefer   alle 5 Minuten  Alter, Rechnung, Links
          ├─ orion-rauschen  alle 5 Minuten  löscht Minuszeilen im Verlauf
          └─ orion-wache     alle 10 Minuten prüft, ob das alles noch läuft

Website (alle 2 s)  →  liest orion_funde + orion_uebersicht, rechnet nichts
Bridge auf Heim-PC  →  bf-bridge  →  bridge_odds  (nur für Betfair)
```

### Dateien

```
index.html            Panel mit drei Reitern
einstellungen.html    Weg B (Zertifikat + Secrets) und Weg A (Bridge)
logik.html            erklärt die Suche, als Textdatei herunterladbar
js/konfig.js          alle Schwellen an einer Stelle
js/rechnung.js        Quoten, Gebühren, Aufteilung   120 Prüfungen
js/zuordnung.js       Marktpaarung                   146 Prüfungen
js/daten.js           liest ab, filtert, richtet Broker-Links
js/anzeige.js         Tafel, Karten, Gegenprobe, Puffer
js/sperre.js          Sperrbildschirm, Overlay wird ENTFERNT + Wache
bridge/               Bridge für den Heim-PC, Build 18  158 Prüfungen
```

### Datenbank

```
orion_funde       jeder Fund, live und Verlauf, mit Prüfergebnis
orion_laeufe      Protokoll jedes Scans
orion_wache       Selbstkontrolle
kalshi_snapshot   öffentliche Kalshi-Kurse
bridge_odds       Betfair, von der Bridge  (NICHT anfassen, Format ist fix)
orion_geheim      privater Schlüssel des Zertifikats, RLS ohne Policy
```

Funktionen: `orion_uebersicht()`, `orion_bf_maerkte()`,
`orion_pruefung_schreiben()`, `orion_rauschen_loeschen()`

---

## 4. Die Regeln, die nicht gebrochen werden dürfen

1. **Nur gleiche Frage gegen gleiche Frage.** Zugelassen sind `sieger`,
   `unentschieden`, `ueber_unter` (nur die Gesamtlinie). Ohne diese Regel
   meldete das Programm am 9.8. **663 Scheinchancen mit bis zu 184 %**.
2. **Unbekannte Gebühr niemals als 0.** Rückfall auf 7 %.
   Beleg: 0,49 gegen 2,03 sieht ohne Gebühr nach +0,46 % aus, mit 4 % sind
   es −0,52 %.
3. **Zwei verschiedene Ähnlichkeitsmaße.** Partie durch den *kürzeren* Namen
   (Schwelle 0,50), Läufer durch den *längeren* (0,80). Beides nötig.
4. **Die Partie kommt aus `ev`, nicht aus `k`.** Bei MATCH_ODDS steht sie in
   `k`, bei allen anderen Typen stehen dort die Läufer. `paar(k) || paar(ev)`
   fiel nie auf `ev` zurück → 0 Paare bei 849 gegen 865 Märkten.
5. **Vereinskürzel und Sportbegriffe zählen nicht als Namensbeleg.**
   Sonst: „Cruzeiro EC vs CR Flamengo" traf „Flamengo v EC Vitoria" — zwei
   verschiedene Spiele, gemeldet mit 16,02 %.
6. **`bf-bridge`, das POST-Format und `profiles.bridge_token` sind
   unantastbar.** Nur erweitern, nie umbauen. Auf zwei PCs laufen Bridges.

---

## 5. Was geprüft ist

```
node pruefung/rechnung.test.js     120 Prüfungen
node pruefung/zuordnung.test.js    146 Prüfungen
node bridge/pruefung.js            158 Prüfungen
```

Jede Schutzregel hat einen Test, der sie **auslöst**, nicht nur einen, der
sie umgeht.

**Unabhängige Nachprüfung aller Funde** (dritte, frisch geschriebene
Rechnung, weder Server- noch Browsercode), 10.8.:

```
628 Zeilen geprüft
608 einwandfrei
 20 ohne Gebührensätze (Zeilen von vor dem Umbau)
  0 Abweichung bei Rendite, Kehrwertsumme, Aufteilung
  0 Fälle, in denen die beiden Ausgänge NICHT gleich zahlen
```

---

## 6. Stand der Anzeige

Drei Reiter: **Chancen**, **Knappste Paare**, **Verlauf**.
Ganz oben eine **Anbietertafel** mit Ampel, Aktualität, Umfang, Funden,
Tempo und dem Zustand von Supabase und allen Takten.

Jede Karte trägt: Uhrzeit oben rechts, Rendite **in Worten** samt Vergleich
ohne Gebühren, **Gegenprobe** beider Ausgänge, Aufteilung in Prozent,
maximalen Einsatz aus der Markttiefe, Puffer, Prüfzeile, beide Links mit
Kopierknopf.

**Verlauf enthält nur Funde, die im Plus waren** — beide Werte (zuletzt und
beste) müssen ≥ 0 sein. Alles andere wird gelöscht, serverseitig alle
5 Minuten.

---

## 7. Offen, nach Wichtigkeit

1. **Smarkets einbauen.** Der größte Hebel: dritte Börse, kein Konto, kein
   Heim-PC, 31 gemeinsame Partien. Vorher messen: Preiskodierung,
   Kommission, Läuferzuordnung.
2. **Anpfiffzeit speichern und anzeigen.** Ein Markt, der in 8 Stunden endet,
   dessen Spiel aber in 20 Minuten beginnt, ist etwas völlig anderes.
   Braucht eine Änderung am Scanner (`st` aus den Bridge-Märkten mitspeichern).
3. **Weitere Betfair-Markttypen.** Ungenutzt im Fenster: 125
   BOTH_TEAMS_TO_SCORE, 121 DOUBLE_CHANCE, 119 DRAW_NO_BET, 100 HALF_TIME.
   Jeder braucht eine eigene Zuordnungsregel plus Prüfstand.
4. **Bridge auf Build 18 starten.** Liegt fertig im Repo, läuft aber nicht.
   Bringt: 8.000 statt 3.919 Märkte und den echten Kommissionssatz je Markt
   statt des 7-%-Rückfalls.
5. **Nicht-Sport (Politik, Krypto).** Gemessen und **bewusst nicht gebaut**:
   4.779 gegen 4.990 Märkte ergaben 13 vermeintliche Treffer, **alle falsch**
   ($64.000 gegen $64.750, teils sogar verschiedene Tage). Titelähnlichkeit
   ist dort das falsche Werkzeug — es bräuchte Zerlegung von Schwelle und
   Datum mit Gleichheitsprüfung.
6. **Kaltstart-Fehler.** `orion-lauf` scheitert gelegentlich direkt nach dem
   Aufspielen mit `WORKER_RESOURCE_LIMIT`. Im Dauerbetrieb 4 von 5 sauber,
   die Wache fängt es ab. Ursache nicht abschließend geklärt.
7. **Prüfstand, der Server- gegen Browserfassung hält.** `rechnung.ts` und
   `zuordnung.ts` sind Spiegel der JS-Dateien und können auseinanderlaufen.

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

**Drei Zustände, nie zwei.** Richtig, falsch, *oder nicht prüfbar*. Ein Link,
den man nicht prüfen kann, ist nicht „tot". Eine Zeile ohne gespeicherte
Gebührensätze ist nicht „falsch gerechnet".

**Was nicht gemessen wurde, wird als ungemessen gekennzeichnet.**
