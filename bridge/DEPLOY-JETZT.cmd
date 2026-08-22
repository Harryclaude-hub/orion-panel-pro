@echo off
rem ============================================================================
rem  ORION - orion-lauf ausrollen. Doppelklick genuegt.
rem ============================================================================
rem  Fragt nur nach dem Token und macht den Rest allein.
rem
rem  WARUM DIESE DATEI: der Befehl von Hand hatte am 19.08. eine Falle.
rem  "set VAR=wert && ..." haengt in cmd ein LEERZEICHEN an den Wert
rem  (gemessen: Laenge 7 statt 6). Der Token kam damit falsch bei Supabase
rem  an und wurde abgelehnt. "set /p" liest die Eingabe sauber ein - hier
rem  kann das nicht mehr passieren.
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem ============================================================================

title Orion - orion-lauf ausrollen
cd /d "C:\Users\Home\orion-panel-pro"

echo.
echo   ORION - DER LETZTE SCHRITT
echo   ============================================================
echo.
echo   Damit wird der Scanner auf den neuen Stand gebracht:
echo     - Tennis-Matchsieger: marktArt erkennt die Form
echo       "Turnier: A vs B" (gemessen 19.8.: 127 Spiele im
echo       72-h-Fenster, vorher 0; 19 Paare gegen Betfair)
echo     - Turnierpraefix wird vor der Namenspruefung abgeschnitten
echo.
echo   WICHTIG, EIGENER SCHRITT: supabase/wache-tennis-turnier.sql
echo   einmal im SQL-Editor ausfuehren - sonst sperrt die Wache
echo   jede Frauen-Tennis-Paarung ("Mannschaftsklasse ungleich").
echo.
echo   Token holen, falls noch keiner da ist:
echo     https://supabase.com/dashboard/account/tokens
echo     Generate new token  ^>  Name: orion-deploy  ^>  kopieren
echo.
echo   Der Token beginnt mit  sbp_
echo   Er wird NICHT gespeichert und verschwindet mit diesem Fenster.
echo.

set "TOKEN="
set /p TOKEN=  Token hier einfuegen (Rechtsklick fuegt ein) und Enter:

if "%TOKEN%"=="" (
  echo.
  echo   Kein Token eingegeben. Nichts passiert.
  echo.
  pause
  exit /b 1
)

echo.
echo   [1/3] Node pruefen ...
where node >nul 2>nul
if errorlevel 1 (
  echo         FEHLER: Node fehlt. Einmalig holen:
  echo         winget install OpenJS.NodeJS.LTS
  echo.
  pause
  exit /b 1
)
echo         in Ordnung.

echo   [2/3] Ausrollen ... das dauert etwa eine Minute.
echo.
set "SUPABASE_ACCESS_TOKEN=%TOKEN%"
call npx --yes supabase@latest functions deploy orion-lauf --project-ref noexklrgtqveiclijdwp --no-verify-jwt
set ERG=%errorlevel%
set "SUPABASE_ACCESS_TOKEN="
set "TOKEN="

echo.
if not "%ERG%"=="0" (
  echo   ============================================================
  echo   FEHLGESCHLAGEN. Es hat sich NICHTS geaendert - der Scanner
  echo   laeuft unveraendert auf dem alten Stand weiter. Es ist
  echo   nichts kaputt.
  echo.
  echo   Haeufigste Ursache: Token abgelaufen oder widerrufen.
  echo   Einfach neuen holen und nochmal doppelklicken.
  echo   ============================================================
  echo.
  pause
  exit /b 1
)

echo   [3/3] Trockenlauf FUSSBALL - rechnet alles, schreibt NICHTS.
echo         Genau dieser Bereich starb am 21.8. an WORKER_RESOURCE_LIMIT.
echo         Kommt eine Antwort mit ok true und pm_maerkte, ist der
echo         Speicherfehler weg. Kommt wieder WORKER_RESOURCE_LIMIT,
echo         reicht die Entlastung nicht - dann Bescheid geben.
echo.
curl -s -X POST "https://noexklrgtqveiclijdwp.supabase.co/functions/v1/orion-lauf" -H "content-type: application/json" -d "{\"bereich\":\"fussball\",\"probe\":true}"
echo.
echo.
echo   ============================================================
echo   FERTIG.
echo.
echo   Oben in der Zeile steht  "pm_maerkte":
echo     steht dort 0    - es hat nicht gegriffen, bitte melden
echo     steht dort ^>0   - Tennis ist sichtbar, es hat geklappt
echo.
echo   Danach den Token wieder loeschen:
echo     https://supabase.com/dashboard/account/tokens
echo     drei Punkte  ^>  Revoke token
echo   ============================================================
echo.
pause
