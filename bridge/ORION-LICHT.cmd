@echo off
rem ============================================================================
rem  ORION-LICHT. Doppelklick, und oben rechts steht ein kleines Fenster.
rem ============================================================================
rem  GRUEN  alles laeuft, Kurse sind frisch
rem  GELB   laeuft, aber die Kurse sind zu alt oder die Datenbank hakt
rem  ROT    ein Programm laeuft nicht
rem
rem  Das Fenster bleibt immer obenauf und ist klein. Man kann es mit der Maus
rem  hinschieben, wo man will.
rem    Klick        oeffnet die ausfuehrliche Anzeige
rem    Rechtsklick  schliesst das Licht (die Programme laufen weiter)
rem
rem  Es startet ab jetzt beim Anmelden von selbst mit.
rem
rem  KEINE UMLAUTE: cmd liest die Datei in der alten Codepage.
rem ============================================================================

rem  /test  zeigt das rote Fenster absichtlich, damit man einmal SIEHT,
rem  wie es aussieht und wo es steht. Rechtsklick blendet es wieder aus.
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0programm\orion-licht.ps1" %*
