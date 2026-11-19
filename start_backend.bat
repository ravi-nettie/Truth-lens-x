@echo off
title TruthLens X Backend
cd /d "%~dp0"
if "%PYTHON%"=="" (
    if exist "C:\Users\Admin\AppData\Local\Programs\Python\Python315\python.exe" (
        set PYTHON="C:\Users\Admin\AppData\Local\Programs\Python\Python315\python.exe"
    ) else (
        set PYTHON=python
    )
)
echo Starting TruthLens X Backend on http://127.0.0.1:8000 ...
%PYTHON% -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
pause
