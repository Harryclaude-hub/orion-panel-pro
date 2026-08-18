# ============================================================================
#  ORION BRIDGE - WAECHTER (19.08.2026)
# ============================================================================
#  Anlass: Am 19.08. stand die Bridge still, ohne dass es jemand meldete.
#  Die Aufgabenplanung merkt das NICHT: wird der Prozess von aussen beendet
#  oder das Fenster geschlossen, sieht sie nur "Aufgabe fertig, Code 0".
#
#  Dieser Waechter laeuft alle 5 Minuten und startet die Bridge NUR dann,
#  wenn gerade keine laeuft. Die Einzelinstanz-Sperre der Bridge ist die
#  zweite Absicherung: startet doch einmal eine zweite, beendet sie sich
#  sofort von selbst.
#
#  WARUM PowerShell und nicht cmd: die erste Fassung nutzte "wmic" — das
#  gibt es auf diesem Windows 11 NICHT MEHR. Die Pruefung schlug damit
#  immer fehl und der Waechter haette alle 5 Minuten einen sinnlosen Start
#  versucht. Beim Testen aufgefallen, nicht im Betrieb.
#
#  Startet node DIREKT, nicht Bridge-start.cmd: die hat eine eigene
#  Neustart-Schleife und kaeme diesem Waechter in die Quere.
# ============================================================================

$ordner = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ordner

$laeuft = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
          Where-Object { $_.CommandLine -like '*orion-bridge-4.js*' }

if ($laeuft) {
  Write-Output ("[" + (Get-Date -Format 'dd.MM.yyyy HH:mm:ss') + "] Bridge laeuft (PID " + $laeuft.ProcessId + ") - nichts zu tun.")
  exit 0
}

# Verwaiste Sperrdatei wegraeumen: der Prozess lebt nicht mehr, sonst waeren
# wir oben schon ausgestiegen.
$sperre = Join-Path $ordner 'bridge.lock'
if (Test-Path $sperre) { Remove-Item $sperre -Force -ErrorAction SilentlyContinue }

Write-Output ("[" + (Get-Date -Format 'dd.MM.yyyy HH:mm:ss') + "] Bridge steht - wird gestartet.")
Start-Process -FilePath 'node.exe' -ArgumentList 'orion-bridge-4.js' `
              -WorkingDirectory $ordner -WindowStyle Minimized
exit 0
