@echo off
title Orion Bridge 4.0 - Start
rem ============================================================================
rem  ORION BRIDGE - EIN-KLICK-STARTER (19.08.2026)
rem ============================================================================
rem  Doppelklick genuegt. Diese Datei arbeitet in IHREM EIGENEN Ordner - egal
rem  wo der liegt (Desktop, Dokumente, USB-Stick). Kein fester Pfad, keine
rem  zweite Kopie irgendwo anders.
rem
rem  Was sie tut, in dieser Reihenfolge:
rem     1. Standby, Ruhezustand und Deckel-Zuklappen abschalten
rem     2. pruefen, ob Node und alle noetigen Dateien da sind
rem     3. die Bridge starten - nur wenn nicht schon eine laeuft
rem     4. den Waechter einrichten (holt sie zurueck, falls sie stehenbleibt)
rem
rem  KEINE UMLAUTE in dieser Datei: cmd.exe liest sie in der alten Codepage,
rem  Umlaute in rem-Zeilen wurden am 19.08. als Befehle missverstanden.
rem ============================================================================

cd /d "%~dp0"
set "HIER=%~dp0"
if "%HIER:~-1%"=="\" set "HIER=%HIER:~0,-1%"

echo.
echo   ORION BRIDGE 4.0
echo   ============================================================
echo   Ordner: %HIER%
echo.

rem ---------- 1. Dauerbetrieb sicherstellen ----------
echo   [1/4] Standby abschalten ...
powercfg /change standby-timeout-ac 0    >nul 2>&1
powercfg /change standby-timeout-dc 0    >nul 2>&1
powercfg /change hibernate-timeout-ac 0  >nul 2>&1
powercfg /change hibernate-timeout-dc 0  >nul 2>&1
rem Deckel zuklappen = nichts unternehmen (Netz UND Akku). Die Einstellung ist
rem auf manchen Geraeten versteckt, deshalb erst sichtbar machen.
powercfg -attributes SUB_BUTTONS 5ca83367-6e45-459f-a27b-476b1d01c936 -ATTRIB_HIDE >nul 2>&1
powercfg /setacvalueindex SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 0 >nul 2>&1
powercfg /setdcvalueindex SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 0 >nul 2>&1
powercfg /setactive SCHEME_CURRENT >nul 2>&1
echo         Deckel zuklappen: nichts unternehmen. Standby und Ruhezustand: nie.

rem ---------- 2. Vollstaendigkeit pruefen ----------
echo   [2/4] Dateien pruefen ...
set FEHLT=0
if not exist "%HIER%\orion-bridge-4.js"  ( echo         FEHLT: orion-bridge-4.js & set FEHLT=1 )
if not exist "%HIER%\bridge-config.json" ( echo         FEHLT: bridge-config.json & set FEHLT=1 )
if "%FEHLT%"=="1" (
  echo.
  echo   Ohne diese Dateien kann die Bridge nicht starten.
  echo   Bitte das komplette Paket in EINEN Ordner entpacken.
  echo.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   FEHLER: Node ist nicht installiert.
  echo   Einmalig holen: https://nodejs.org  ^(LTS, Standardeinstellungen^)
  echo.
  pause
  exit /b 1
)
echo         alles vorhanden.

rem ---------- 3. Bridge starten ----------
echo   [3/4] Bridge starten ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$l = Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*orion-bridge-4.js*' };" ^
  "if ($l) { Write-Host ('        Laeuft bereits (PID ' + $l.ProcessId + ') - nichts zu tun.'); exit 0 }" ^
  "$s = Join-Path '%HIER%' 'bridge.lock'; if (Test-Path $s) { Remove-Item $s -Force -ErrorAction SilentlyContinue };" ^
  "Start-Process -FilePath 'node.exe' -ArgumentList 'orion-bridge-4.js' -WorkingDirectory '%HIER%' -WindowStyle Minimized;" ^
  "Start-Sleep -Seconds 6;" ^
  "$n = Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*orion-bridge-4.js*' };" ^
  "if ($n) { Write-Host ('        Gestartet (PID ' + $n.ProcessId + ').') } else { Write-Host '        START FEHLGESCHLAGEN.' }"

rem ---------- 4. Waechter einrichten ----------
rem  Warum: Am 19.08. stand die Bridge still, ohne dass es jemand meldete. Die
rem  Aufgabenplanung merkt das nicht - wird der Prozess von aussen beendet,
rem  sieht sie nur "Aufgabe fertig". Der Waechter sieht alle 5 Minuten nach.
echo   [4/4] Waechter einrichten ...
if exist "%HIER%\Bridge-waechter.ps1" (
  schtasks /create /tn "Orion Bridge Waechter" /f /rl limited /sc minute /mo 5 ^
    /tr "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"%HIER%\Bridge-waechter.ps1\"" >nul 2>&1
  if errorlevel 1 ( echo         konnte nicht eingerichtet werden - nicht schlimm. ) else ( echo         eingerichtet: alle 5 Minuten. )
) else (
  echo         Bridge-waechter.ps1 fehlt - uebersprungen.
)

echo.
echo   Fertig. Du kannst den Deckel jetzt zuklappen.
echo   Nachsehen: im Panel muss die Betfair-Kachel unter 1 Minute zeigen.
echo.
rem ping statt timeout: timeout bricht ab, sobald die Eingabe umgeleitet ist.
ping -n 9 127.0.0.1 >nul
