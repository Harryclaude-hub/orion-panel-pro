@echo off
rem ============================================================================
rem  ORION - nachsehen, WELCHE Geheimnisse bei Supabase hinterlegt sind
rem ============================================================================
rem  ANLASS 27.8.2026: ORION_DB_KEY wurde angelegt und alle neun Funktionen
rem  neu ausgerollt - trotzdem kommt weiter "JWT issued at future". Der Code
rem  nimmt ORION_DB_KEY und faellt NUR dann auf den alten Schluessel zurueck,
rem  wenn er leer ist. Also kommt der neue Schluessel nicht an.
rem
rem  Moegliche Gruende: Name anders geschrieben, oder der falsche Schluessel
rem  eingefuegt. Diese Datei zeigt die NAMEN aller Geheimnisse - die WERTE
rem  gibt Supabase grundsaetzlich nicht heraus, auch hier nicht.
rem
rem  Es wird NICHTS geaendert. Reines Nachsehen.
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem ============================================================================

title Orion - Geheimnisse pruefen
cd /d "%~dp0"

echo.
echo   WELCHE GEHEIMNISSE LIEGEN BEI SUPABASE?
echo   ============================================================
echo.
echo   Es wird nichts geaendert, nur nachgesehen.
echo   Die WERTE zeigt Supabase nie an - auch hier nicht, nur die Namen.
echo.
echo   Du brauchst denselben Ausroll-Token wie vorhin (beginnt mit sbp_).
echo   Falls er weg ist:  https://supabase.com/dashboard/account/tokens
echo.

set "TOKEN="
set /p TOKEN=  Token hier einfuegen (Rechtsklick fuegt ein) und Enter:

if "%TOKEN%"=="" goto :kein_token
echo %TOKEN%| findstr /b /c:"sbp_" >nul
if errorlevel 1 goto :falscher_token

echo.
echo   Frage nach ...
echo.
curl -s -m 30 "https://api.supabase.com/v1/projects/noexklrgtqveiclijdwp/secrets" -H "Authorization: Bearer %TOKEN%" > "%~dp0geheimnisse.txt"
set "TOKEN="

node -e "const fs=require('fs');let r;try{r=JSON.parse(fs.readFileSync('geheimnisse.txt','utf8'))}catch(e){console.log('  Antwort unlesbar:');console.log('  '+fs.readFileSync('geheimnisse.txt','utf8').slice(0,200));process.exit(0)};if(!Array.isArray(r)){console.log('  Fehler von Supabase:');console.log('  '+JSON.stringify(r).slice(0,200));process.exit(0)};console.log('  Gefundene Geheimnisse:');for(const g of r){const n=g.name||'?';const w=String(g.value||'');const zeig=w?(w.slice(0,10)+'... ('+w.length+' Zeichen)'):'(Wert nicht einsehbar)';console.log('    '+n.padEnd(28)+zeig)};const t=r.find(x=>x.name==='ORION_DB_KEY');console.log('');if(!t){console.log('  >>> ORION_DB_KEY IST NICHT DA. Name genau so schreiben, GROSS mit Unterstrichen.')}else{const w=String(t.value||'');if(w.startsWith('sb_secret_')){console.log('  >>> ORION_DB_KEY ist da und beginnt richtig mit sb_secret_')}else if(w){console.log('  >>> ORION_DB_KEY ist da, beginnt aber mit \"'+w.slice(0,12)+'\" - das ist der FALSCHE Schluessel.');console.log('      Gebraucht wird der aus Project Settings > API Keys > Secret keys.')}else{console.log('  >>> ORION_DB_KEY ist da. Den Wert zeigt Supabase nicht an.')}}"

del "%~dp0geheimnisse.txt" >nul 2>nul
echo.
echo   ============================================================
echo   Schick Claude, was hier oben steht.
echo   ============================================================
echo.
pause
exit /b 0

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
