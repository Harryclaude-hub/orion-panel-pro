# ===========================================================================
#  ORION-WARNLICHT - meldet sich NUR, wenn etwas kaputt ist
# ===========================================================================
#  Karams Ansage am 27.08.2026: "Ich will diese Anzeige nur, wenn was
#  schieflaeuft. Solange nichts schieflaeuft, soll auch keine Anzeige
#  kommen, kein gruenes Licht. Nur ein rotes Licht oben rechts."
#
#  Genau so gebaut. Das Programm laeuft still im Hintergrund und ist
#  UNSICHTBAR, solange alles in Ordnung ist. Erst wenn etwas klemmt,
#  erscheint oben rechts ein kleines rotes Fenster mit dem Grund. Ist der
#  Fehler weg, verschwindet es von selbst wieder.
#
#  Das ist bewusst so: ein Dauerlicht, das immer gruen ist, uebersieht man
#  nach zwei Tagen. Ein Licht, das nur bei Aerger angeht, nicht.
#
#  WAS ALS FEHLER GILT
#    - eines der drei Programme laeuft nicht (Bridge, Scanner, Sammler)
#    - die Betfair-Kurse sind aelter als 5 Minuten (ihre Sperrgrenze)
#    - die Datenbank ist dreimal hintereinander nicht erreichbar
#  Kurze Aussetzer werden bewusst NICHT gemeldet: einmal Pech beim Abruf
#  ist kein Ausfall, und ein Licht, das grundlos angeht, ist wertlos.
#
#  Klick auf das Fenster oeffnet die ausfuehrliche Anzeige.
#  Rechtsklick blendet es aus, bis der naechste Fehler kommt.
# ===========================================================================

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# ---- NUR EINMAL LAUFEN, geraeteweit (27.08.2026) --------------------------
# DREI Anlaeufe, weil zwei Fallstricke zuschlugen:
#   1. Prozesssuche im Starter: zu langsam, zwei Starts im selben Moment
#      sehen einander noch nicht.
#   2. Mutex mit Local\ : gilt JE WINDOWS-SITZUNG. Claudes Befehle laufen
#      in einer anderen Sitzung als Karams Desktop, die zwei Kopien haben
#      sich deshalb nie gesehen. Genau das war gemessen: trotz Sperre zwei.
# Deshalb jetzt eine Sperrdatei mit PID, so wie es die Bridge seit Build 27
# macht. Die wirkt ueber Sitzungsgrenzen hinweg.
$sperre = Join-Path $env:LOCALAPPDATA 'orion-warnlicht.lock'
# Gurt UND Hosentraeger: zusaetzlich direkt nachsehen, ob schon ein anderes
# Warnlicht laeuft. Die Sperrdatei allein hat am 27.08. nicht gereicht -
# vermutlich weil zwei Starts sich im selben Sekundenfenster ueberholten.
# Diese Suche sieht Prozesse ueber Sitzungsgrenzen hinweg.
# EINMAL LAUFEN - und zwar mit PRAEZISEM Vergleich (27.08., vierter Anlauf).
#
# DIE EIGENTLICHE LEHRE: die drei Anlaeufe davor waren gar nicht noetig. Es
# lief immer nur EINE Kopie. Mein Zaehlbefehl suchte nach '*orion-licht*'
# in allen powershell-Befehlszeilen - und dieser Befehl enthielt selbst das
# Wort. Er hat sich also selbst mitgezaehlt und zwei gemeldet. Ich habe
# daraufhin dreimal eine Sperre gebaut, die nie ein Problem hatte.
# Merksatz: erst das MESSGERAET pruefen, dann das Gemessene.
#
# Deshalb jetzt genau: nur Prozesse, die orion-licht.ps1 wirklich per -File
# ausfuehren. Ein Befehl, der den Namen bloss erwaehnt, zaehlt nicht mehr.
try {
  $andere = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction Stop |
              Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match '-File\s+\S*orion-licht\.ps1' })
  if ($andere.Count -gt 0) { exit 0 }
} catch { }

try { Set-Content -LiteralPath $sperre -Value $PID -Encoding ascii -ErrorAction Stop } catch { }

