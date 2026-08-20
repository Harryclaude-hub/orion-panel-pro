# Die Struktur — wer was ist und wer mit wem redet

Stand 15.08.2026, nach dem großen Aufräumen. **Diese Datei ist die
Landkarte**; wer etwas ändern will, schaut zuerst hier, in welcher
Schicht er sich bewegt. (Sitzungs-Einstieg bleibt UEBERGABE.md 8j;
die Datenbank-Wahrheit bleibt supabase/datenbank.md.)

## Die eiserne Regel

**Logik und Design sind getrennte Schichten.** Wer am Aussehen arbeitet,
fasst keine Logik-Datei an — und umgekehrt. Jede Design-Datei ist
LÖSCHBAR: fällt sie weg, fehlt Schmuck oder Ton, nie ein Wert und nie
eine Rechnung.

## Schicht 1 — LOGIK (Rechenwege; Änderungen nur mit Trockenlauf + Spiegeltest)

| Datei | Aufgabe | redet mit |
|---|---|---|
| `js/konfig.js` | alle Schwellen, Bücher, Schlüssel, Takte | wird von allen gelesen |
| `js/rechnung.js` | Effektivquoten, Kehrwertsumme, Aufteilung — **Spiegel der Server-Fassung** | daten.js, funker.js, Prüfstand |
| `js/zuordnung.js` | Wortzerlegung, Paar-Belege — **Spiegel der Server-Fassung** | daten.js, Prüfstand |
| `js/daten.js` | liest Supabase (mit Puffern), teilt in Chancen/Knapp/Verlauf/Falsch, Rechnungsnummern | app.js ruft `ladeAlles()` |
| `js/anzeige.js` | zeichnet alles (Tafel, Matrix, Karten, Reiter, Ansichten), rechnet NICHTS Neues | liest das Ergebnis von daten.js |
| `js/app.js` | der 2-Sekunden-Takt, Fehlerbanner | Daten → Anzeige, setzt `welt.letztesErgebnis` |
| `js/filter.js` | blendet nur aus, sucht nie | anzeige.js |
| `js/funker.js` | Chat-PRÜFER: rechnet mit rechnung.js nach, rät nie | liest `welt.letztesErgebnis` |
| `js/sperre.js` | das Passwort-Tor | startet app.js |

**Server (Wahrheit in Supabase, dokumentiert in `supabase/datenbank.md`):**
Scanner `orion-lauf` (je Bereich, Fußball alle 2 min seit der
Egress-Bremse vom 20.8.) → `orion_funde`;
Wächter/Nachtwache minütlich; Prüfer 5-minütlich; Zeiten/Nummern/Sperren
minütlich; Rauschen-Löscher 5-minütlich; `orion-melder-mail` minütlich
(braucht `RESEND_API_KEY`). Sammler: Kalshi + Smarkets alle 2 min;
Betfair über die Bridge am Heim-PC. **Endpunkte und Supabase-Projekt
niemals umbenennen.**

## Schicht 2 — DESIGN (löschbar, liest höchstens `welt.letztesErgebnis`)

| Datei | Aufgabe |
|---|---|
| `css/stil.css` | ALLE Farben als Tokens ganz oben; darunter gewachsene Schichten (spätere Regeln überstimmen frühere — Absicht) |
| `css/start.css` | gehört **nur** zu `start.html` (Landingpage), 189 Zeilen, keine Animation. Die Farbwerte sind aus `stil.css` **kopiert, nicht importiert** (die Landing soll nicht 124 KB Panel-CSS laden). Preis: Farbwelt ändern heißt an ZWEI Stellen ändern. Steht auch im Kopf der Datei |
| `schrift/` | selbst gehostete Schriften (Black Ops One / Rajdhani / Share Tech Mono, OFL) |
| `js/anim.js` | Animationsstufen-Schalter (1/2/3 + Geraete-Empfehlung) — am 20.8. aus der GELOESCHTEN buehne.js gerettet, weil er Radar/LED/Avatar drosselt und damit Funktion ist |
| `js/puls.js` | Radar + Gefechtsstand-HUD |
| `js/stimme.js` | echte Sprecher-Aufnahmen (audio/ + sprueche.json), Avatar, Gemütslagen, TON-HAUPTSCHALTER |
| `js/musik.js` | Hintergrund-Ambiente (synthetisiert), Rechtsklick auf Ton |
| `js/melder.js` | Windows-Push (lautlos, stapelt nie) + E-Mail-Einrichtung (Rechtsklick) |
| `audio/` | 88 MP3-Aufnahmen + `liste.json` + `sprueche.json` (EINE Quelle für Texte und Clips) |

**Ton-Ordnung:** Ton-Knopf = Hauptschalter (AUS = totale Funkstille,
erstickt auch Ambiente und Chat). Rechtsklick Ton = Ambiente. Der
Funker-Chat hat zusätzlich seinen eigenen 🔊/🔇 im Fenster.

