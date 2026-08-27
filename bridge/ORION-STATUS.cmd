@echo off
rem ============================================================================
rem  ORION STATUS. Doppelklick, und Du siehst selbst, ob alles laeuft.
rem ============================================================================
rem  Zeigt auf einer Seite:
rem    - welche Programme auf diesem Laptop laufen
rem    - wie frisch die Daten der vier Boersen sind
rem    - wie viele Zeilen und Chancen im Panel stehen
rem    - was zuletzt in jedem Protokoll passiert ist
rem  Aktualisiert sich alle 10 Sekunden.
rem
rem  WARUM ES DAS GIBT: seit dem 27.8. laufen die Programme VERBORGEN, damit
rem  keine leeren Terminals mehr herumstehen. Damit sieht man aber auch nicht
rem  mehr, DASS sie laufen. Dieses Fenster gibt die Kontrolle zurueck.
rem
rem  Dieses Fenster zu schliessen beendet NUR die Anzeige. Die Programme
rem  laufen weiter.
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem ============================================================================

title Orion - Status
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0programm\orion-status.ps1"
