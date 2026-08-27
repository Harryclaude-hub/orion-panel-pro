@echo off
rem ============================================================================
rem  TELEGRAM-SCHLUESSEL AUS SUPABASE HOLEN. Ein Doppelklick.
rem ============================================================================
rem  Karam hatte recht: die beiden Bot-Schluessel liegen laengst in den
rem  Supabase-Geheimnissen. Ich kann sie von aussen nicht lesen - aber DEIN
rem  Ausroll-Token darf das. Diese Datei holt sie damit und traegt sie in
rem  bridge-config.json ein. Danach laufen die Telegram-Bots lokal weiter,
rem  genau wie Bridge, Scanner und Sammler.
rem
rem  WAS PASSIERT
rem    1. fragt einmal nach dem Ausroll-Token (beginnt mit sbp_)
rem    2. holt die Geheimnisliste von api.supabase.com
rem    3. traegt TELEGRAM_BOT_TOKEN und TELEGRAM_BOT_TOKEN_KNAPP
rem       in bridge-config.json ein
rem    4. startet die Bots
rem
rem  DIE SCHLUESSEL BLEIBEN AUF DIESEM LAPTOP. Sie gehen von Supabase in
rem  deine eigene Zugangsdatei, sonst nirgendwohin. Der Ausroll-Token wird
rem  nicht gespeichert und verschwindet mit diesem Fenster.
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem ============================================================================

title Orion - Telegram-Schluessel holen
cd /d "%~dp0"

echo.
echo   TELEGRAM-SCHLUESSEL AUS SUPABASE HOLEN
echo   ============================================================
echo.
echo   Die beiden Bot-Schluessel liegen in den Supabase-Geheimnissen.
echo   Mit deinem Ausroll-Token hole ich sie und trage sie hier ein.
echo   Danach nie wieder noetig.
echo.
echo   Token holen, falls keiner mehr da ist:
echo     https://supabase.com/dashboard/account/tokens
echo   Er beginnt mit  sbp_  und wird NICHT gespeichert.
echo.

where node >nul 2>nul
if errorlevel 1 goto :kein_node
if not exist "bridge-config.json" goto :keine_config

set "TOKEN="
set /p TOKEN=  Token hier einfuegen (Rechtsklick fuegt ein) und Enter:

if "%TOKEN%"=="" goto :kein_token
echo %TOKEN%| findstr /b /c:"sbp_" >nul
if errorlevel 1 goto :falscher_token

echo.
echo   Hole die Geheimnisse ...
curl -s -m 40 "https://api.supabase.com/v1/projects/noexklrgtqveiclijdwp/secrets" -H "Authorization: Bearer %TOKEN%" > "%TEMP%\orion-geheim.json"
set "TOKEN="

node -e "const fs=require('fs');const q=process.env.TEMP+'\\orion-geheim.json';let r;try{r=JSON.parse(fs.readFileSync(q,'utf8'))}catch(e){console.log('  Antwort unlesbar. Token falsch oder abgelaufen?');process.exit(1)}if(!Array.isArray(r)){console.log('  Supabase sagt: '+JSON.stringify(r).slice(0,160));process.exit(1)}const hol=n=>{const t=r.find(x=>x.name===n);return t&&t.value?String(t.value):''};const a=hol('TELEGRAM_BOT_TOKEN'),b=hol('TELEGRAM_BOT_TOKEN_KNAPP');console.log('  Gefundene Geheimnisse: '+r.map(x=>x.name).join(', '));console.log('');if(!a&&!b){console.log('  KEINER der beiden Telegram-Schluessel ist dort hinterlegt.');console.log('  Namen muessen TELEGRAM_BOT_TOKEN und TELEGRAM_BOT_TOKEN_KNAPP sein.');process.exit(1)}const f='./bridge-config.json';const c=JSON.parse(fs.readFileSync(f,'utf8'));if(a)c.telegramBotToken=a;if(b)c.telegramBotTokenKnapp=b;fs.writeFileSync(f,JSON.stringify(c,null,2));console.log('  Chancen-Bot : '+(a?('eingetragen ('+a.length+' Zeichen, beginnt '+a.slice(0,8)+'...)'):'FEHLT in Supabase'));console.log('  Knapp-Bot   : '+(b?('eingetragen ('+b.length+' Zeichen, beginnt '+b.slice(0,8)+'...)'):'FEHLT in Supabase'));"
set "ERG=%errorlevel%"

del "%TEMP%\orion-geheim.json" >nul 2>nul
if not "%ERG%"=="0" goto :nichts_gefunden

echo.
echo   Starte die Telegram-Bots ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0programm\orion-start.ps1"

echo.
echo   ============================================================
echo   FERTIG. Die Bots laufen jetzt mit.
echo   Was sie tun, steht in  programm\melder.log
echo   ============================================================
echo.
pause
exit /b 0

:nichts_gefunden
echo.
echo   ============================================================
echo   Es wurde nichts eingetragen. Es hat sich nichts geaendert.
echo   Schick Claude, was hier oben steht.
echo   ============================================================
echo.
pause
exit /b 1

:falscher_token
set "TOKEN="
echo.
echo   Das ist der falsche Schluessel. Gebraucht wird der AUSROLL-Token,
echo   er beginnt mit  sbp_  und kommt von:
echo     https://supabase.com/dashboard/account/tokens
echo.
pause
exit /b 1

:kein_token
echo.
echo   Kein Token eingegeben. Nichts passiert.
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
