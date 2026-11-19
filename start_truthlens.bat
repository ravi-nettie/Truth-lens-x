@echo off
title TruthLens X Launcher
cd /d "%~dp0"
echo Starting TruthLens X Backend and Frontend...

if exist "C:\Users\Admin\.gemini\antigravity\scratch\node20\node-v20.18.0-win-x64" (
    set "PATH=C:\Users\Admin\.gemini\antigravity\scratch\node20\node-v20.18.0-win-x64;%PATH%"
)

if "%PYTHON%"=="" (
    if exist "C:\Users\Admin\AppData\Local\Programs\Python\Python315\python.exe" (
        set PYTHON="C:\Users\Admin\AppData\Local\Programs\Python\Python315\python.exe"
    ) else (
        set PYTHON=python
    )
)

echo [1/2] Launching Backend on http://127.0.0.1:8000 ...
start "TruthLens X Backend (Port 8000)" %PYTHON% -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

echo [2/2] Launching Frontend on http://localhost:3000 ...
start "TruthLens X Frontend (Port 3000)" cmd /c "cd frontend && npm run dev"

echo.
echo ====================================================
echo TruthLens X is running!
echo   Single-port UI + API: http://127.0.0.1:8000
echo   Vite Dev Server:      http://localhost:3000
echo ====================================================
