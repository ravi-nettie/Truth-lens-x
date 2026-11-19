@echo off
title TruthLens X Frontend
cd /d "%~dp0frontend"
if exist "C:\Users\Admin\.gemini\antigravity\scratch\node20\node-v20.18.0-win-x64" (
    set "PATH=C:\Users\Admin\.gemini\antigravity\scratch\node20\node-v20.18.0-win-x64;%PATH%"
)
echo Starting TruthLens X Frontend Dev Server on http://localhost:3000 ...
npm run dev
pause
