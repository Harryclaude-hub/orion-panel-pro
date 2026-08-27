@echo off
rem ============================================================================
rem  ORION BEENDEN. Doppelklick genuegt.
rem ============================================================================
rem  Beendet die Betfair-Bridge, den Scanner und die Telegram-Bots.
rem
rem  WARUM ES DIESE DATEI GIBT: seit dem 27.8. laufen die drei Programme
rem  VERBORGEN, damit keine leeren Terminals mehr herumstehen. Verborgen
rem  heisst aber auch: man kann sie nicht mehr durch Fensterschliessen
rem  beenden. Dafuer ist diese Datei da.
rem
rem  ACHTUNG: der Aufgabenplaner startet Orion alle 10 Minuten neu. Wer
rem  laenger Ruhe will, muss zusaetzlich die Aufgabe "Orion Bridge"
rem  deaktivieren (Aufgabenplanung oeffnen, Rechtsklick, Deaktivieren).
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem ============================================================================

echo.
echo   ORION BEENDEN
echo   ============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$n=0; Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*Orion-Bridge-Pro*' -or $_.CommandLine -like '*orion-lokal*' -or $_.CommandLine -like '*orion-sammler-lokal*' -or $_.CommandLine -like '*orion-melder-lokal*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host ('   beendet: ' + $_.ProcessId); $n++ }; $s=Join-Path $env:LOCALAPPDATA 'orion-bridge.lock'; if (Test-Path $s) { Remove-Item -LiteralPath $s -Force }; if ($n -eq 0) { Write-Host '   Es lief nichts.' } else { Write-Host ('   ' + $n + ' Programm(e) beendet.') }"

echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*orion-licht*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host '   Licht beendet.' }"

echo   Zum Wiederstarten: ORION-STARTEN.cmd
echo.
pause

