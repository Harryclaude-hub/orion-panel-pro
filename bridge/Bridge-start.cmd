@echo off
chcp 65001 >nul
title Orion Bridge 4.0 - Betfair
cd /d "%~dp0"

echo.
echo   ORION BRIDGE 4.0
echo   ----------------------------------------------------------
echo   Dieses Fenster offen lassen. Schliessen beendet die Bridge.
echo   Bei einem Absturz startet sie sich hier von selbst neu.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   FEHLER: Node ist nicht installiert.
  echo   Einmalig holen: https://nodejs.org  ^(LTS, Standardeinstellungen^)
  echo.
  pause
  exit /b 1
)

if not exist "bridge-config.json" (
  echo   FEHLER: bridge-config.json fehlt in diesem Ordner.
  echo   Kopiere sie aus dem alten Bridge-Ordner hierher.
  echo.
  pause
  exit /b 1
)

:start
node orion-bridge-4.js
echo.
echo   Bridge beendet ^(Code %errorlevel%^). Neustart in 15 Sekunden ...
echo   Zum endgueltigen Beenden dieses Fenster schliessen.
timeout /t 15 /nobreak >nul
goto start
