@echo off
rem ============================================================================
rem  ORION STARTEN. Ein Doppelklick, alles laeuft.
rem ============================================================================
rem  Startet, was noch nicht laeuft:
rem    1. die BETFAIR-BRIDGE   holt Kurse von Betfair
rem    2. den SCANNER          paart Polymarket gegen Betfair
rem    3. die zwei TELEGRAM-BOTS, sobald ihre Schluessel hinterlegt sind
rem
rem  LAEUFT SCHON ETWAS, wird es NICHT doppelt gestartet. Deshalb darf diese
rem  Datei beliebig oft laufen - sie ist zugleich der Waechter. Die frueher
rem  getrennte Aufgabe "Orion Bridge Waechter" ist am 27.8. geloescht: sie
rem  zeigte nach dem Aufraeumen auf eine verschobene Datei und warf alle paar
rem  Minuten ein Fehlerfenster.
rem
rem  KEINE FENSTER MEHR. Frueher blieb je Programm ein minimiertes Terminal
rem  stehen, dessen Ausgabe ins Protokoll ging - es sah leer aus. Jetzt laeuft
rem  alles verborgen. Was passiert, steht in programm\*.log
rem
rem  BEENDEN: ORION-STOPPEN.cmd
rem
rem  WEITERGEBEN: der Ordner ist in sich vollstaendig. Kopieren, eigene
rem  bridge-config.json einsetzen, doppelklicken. Nichts ist auf diesen
rem  Laptop festgenagelt.
rem
rem  /auto  laesst Ausgaben und das Warten am Ende weg (fuer den Aufgabenplaner)
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem ============================================================================

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto :kein_node

rem ---- Telegram-Schluessel einmalig erfragen, wenn noch keiner da ist ----
if /i "%~1"=="/auto" goto :los
set "TGDA="
for /f "delims=" %%T in ('node -e "process.stdout.write(String(require(\"./bridge-config.json\").telegramBotToken||\"\"))" 2^>nul') do set "TGDA=%%T"
if not "%TGDA%"=="" goto :los

echo.
echo   TELEGRAM: die zwei Bot-Schluessel fehlen noch.
echo   ------------------------------------------------------------
echo   Sie liegen NUR bei Telegram selbst, kein Dashboard noetig:
echo.
echo     Telegram oeffnen  ^>  Chat mit  @BotFather
echo     /mybots schreiben  ^>  Bot antippen  ^>  API Token
echo.
echo   Sie sehen so aus:  1234567890:AAE...
echo   Werden hier gemerkt, also nur EINMAL noetig.
echo   Leer lassen und Enter geht auch, dann laufen Bridge und Scanner.
echo.
set "TG1="
set "TG2="
set /p TG1=  Schluessel des CHANCEN-Bots:
set /p TG2=  Schluessel des KNAPP-Bots:
if "%TG1%"=="" goto :los
node -e "const f='./bridge-config.json',fs=require('fs'),c=JSON.parse(fs.readFileSync(f,'utf8'));c.telegramBotToken=process.env.TG1||'';c.telegramBotTokenKnapp=process.env.TG2||'';fs.writeFileSync(f,JSON.stringify(c,null,2));console.log('  gemerkt. Ab jetzt nie wieder noetig.');"
set "TG1="
set "TG2="

:los
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0programm\orion-start.ps1" %*
if /i "%~1"=="/auto" exit /b 0
echo   Panel:  https://harryclaude-hub.github.io/orion-panel-pro/
echo.
pause
exit /b 0

:kein_node
echo.
echo   FEHLER: Node ist nicht installiert. https://nodejs.org
echo.
if /i "%~1"=="/auto" exit /b 1
pause
exit /b 1
