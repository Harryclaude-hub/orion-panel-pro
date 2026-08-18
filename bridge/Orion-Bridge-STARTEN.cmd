@echo off
rem ============================================================================
rem  ORION BRIDGE 4.0 - STARTER UND WAECHTER IN EINER DATEI (19.08.2026)
rem ============================================================================
rem  Doppelklick genuegt. Arbeitet in IHREM EIGENEN Ordner - egal wo der liegt
rem  (Desktop, Dokumente, USB-Stick). Kein fester Pfad, keine zweite Kopie.
rem
rem  ZWEI BETRIEBSARTEN:
rem     ohne Argument   voller Start: Standby aus, pruefen, starten, Waechter
rem     /waechter       stiller Nachschau-Lauf alle 5 Minuten (von der Aufgabe)
rem
rem  Warum beides in EINER Datei: vorher gab es Bridge-start.cmd,
rem  Bridge-waechter.ps1 und diesen Starter nebeneinander - drei Dateien fuer
rem  eine Aufgabe. Karam am 19.08.: "warum sind manche einfach doppelt?"
rem
rem  KEINE UMLAUTE hier: cmd.exe liest die Datei in der alten Codepage,
rem  Umlaute in rem-Zeilen wurden als Befehle missverstanden.
rem ============================================================================

cd /d "%~dp0"
set "HIER=%~dp0"
if "%HIER:~-1%"=="\" set "HIER=%HIER:~0,-1%"

if /i "%~1"=="/waechter" goto :waechter

rem ============================ VOLLER START ==================================
title Orion Bridge 4.0 - Start
echo.
echo   ORION BRIDGE 4.0
echo   ============================================================
echo   Ordner: %HIER%
echo.

echo   [1/4] Standby abschalten ...
powercfg /change standby-timeout-ac 0    >nul 2>&1
powercfg /change standby-timeout-dc 0    >nul 2>&1
powercfg /change hibernate-timeout-ac 0  >nul 2>&1
powercfg /change hibernate-timeout-dc 0  >nul 2>&1
rem Deckel zuklappen = nichts unternehmen (Netz UND Akku). Auf manchen
rem Geraeten ist die Einstellung versteckt, deshalb erst sichtbar machen.
powercfg -attributes SUB_BUTTONS 5ca83367-6e45-459f-a27b-476b1d01c936 -ATTRIB_HIDE >nul 2>&1
powercfg /setacvalueindex SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 0 >nul 2>&1
powercfg /setdcvalueindex SCHEME_CURRENT 4f971e89-eebd-4455-a8de-9e59040e7347 5ca83367-6e45-459f-a27b-476b1d01c936 0 >nul 2>&1
powercfg /setactive SCHEME_CURRENT >nul 2>&1
echo         Deckel zuklappen: nichts unternehmen. Standby und Ruhezustand: nie.

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

echo   [3/4] Bridge starten ...
call :starten
echo   [4/4] Waechter einrichten ...
rem  Warum: Am 19.08. stand die Bridge still, ohne dass es jemand meldete.
rem  Die Aufgabenplanung merkt das nicht - wird der Prozess von aussen
rem  beendet, sieht sie nur "Aufgabe fertig". Der Waechter ruft DIESE Datei
rem  alle 5 Minuten mit /waechter auf.
schtasks /create /tn "Orion Bridge Waechter" /f /rl limited /sc minute /mo 5 ^
  /tr "\"%HIER%\Orion-Bridge-STARTEN.cmd\" /waechter" >nul 2>&1
if errorlevel 1 ( echo         konnte nicht eingerichtet werden - nicht schlimm. ) else ( echo         eingerichtet: alle 5 Minuten. )

echo.
echo   Fertig. Du kannst den Deckel jetzt zuklappen.
echo   Nachsehen: im Panel muss die Betfair-Kachel unter 1 Minute zeigen.
echo.
rem ping statt timeout: timeout bricht ab, sobald die Eingabe umgeleitet ist.
ping -n 9 127.0.0.1 >nul
exit /b 0

rem ============================ WAECHTER-LAUF =================================
:waechter
call :starten >nul 2>&1
exit /b 0

rem ============================ GEMEINSAMER TEIL ==============================
rem  Startet die Bridge NUR, wenn keine laeuft. Die Einzelinstanz-Sperre der
rem  Bridge ist die zweite Absicherung.
rem  Geprueft wird ueber PowerShell, NICHT ueber wmic: wmic gibt es auf
rem  Windows 11 nicht mehr - die erste Fassung haette deshalb immer einen
rem  sinnlosen Start versucht (am 19.08. beim Testen aufgefallen).
:starten
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$l = Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*orion-bridge-4.js*' };" ^
  "if ($l) { Write-Host ('        Laeuft bereits (PID ' + $l.ProcessId + ') - nichts zu tun.'); exit 0 }" ^
  "$s = Join-Path '%HIER%' 'bridge.lock'; if (Test-Path $s) { Remove-Item $s -Force -ErrorAction SilentlyContinue };" ^
  "Start-Process -FilePath 'node.exe' -ArgumentList 'orion-bridge-4.js' -WorkingDirectory '%HIER%' -WindowStyle Minimized;" ^
  "Start-Sleep -Seconds 6;" ^
  "$n = Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*orion-bridge-4.js*' };" ^
  "if ($n) { Write-Host ('        Gestartet (PID ' + $n.ProcessId + ').') } else { Write-Host '        START FEHLGESCHLAGEN.' }"
exit /b 0
