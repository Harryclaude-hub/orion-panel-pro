# ===========================================================================
#  ORION STATUS - selbst nachsehen, ob alles laeuft
# ===========================================================================
#  Wird von ORION-STATUS.cmd aufgerufen und aktualisiert sich alle 10 s.
#
#  WARUM ES DAS GIBT (27.08.2026): seit die drei Programme VERBORGEN laufen,
#  steht kein Fenster mehr herum - gut gegen Durcheinander, aber Karam sah
#  gar nichts mehr und musste glauben, dass etwas laeuft. Diese Anzeige gibt
#  ihm die Kontrolle zurueck: eine Seite, alles drauf, ohne Nachfragen.
# ===========================================================================

$Programm = Split-Path -Parent $MyInvocation.MyCommand.Path
$SUPA = 'https://noexklrgtqveiclijdwp.supabase.co'
$KEY  = 'sb_publishable_NrgVUoZhe-uN8U8j41P17Q_9cZgUd6M'
$kopf = @{ apikey = $KEY; authorization = "Bearer $KEY" }

function Alter($iso) {
  if (-not $iso) { return $null }
  return [int]((Get-Date).ToUniversalTime() - [datetime]::Parse($iso).ToUniversalTime()).TotalSeconds
}
function Zeig($s) { if ($s -lt 60) { "$s s" } elseif ($s -lt 3600) { "{0} min" -f [math]::Round($s/60,1) } else { "{0} h" -f [math]::Round($s/3600,1) } }

while ($true) {
  Clear-Host
  Write-Host ""
  Write-Host "   ORION - STAND $((Get-Date).ToString('HH:mm:ss'))" -ForegroundColor Cyan
  Write-Host "   ============================================================"
  Write-Host ""

  # ---- 1. Was laeuft auf diesem Laptop ----
  Write-Host "   PROGRAMME AUF DIESEM LAPTOP" -ForegroundColor White
  $alle = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue
  $dienste = @(
    @{ n = 'Betfair-Bridge';   m = 'Orion-Bridge-Pro' },
    @{ n = 'Scanner';          m = 'orion-lokal' },
    @{ n = 'Kalshi+Smarkets';  m = 'orion-sammler' },
    @{ n = 'Telegram-Bots';    m = 'orion-melder-lokal' }
  )
  foreach ($d in $dienste) {
    $p = $alle | Where-Object { $_.CommandLine -like ('*' + $d.m + '*') } | Select-Object -First 1
    if ($p) {
      $seit = (Get-Date) - $p.CreationDate
      Write-Host ("     {0,-18} LAEUFT   seit {1:hh\:mm\:ss}" -f $d.n, $seit) -ForegroundColor Green
    } else {
      $farbe = if ($d.m -eq 'orion-melder-lokal') { 'DarkGray' } else { 'Red' }
      $text  = if ($d.m -eq 'orion-melder-lokal') { 'aus (kein Telegram-Schluessel)' } else { 'LAEUFT NICHT' }
      Write-Host ("     {0,-18} {1}" -f $d.n, $text) -ForegroundColor $farbe
    }
  }

  # ---- 2. Wie frisch sind die vier Boersen ----
  Write-Host ""
  Write-Host "   DIE VIER BOERSEN" -ForegroundColor White
  try {
    $bf = Invoke-RestMethod -Uri "$SUPA/rest/v1/bridge_odds?id=eq.1&select=updated_at,markets" -Headers $kopf -TimeoutSec 15
    $ka = Invoke-RestMethod -Uri "$SUPA/rest/v1/kalshi_snapshot?select=id,updated_at,maerkte&order=id" -Headers $kopf -TimeoutSec 15
    $sm = Invoke-RestMethod -Uri "$SUPA/rest/v1/smarkets_snapshot?id=eq.1&select=updated_at,maerkte" -Headers $kopf -TimeoutSec 15

    $reihen = @(
      @{ n='Betfair';      a=(Alter $bf[0].updated_at); z=$bf[0].markets.Count;  g=300 },
      @{ n='Kalshi Sport'; a=(Alter $ka[0].updated_at); z=$ka[0].maerkte.Count;  g=900 },
      @{ n='Kalshi Welt';  a=(Alter $ka[1].updated_at); z=$ka[1].maerkte.Count;  g=900 },
      @{ n='Smarkets';     a=(Alter $sm[0].updated_at); z=$sm[0].maerkte.Count;  g=900 }
    )
    foreach ($r in $reihen) {
      $ok = $r.a -le $r.g
      $wort = if ($ok) { 'frisch' } else { 'ZU ALT, gesperrt' }
      $farbe = if ($ok) { 'Green' } else { 'Red' }
      Write-Host ("     {0,-14} {1,8}   {2,6} Maerkte   {3}" -f $r.n, (Zeig $r.a), $r.z, $wort) -ForegroundColor $farbe
    }
  } catch {
    Write-Host "     Datenbank nicht erreichbar: $($_.Exception.Message)" -ForegroundColor Red
  }

  # ---- 3. Was steht im Panel ----
  Write-Host ""
  Write-Host "   IM PANEL" -ForegroundColor White
  try {
    $live = Invoke-RestMethod -Uri "$SUPA/rest/v1/orion_funde?status=eq.live&select=rendite,weg" -Headers $kopf -TimeoutSec 15
    $ch = @($live | Where-Object { $_.rendite -ge 2 }).Count
    Write-Host ("     Lebende Zeilen : {0}" -f @($live).Count)
    Write-Host ("     Chancen ab 2 % : {0}" -f $ch) -ForegroundColor $(if ($ch -gt 0) { 'Yellow' } else { 'Gray' })
    $wege = $live | Group-Object weg | Sort-Object Count -Descending | Select-Object -First 6
    if ($wege) { Write-Host ("     Paarungen      : " + (($wege | ForEach-Object { "$($_.Name) $($_.Count)" }) -join '  ')) }
  } catch {
    Write-Host "     nicht erreichbar" -ForegroundColor Red
  }

  # ---- 4. Letzte Zeile jedes Protokolls ----
  Write-Host ""
  Write-Host "   ZULETZT PASSIERT" -ForegroundColor White
  foreach ($f in @(@{d='bridge-lauf.log'; n='Bridge  '}, @{d='notbetrieb.log'; n='Scanner '}, @{d='sammler.log'; n='Sammler '})) {
    $pfad = Join-Path $Programm $f.d
    if (Test-Path $pfad) {
      # -Encoding utf8: die Protokolle sind UTF-8, PowerShell liest sonst
      # die alte Codepage und macht aus "Fussball" ein "FuAYball".
      $z = Get-Content $pfad -Tail 1 -Encoding utf8 -ErrorAction SilentlyContinue
      if ($z) { Write-Host ("     {0} {1}" -f $f.n, $z.Trim().Substring(0,[Math]::Min(70,$z.Trim().Length))) -ForegroundColor Gray }
    }
  }

  Write-Host ""
  Write-Host "   Panel: https://harryclaude-hub.github.io/orion-panel-pro/" -ForegroundColor DarkCyan
  Write-Host "   Aktualisiert sich alle 10 Sekunden. Fenster schliessen beendet NUR diese Anzeige."
  Start-Sleep -Seconds 10
}