## Seiten

`index.html` (Übersicht ↔ Listen-Seite) · `angaben.html` (Wörterbuch) ·
`logik.html` (Suchlogik, **bei Logik-Änderungen mitziehen!**) ·
`knoepfe.html` (jeder Knopf erklärt) · `regelwerk.html` (Absage-Regeln) ·
`einstellungen.html` · `bridge-setup.html` (Bridge-Einrichtung) ·
`beitrag.html?fund=…` (eine einzelne Karte, Ziel der Telegram-Links) ·
`gespeichert.html` (gemerkte Funde).
`funktionen.html` wurde am 15.8. GELÖSCHT — sie beschrieb einen Stand,
den es nie gab (Login/Adminbereich), und war nirgends verlinkt.

**`start.html` (20.8., LANDINGPAGE, Schicht 2)** ist der öffentliche
Auftritt. Sie ist **vollständig additiv**: sie und `css/start.css` sind
die einzigen beiden Dateien, die dazugekommen sind, am Panel wurde für
sie nichts geändert. Sie spricht **weder mit Supabase noch mit der
Bridge** und zeigt keine Betriebsdaten. Sie ist nirgends aus dem Panel
verlinkt (der Weg führt nur von der Landing zum Panel, nicht zurück) und
trägt wie alle anderen Seiten `noindex`; `robots.txt` bleibt
`Disallow: /`. Verlinkt sind von dort aus nur die **ohne Kennwort
erreichbaren** Seiten (`angaben.html`, `regelwerk.html`) plus das Panel.
**Löschbar:** beide Dateien weg = Stand von vorher.

**Kennwort-Tor, gemessen 20.8.:** `sperre.js` laden index, logik,
knoepfe, einstellungen, gespeichert und beitrag. **OHNE Tor** sind
`angaben.html`, `regelwerk.html`, `bridge-setup.html` und
`muster-hud.html`. Wer von einer offenen Seite nach `logik.html`
verlinkt, schickt den Leser in die Kennwortwand (so steht es in
bridge-setup).

**Cache-Marken (`?v=`) gehören zusammen.** Am 20.8. standen
angaben/logik/knoepfe/regelwerk/einstellungen noch auf `v=54` (CSS) und
`v=22` (JS), während index/beitrag/gespeichert auf `v=71` liefen. Wer
diese Seiten schon einmal besucht hatte, bekam **stil.css und sperre.js
aus dem alten Cache**: die Farbwelt von VOR dem Rückbau (also noch mit
Orange) und eine alte Fassung des Tors. Alle Betriebsseiten stehen jetzt
auf `v=74` (Stand nach der Egress-Bremse, 8t). **Regel: wird eine gemeinsame Datei geändert, ziehen ALLE
Seiten ihre Marke mit**, sonst laufen wieder zwei Fassungen nebeneinander.
(`muster-hud.html` bleibt auf `v=52`: Musterseite, nicht im Betrieb.)

## Prüfstand (`pruefung/`)

`spiegel.test.js` — **vor JEDEM Ausrollen**: Browser- und Server-Rechnung
identisch (19.896 Prüfungen, gemessen 20.8.). Dazu `bereiche.js`, `nachschlagen.js`,
`karte-probe.html` für Messläufe gegen echte Daten.

## Was beim Aufräumen am 20.8. entfernt wurde (und warum)

- **buehne.js und partikel.js GELOESCHT** (Karams Vorgabe: "Seitendesign
  viel schlichter, den Blödsinn löschen"): Flanken samt Wacht, Jets,
  Raketen, Boom, das Kino und alle Partikel-/Aufbau-Effekte. Dazu 94
  CSS-Regeln und 21 @keyframes aus stil.css. Der Animationsstufen-
  Schalter überlebte als js/anim.js (er drosselt Radar/LED/Avatar).
- Bestandsfund dabei: ein nie geschlossener CSS-Kommentar (nur `*`)
  hatte die will-change-Regel der Flanken-Flieger seit jeher verschluckt.

## Was beim Aufräumen am 15.8. entfernt wurde (und warum)

- Browser-Sprachausgabe in stimme.js (~70 Zeilen): toter Code, seit echte
  Aufnahmen jede Zeile abdecken — und die einzige Quelle einer möglichen
  Roboterstimme.
- CSS: 14 tote Blöcke (.punkt-Ampel → längst .sat-Satellit; Alt-Jet;
  Soldaten; fl-zitter) und die jeweils ERSTE von fünf doppelten
  @keyframes-Definitionen (die spätere gewinnt ohnehin).
- `funktionen.html` (465 Zeilen Altlast, siehe oben).
- 8 Chat-Aufnahmen der Fremdsprecher bleiben ungenutzt in `audio/`
  liegen (Funker spricht nur Liam) — bewusst behalten, falls die
  Abwechslung zurückgewünscht wird; sie laden nie.
