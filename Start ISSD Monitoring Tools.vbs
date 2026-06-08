Dim shell, root
Set shell = CreateObject("WScript.Shell")

' Resolve the folder this .vbs lives in
root = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))

' Start backend silently (window style 0 = hidden, bWaitOnReturn = False)
shell.Run "cmd /c cd /d """ & root & """ && npm run start:backend", 0, False

' Start frontend (Vite) silently
shell.Run "cmd /c cd /d """ & root & """ && npm run dev:frontend", 0, False

' Wait 6 seconds for both servers to be ready
WScript.Sleep 6000

' Open the app in the default browser
shell.Run "http://localhost:5173", 1, False

Set shell = Nothing
