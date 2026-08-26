@echo off
rem ============================================================================
rem  ORION NOTBETRIEB STARTEN. Doppelklick genuegt.
rem ============================================================================
rem  WAS DAS IST: der Scanner laeuft ersatzweise auf DIESEM Laptop, weil die
rem  Supabase-Server-Funktionen seit dem 25.8. nicht mehr an ihre eigene
rem  Datenbank kommen ("JWT issued at future", HTTP 401). Neu ausrollen half
rem  nicht - neuer Code nuetzt nichts, wenn der Server die Datenbank nicht
rem  lesen darf.
rem
rem  Es ist GENAU DERSELBE Scannercode wie auf dem Server, nur hier
rem  ausgefuehrt. Keine zweite Fassung der Logik.
rem
rem  WAS ES BRAUCHT: nur den Bridge-Token aus bridge-config.json. Betfair-
rem  Benutzername und Passwort werden NICHT angefasst.
rem
rem  WAS ES LIEFERT: Polymarket-gegen-Betfair-Paare, also genau die Paarung
rem  des Sonego-Falls. Kalshi und Smarkets bleiben still, ihre Sammler sind
rem  ebenfalls tot und ihre Schnappschuesse ueber 20 Stunden alt - die
rem  Frischesperren halten sie deshalb richtigerweise zurueck.
rem
rem  BEENDEN: dieses Fenster schliessen. Sobald Supabase repariert ist, kann
rem  es einfach zubleiben - die Server-Takte uebernehmen von selbst wieder.
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem ============================================================================

title Orion Notbetrieb - Scanner laeuft lokal
cd /d "%~dp0"

echo.
echo   ORION NOTBETRIEB
echo   ============================================================
echo.
echo   Der Scanner laeuft ab jetzt auf diesem Laptop.
echo   Gleicher Code wie auf dem Server.
echo.
echo   Dieses Fenster offen lassen. Zum Beenden einfach schliessen.
echo.

where node >nul 2>nul
if errorlevel 1 goto :kein_node

if not exist "orion-lauf.bundle.js" goto :kein_bundle
if not exist "orion-lokal.js" goto :kein_laeufer
if not exist "bridge-config.json" goto :keine_config

set "ORION_BRIDGE_TOKEN="
for /f "delims=" %%T in ('node -e "process.stdout.write(String(require(\"./bridge-config.json\").bridgeToken||\"\"))"') do set "ORION_BRIDGE_TOKEN=%%T"

if "%ORION_BRIDGE_TOKEN%"=="" goto :kein_token

echo   Token gefunden. Der Scanner darf schreiben.
echo.

node orion-lokal.js

set "ORION_BRIDGE_TOKEN="
echo.
echo   Der Notbetrieb wurde beendet.
echo.
pause
exit /b 0

:kein_node
echo   FEHLER: Node ist nicht installiert oder nicht im Pfad.
echo   Node holen: https://nodejs.org
echo.
pause
exit /b 1

:kein_bundle
echo   FEHLER: orion-lauf.bundle.js fehlt in diesem Ordner.
echo   Das ist der gebuendelte Scanner. Claude erzeugt ihn neu.
echo.
pause
exit /b 1

:kein_laeufer
echo   FEHLER: orion-lokal.js fehlt in diesem Ordner.
echo.
pause
exit /b 1

:keine_config
echo   FEHLER: bridge-config.json fehlt in diesem Ordner.
echo.
pause
exit /b 1

:kein_token
echo   FEHLER: in bridge-config.json steht kein bridgeToken.
echo   Ohne ihn koennte nur gerechnet, aber nichts gespeichert werden.
echo.
pause
exit /b 1