$Programm = Split-Path -Parent $MyInvocation.MyCommand.Path
$Oben     = Split-Path -Parent $Programm
$SUPA = 'https://noexklrgtqveiclijdwp.supabase.co'
$KEY  = 'sb_publishable_NrgVUoZhe-uN8U8j41P17Q_9cZgUd6M'
$kopf = @{ apikey = $KEY; authorization = "Bearer $KEY" }

# ---- Das Fenster, anfangs unsichtbar --------------------------------------
$f = New-Object System.Windows.Forms.Form
$f.Text = 'Orion'
$f.FormBorderStyle = 'None'
$f.Size = New-Object System.Drawing.Size(268, 92)
$f.TopMost = $true
$f.ShowInTaskbar = $false
$f.BackColor = [System.Drawing.Color]::FromArgb(60, 14, 24)
$f.StartPosition = 'Manual'
$bild = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$f.Location = New-Object System.Drawing.Point(($bild.Width - 288), 20)

$punkt = New-Object System.Windows.Forms.Label
$punkt.Text = [char]0x25CF
$punkt.Font = New-Object System.Drawing.Font('Segoe UI', 28)
$punkt.ForeColor = [System.Drawing.Color]::FromArgb(255, 87, 110)
$punkt.Location = New-Object System.Drawing.Point(10, 10)
$punkt.Size = New-Object System.Drawing.Size(48, 56)
$punkt.TextAlign = 'MiddleCenter'
$f.Controls.Add($punkt)

$titel = New-Object System.Windows.Forms.Label
$titel.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
$titel.ForeColor = [System.Drawing.Color]::White
$titel.Location = New-Object System.Drawing.Point(60, 12)
$titel.Size = New-Object System.Drawing.Size(200, 22)
$titel.Text = 'ORION STEHT'
$f.Controls.Add($titel)

$grund = New-Object System.Windows.Forms.Label
$grund.Font = New-Object System.Drawing.Font('Segoe UI', 8)
$grund.ForeColor = [System.Drawing.Color]::FromArgb(255, 200, 210)
$grund.Location = New-Object System.Drawing.Point(62, 36)
$grund.Size = New-Object System.Drawing.Size(198, 48)
$f.Controls.Add($grund)

# ---- ZUSAETZLICH: echte Windows-Benachrichtigung (27.08.2026) -------------
# Karam sieht das rote Fenster nicht - auch der Probealarm blieb unsichtbar,
# obwohl alles in derselben Windows-Sitzung laeuft. Warum, ist ungeklaert.
# Statt weiter daran zu raten kommt hier ein ZWEITER, ganz anderer Weg dazu:
# eine Sprechblase aus dem Infobereich neben der Uhr. Wenn das Fenster nicht
# durchkommt, kommt wenigstens die Blase an - und umgekehrt.
$symbol = New-Object System.Windows.Forms.NotifyIcon
$symbol.Icon = [System.Drawing.SystemIcons]::Warning
$symbol.Text = 'Orion'
$symbol.Visible = $true
$symbol.Add_BalloonTipClicked({
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', (Join-Path $Oben 'ORION-STATUS.cmd')
})
$script:letzteBlase = $null

$klick = {
  if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Right) { $f.Hide(); return }
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', (Join-Path $Oben 'ORION-STATUS.cmd')
}
foreach ($c in @($f, $punkt, $titel, $grund)) { $c.Add_MouseClick($klick) }

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

# ---- Pruefung -------------------------------------------------------------
$script:netzFehler = 0

