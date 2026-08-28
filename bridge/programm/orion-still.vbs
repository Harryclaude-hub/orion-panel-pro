' ===========================================================================
'  ORION - der Starter, OHNE aufblitzendes Fenster
' ===========================================================================
'  ANLASS 28.08.2026, Karams Meldung: "die ganze Zeit oeffnet sich bei mir
'  ein Terminal und schliesst sich direkt."
'
'  GEMESSEN: es war nicht der Notbetrieb. Alle Orion-Prozesse liefen
'  ununterbrochen seit 2 Stunden 51 Minuten, keiner wurde neu gestartet.
'  Es waren die zwei geplanten Aufgaben:
'      Orion Wache    alle  5 Minuten
'      Orion Bridge   alle 10 Minuten
'  also im Schnitt alle gut drei Minuten ein Start.
'
'  WARUM ES TROTZ "-WindowStyle Hidden" BLITZT: Windows legt zuerst das
'  Konsolenfenster an und uebergibt es an powershell.exe. Erst DANN wertet
'  PowerShell den Schalter aus und versteckt es wieder. Der Schalter kommt
'  also zu spaet - das Fenster war schon da. Das ist kein Fehler im
'  Starter, sondern die Reihenfolge in Windows selbst.
'
'  WAS DIESE DATEI TUT: sie startet denselben Starter mit derselben
'  Zeile, nur ueber wscript. Der dritte Wert 0 in .Run heisst "kein
'  Fenster" - und zwar von Anfang an, es entsteht gar keines erst.
'  False heisst "nicht warten", die Aufgabe ist sofort fertig.
'
'  DIE ALTE .VBS-FALLE (27.08.): eine frueher gebaute .vbs zeigte nach dem
'  Aufraeumen auf einen verschobenen Pfad und warf alle paar Minuten ein
'  Fehlerfenster. Deshalb hier: der Pfad wird aus dem EIGENEN Speicherort
'  abgeleitet und NICHT zusammengetippt. Diese Datei kann mitsamt Ordner
'  verschoben werden, ohne dass etwas bricht.
'
'  ZURUECKBAUEN: in beiden Aufgaben wieder powershell.exe eintragen, so
'  wie es in UEBERGABE.md Abschnitt 9gg steht. Dann blitzt es wieder,
'  sonst aendert sich nichts.
' ===========================================================================

Option Explicit

Dim fso, schale, hier, ziel, befehl
Set fso    = CreateObject("Scripting.FileSystemObject")
Set schale = CreateObject("WScript.Shell")

' Der eigene Ordner. Kein zusammengebauter Pfad, kein festes Laufwerk.
hier = fso.GetParentFolderName(WScript.ScriptFullName)
ziel = fso.BuildPath(hier, "orion-start.ps1")

' Gibt es den Starter ueberhaupt? Wenn nicht, still beenden statt ein
' Fehlerfenster zu werfen - genau daran ist die alte .vbs gescheitert.
' Der Rueckgabewert 2 taucht im Aufgabenplaner als "letztes Ergebnis" auf,
' die Stelle zum Nachsehen, falls einmal nichts mehr startet.
If Not fso.FileExists(ziel) Then
  WScript.Quit 2
End If

befehl = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & ziel & """ /auto"

' 0 = kein Fenster, False = nicht auf das Ende warten.
schale.Run befehl, 0, False

WScript.Quit 0
