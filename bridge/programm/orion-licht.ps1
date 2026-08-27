# ===========================================================================
#  ORION-LICHT - ein kleines Fenster, das immer obenauf bleibt
# ===========================================================================
#  Karams Wunsch am 27.08.2026: "Irgendein gruenes Licht, und wenn es dann
#  mal nicht laeuft, wird's rot."
#
#  WARUM: seit die Programme verborgen laufen, sieht man nicht mehr, DASS
#  sie laufen. Karam musste dreimal nachfragen, ob die Bridge aktiv ist,
#  obwohl sie durchlief. Dieses Fenster beantwortet das ohne Nachfragen.
#
#  GRUEN  alles laeuft und die Daten sind frisch
#  GELB   laeuft, aber etwas ist zu alt oder eine Quelle fehlt
#  ROT    ein Programm laeuft nicht
#
#  Klick aufs Fenster oeffnet die ausfuehrliche Anzeige.
#  Rechtsklick schliesst das Licht (die Programme laufen weiter).
# ===========================================================================

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$Programm = Split-Path -Parent $MyInvocation.MyCommand.Path
$SUPA = 'https://noexklrgtqveiclijdwp.supabase.co'
$KEY  = 'sb_publishable_NrgVUoZhe-uN8U8j41P17Q_9cZgUd6M'
$kopf = @{ apikey = $KEY; authorization = "Bearer $KEY" }

# ---- Fenster -------------------------------------------------------------
$f = New-Object System.Windows.Forms.Form
$f.Text = 'Orion'
$f.FormBorderStyle = 'None'
$f.Size = New-Object System.Drawing.Size(230, 84)
$f.TopMost = $true
$f.ShowInTaskbar = $false
$f.BackColor = [System.Drawing.Color]::FromArgb(12, 18, 30)
$f.StartPosition = 'Manual'
$bild = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$f.Location = New-Object System.Drawing.Point(($bild.Width - 250), 20)

$punkt = New-Object System.Windows.Forms.Label
$punkt.Text = [char]0x25CF          # ein voller Kreis
$punkt.Font = New-Object System.Drawing.Font('Segoe UI', 30)
$punkt.ForeColor = [System.Drawing.Color]::Gray
$punkt.Location = New-Object System.Drawing.Point(12, 8)
$punkt.Size = New-Object System.Drawing.Size(52, 58)
$punkt.TextAlign = 'MiddleCenter'
$f.Controls.Add($punkt)

$kopfzeile = New-Object System.Windows.Forms.Label
$kopfzeile.Font = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
$kopfzeile.ForeColor = [System.Drawing.Color]::White
$kopfzeile.Location = New-Object System.Drawing.Point(66, 12)
$kopfzeile.Size = New-Object System.Drawing.Size(156, 24)
$kopfzeile.Text = 'pruefe ...'
$f.Controls.Add($kopfzeile)

$zeile2 = New-Object System.Windows.Forms.Label
$zeile2.Font = New-Object System.Drawing.Font('Segoe UI', 8)
$zeile2.ForeColor = [System.Drawing.Color]::FromArgb(133, 160, 189)
$zeile2.Location = New-Object System.Drawing.Point(68, 38)
$zeile2.Size = New-Object System.Drawing.Size(154, 34)
$f.Controls.Add($zeile2)

# Klick: ausfuehrliche Anzeige. Rechtsklick: schliessen.
$klick = {
  if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Right) { $f.Close(); return }
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', (Join-Path (Split-Path -Parent $Programm) 'ORION-STATUS.cmd')
}
$f.Add_MouseClick($klick)
$punkt.Add_MouseClick($klick)
$kopfzeile.Add_MouseClick($klick)
$zeile2.Add_MouseClick($klick)

# Fenster mit der Maus verschieben duerfen
$zieheVon = $null
$f.Add_MouseDown({ $script:zieheVon = $_.Location })
$f.Add_MouseMove({
  if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left -and $script:zieheVon) {
    $f.Location = New-Object System.Drawing.Point(
      ($f.Location.X + $_.X - $script:zieheVon.X),
      ($f.Location.Y + $_.Y - $script:zieheVon.Y))
  }
})
$f.Add_MouseUp({ $script:zieheVon = $null })

# ---- Pruefung ------------------------------------------------------------
function Pruefe {
  $noetig = @(
    @{ n='Bridge';   m='Orion-Bridge-Pro' },
    @{ n='Scanner';  m='orion-lokal' },
    @{ n='Sammler';  m='orion-sammler' }
  )
  $alle = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue
  $fehlt = @()
  foreach ($d in $noetig) {
    if (-not ($alle | Where-Object { $_.CommandLine -like ('*' + $d.m + '*') })) { $fehlt += $d.n }
  }

  if ($fehlt.Count -gt 0) {
    return @{ farbe='rot'; kopf='STEHT'; text=($fehlt -join ', ') + ' laeuft nicht' }
  }

  # Laeuft alles: wie frisch sind die Daten?
  try {
    $bf = Invoke-RestMethod -Uri "$SUPA/rest/v1/bridge_odds?id=eq.1&select=updated_at" -Headers $kopf -TimeoutSec 10
    $alt = [int]((Get-Date).ToUniversalTime() - [datetime]::Parse($bf[0].updated_at).ToUniversalTime()).TotalSeconds
    $z = Invoke-RestMethod -Uri "$SUPA/rest/v1/orion_funde?status=eq.live&select=rendite" -Headers $kopf -TimeoutSec 10
    $anz = @($z).Count
    $ch  = @($z | Where-Object { $_.rendite -ge 2 }).Count

    if ($alt -gt 300) {
      return @{ farbe='gelb'; kopf='ALTE KURSE'; text=("Betfair " + [math]::Round($alt/60) + " min alt") }
    }
    $t = "Betfair $alt s  ·  $anz Zeilen"
    if ($ch -gt 0) { $t += "`n$ch Chance" + $(if ($ch -gt 1) { 'n' } else { '' }) + " im Panel" }
    return @{ farbe='gruen'; kopf='LAEUFT'; text=$t }
  } catch {
    return @{ farbe='gelb'; kopf='LAEUFT'; text='Datenbank gerade nicht erreichbar' }
  }
}

$takt = New-Object System.Windows.Forms.Timer
$takt.Interval = 15000
$takt.Add_Tick({
  $e = Pruefe
  switch ($e.farbe) {
    'gruen' { $punkt.ForeColor = [System.Drawing.Color]::FromArgb(47, 211, 167) }
    'gelb'  { $punkt.ForeColor = [System.Drawing.Color]::FromArgb(242, 193, 78) }
    default { $punkt.ForeColor = [System.Drawing.Color]::FromArgb(255, 107, 133) }
  }
  $kopfzeile.Text = $e.kopf
  $zeile2.Text = $e.text
})
$takt.Start()

$f.Add_Shown({
  $e = Pruefe
  switch ($e.farbe) {
    'gruen' { $punkt.ForeColor = [System.Drawing.Color]::FromArgb(47, 211, 167) }
    'gelb'  { $punkt.ForeColor = [System.Drawing.Color]::FromArgb(242, 193, 78) }
    default { $punkt.ForeColor = [System.Drawing.Color]::FromArgb(255, 107, 133) }
  }
  $kopfzeile.Text = $e.kopf
  $zeile2.Text = $e.text
})

[void]$f.ShowDialog()
