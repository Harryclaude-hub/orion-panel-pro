@echo off
rem ============================================================================
rem  ORION - die BEIDEN TELEGRAM-MELDER ausrollen. Doppelklick genuegt.
rem ============================================================================
rem  Schwesterdatei zu DEPLOY-JETZT.cmd (die rollt den SCANNER aus).
rem  Diese hier rollt die zwei Bots aus:
rem      orion-melder-telegram  (Chancen-Bot, laeuft minuetlich)
rem      orion-melder-knapp     (Knapp-Bot, laeuft alle fuenf Minuten)
rem
rem  WAS SICH GEAENDERT HAT (24.8., Karams Vorgabe): SELBST-ANMELDUNG.
rem  Wer einem Bot /start schreibt, wird ab jetzt bei JEDEM Takt
rem  automatisch als Empfaenger eingetragen - MIT Beitragslink, also
rem  denselben Meldungen wie der Betreiber - und bekommt sofort eine
rem  Begruessung. Dazu (23.8.): Rendite VOR Gebuehren, Netto-Zusatz im
rem  Kopf, genaue Setz-Anweisung mit Prozent-Aufteilung je Seite.
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
echo   Danach gilt in beiden Bots die SELBST-ANMELDUNG: /start
echo   genuegt, jeder Starter bekommt automatisch jede Meldung
echo   mit allen Links - dieselben wie der Betreiber.
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
echo   [1/5] Node pruefen ...
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

echo   [2/5] Chancen-Bot ausrollen ...
echo.
call npx --yes supabase@latest functions deploy orion-melder-telegram --project-ref noexklrgtqveiclijdwp --no-verify-jwt
set ERG1=%errorlevel%

echo.
echo   [3/5] Knapp-Bot ausrollen ...
echo.
call npx --yes supabase@latest functions deploy orion-melder-knapp --project-ref noexklrgtqveiclijdwp --no-verify-jwt
set ERG2=%errorlevel%

set "SUPABASE_ACCESS_TOKEN="
set "TOKEN="

echo.
if not "%ERG1%"=="0" goto :schiefgegangen
if not "%ERG2%"=="0" goto :schiefgegangen

echo   [4/5] ABONNENTEN ABHOLEN - jeder, der einem Bot geschrieben hat,
echo         wird sofort als Empfaenger eingetragen, MIT Beitragslink.
echo         (Ab jetzt passiert das ohnehin automatisch bei jedem Takt.)
echo.
curl -s -X POST "https://noexklrgtqveiclijdwp.supabase.co/functions/v1/orion-melder-telegram" -H "content-type: application/json" -d "{\"abholen\":true}"
echo.
curl -s -X POST "https://noexklrgtqveiclijdwp.supabase.co/functions/v1/orion-melder-knapp" -H "content-type: application/json" -d "{\"abholen\":true}"
echo.
echo.
echo   [5/5] WER BEKOMMT WAS - Liste beider Bots.
echo         Steht unter BEKOMMEN_NICHTS noch jemand, hat er dem Bot
echo         geschrieben, ist aber nicht eingetragen.
echo.
curl -s -X POST "https://noexklrgtqveiclijdwp.supabase.co/functions/v1/orion-melder-telegram" -H "content-type: application/json" -d "{\"einrichten\":true}"
echo.
curl -s -X POST "https://noexklrgtqveiclijdwp.supabase.co/functions/v1/orion-melder-knapp" -H "content-type: application/json" -d "{\"einrichten\":true}"
echo.
echo.
echo   ============================================================
echo   FERTIG. Beide Bots stehen auf dem neuen Stand und senden an
echo   ALLE eingetragenen Empfaenger.
echo.
echo   ABSICHTLICH KEINE FUNKPROBE: Testnachrichten sahen zuletzt wie
echo   echte Funde aus und haben verwirrt. Wer eine will, ruft
echo   {"test":true} von Hand auf (Befehl in BEFEHLE.txt).
echo.
echo   KANAL NACHTRAGEN: Kanal anlegen, beide Bots als Admin
echo   hinzufuegen, EINE Nachricht in den Kanal schreiben, dann diese
echo   Datei nochmal doppelklicken. Der Kanal wird dann automatisch
echo   als Empfaenger eingetragen.
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
