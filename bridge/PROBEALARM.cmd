@echo off
rem ============================================================================
rem  PROBEALARM - zeigt das rote Warnfenster absichtlich
rem ============================================================================
rem  Damit sieht man EINMAL, wie die Warnung aussieht und wo sie steht, ohne
rem  dass wirklich etwas kaputt sein muss.
rem
rem  Das rote Fenster erscheint oben rechts. Rechtsklick darauf blendet es aus
rem  und beendet die Probe. Das echte Warnlicht laeuft davon unberuehrt weiter.
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem ============================================================================
echo.
echo   PROBEALARM
echo   ============================================================
echo.
echo   Gleich erscheint oben rechts das rote Warnfenster.
echo   So sieht es aus, wenn wirklich etwas klemmt.
echo.
echo   Rechtsklick darauf blendet es aus.
echo.
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0programm\orion-licht.ps1" /test
timeout /t 3 >nul
exit /b 0
