# Orion Panel Pro

Surebet-Scanner zwischen zwei Börsen: **Polymarket** und **Betfair**
(gehandelt über den Broker 96ex/Orbit). Meldet, wenn beide Seiten desselben
Ereignisses zusammen unter 100 % liegen.

**Nur Börsen, nie Buchmacher.**

Live: https://harryclaude-hub.github.io/orion-panel-pro/

Die alte Fassung liegt unverändert unter
https://harryclaude-hub.github.io/orion-panel/ und im Repo `orion-panel`.

---

## Aufbau

```
Polymarket ──→ [orion-scan]  Supabase Edge Function  ─┐
                                                       ├─→ Website
Betfair ──→ [Bridge auf Heim-PC] ──→ [bf-bridge] ─────┘
                                       Tabelle bridge_odds
```

| Aufgabe | wo | warum |
|---|---|---|
| Polymarket-Bestand holen | Supabase | 55 ms Anbindung, 5,8 s für 4.124 Märkte |
| Betfair-Katalog + Quoten | Heim-PC | Betfair blockt Rechenzentren mit 403, gemessen |
| Zuordnung + Rechnung | Browser | dieselben geprüften Module wie im Prüfstand |

---

## Dateien

```
index.html          Gerüst und Sperrbildschirm
css/stil.css        Graphit, rund
js/konfig.js        Schlüssel, Schwellen, Gebühren-Rückfall
js/rechnung.js      Effektivquote, Aufteilung, Lay, Gebühren   ohne DOM
js/zuordnung.js     Marktpaarung                                ohne DOM
js/daten.js         holt beide Seiten und verbindet sie
js/anzeige.js       Darstellung
js/sperre.js        Entsperren, Overlay wird entfernt, mit Wache
js/app.js           Ablauf
pruefung/           Node-Prüfstand
bridge/             Betfair-Bridge für den Heim-PC, unverändert Build 17
```

## Prüfen

```
node pruefung/rechnung.test.js     94 Prüfungen
node pruefung/zuordnung.test.js    79 Prüfungen
```

Beide laufen gegen die echten Dateien aus `js/`, nicht gegen Kopien.

## Erreichbarkeit von Betfair nachmessen

```
curl -s https://noexklrgtqveiclijdwp.supabase.co/functions/v1/bf-erreichbar
```

Stand 9.8.2026: 9 Wege geprüft, 7 mit 403 von Cloudflare geblockt.
Erreichbar sind nur `identitysso-cert.betfair.com/api/certlogin`
(antwortet `CERT_AUTH_REQUIRED`) und die Gegenprobe Polymarket.
**Die Datenendpunkte sind alle geblockt**, auch das öffentliche `menu.json`.

Siehe [STAND.md](STAND.md) für Messwerte und offene Punkte.
