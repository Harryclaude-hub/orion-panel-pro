# Orion Panel — Übergabe für einen Neustart

Stand: 9. August 2026. Dieser Text enthält alles, was ein Neuaufbau braucht:
das Ziel, die Rechnung, die teuer erarbeiteten Schnittstellen-Eigenheiten, die
Fehlerklassen, die uns Tage gekostet haben, und eine ehrliche Bewertung, was
funktioniert und was nicht.

---

## 0. DER WICHTIGSTE FUND — ganz oben, weil er alles erklärt

**Wir haben den größten Teil von Polymarket nie gesehen.**

Der Scanner fragte den Bestand so ab:

```
https://gamma-api.polymarket.com/markets?closed=false&active=true&limit=100&offset=N
```

Das liefert rund **2100 Märkte**, davon nach Prüfung **1420 handelbar** — und darin
sind **28 Sportmärkte, von denen KEIN EINZIGER in unter 60 Tagen auflöst.**
Deshalb fanden wir tagelang nur Langläufer (Wahl 2027, Ballon d'Or) und fast
keine Überschneidung mit Betfair, das überwiegend Sport führt.

**Über die Events-Schnittstelle mit Themen-Kennung sieht es völlig anders aus:**

```
https://gamma-api.polymarket.com/events?closed=false&limit=100&tag_slug=<thema>
```

| tag_slug | Events | Märkte |
|---|---|---|
| mlb | 100 | **2515** |
| sports | 100 | **1905** |
| soccer | 100 | **1647** |
| nfl | 100 | **1169** |
| nba | 22 | **631** |
| epl | 45 | **569** |

Nachgeprüft an `soccer`: von 1098 Märkten sind **641 handelbar** (Orderbuch,
aktiv, offen) und **106 lösen in unter 7 Tagen auf** — echte Einzelspiele wie
„CD Concepción vs. O'Higgins FC: O/U 2.5" oder „New England Revolution vs.
Houston Dynamo". **Genau die Märkte, die es auch bei Betfair gibt.**

**Folgerung für den Neuaufbau:** Der Bestand muss über `/events?tag_slug=…`
je Sportart geholt werden, nicht (nur) über `/markets`. Das ist mit hoher
Wahrscheinlichkeit der Grund, warum bisher kaum Cross-Book-Chancen entstanden.
Das ist eine **Hypothese mit starker Datenlage**, kein Beweis: dass die Märkte
existieren, ist gemessen; dass daraus Arbitrage entsteht, muss der neue
Scanner erst zeigen.

---

## 1. Was das Programm ist

Ein **Surebet-Scanner zwischen zwei Börsen**: Polymarket und Betfair (der
Nutzer handelt Betfair über den Broker 96ex/Orbit). Es vergleicht Kurse
desselben Ereignisses auf beiden Büchern und meldet, wenn beide Seiten
zusammen unter 100 % liegen — dann ist der Gewinn unabhängig vom Ausgang.

**Nur Börsen, nie Buchmacher.** An einer Börse wettet man gegen andere Nutzer,
der Betreiber verdient an der Kommission und sperrt keine Gewinner. Das ist
eine feste Vorgabe des Auftraggebers.

---

## 2. Die Rechnung (verifiziert, 158 Prüfungen)

```
Effektivquote nach Gebühr:   qE  = 1 + (q − 1) · (1 − Gebühr)
Summe der Kehrwerte:         inv = 1/qE1 + 1/qE2
Arbitrage, wenn              inv < 1
Aufteilung von Einsatz S:    S1  = S · (1/qE1)/inv,   S2 = S − S1
Auszahlung (bei BEIDEN Ausgängen gleich):  S/inv
Rendite:                     (1/inv − 1) · 100 %
```

**Ausdrücklich nicht 50/50**, sondern so, dass beide Ausgänge denselben Betrag
zurückgeben. Nur dann ist der Gewinn unabhängig vom Ergebnis.

**Dagegenhalten (Lay)** — der Schlüssel für Märkte mit vielen Teilnehmern
(Wahlen, Meister, Ballon d'Or), wo Polymarket binär fragt „Gewinnt X?":

```
qE = 1 + (1 − Gebühr) / (L − 1)          L = Lay-Quote
Eingesetzt wird die Haftung: stake · (L − 1),  max = laySize · (L − 1)
```

### Gebühren — niemals pauschal rechnen

- **Betfair:** Kommission auf den **Nettogewinn**. Satz steht **je Markt** in
  `description.marketBaseRate` (2–7 %, nicht überall 5 %).
- **Polymarket:** Gebühr je **Anteil**, preisabhängig:
  `Gebühr = Satz · min(p, 1−p)^exponent`, dann `qE = (1 − Gebühr)/p`.
  Felder: `feesEnabled`, `feeType`, `feeSchedule{rate, exponent, takerOnly}`.
  Gemessen (5.8.2026): von 1200 Märkten mit Orderbuch haben **1088 Gebühren** —
  747× 4 %, 203× 5 %, 138× 7 %, alle `takerOnly:true`, `exponent:1`.
  **Wer zum Briefkurs kauft, ist immer Taker und zahlt.**
- Die Polymarket-Gebühr ist bei p ≈ 0,50 am höchsten — genau bei Zweikämpfen.
- **Unbekannte Gebühr NIEMALS als 0 durchgehen lassen.** Rückfall auf den
  ungünstigsten bekannten Satz (7 %). Mit `feePm = 0` entstanden reihenweise
  Scheinchancen: 0,49 gegen Betfair 2,03 sieht ohne Gebühr nach +0,46 % aus,
  mit 4 % sind es **−0,52 %**.

---

## 3. Schnittstellen-Eigenheiten (teuer erarbeitet, nicht neu herleiten)

### Polymarket
- **Gamma deckelt JEDE Antwort bei 100 Einträgen**, egal welches `limit`.
  Nur `offset`-Blättern liefert alles.
- **Hinter dem letzten Eintrag antwortet Gamma mit HTTP 422**, nicht mit einer
  leeren Liste. Das ist das Ende, kein Fehler.
- **Preise im Stapel:** `POST /books` mit bis zu 500 Token (250 ist sicher).
  Die `asks` kommen **absteigend** → der Kaufpreis ist das **Minimum**, nicht
  `asks[0]`. Diese Verwechslung erzeugt Fantasiepreise.
- Einzelabruf `/price?token_id=X&side=sell` = ASK. `side=buy` ist der Bid und
  erzeugt Fake-Arbitrage. `outcomePrices`/Mid-Preise **nie** verwenden.
- **Links:** `/event/<event-slug>/<markt-slug>` trifft den Markt.
  `/event/<markt-slug>` allein ist 404. Ein Event bündelt bis zu 128 Märkte.
- **negRisk** heißt: die Märkte des Events schließen einander aus, genau einer
  gewinnt. Nur dann ist „alle JA-Seiten kaufen" eine Absicherung.

### Betfair
- **Blockt Cloud-Server** (403 Cloudflare) → die Bridge muss auf einem Heim-PC
  laufen.
- **`LIMITED_ACCESS` liefert ein gültiges Token** (bei `SUSPENDED`/`KYC_SUSPEND`):
  Wetten gesperrt, **Kurse lesen erlaubt**. Nur `FAIL` ohne Token ist echt blockiert.
- `listMarketCatalogue` deckelt bei **1000** → Bestand über Zeitfenster zerlegen.
- `listMarketBook` mit `EX_BEST_OFFERS`: **200 Punkte je Anfrage, Kursabruf
  wiegt 5 → 40 Märkte pro Anfrage**, fest.
- Die dokumentierte Grenze „5 Anfragen/s" gilt **pro Markt**, nicht global.
- **TOO_MUCH_DATA** versteckt sich hinter dem Sammelcode **ANGX-0001**; der
  wahre Grund steht im `APINGException` hinter der requestUUID. Antwort: das
  Zeitfenster halbieren, so tief wie nötig (bis 2 Minuten), still — das ist
  Normalbetrieb, kein Fehler.
- **Nur die Exchange** (`SportsAPING`, `availableToBack`/`availableToLay`),
  nie Betfair Sportsbook.
- Live-Key kostet **£499**; Delayed-Key gratis. Gemessener Unterschied bis zum
  Schirm: Delayed 72–132 s, Live 12–47 s → der Live-Key spart **~73 s**, nicht
  Scangeschwindigkeit.
- **betfair.com ist aus Österreich im Browser gesperrt.** Die Marktnummer im
  Link stimmt, die Seite weist ab. Lösung: Links auf den Broker umschreiben
  (Muster mit `{id}` für die Marktnummer).

---

## 4. Architektur, wie sie jetzt ist

```
Polymarket  ─┐
             ├─→  [pm-scan]  1×/Min per pg_cron  →  Tabelle pm_snapshot  ─┐
Betfair ─→ [Bridge auf Heim-PC] ─→ [bf-bridge] → Tabelle bridge_odds ─────┼─→ Website
                                                                          ┘
```

- **Website:** eine einzige statische `index.html` (~290 KB) auf GitHub Pages.
  Push auf `main` = Veröffentlichung.
- **Bridge:** `bridge/betfair-bridge.js`, als `.exe` im Release `bridge-v1`.
  Liest **beide** Seiten selbst, rechnet lokal, lädt Quoten und Funde hoch.
  Zugangsdaten bleiben in `bridge-config.json` neben der exe.
- **pm-scan:** Edge Function, holt den Polymarket-Bestand zentral (785 ms) und
  legt ihn in `pm_snapshot` ab. Vorher lud **jeder Browser 13,6 MB** Katalog;
  jetzt sind es **865 KB in ~1 s**.
- **Supabase** `noexklrgtqveiclijdwp`: Tabellen `profiles`, `activity`,
  `opportunities`, `bridge_odds`, `pm_snapshot`, `app_settings`, `opp_daily`.
  `pg_cron` und `pg_net` sind im kostenlosen Tarif verfügbar und eingerichtet.

### Messwerte (9.8.2026)
| | |
|---|---|
| GitHub Pages, ganze Seite | 95 KB gzip, erste Antwort 144 ms, gesamt 322 ms |
| Polymarket-Katalog im Browser (alt) | 13,6 MB, 21 Abrufe, 3–12 s |
| Polymarket-Katalog über Server (neu) | 865 KB, 1 Abruf, ~1 s |
| pm-scan auf dem Server | 785 ms für 2100 → 1420 handelbare Märkte |
| Betfair-Katalog der Bridge | 8247 Märkte, voller Durchlauf ~24 s |

---

## 5. Fehlerklassen, die uns Tage gekostet haben

**Diese Liste ist der wertvollste Teil dieses Dokuments.** Jeder Punkt war ein
echter Fehler, der von außen nicht als solcher zu erkennen war.

1. **Der Sperrbildschirm blieb im Dokument liegen.** Beim Entsperren wurde nur
   das Versteck-CSS entfernt, nicht das Overlay. Es ist bildschirmfüllend mit
   `z-index: 2147483647` — die Seite sah normal aus, schluckte aber jeden Klick.
   Gemessen: **49 von 53 Knöpfen unerreichbar.** Symptom: „die Buttons
   funktionieren nicht".
   → **Regel: Nach dem Entsperren IMMER das Overlay entfernen, plus eine Wache,
   die ein verwaistes Overlay wegräumt.**

2. **Zugang nur im sessionStorage.** Jeder neue Tab verlangte das Passwort neu;
   bei gesperrtem Speicher landete das „ok" im Arbeitsspeicher, den das
   folgende `location.reload()` löschte → **Endlosschleife**, fühlt sich an wie
   „lädt ewig".
   → **Regel: localStorage zuerst, und prüfen ob wirklich geschrieben wurde.**

3. **Ein `disabled` Button feuert keinen Klick.** Der Einsatz-Knopf war
   während der Bestätigungsschleife gesperrt — Drücken bewirkte nichts, ohne
   jede Erklärung.
   → **Regel: nie `disabled`, sondern optisch gesperrt + Klick nennt den Grund.**

4. **`window.open` nach asynchroner Arbeit wird blockiert.** Die Märkte wurden
   erst nach Protokoll und Verlauf geöffnet; bis dahin gilt die Nutzergeste als
   abgelaufen.
   → **Regel: Fenster als ERSTES im Klick-Handler öffnen.**

5. **`content-visibility:auto` ließ Zeilen als Einzeiler erscheinen** und dann
   springen, wobei sie überlappten. Symptom: „es wird immer zu einem Einzeiler",
   „die Sachen gehen übereinander".
   → **Regel: nur bei sehr langen Listen, und dann mit korrekter Höhe.**

6. **Sekündliches `innerHTML` auf Elementen unter der Maus.** Der Browser
   ersetzt das Element, der Hover-Zustand geht verloren, Klicks fallen zwischen
   mousedown und mouseup durch.
   → **Regel: vor jedem Schreiben prüfen, ob sich der Inhalt geändert hat.**

7. **Die Fundzeit lebte nur im Arbeitsspeicher.** Jedes Neuladen setzte sie auf
   null, die 2-Stunden-Ablaufregel griff nie, und derselbe Fund kam nach Ablauf
   sofort wieder als „neu". Symptom: „steht seit zwei Tagen da".
   → **Regel: Fundzeit dauerhaft speichern, abgelaufene IDs stilllegen.**

8. **Eine Grenze, die nie anschlägt, sieht aus wie eine, die nichts zu tun hat.**
   Die Quotengrenze las `v.bf.q` — ein Feld, das es am Bein nicht gibt.
   `NaN > 20` ist immer falsch, die Prüfung griff **nie**.
   → **Regel: für jede Schutzregel einen Test, der sie AUSLÖST.**

9. **Abgeschnittene Knöpfe sind tote Knöpfe.** Die Aktionsspalte war 136 px mit
   `overflow:hidden`; die Hit-Marke saß bei x = −24, außerhalb.

10. **Der Prüfstand schneidet Funktionen einzeln aus.** Jede neue Querverbindung
    zwischen Modulen braucht `typeof X === 'function'`-Wachen, sonst reißt ein
    fehlender Nachbar die ganze Funktion mit. Dreimal passiert.

11. **Zahlen und Hilfsverben als Namensbeleg.** „200" aus „200 – 250m" traf
    „Bitcoin $200,000"; „will" verband den Cricketspieler „Will Jacks" mit
    „Will the Republican Party win…". → Reine Zahlen und `will/does/did/would/
    shall` als Stoppwörter.

12. **Bulk-Upsert (PostgREST):** ALLE Objekte eines Batches brauchen
    IDENTISCHE Keys, sonst PGRST102. Klassiker: der Erfolgszweig schickt mehr
    Felder als der Fehlerzweig.

---

## 6. Was geprüft ist

- `node bridge/pruefung.js` — **158 Prüfungen** (Rechnung, Zuordnung, Lay,
  Gebühren, Links, Fensterteilung)
- `node oberflaeche-pruefung.js` — **103 Prüfungen**; schneidet die Funktionen
  aus der echten `index.html` heraus statt eine Kopie zu prüfen
- Live gemessen: Polymarket-Vollbestand 2,4 s, Kurse 3,6 s, Link-Prüfer 12/12
  richtig gegen die echte Gamma-API, Falschprobe korrekt abgewiesen

**Nicht geprüft:** die Betfair-Anmeldung (Passwörter werden nirgends
eingetragen), und alles hinter dem Login der Website.

---

## 7. Design-Vorgaben des Auftraggebers

Vier Runden, das ist der Endstand:

- **Nicht eckig, sondern rund** (12 px Flächen, 8 px Chips). Die alte Regel
  „nur spitze Ecken" ist ausdrücklich aufgehoben.
- **Mittel-dunkles Graphit**, kein Schwarz, kein Weiß, **keine Neonfarben**.
  Grund `#24262B`, Karten `#2F3339`, Text `#E8EAED`, gedämpfte Akzente
  (Gold `#C8AC63`, Grün `#8FC178`, Violett `#B3A1E6`, Blau `#82B3D9`).
- **Jede Sache ihre Farbe:** Polymarket violett, Betfair blau, weitere Börse
  türkis; grün = gut, orange = Achtung, rot = gesperrt.
- **Große Knöpfe** (44 px Kopfzeile), großzügige Schrift.
- Alle Kontraste gemessen: 4,6 bis 12,6.

---

## 8. Was der Auftraggeber will (unverhandelbar)

1. **Nur echtes Cross-Book-Arbitrage** Polymarket ⇄ Betfair. Die
   Polymarket-internen Pakete („grüne Zeilen") sind kein Arbitrage im
   gewünschten Sinn und stehen standardmäßig aus.
2. **Neue Funde, keine Karteileichen.** Was tagelang steht, ist ein Fehler.
3. **Beide Links müssen immer da sein und immer denselben Markt treffen.**
4. **Jeder Knopf muss funktionieren.** Nichts darf überlappen.
5. **Alles kommt in den Verlauf** — gefunden, gesetzt, vorbei, mit Zeit und
   Gebühren. Kurzfristig im Browser, langfristig in der Datenbank.
6. **Jede Funktion wird dokumentiert**, auf einer eigenen Seite, mit ehrlicher
   Angabe, wie sie geprüft wurde.
7. **Kein Lovable** ohne ausdrückliche Zustimmung (verbraucht Credits).
8. **Laufende Bridges dürfen nie brechen.** Der Endpunkt `bf-bridge`, das
   POST-Format `{data:[{key,o1,o2,link}]}` und `profiles.bridge_token` sind
   unantastbar — nur erweitern, nie umbauen.

---

## 9. Zugänge und Kennungen

- **Live:** https://saifokaram1-hub.github.io/orion-panel/
- **Repo:** saifokaram1-hub/orion-panel · lokal `C:\Users\Home\arbitrage-radar`
- **Supabase:** `noexklrgtqveiclijdwp`, Key `sb_publishable_NrgVUoZhe-uN8U8j41P17Q_9cZgUd6M`
- **Sperrbildschirm:** `ARBRADAR2026`
- **Bridge-Release:** `bridge-v1`, aktuell Build 17 / Fassung 3.7
- Betfair-Konto steht auf `SUSPENDED` — lesen ja, wetten über die API nein.

---

## 10. Empfehlung für den Neuaufbau

**Was zu behalten ist:** die Rechnung samt Prüfungen, die
Schnittstellen-Eigenheiten aus Abschnitt 3, die Fehlerklassen aus Abschnitt 5,
die Bridge (sie funktioniert und liest 8247 Betfair-Märkte zuverlässig),
`pm-scan` und den serverseitigen Takt.

**Was anders zu machen ist:**

1. **Den Polymarket-Bestand über `/events?tag_slug=…` je Sportart holen** —
   das ist der Fund aus Abschnitt 0 und mit Abstand der wichtigste Punkt.
   Damit kommen tausende kurzfristige Sportmärkte dazu, genau dort, wo Betfair
   stark ist.
2. **Nicht eine 290-KB-Datei.** Getrennte Dateien für Stil, Datenschicht,
   Rechnung, Anzeige. Die Einzeldatei war der Grund, warum jede Änderung ein
   Risiko war.
3. **Die Zuordnung zweier Märkte als eigenes, testbares Stück.** Sie ist die
   gefährlichste Stelle im ganzen Programm (Fehlpaarungen), und sie steckte
   bisher mitten in der Suchschleife.
4. **Von Anfang an messen statt vermuten.** Jeder Fehler in Abschnitt 5 wurde
   erst gefunden, als ich aufgehört habe zu überlegen und angefangen habe, im
   echten Browser nachzumessen (`elementFromPoint`, `performance.getEntries`).

**Was ehrlich bleibt:** Ob am Ende regelmäßig Chancen entstehen, entscheidet
der Markt, nicht die Software. Zwei Börsen, die beide viele Teilnehmer haben,
liegen selten weit auseinander. Der Fund aus Abschnitt 0 verbessert die
Ausgangslage erheblich — aber niemand kann eine Trefferzahl versprechen.
