@echo off
rem ============================================================================
rem  ORION - ALLE NEUN FUNKTIONEN ausrollen. Doppelklick genuegt.
rem ============================================================================
rem  ANLASS 26.8.2026: die Datenbank wies ihre eigenen Funktionen ab
rem  ("JWT issued at future" -> HTTP 401). Alle neun Funktionen mussten auf
rem  den neuen Schluessel ORION_DB_KEY umgestellt werden, und dafuer gab es
rem  bis dahin keine Datei - DEPLOY-JETZT.cmd rollt nur den Scanner aus,
rem  DEPLOY-MELDER.cmd nur die zwei Bots. Sechs Funktionen hatten gar keinen
rem  Weg auf den Server.
rem
rem  KEIN npx, KEIN supabase-CLI. Windows' Anwendungssteuerung blockiert
rem  frisch geladene unsignierte Programme (Fehler "spawn UNKNOWN"), daran
rem  scheiterte jeder CLI-Deploy. Hier laeuft alles ueber das SIGNIERTE,
rem  in Windows eingebaute curl (C:\Windows\System32\curl.exe).
rem
rem  KEINE KLAMMERBLOECKE. Am 26.8. hat eine Klammer im Meldungstext den
rem  if-Block vorzeitig geschlossen, cmd brach mit einem Syntaxfehler ab und
rem  das Fenster flog zu, genau wenn die Fehlermeldung kommen sollte. Deshalb
rem  hier nur Spruenge, und Klammern in Texten sind escaped.
rem
rem  GEFAHRLOS: schlaegt eine Funktion fehl, laeuft sie unveraendert auf dem
rem  alten Stand weiter. Jede Antwort landet in bridge\letzter-deploy-*.log
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem ============================================================================

title Orion - alle Funktionen ausrollen
cd /d "C:\Users\Home\orion-panel-pro"

echo.
echo   ORION - ALLE NEUN FUNKTIONEN AUSROLLEN
echo   ============================================================
echo.
echo   Rollt aus, was gerade im Repo liegt:
echo     orion-lauf ^(Scanner, 3 Dateien^)   orion-pruefer
echo     orion-melder-telegram              orion-melder-knapp
echo     bf-bridge                          orion-kalshi
echo     orion-smarkets                     orion-lebenszeichen
echo     pm-scan
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

if "%TOKEN%"=="" goto :kein_token

set "API=https://api.supabase.com/v1/projects/noexklrgtqveiclijdwp/functions/deploy"
set "GUT=0"
set "SCHLECHT=0"

echo.
echo   Ausrollen laeuft, das dauert ein bis zwei Minuten ...
echo.

rem ---- Der Scanner zuerst, er hat drei Dateien ----
echo {"name":"orion-lauf","entrypoint_path":"index.ts","verify_jwt":false}>"%TEMP%\orion-meta.json"
set "CODE="
for /f %%H in ('curl -s -o "%~dp0letzter-deploy-orion-lauf.log" -w "%%{http_code}" -X POST "%API%?slug=orion-lauf" -H "Authorization: Bearer %TOKEN%" -F "metadata=<%TEMP%\orion-meta.json;type=application/json" -F "file=@supabase/functions/orion-lauf/index.ts;type=application/typescript" -F "file=@supabase/functions/orion-lauf/rechnung.ts;type=application/typescript" -F "file=@supabase/functions/orion-lauf/zuordnung.ts;type=application/typescript"') do set CODE=%%H
call :melden orion-lauf

rem ---- Alle uebrigen, je eine Datei ----
call :eine orion-pruefer
call :eine orion-melder-telegram
call :eine orion-melder-knapp
call :eine bf-bridge
call :eine orion-kalshi
call :eine orion-smarkets
call :eine orion-lebenszeichen
call :eine pm-scan

set "TOKEN="
del "%TEMP%\orion-meta.json" >nul 2>nul

echo.
echo   ============================================================
echo   ERGEBNIS: %GUT% von 9 ausgerollt, %SCHLECHT% fehlgeschlagen.
echo   ============================================================
echo.

if not "%SCHLECHT%"=="0" goto :teilweise

echo   Alle neun sind auf dem neuen Stand.
echo.
echo   Token wieder loeschen:
echo     https://supabase.com/dashboard/account/tokens
echo     drei Punkte  ^>  Revoke token
echo.
pause
exit /b 0

:teilweise
echo   Die fehlgeschlagenen laufen unveraendert weiter, es ist
echo   nichts kaputt. Der Grund steht je Funktion in:
echo     bridge\letzter-deploy-^<name^>.log
echo.
echo   HTTP 401 = Token falsch oder abgelaufen. Neuen holen:
echo     https://supabase.com/dashboard/account/tokens
echo   Alles andere: Claude die Log-Dateien lesen lassen.
echo.
pause
exit /b 1

:kein_token
echo.
echo   Kein Token eingegeben. Nichts passiert.
echo.
pause
exit /b 1

rem ---------------------------------------------------------------------------
rem  :eine  - eine Funktion mit genau einer Datei ausrollen
rem ---------------------------------------------------------------------------
:eine
echo {"name":"%~1","entrypoint_path":"index.ts","verify_jwt":false}>"%TEMP%\orion-meta.json"
set "CODE="
for /f %%H in ('curl -s -o "%~dp0letzter-deploy-%~1.log" -w "%%{http_code}" -X POST "%API%?slug=%~1" -H "Authorization: Bearer %TOKEN%" -F "metadata=<%TEMP%\orion-meta.json;type=application/json" -F "file=@supabase/functions/%~1/index.ts;type=application/typescript"') do set CODE=%%H
call :melden %~1
exit /b 0

rem ---------------------------------------------------------------------------
rem  :melden - Ergebnis anzeigen und mitzaehlen
rem ---------------------------------------------------------------------------
:melden
if "%CODE%"=="200" goto :melden_gut
if "%CODE%"=="201" goto :melden_gut
set /a SCHLECHT+=1
echo     FEHLER  %~1   HTTP %CODE%
exit /b 0
:melden_gut
set /a GUT+=1
echo     ok      %~1   HTTP %CODE%
exit /b 0
