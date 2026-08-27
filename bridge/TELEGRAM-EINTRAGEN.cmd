@echo off
rem ============================================================================
rem  TELEGRAM-SCHLUESSEL EINTRAGEN. Ein Doppelklick, dann nie wieder.
rem ============================================================================
rem  Fragt die zwei Bot-Schluessel ab, FRAGT TELEGRAM OB SIE STIMMEN, und
rem  traegt sie erst dann in bridge-config.json ein. Danach starten die Bots.
rem
rem  WARUM MIT PRUEFUNG: am 27.08. wurden Werte eingetragen, die wie
rem  Schluessel aussahen, aber keine waren - Supabase hatte nur Pruefsummen
rem  herausgegeben. Der Bot scheiterte dann jede Minute still. Diese Datei
rem  fragt deshalb bei Telegram nach, BEVOR sie etwas speichert, und nennt
rem  den Bot beim Namen, wenn es geklappt hat.
rem
rem  WO DIE SCHLUESSEL HERKOMMEN
rem    Telegram oeffnen  >  Chat mit  @BotFather
rem    /mybots senden    >  Bot antippen  >  API Token
rem    Sie sehen so aus:  1234567890:AAEabc...   (Zahlen, Doppelpunkt, Rest)
rem
rem  Die Schluessel bleiben auf diesem Laptop, in bridge-config.json.
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem ============================================================================

title Orion - Telegram-Schluessel eintragen
cd /d "%~dp0"

echo.
echo   TELEGRAM-SCHLUESSEL EINTRAGEN
echo   ============================================================
echo.
echo   So kommst du an sie, auf dem Handy oder am Rechner:
echo.
echo     Telegram oeffnen  ^>  Chat mit  @BotFather
echo     /mybots senden    ^>  Bot antippen  ^>  API Token
echo.
echo   Sie sehen so aus:   1234567890:AAEabc...
echo   Zahlen, dann ein DOPPELPUNKT, dann Buchstaben. Ohne Doppelpunkt
echo   ist es keiner.
echo.
echo   Einen leer lassen geht auch - dann laeuft nur der andere Bot.
echo.

where node >nul 2>nul
if errorlevel 1 goto :kein_node
if not exist "bridge-config.json" goto :keine_config

set "TG1="
set "TG2="
set /p TG1=  1. CHANCEN-Bot  (meldet Funde ab 2 Prozent):
set /p TG2=  2. KNAPP-Bot    (meldet die knappen Paare):

if "%TG1%%TG2%"=="" goto :nichts

echo.
echo   Frage bei Telegram nach, ob die Schluessel stimmen ...
echo.

pushd "%~dp0programm"
node telegram-eintragen.js
popd
set "ERG=%errorlevel%"
set "TG1="
set "TG2="

if not "%ERG%"=="0" goto :schiefgegangen

echo.
echo   Starte die Bots ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0programm\orion-start.ps1"

echo.
echo   ============================================================
echo   FERTIG. Die Bots laufen mit.
echo   Was sie tun, steht in  programm\melder.log
echo   ============================================================
echo.
pause
exit /b 0

:schiefgegangen
echo.
echo   ============================================================
echo   Nichts gespeichert, nichts kaputt. Einfach nochmal.
echo   Der Schluessel muss aussehen wie:  1234567890:AAEabc...
echo   ============================================================
echo.
pause
exit /b 1

:nichts
echo.
echo   Nichts eingegeben. Es hat sich nichts geaendert.
echo.
pause
exit /b 1

:kein_node
echo   FEHLER: Node ist nicht installiert. https://nodejs.org
echo.
pause
exit /b 1

:keine_config
echo   FEHLER: bridge-config.json fehlt neben dieser Datei.
echo.
pause
exit /b 1
