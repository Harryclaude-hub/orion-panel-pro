@echo off
rem ============================================================================
rem  ORION - orion-lauf (den SCANNER) ausrollen. Doppelklick genuegt.
rem ============================================================================
rem  Rollt den Scanner mit seinen DREI Dateien aus dem Repo aus:
rem      index.ts, rechnung.ts, zuordnung.ts
rem
rem  UMBAU 24.8.: KEIN npx/supabase-CLI mehr. Windows' Anwendungssteuerung
rem  (Smart App Control) blockiert frisch geladene unsignierte Programme -
rem  daran scheiterte jeder CLI-Deploy seit dem 23.8., unabhaengig vom
rem  Token. Jetzt geht alles ueber das SIGNIERTE, eingebaute curl direkt
rem  an die Supabase-Verwaltungsschnittstelle. Die Antwort landet in
rem      bridge\letzter-deploy-scanner.log
rem  damit ein Fehlschlag nie wieder stumm bleibt.
rem
rem  GEFAHRLOS: schlaegt der Deploy fehl, aendert sich NICHTS - der
rem  Scanner laeuft unveraendert auf dem alten Stand weiter.
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem ============================================================================

title Orion - orion-lauf ausrollen
cd /d "C:\Users\Home\orion-panel-pro"

echo.
echo   ORION - DEN SCANNER AUSROLLEN
echo   ============================================================
echo.
echo   Rollt orion-lauf auf den Stand aus, der gerade im Repo liegt.
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

set "API=https://api.supabase.com/v1/projects/noexklrgtqveiclijdwp/functions/deploy"

echo.
echo   [1/2] Ausrollen (drei Dateien) ...
echo {"name":"orion-lauf","entrypoint_path":"index.ts","verify_jwt":false}>"%TEMP%\orion-meta-lauf.json"
set "CODE="
for /f %%H in ('curl -s -o "%~dp0letzter-deploy-scanner.log" -w "%%{http_code}" -X POST "%API%?slug=orion-lauf" -H "Authorization: Bearer %TOKEN%" -F "metadata=<%TEMP%\orion-meta-lauf.json;type=application/json" -F "file=@supabase/functions/orion-lauf/index.ts;type=application/typescript" -F "file=@supabase/functions/orion-lauf/rechnung.ts;type=application/typescript" -F "file=@supabase/functions/orion-lauf/zuordnung.ts;type=application/typescript"') do set CODE=%%H
echo         Antwort HTTP %CODE%  (Details: bridge\letzter-deploy-scanner.log)

set "TOKEN="
del "%TEMP%\orion-meta-lauf.json" >nul 2>nul

echo.
rem  ABSTURZFALLE, behoben am 26.8.2026: hier stand ein Klammerblock
rem  "if ... ( ... )" und darin die Zeile "FEHLGESCHLAGEN (HTTP %CODE%)".
rem  Die Klammer im Text hat den Block VORZEITIG geschlossen, cmd brach mit
rem  einem Syntaxfehler ab und das Fenster flog sofort zu - genau in dem
rem  Moment, in dem die Fehlermeldung haette erscheinen sollen. Karam sah
rem  deshalb nur ein Fenster, das sich nach dem Enter schliesst.
rem  Ab jetzt derselbe Weg wie in DEPLOY-MELDER.cmd: KEINE Klammerbloecke,
rem  nur Spruenge. Damit kann das nicht wieder passieren.
if "%CODE%"=="200" goto :geklappt
if "%CODE%"=="201" goto :geklappt
goto :schiefgegangen

:geklappt

echo   ============================================================
echo   AUSROLLEN HAT GEKLAPPT ^(HTTP %CODE%^).
echo   ============================================================
echo.
echo   [2/2] Trockenlauf FUSSBALL - rechnet alles, schreibt NICHTS.
echo         Kommt eine Antwort mit ok true und pm_maerkte ueber 0,
echo         laeuft der neue Stand.
echo.
echo   HINWEIS 26.8.2026: solange die Supabase-Stoerung laeuft
echo   ^("JWT issued at future"^), antwortet der Trockenlauf mit
echo   "Bereich fussball steht nicht im Register". Das ist NICHT
echo   Dein Deploy - der ist oben schon durch. Es heisst nur, dass
echo   die Funktion die Datenbank noch nicht lesen darf.
echo.
curl -s -X POST "https://noexklrgtqveiclijdwp.supabase.co/functions/v1/orion-lauf" -H "content-type: application/json" -d "{\"bereich\":\"fussball\",\"probe\":true}"
echo.
echo.
echo   ============================================================
echo   FERTIG.
echo.
echo   Danach den Token wieder loeschen:
echo     https://supabase.com/dashboard/account/tokens
echo     drei Punkte  ^>  Revoke token
echo   ============================================================
echo.
pause
exit /b 0

:schiefgegangen
echo   ============================================================
echo   FEHLGESCHLAGEN ^(HTTP %CODE%^). Es hat sich NICHTS geaendert -
echo   der Scanner laeuft unveraendert auf dem alten Stand weiter.
echo   Es ist nichts kaputt.
echo.
echo   Der GRUND steht in dieser Datei:
echo     bridge\letzter-deploy-scanner.log
echo.
echo   HTTP 401 = Token falsch oder abgelaufen. Neuen holen:
echo     https://supabase.com/dashboard/account/tokens
echo   Alles andere: Claude die Log-Datei lesen lassen.
echo   ============================================================
echo.
pause
exit /b 1
