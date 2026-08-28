@echo off
rem ============================================================================
rem  ORION - die fuenf Notbetrieb-Buendel neu bauen. Doppelklick genuegt.
rem ============================================================================
rem  ANLASS 27.8.2026: es gab fuer diesen Schritt KEINE Datei. Die Buendel in
rem  programm\ waren einmal von Hand gebaut worden, und der Befehl stand
rem  nirgends. Wer den Scanner aendert, haette die Aenderung im Notbetrieb
rem  nicht bemerkt - der Laptop haette weiter den alten Stand gerechnet.
rem  Genau die Fehlerklasse "Drift zwischen zwei Fassungen".
rem
rem  WAS ES TUT: baut aus dem Repo (supabase\functions\...) die fuenf
rem  Buendel, die der Notbetrieb per require laedt. Es gibt damit weiter
rem  KEINE zweite Fassung der Logik - das Buendel IST der Repo-Stand.
rem
rem  GEPRUEFT am 27.8.: mit genau diesen Befehlen entstanden alle fuenf
rem  Buendel BYTEWEISE gleich wie die, die seit dem 26.8. laufen.
rem
rem  GEFAHRLOS: gebaut wird zuerst daneben. Erst wenn ALLE fuenf sauber
rem  durchlaufen, werden sie uebernommen. Bricht eines ab, bleibt alles
rem  beim Alten und der laufende Notbetrieb merkt nichts.
rem
rem  DANACH NEU STARTEN: die Laeufer halten ihr Buendel im Speicher.
rem  ORION-STOPPEN.cmd, dann ORION-STARTEN.cmd.
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem  KEINE KLAMMERN in Meldungstexten: sie schliessen if-Bloecke vorzeitig.
rem ============================================================================

title Orion - Buendel neu bauen
cd /d "C:\Users\Home\orion-panel-pro\supabase\functions"

set "ZIEL=C:\Users\Home\Desktop\ORION-BRIDGE\programm"
set "TMP=%TEMP%\orion-buendel"

echo.
echo   ORION - DIE FUENF BUENDEL NEU BAUEN
echo   ============================================================
echo.
echo   Quelle:  C:\Users\Home\orion-panel-pro\supabase\functions
echo   Ziel:    %ZIEL%
echo.

if not exist "index.ts" if not exist "orion-lauf\index.ts" goto :kein_repo

if exist "%TMP%" rd /s /q "%TMP%"
mkdir "%TMP%" 2>nul

echo   1 von 5  Scanner ...
call npx --no-install esbuild orion-lauf/index.ts --bundle --format=cjs --platform=node --outfile="%TMP%\orion-lauf.bundle.js" --log-level=error
if errorlevel 1 goto :bau_fehler
if not exist "%TMP%\orion-lauf.bundle.js" goto :bau_fehler

echo   2 von 5  Chancen-Melder ...
call npx --no-install esbuild orion-melder-telegram/index.ts --bundle --format=cjs --platform=node --outfile="%TMP%\melder-chance.bundle.js" --log-level=error
if errorlevel 1 goto :bau_fehler
if not exist "%TMP%\melder-chance.bundle.js" goto :bau_fehler

echo   3 von 5  Knapp-Melder ...
call npx --no-install esbuild orion-melder-knapp/index.ts --bundle --format=cjs --platform=node --outfile="%TMP%\melder-knapp.bundle.js" --log-level=error
if errorlevel 1 goto :bau_fehler
if not exist "%TMP%\melder-knapp.bundle.js" goto :bau_fehler

echo   4 von 5  Kalshi-Sammler ...
call npx --no-install esbuild orion-kalshi/index.ts --bundle --format=cjs --platform=node --outfile="%TMP%\sammler-kalshi.bundle.js" --log-level=error
if errorlevel 1 goto :bau_fehler
if not exist "%TMP%\sammler-kalshi.bundle.js" goto :bau_fehler

echo   5 von 5  Smarkets-Sammler ...
call npx --no-install esbuild orion-smarkets/index.ts --bundle --format=cjs --platform=node --outfile="%TMP%\sammler-smarkets.bundle.js" --log-level=error
if errorlevel 1 goto :bau_fehler
if not exist "%TMP%\sammler-smarkets.bundle.js" goto :bau_fehler

echo.
echo   Alle fuenf gebaut. Werden jetzt uebernommen ...
copy /y "%TMP%\*.bundle.js" "%ZIEL%\" >nul
if errorlevel 1 goto :kopier_fehler
rd /s /q "%TMP%"

echo.
echo   ============================================================
echo   FERTIG. Die fuenf Buendel sind auf dem Repo-Stand.
echo   ============================================================
echo.
echo   WICHTIG: die Laeufer halten ihr Buendel im Speicher.
echo   Damit die Aenderung wirkt:
echo      1. ORION-STOPPEN.cmd
echo      2. ORION-STARTEN.cmd
echo.
pause
exit /b 0

:kein_repo
echo.
echo   Das Repo liegt nicht da, wo es soll:
echo     C:\Users\Home\orion-panel-pro\supabase\functions
echo   Nichts geaendert.
echo.
pause
exit /b 1

:bau_fehler
echo.
echo   ============================================================
echo   ABGEBROCHEN. Es wurde NICHTS uebernommen.
echo   ============================================================
echo.
echo   Der laufende Notbetrieb ist unveraendert und laeuft weiter.
echo   Haeufigster Grund: esbuild fehlt. Dann einmal ausfuehren:
echo      npm i -g esbuild
echo.
if exist "%TMP%" rd /s /q "%TMP%"
pause
exit /b 1

:kopier_fehler
echo.
echo   Bauen ging, aber das Kopieren nach programm\ schlug fehl.
echo   Laeuft dort gerade etwas? Erst ORION-STOPPEN.cmd, dann nochmal.
echo   Die fertigen Dateien liegen in:  %TMP%
echo.
pause
exit /b 1
