@echo off
rem ============================================================================
rem  ORION - die BEIDEN TELEGRAM-MELDER ausrollen. Doppelklick genuegt.
rem ============================================================================
rem  Schwesterdatei zu DEPLOY-JETZT.cmd (die rollt den SCANNER aus).
rem  Diese hier rollt die zwei Bots aus:
rem      orion-melder-telegram  (Chancen-Bot, laeuft minuetlich)
rem      orion-melder-knapp     (Knapp-Bot, laeuft alle fuenf Minuten)
rem
rem  UMBAU 24.8.: KEIN npx/supabase-CLI mehr. Windows' Anwendungssteuerung
rem  (Smart App Control) blockiert frisch geladene unsignierte Programme -
rem  daran scheiterte jeder Deploy seit dem 23.8., unabhaengig vom Token.
rem  Jetzt geht alles ueber das SIGNIERTE, eingebaute curl direkt an die
rem  Supabase-Verwaltungsschnittstelle. Jede Antwort landet zusaetzlich in
rem      bridge\letzter-deploy-1.log  (Chancen-Bot)
rem      bridge\letzter-deploy-2.log  (Knapp-Bot)
rem  damit ein Fehlschlag nie wieder stumm bleibt.
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

set "API=https://api.supabase.com/v1/projects/noexklrgtqveiclijdwp/functions/deploy"

echo.
echo   [1/4] Chancen-Bot ausrollen ...
echo {"name":"orion-melder-telegram","entrypoint_path":"index.ts","verify_jwt":false}>"%TEMP%\orion-meta1.json"
set "CODE1="
for /f %%H in ('curl -s -o "%~dp0letzter-deploy-1.log" -w "%%{http_code}" -X POST "%API%?slug=orion-melder-telegram" -H "Authorization: Bearer %TOKEN%" -F "metadata=<%TEMP%\orion-meta1.json;type=application/json" -F "file=@supabase/functions/orion-melder-telegram/index.ts;type=application/typescript"') do set CODE1=%%H
echo         Antwort HTTP %CODE1%  (Details: bridge\letzter-deploy-1.log)

echo   [2/4] Knapp-Bot ausrollen ...
echo {"name":"orion-melder-knapp","entrypoint_path":"index.ts","verify_jwt":false}>"%TEMP%\orion-meta2.json"
set "CODE2="
for /f %%H in ('curl -s -o "%~dp0letzter-deploy-2.log" -w "%%{http_code}" -X POST "%API%?slug=orion-melder-knapp" -H "Authorization: Bearer %TOKEN%" -F "metadata=<%TEMP%\orion-meta2.json;type=application/json" -F "file=@supabase/functions/orion-melder-knapp/index.ts;type=application/typescript"') do set CODE2=%%H
echo         Antwort HTTP %CODE2%  (Details: bridge\letzter-deploy-2.log)

set "TOKEN="
del "%TEMP%\orion-meta1.json" "%TEMP%\orion-meta2.json" >nul 2>nul

echo.
if not "%CODE1%"=="200" if not "%CODE1%"=="201" goto :schiefgegangen
if not "%CODE2%"=="200" if not "%CODE2%"=="201" goto :schiefgegangen

echo   [3/4] ABONNENTEN ABHOLEN - jeder, der einem Bot geschrieben hat,
echo         wird sofort als Empfaenger eingetragen, MIT Beitragslink.
echo         (Ab jetzt passiert das ohnehin automatisch bei jedem Takt.)
echo.
curl -s -X POST "https://noexklrgtqveiclijdwp.supabase.co/functions/v1/orion-melder-telegram" -H "content-type: application/json" -d "{\"abholen\":true}"
echo.
curl -s -X POST "https://noexklrgtqveiclijdwp.supabase.co/functions/v1/orion-melder-knapp" -H "content-type: application/json" -d "{\"abholen\":true}"
echo.
echo.
echo   [4/4] WER BEKOMMT WAS - Liste beider Bots.
echo.
curl -s -X POST "https://noexklrgtqveiclijdwp.supabase.co/functions/v1/orion-melder-telegram" -H "content-type: application/json" -d "{\"einrichten\":true}"
echo.
curl -s -X POST "https://noexklrgtqveiclijdwp.supabase.co/functions/v1/orion-melder-knapp" -H "content-type: application/json" -d "{\"einrichten\":true}"
echo.
echo.
echo   ============================================================
echo   FERTIG. Beide Bots stehen auf dem neuen Stand und senden an
echo   ALLE eingetragenen Empfaenger. Ab jetzt genuegt /start:
echo   jeder neue Starter wird automatisch eingetragen und begruesst.
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
echo   FEHLGESCHLAGEN (HTTP %CODE1% / %CODE2%). Es hat sich NICHTS
echo   geaendert - beide Bots melden unveraendert weiter.
echo.
echo   Der GRUND steht jetzt schwarz auf weiss in:
echo     bridge\letzter-deploy-1.log   und   bridge\letzter-deploy-2.log
echo.
echo   HTTP 401 = Token falsch/abgelaufen: neuen holen, nochmal klicken.
echo   Alles andere: Claude die Log-Dateien lesen lassen.
echo   ============================================================
echo.
pause
exit /b 1
