@echo off
rem ============================================================
rem  EINMALIG ausfuehren - danach nie wieder noetig.
rem
rem  Verhindert, dass der Laptop im Leerlauf einschlaeft. Im
rem  Schlaf laeuft KEIN Programm weiter, also auch die Bridge
rem  nicht - genau daran ist die Nacht vom 11. auf den 12.
rem  August gescheitert (Standby nach 15 Minuten Leerlauf).
rem
rem  Der Bildschirm darf weiter dunkel werden, das stoert nicht.
rem  Deckel zuklappen ist bei diesem Geraet ebenfalls in Ordnung
rem  - die Einstellung steht bereits auf "nichts tun".
rem
rem  Rueckgaengig machen: dieselben Befehle mit 30 statt 0.
rem ============================================================
title Standby abschalten

echo.
echo   Vorher:
powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE | findstr /i "Wechselstrom AC"
echo.

powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

echo   Nachher (0x00000000 = schlaeft nicht mehr ein):
powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE | findstr /i "Wechselstrom AC"
echo.
echo   Fertig. Am AKKU bleibt der Standby bewusst an, damit der
echo   Laptop unterwegs nicht leerlaeuft.
echo.
pause
