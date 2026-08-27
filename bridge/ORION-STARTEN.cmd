@echo off
rem ============================================================================
rem  ORION STARTEN. Ein Doppelklick, alles laeuft.
rem ============================================================================
rem  Startet drei Dinge:
rem    1. die BETFAIR-BRIDGE   holt Kurse von Betfair
rem    2. den SCANNER          paart Polymarket gegen Betfair
rem    3. die zwei TELEGRAM-BOTS
rem
rem  Alles Weitere liegt im Unterordner  programm\  - da muss niemand hinein.
rem  Oben stehen nur drei Dinge: dieser Starter, die Zugangsdatei und die
rem  Anleitung. (Aufgeraeumt am 26.8.2026 auf Karams Ansage.)
rem
rem  WEITERGEBEN: der ganze Ordner ORION-BRIDGE ist in sich vollstaendig.
rem  Wer ihn kopiert, seine eigene bridge-config.json einsetzt und diese
rem  Datei doppelklickt, hat eine eigene lokale Bridge. Nichts ist auf
rem  diesen Laptop festgenagelt.
rem
rem  /auto  laesst alle Rueckfragen und das Warten am Ende weg. So ruft der
rem         Aufgabenplaner die Datei beim Anmelden auf.
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem ============================================================================

title Orion - alles starten
cd /d "%~dp0"

set "AUTO="
if /i "%~1"=="/auto" set "AUTO=1"

if defined AUTO goto :pruefen
echo.
echo   ORION STARTEN
echo   ============================================================
echo.

:pruefen
where node >nul 2>nul
if errorlevel 1 goto :kein_node
if not exist "bridge-config.json" goto :keine_config
if not exist "programm\orion-lokal.js" goto :kein_programm

rem ---- Schluessel aus der Zugangsdatei lesen ----
set "ORION_BRIDGE_TOKEN="
set "TELEGRAM_BOT_TOKEN="
set "TELEGRAM_BOT_TOKEN_KNAPP="
for /f "delims=" %%T in ('node -e "process.stdout.write(String(require(\"./bridge-config.json\").bridgeToken||\"\"))"') do set "ORION_BRIDGE_TOKEN=%%T"
for /f "delims=" %%T in ('node -e "process.stdout.write(String(require(\"./bridge-config.json\").telegramBotToken||\"\"))"') do set "TELEGRAM_BOT_TOKEN=%%T"
for /f "delims=" %%T in ('node -e "process.stdout.write(String(require(\"./bridge-config.json\").telegramBotTokenKnapp||\"\"))"') do set "TELEGRAM_BOT_TOKEN_KNAPP=%%T"

if "%ORION_BRIDGE_TOKEN%"=="" goto :kein_bridgetoken
if not "%TELEGRAM_BOT_TOKEN%"=="" goto :starten
if defined AUTO goto :starten

echo   TELEGRAM: die zwei Bot-Schluessel fehlen noch.
echo   ------------------------------------------------------------
echo   Sie liegen NUR bei Telegram selbst - kein Dashboard noetig:
echo.
echo     Telegram oeffnen  ^>  Chat mit  @BotFather
echo     /mybots schreiben  ^>  Bot antippen  ^>  API Token
echo.
echo   Sie sehen so aus:  1234567890:AAE...
echo   Werden hier gemerkt, also nur EINMAL noetig.
echo   Leer lassen und Enter geht auch - dann laufen Bridge und Scanner,
echo   nur ohne Telegram.
echo.
set /p TELEGRAM_BOT_TOKEN=  Schluessel des CHANCEN-Bots:
set /p TELEGRAM_BOT_TOKEN_KNAPP=  Schluessel des KNAPP-Bots:
if "%TELEGRAM_BOT_TOKEN%"=="" goto :starten
node -e "const f='./bridge-config.json',fs=require('fs'),c=JSON.parse(fs.readFileSync(f,'utf8'));c.telegramBotToken=process.env.TELEGRAM_BOT_TOKEN||'';c.telegramBotTokenKnapp=process.env.TELEGRAM_BOT_TOKEN_KNAPP||'';fs.writeFileSync(f,JSON.stringify(c,null,2));console.log('  gemerkt. Ab jetzt nie wieder noetig.');"

:starten
if not defined AUTO echo.
if not defined AUTO echo   [1/3] Betfair-Bridge ...
start "Orion Bridge" /min cmd /c "cd /d "%~dp0programm" && node Orion-Bridge-Pro-27.js > bridge-lauf.log 2>&1"

if not defined AUTO echo   [2/3] Scanner ...
start "Orion Scanner" /min cmd /c "cd /d "%~dp0programm" && node orion-lokal.js > notbetrieb.log 2>&1"

if "%TELEGRAM_BOT_TOKEN%"=="" goto :ohne_telegram
if not defined AUTO echo   [3/3] Telegram-Bots ...
start "Orion Melder" /min cmd /c "cd /d "%~dp0programm" && node orion-melder-lokal.js > melder.log 2>&1"
goto :fertig

:ohne_telegram
if not defined AUTO echo   [3/3] Telegram uebersprungen, kein Schluessel hinterlegt.

:fertig
set "ORION_BRIDGE_TOKEN="
set "TELEGRAM_BOT_TOKEN="
set "TELEGRAM_BOT_TOKEN_KNAPP="
if defined AUTO exit /b 0
echo.
echo   ============================================================
echo   LAEUFT. Drei kleine Fenster stehen in der Taskleiste.
echo.
echo   Was gerade passiert, steht in programm\ :
echo     bridge-lauf.log    die Betfair-Bridge
echo     notbetrieb.log     der Scanner
echo     melder.log         die Telegram-Bots
echo.
echo   Panel:  https://harryclaude-hub.github.io/orion-panel-pro/
echo.
echo   BEENDEN: die drei kleinen Fenster schliessen.
echo   ============================================================
echo.
pause
exit /b 0

:kein_node
echo   FEHLER: Node ist nicht installiert. https://nodejs.org
if not defined AUTO pause
exit /b 1

:keine_config
echo   FEHLER: bridge-config.json fehlt neben dieser Datei.
if not defined AUTO pause
exit /b 1

:kein_programm
echo   FEHLER: der Unterordner programm\ fehlt oder ist unvollstaendig.
if not defined AUTO pause
exit /b 1

:kein_bridgetoken
echo   FEHLER: in bridge-config.json steht kein bridgeToken.
if not defined AUTO pause
exit /b 1
