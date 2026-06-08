@echo off
title ISSD Monitoring Tools

:: ── Change to the project root (same folder as this .bat file) ────────────────
cd /d "%~dp0"

echo ============================================================
echo  ISSD Monitoring Tools
echo ============================================================
echo  Starting backend and frontend servers...
echo.

:: Start the backend in a separate window
start "ISSD Backend" cmd /k "cd /d "%~dp0" && npm run start:backend"

:: Start the frontend (Vite) in a separate window
start "ISSD Frontend" cmd /k "cd /d "%~dp0" && npm run dev:frontend"

:: Give both servers a few seconds to initialise before opening the browser
timeout /t 5 /nobreak >nul

echo  Opening browser...
start "" "http://localhost:5173"

echo.
echo  Backend : http://localhost:5000
echo  Frontend: http://localhost:5173
echo  Close both server windows to shut everything down.
echo ============================================================
