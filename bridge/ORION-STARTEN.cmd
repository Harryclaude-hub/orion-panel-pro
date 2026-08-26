@echo off
rem ============================================================================
rem  ORION STARTEN. Ein Doppelklick, alles laeuft.
rem ============================================================================
rem  Startet drei Dinge:
rem    1. die BETFAIR-BRIDGE   (holt Kurse von Betfair)
rem    2. den SCANNER          (paart Polymarket gegen Betfair)
rem    3. die zwei TELEGRAM-BOTS
rem
rem  WARUM ALLES HIER LAEUFT: die Supabase-Server-Funktionen kommen seit dem
rem  25.8. nicht mehr an ihre eigene Datenbank ("JWT issued at future",
rem  HTTP 401). Neuen Code hochzuladen nuetzt nichts, solange der Server die
rem  Datenbank nicht lesen darf. Deshalb laeuft alles ersatzweise hier - mit
rem  GENAU DEMSELBEN Code, nur fuer Node gebuendelt.
rem
rem  Ist die Stoerung vorbei, dieses Fenster einfach schliessen. Die
rem  Server-Takte uebernehmen dann von selbst wieder.
rem
rem  Die Telegram-Schluessel werden EINMAL abgefragt und danach in
rem  bridge-config.json gemerkt. Nie wieder tippen.
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem ============================================================================

title Orion - alles starten
cd /d "%~dp0"

echo.
echo   ORION STARTEN
echo   ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :kein_node
if not exist "bridge-config.json" goto :keine_config

rem ---- Bridge-Token lesen ----
set "ORION_BRIDGE_TOKEN="
for /f "delims=" %%T in ('node -e "process.stdout.write(String(require(\"./bridge-config.json\").bridgeToken||\"\"))"') do set "ORION_BRIDGE_TOKEN=%%T"
if "%ORION_BRIDGE_TOKEN%"=="" goto :kein_bridgetoken

rem ---- Telegram-Schluessel lesen, notfalls einmal fragen ----
set "TELEGRAM_BOT_TOKEN="
set "TELEGRAM_BOT_TOKEN_KNAPP="
for /f "delims=" %%T in ('node -e "process.stdout.write(String(require(\"./bridge-config.json\").telegramBotToken||\"\"))"') do set "TELEGRAM_BOT_TOKEN=%%T"
for /f "delims=" %%T in ('node -e "process.stdout.write(String(require(\"./bridge-config.json\").telegramBotTokenKnapp||\"\"))"') do set "TELEGRAM_BOT_TOKEN_KNAPP=%%T"

if not "%TELEGRAM_BOT_TOKEN%"=="" goto :telegram_da

echo   TELEGRAM: die zwei Bot-Schluessel fehlen noch.
echo   ------------------------------------------------------------
echo   Sie liegen nur bei Telegram selbst. So kommst Du ran:
echo.
echo     Telegram oeffnen  ^>  Chat mit  @BotFather
echo     /mybots schreiben  ^>  Bot auswaehlen  ^>  API Token
echo.
echo   Sie sehen so aus:  1234567890:AAE...
echo   Sie werden in bridge-config.json gemerkt, also nur EINMAL noetig.
echo   Leer lassen und Enter geht auch - dann laufen Bridge und Scanner,
echo   nur ohne Telegram.
echo.
set /p TELEGRAM_BOT_TOKEN=  Schluessel des CHANCEN-Bots:
set /p TELEGRAM_BOT_TOKEN_KNAPP=  Schluessel des KNAPP-Bots:

if "%TELEGRAM_BOT_TOKEN%"=="" goto :telegram_da
node -e "const f='./bridge-config.json',fs=require('fs'),c=JSON.parse(fs.readFileSync(f,'utf8'));c.telegramBotToken=process.env.TELEGRAM_BOT_TOKEN||'';c.telegramBotTokenKnapp=process.env.TELEGRAM_BOT_TOKEN_KNAPP||'';fs.writeFileSync(f,JSON.stringify(c,null,2));console.log('  gemerkt.');"

:telegram_da
echo.
echo   [1/3] Betfair-Bridge starten ...
start "Orion Bridge" /min cmd /c "node Orion-Bridge-Pro-27.js > bridge-lauf.log 2>&1"

echo   [2/3] Scanner starten ...
start "Orion Scanner" /min cmd /c "node orion-lokal.js > notbetrieb.log 2>&1"

if "%TELEGRAM_BOT_TOKEN%"=="" goto :ohne_telegram
echo   [3/3] Telegram-Bots starten ...
start "Orion Melder" /min cmd /c "node orion-melder-lokal.js > melder.log 2>&1"
goto :fertig

:ohne_telegram
echo   [3/3] Telegram uebersprungen, kein Schluessel hinterlegt.

:fertig
echo.
echo   ============================================================
echo   LAEUFT. Drei kleine Fenster stehen jetzt in der Taskleiste.
echo.
echo   Was gerade passiert, steht in:
echo     bridge-lauf.log    die Betfair-Bridge
echo     notbetrieb.log     der Scanner
echo     melder.log         die Telegram-Bots
echo.
echo   Panel:  https://harryclaude-hub.github.io/orion-panel-pro/
echo.
echo   BEENDEN: die drei kleinen Fenster schliessen.
echo   ============================================================
echo.
set "ORION_BRIDGE_TOKEN="
set "TELEGRAM_BOT_TOKEN="
set "TELEGRAM_BOT_TOKEN_KNAPP="
pause
exit /b 0

:kein_node
echo   FEHLER: Node ist nicht installiert. https://nodejs.org
echo.
pause
exit /b 1

:keine_config
echo   FEHLER: bridge-config.json fehlt in diesem Ordner.
echo.
pause
exit /b 1

:kein_bridgetoken
echo   FEHLER: in bridge-config.json steht kein bridgeToken.
echo.
pause
exit /b 1
