@echo off
rem ============================================================================
rem  ORION - die BEIDEN TELEGRAM-MELDER ausrollen. Doppelklick genuegt.
rem ============================================================================
rem  Schwesterdatei zu DEPLOY-JETZT.cmd (die rollt den SCANNER aus).
rem  Diese hier rollt die zwei Bots aus:
rem      orion-melder-telegram  (Chancen-Bot, laeuft minuetlich)
rem      orion-melder-knapp     (Knapp-Bot, laeuft alle fuenf Minuten)
rem
rem  WAS SICH GEAENDERT HAT (20.8., Karams Vorgabe): in beiden Meldungen
rem  fuehrt JEDER Link ins eigene Haus. Die zwei Buchzeilen zeigen nicht
rem  mehr direkt auf den Anbieter, sondern auf
rem      beitrag.html?fund=<schluessel>&zu=1   bzw.   &zu=2
rem  Dort steht der Absprung zum Anbieter als eigener Klick, mit dem
rem  aktuellen Kurs daneben. Grund: zwischen Meldung und Klick koennen
rem  Minuten liegen. Der Kurs in der Telegram-Nachricht ist eingefroren,
rem  der auf der Seite nicht.
rem
rem  GEFAHRLOS: schlaegt der Deploy fehl, aendert sich NICHTS - die alten
rem  Fassungen melden unveraendert weiter.
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem ============================================================================

title Orion - die zwei Telegram-Melder ausrollen
cd /d "C:\Users\Home\orion-panel-pro"

echo.
echo   ORION - DIE ZWEI MELDER AUSROLLEN
echo   ============================================================
echo.
echo   Danach fuehrt in beiden Bots jeder Link auf die eigene
echo   Beitragsseite statt direkt zum Anbieter.
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
echo   [1/4] Node pruefen ...
where node >nul 2>nul
if errorlevel 1 (
  echo         FEHLER: Node fehlt. Einmalig holen:
  echo         winget install OpenJS.NodeJS.LTS
  echo.
  pause
  exit /b 1
)
echo         in Ordnung.

set "SUPABASE_ACCESS_TOKEN=%TOKEN%"

echo   [2/4] Chancen-Bot ausrollen ...
echo.
call npx --yes supabase@latest functions deploy orion-melder-telegram --project-ref noexklrgtqveiclijdwp --no-verify-jwt
set ERG1=%errorlevel%

echo.
echo   [3/4] Knapp-Bot ausrollen ...
echo.
call npx --yes supabase@latest functions deploy orion-melder-knapp --project-ref noexklrgtqveiclijdwp --no-verify-jwt
set ERG2=%errorlevel%

set "SUPABASE_ACCESS_TOKEN="
set "TOKEN="

echo.
if not "%ERG1%"=="0" goto :schiefgegangen
if not "%ERG2%"=="0" goto :schiefgegangen

echo   [4/4] FUNKPROBE - beide Bots schicken ein MUSTER in deinen Chat.
echo         Pruefe dort: die zwei Buchzeilen muessen "ansehen" heissen
echo         und auf harryclaude-hub.github.io zeigen, NICHT auf
echo         polymarket.com / smarkets.com / betfair.
echo.
curl -s -X POST "https://noexklrgtqveiclijdwp.supabase.co/functions/v1/orion-melder-telegram" -H "content-type: application/json" -d "{\"test\":true}"
echo.
curl -s -X POST "https://noexklrgtqveiclijdwp.supabase.co/functions/v1/orion-melder-knapp" -H "content-type: application/json" -d "{\"test\":true}"
echo.
echo.
echo   ============================================================
echo   FERTIG. Beide Bots stehen auf dem neuen Stand.
echo   ============================================================
echo.
pause
exit /b 0

:schiefgegangen
echo   ============================================================
echo   FEHLGESCHLAGEN. Es hat sich NICHTS geaendert - beide Bots
echo   melden unveraendert auf dem alten Stand weiter. Es ist
echo   nichts kaputt.
echo.
echo   Haeufigste Ursache: Token abgelaufen oder widerrufen.
echo   Einfach neuen holen und nochmal doppelklicken.
echo   ============================================================
echo.
pause
exit /b 1
