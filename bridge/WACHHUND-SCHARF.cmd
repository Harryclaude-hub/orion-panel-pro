@echo off
rem ============================================================================
rem  ORION - den WACHHUND scharf schalten. Doppelklick genuegt.
rem ============================================================================
rem  Der Wachhund ist der Waechter VON AUSSEN (GitHub Actions, alle 30 min).
rem  Er prueft, ob die Datenbank antwortet und ob der Scanner frisch laeuft -
rem  unabhaengig von Supabase UND vom Laptop. Genau die Luecke vom 23.8.:
rem  damals schwiegen Scanner, beide Bots UND das Lebenszeichen gleichzeitig,
rem  weil alle drei IM ausgefallenen System wohnen.
rem
rem  BEREITS ERLEDIGT (von Claude): der Workflow liegt auf GitHub und ist
rem  aktiv, die Chat-Nummer TELEGRAM_CHAT_ID ist gesetzt.
rem
rem  ES FEHLT NUR NOCH: der Bot-Token. Den kann niemand auslesen, er liegt
rem  ausschliesslich in den Supabase-Secrets - deshalb dieser eine Schritt.
rem
rem  WO DU IHN HERBEKOMMST (einer der beiden Wege):
rem    a) Supabase-Dashboard  >  Project Settings  >  Edge Functions
rem       >  Secrets  >  TELEGRAM_BOT_TOKEN  >  anzeigen und kopieren
rem    b) Telegram, Chat mit @BotFather  >  /mybots  >  deinen Chancen-Bot
rem       waehlen  >  API Token
rem
rem  Der Token sieht so aus:  1234567890:AAE...
rem  Er wird NICHT gespeichert und verschwindet mit diesem Fenster. Bei
rem  GitHub landet er verschluesselt als Secret und ist dort nie wieder
rem  lesbar - auch nicht fuer dich selbst.
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem ============================================================================

title Orion - Wachhund scharf schalten
cd /d "C:\Users\Home\orion-panel-pro"

echo.
echo   ORION - DEN WACHHUND SCHARF SCHALTEN
echo   ============================================================
echo.
echo   Danach meldet dir GitHub jeden Totalausfall binnen 30 Minuten
echo   per Telegram - auch dann, wenn Supabase komplett steht und
echo   dein Laptop aus ist.
echo.
echo   Bot-Token holen (einer der beiden Wege):
echo     a) Supabase-Dashboard ^> Project Settings ^> Edge Functions
echo        ^> Secrets ^> TELEGRAM_BOT_TOKEN ^> kopieren
echo     b) Telegram ^> @BotFather ^> /mybots ^> Chancen-Bot ^> API Token
echo.
echo   Er sieht so aus:  1234567890:AAE...
echo.

set "BOTTOKEN="
set /p BOTTOKEN=  Bot-Token hier einfuegen (Rechtsklick fuegt ein) und Enter:

if "%BOTTOKEN%"=="" (
  echo.
  echo   Kein Token eingegeben. Nichts passiert.
  echo.
  pause
  exit /b 1
)

echo.
echo   [1/3] GitHub-Anmeldung pruefen ...
gh auth status >nul 2>nul
if errorlevel 1 (
  echo         FEHLER: gh ist nicht angemeldet. Einmalig:  gh auth login
  echo.
  pause
  exit /b 1
)
echo         in Ordnung.

echo   [2/3] Token als GitHub-Secret hinterlegen ...
gh secret set TELEGRAM_BOT_TOKEN --repo Harryclaude-hub/orion-panel-pro --body "%BOTTOKEN%"
set ERG=%errorlevel%
set "BOTTOKEN="

if not "%ERG%"=="0" (
  echo.
  echo   ============================================================
  echo   FEHLGESCHLAGEN. Es hat sich nichts geaendert.
  echo   Haeufigste Ursache: gh fehlen Rechte. Dann einmal:
  echo     gh auth refresh -h github.com -s repo
  echo   ============================================================
  echo.
  pause
  exit /b 1
)
echo         gesetzt.

echo   [3/3] Probelauf starten ...
gh workflow run wachhund.yml --repo Harryclaude-hub/orion-panel-pro
echo.
echo   ============================================================
echo   FERTIG. Der Wachhund ist scharf.
echo.
echo   Er laeuft ab jetzt alle 30 Minuten von selbst und SCHWEIGT,
echo   solange alles gesund ist. Nur bei Stoerung funkt er:
echo     - Supabase antwortet nicht
echo     - oder der letzte Scanner-Lauf ist ueber 20 Minuten alt
echo.
echo   Laeufe ansehen:
echo     https://github.com/Harryclaude-hub/orion-panel-pro/actions
echo   ============================================================
echo.
pause
