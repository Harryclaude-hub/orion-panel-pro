# Orion Panel — Stand vom 9. August 2026, Neuaufbau

Kurzfassung für den Wiedereinstieg. Nichts ist live, nichts ist gepusht.

## Was gemessen und belegt ist

1. **`/events?tag_slug=…` trägt.** 15.290 Märkte, 7.586 handelbar, 427 Begegnungen
   im 72-Stunden-Fenster. Der alte Weg über `/markets` fand 28 Sportmärkte,
   keinen unter 60 Tagen.
2. **Schnittmenge mit Betfair: 39 Partien**, gemessen gegen `bridge_odds`
   (40 s alt). Die Bridge selbst meldet im selben Moment `gemeinsam: 12`.
   Faktor 3,2.
3. **Betfair blockt Supabase mit 403 Cloudflare.** Gegenprobe: Polymarket
   antwortet aus derselben Funktion mit 200 in 55 ms. Die Betfair-Hälfte
   kann nicht auf den Server, das gilt für jeden Rechenzentrums-Anbieter.
   Nachmessen: `curl -s https://noexklrgtqveiclijdwp.supabase.co/functions/v1/bf-erreichbar`
4. **Serverseitiger Scan läuft:** `orion-scan`, 5,8 s, 4.124 handelbare Märkte,
   0 Stapelfehler.
5. **Nur rund die Hälfte der handelbaren Märkte hat beidseitige Briefkurse.**
6. Die Bridge lädt nur **4.000 von 8.247** Betfair-Märkten hoch. Deshalb fehlen
   Partien. Additiv behebbar, ohne das POST-Format anzufassen.

## Dateien

```
js/rechnung.js     94 Prüfungen grün   (pruefung/rechnung.test.js)
js/zuordnung.js    52 Prüfungen grün   (pruefung/zuordnung.test.js)
js/konfig.js       Schwellen, Schlüssel, Gebühren-Rückfall
js/daten.js        holt beide Seiten, verbindet, rechnet
js/anzeige.js      Darstellung
js/sperre.js       Sperrbildschirm, Overlay wird ENTFERNT + Wache
js/app.js          Ablauf
index.html         neu, modular
css/stil.css       Graphit, rund
```

Edge Functions neu: `orion-scan`, `bf-erreichbar`.
Unberührt: `bf-bridge`, `pm-scan`, `ob-proxy`, `sx-proxy`,
`profiles.bridge_token`, POST-Format. Bridges laufen weiter.

Alter Stand gesichert: `git checkout alte-fassung-2026-08-09`

## Der Fehler, der im ersten echten Lauf auffiel

Die Anzeige meldete **663 Chancen mit bis zu 184 % Rendite**. Alles falsch.
Ursache: Polymarket-Märkte wie „CSD Municipal 1 - 3 CSD Cobán Imperial"
(Exact Score) wurden gegen die Betfair-**Siegerquote** gehalten. Zwei
verschiedene Fragen sind keine Absicherung.

Zwei Gründe, beide behoben:
- `aehnlichkeit()` teilt durch den **kürzeren** Namen. „CSD Municipal" steckt
  vollständig in „CSD Municipal 1 - 3 CSD Cobán Imperial" → Score 1,00.
  → neue `namensgleichheit()` teilt durch den **längeren** Namen, Schwelle 0,8.
- Es fehlte die Prüfung, ob der Markt überhaupt dieselbe Frage stellt.
  → neue `marktArt()`, lässt nur `sieger` und `unentschieden` durch.

## Ergebnis nach der Reparatur

Derselbe Lauf, dieselben Daten, mit Filter:

```
663 Chancen  ->  0 Chancen
3.303 Polymarket-Märkte handelbar
3.116 abgewiesen, weil sie eine andere Frage stellen als Betfair
65 Paare wirklich gerechnet
beste Rendite 0,049 %  ->  unter der Schwelle von 0,5 %, also kein Fund
```

**Null ist hier das richtige Ergebnis.** Zwei Börsen mit vielen Teilnehmern
liegen selten weit auseinander. Der Fund aus Abschnitt 0 verbessert die
Ausgangslage, aber niemand kann eine Trefferzahl versprechen.

Gegengeprüft im echten Browser mit `elementFromPoint`:
**52 von 52 Knöpfen erreichbar, 0 tot, 0 Überlappungen.**
Die alte Fassung hatte 49 von 53 unerreichbar.

Zusätzlich eingebaut: Warnung, wenn die Bridge-Daten älter als 5 Minuten sind.
Beim Test waren sie 4,7 h alt, und die Seite hat das gemeldet statt eine
Chance auf toten Kursen vorzuspielen.

## Offen, als Nächstes

1. `funktionen.html` und `logik.html` nachziehen (Übergabe Punkt 6).
   Beide sind noch die alten Seiten und passen nicht mehr zum Programm.
2. Verlauf und Fundzeit dauerhaft speichern (Fehlerklasse 7).
3. Upload-Grenze der Bridge von 4.000 anheben, additiv. Dadurch fehlen
   derzeit Partien, die es bei beiden gibt.
4. Betfair-Kommission: die Bridge schickt `marketBaseRate` nicht mit,
   deshalb wird mit 7 % gerechnet. Additiv nachrüstbar, macht die
   Rechnung genauer und findet mehr echte Chancen.
5. `pm-scan` durch `orion-scan` ersetzen oder zusammenlegen.
6. Alte Dateien aufräumen: `admin.html`, `konto.html`, `login.html`,
   `config.js`, `pdf.js` gehören zur alten Fassung.
