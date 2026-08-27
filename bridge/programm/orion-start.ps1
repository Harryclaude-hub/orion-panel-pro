# ===========================================================================
#  ORION STARTEN - die eigentliche Arbeit
# ===========================================================================
#  Wird von ORION-STARTEN.cmd aufgerufen. Hier steht die Logik, weil cmd
#  fuer "laeuft das schon?" und "starte ohne Fenster" zu schwach ist.
#
#  DREI EIGENSCHAFTEN, die am 27.08.2026 dazukamen, nachdem der alte Weg
#  Karam Fenster und leere Terminals beschert hat:
#
#  1. IDEMPOTENT. Laeuft etwas schon, wird es NICHT doppelt gestartet.
#     Damit kann dieselbe Datei beim Anmelden UND alle 10 Minuten laufen -
#     sie ist zugleich der Waechter. Die frueher getrennte Aufgabe
#     "Orion Bridge Waechter" ist deshalb geloescht; sie zeigte nach dem
#     Aufraeumen auf eine verschobene Datei und warf alle paar Minuten
#     ein Fehlerfenster.
#
#  2. OHNE FENSTER. Frueher entstand je Programm ein minimiertes
#     cmd-Fenster, dessen Ausgabe ins Protokoll umgeleitet war - es sah
#     also leer aus. Karam sah "zwei Terminals, die nix machen". Jetzt
#     laeuft alles verborgen, die Ausgabe steht in den Protokollen.
#
#  3. KEINE ABSOLUTEN PFADE. Alles wird aus dem eigenen Ort abgeleitet.
#     Der Ordner darf verschoben und weitergegeben werden.
# ===========================================================================

$ErrorActionPreference = 'Stop'

$Programm = Split-Path -Parent $MyInvocation.MyCommand.Path
$Oben     = Split-Path -Parent $Programm
$Auto     = $args -contains '/auto'

function Sag($t) { if (-not $Auto) { Write-Host $t } }

# ---- Was laeuft schon? -----------------------------------------------------
function Laeuft($muster) {
  $p = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
       Where-Object { $_.CommandLine -like "*$muster*" }
  return [bool]$p
}

# ---- Einen Dienst starten, verborgen, mit Protokoll -------------------------
function Starte($name, $datei, $protokoll, $umgebung) {
  if (Laeuft $datei) { Sag ("   laeuft schon: " + $name); return $true }
  $ziel = Join-Path $Programm $datei
  if (-not (Test-Path $ziel)) { Sag ("   FEHLT: " + $datei); return $false }

  foreach ($k in $umgebung.Keys) { Set-Item -Path ("Env:" + $k) -Value $umgebung[$k] }
  try {
    Start-Process -FilePath 'node' -ArgumentList $datei `
      -WorkingDirectory $Programm -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $Programm $protokoll) `
      -RedirectStandardError  (Join-Path $Programm ($protokoll -replace '\.log$','-fehler.log'))
    Sag ("   gestartet: " + $name)
    return $true
  } catch {
    Sag ("   FEHLER bei " + $name + ": " + $_.Exception.Message)
    return $false
  } finally {
    foreach ($k in $umgebung.Keys) { Remove-Item -Path ("Env:" + $k) -ErrorAction SilentlyContinue }
  }
}

# ---- Zugangsdatei ----------------------------------------------------------
$cfgDatei = Join-Path $Oben 'bridge-config.json'
if (-not (Test-Path $cfgDatei)) { $cfgDatei = Join-Path $Programm 'bridge-config.json' }
if (-not (Test-Path $cfgDatei)) {
  Write-Host "   FEHLER: bridge-config.json nicht gefunden."
  exit 1
}
$cfg = Get-Content $cfgDatei -Raw | ConvertFrom-Json
$brg = [string]$cfg.bridgeToken
if (-not $brg) { Write-Host "   FEHLER: in bridge-config.json steht kein bridgeToken."; exit 1 }
$tg  = [string]$cfg.telegramBotToken
$tgk = [string]$cfg.telegramBotTokenKnapp

Sag ""
Sag "   ORION"
Sag "   ============================================================"

# 1. Betfair-Bridge
Starte 'Betfair-Bridge' 'Orion-Bridge-Pro-27.js' 'bridge-lauf.log' @{} | Out-Null

# 2. Scanner
Starte 'Scanner' 'orion-lokal.js' 'notbetrieb.log' @{ ORION_BRIDGE_TOKEN = $brg } | Out-Null

# 3. Sammler fuer Kalshi und Smarkets
#    Seit 27.08. auch hier: ihre Server-Funktionen kommen nicht an die
#    Datenbank, dadurch waren ihre Schnappschuesse ueber 20 Stunden alt und
#    die Frischesperren hielten sie zurueck. Von vier Boersen arbeiteten
#    nur noch zwei.
Starte 'Sammler Kalshi+Smarkets' 'orion-sammler-lokal.js' 'sammler.log' @{ ORION_BRIDGE_TOKEN = $brg } | Out-Null

# 4. Telegram-Bots, nur wenn ein Schluessel hinterlegt ist
if ($tg -or $tgk) {
  Starte 'Telegram-Bots' 'orion-melder-lokal.js' 'melder.log' `
    @{ ORION_BRIDGE_TOKEN = $brg; TELEGRAM_BOT_TOKEN = $tg; TELEGRAM_BOT_TOKEN_KNAPP = $tgk } | Out-Null
} else {
  Sag "   Telegram uebersprungen: kein Bot-Schluessel in bridge-config.json"
}

Sag ""
Sag "   Protokolle liegen in programm\ :"
Sag "     bridge-lauf.log   notbetrieb.log   sammler.log   melder.log"
Sag ""
exit 0
