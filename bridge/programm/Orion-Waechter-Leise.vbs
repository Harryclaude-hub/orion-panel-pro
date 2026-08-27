' Orion-Waechter-Leise.vbs - startet den Waechter-Lauf OHNE Fenster.
' Wird von Orion-Bridge-STARTEN.cmd erzeugt - Aenderungen DORT machen.
Dim fso, ordner
Set fso = CreateObject("Scripting.FileSystemObject")
ordner = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("Wscript.Shell").Run """" & ordner & "\Orion-Bridge-STARTEN.cmd"" /waechter", 0, False