function Was-Ist-Kaputt {
  $noetig = @(
    @{ n='Betfair-Bridge'; m='Orion-Bridge-Pro' },
    @{ n='Scanner';        m='orion-lokal' },
    @{ n='Sammler';        m='orion-sammler' }
  )
  $alle = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue
  $fehlt = @()
  foreach ($d in $noetig) {
    if (-not ($alle | Where-Object { $_.CommandLine -like ('*' + $d.m + '*') })) { $fehlt += $d.n }
  }
  if ($fehlt.Count -gt 0) {
    return ($fehlt -join ', ') + " laeuft nicht.`nKlick hier fuer Einzelheiten."
  }

  try {
    $bf = Invoke-RestMethod -Uri "$SUPA/rest/v1/bridge_odds?id=eq.1&select=updated_at" -Headers $kopf -TimeoutSec 12
    $script:netzFehler = 0
    $alt = [int]((Get-Date).ToUniversalTime() - [datetime]::Parse($bf[0].updated_at).ToUniversalTime()).TotalSeconds
    if ($alt -gt 300) {
      return ("Betfair-Kurse sind " + [math]::Round($alt/60) + " min alt.`nAb 5 min werden sie gesperrt.")
    }
  } catch {
    # Ein einzelner Aussetzer ist kein Ausfall. Erst beim dritten Mal melden.
    $script:netzFehler++
    if ($script:netzFehler -ge 3) { return "Datenbank seit mehreren Minuten`nnicht erreichbar." }
  }
  return $null
}

# PROBEALARM: mit  ORION-LICHT.cmd /test  laesst sich das rote Fenster
# absichtlich zeigen. Anlass 27.08.: ich kann von aussen nicht pruefen, ob
# das Fenster auf Karams Bildschirm wirklich erscheint - meine Befehle
# laufen in einer anderen Windows-Sitzung und sehen nur deren Fenster.
# Dieser Schalter macht die Probe zu einem Doppelklick.
$script:probe = ($args -contains '/test')

function Nachsehen {
  if ($script:probe) {
    $grund.Text = "PROBEALARM. So sieht es aus,`nwenn wirklich etwas klemmt.`nRechtsklick blendet aus."
    if (-not $f.Visible) { $f.Show() }
    $f.TopMost = $true
    return
  }
  $problem = Was-Ist-Kaputt
  if ($problem) {
    $grund.Text = $problem
    if (-not $f.Visible) { $f.Show() }
    $f.TopMost = $true
    # Blase nur beim ERSTEN Mal und dann hoechstens alle 10 Minuten wieder.
    # Eine Sprechblase, die alle 20 Sekunden aufpoppt, waere eine Plage.
    $jetzt = Get-Date
    if (-not $script:letzteBlase -or ($jetzt - $script:letzteBlase).TotalMinutes -ge 10) {
      $script:letzteBlase = $jetzt
      $symbol.BalloonTipIcon  = [System.Windows.Forms.ToolTipIcon]::Error
      $symbol.BalloonTipTitle = 'ORION STEHT'
      $symbol.BalloonTipText  = ($problem -replace "`n", ' ')
      $symbol.ShowBalloonTip(20000)
    }
  } elseif ($f.Visible -or $script:letzteBlase) {
    $f.Hide()
    if ($script:letzteBlase) {
      $script:letzteBlase = $null
      $symbol.BalloonTipIcon  = [System.Windows.Forms.ToolTipIcon]::Info
      $symbol.BalloonTipTitle = 'Orion laeuft wieder'
      $symbol.BalloonTipText  = 'Alles in Ordnung.'
      $symbol.ShowBalloonTip(8000)
    }
  }
}

$takt = New-Object System.Windows.Forms.Timer
$takt.Interval = 20000
$takt.Add_Tick({ Nachsehen })
$takt.Start()

# Beim Start einmal pruefen, aber dem System 20 s Zeit geben - direkt nach
# dem Anmelden oder nach dem Aufwachen laeuft noch nicht alles.
$erst = New-Object System.Windows.Forms.Timer
$erst.Interval = if ($script:probe) { 500 } else { 20000 }
$erst.Add_Tick({ $erst.Stop(); Nachsehen })
$erst.Start()

# Unsichtbar laufen: kein ShowDialog, sonst waere das Fenster immer da.
$ctx = New-Object System.Windows.Forms.ApplicationContext
$f.Add_FormClosed({ $ctx.ExitThread() })
[System.Windows.Forms.Application]::Run($ctx)

# Beim Beenden die Sperrdatei wieder freigeben.
if ($symbol) { $symbol.Visible = $false; $symbol.Dispose() }
try { Remove-Item -LiteralPath $sperre -Force -ErrorAction SilentlyContinue } catch { }
