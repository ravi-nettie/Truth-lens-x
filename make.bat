@echo off
setlocal

set TARGET=%1
if "%TARGET%"=="" set TARGET=help

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

if "%TARGET%"=="doctor" (
    %PYTHON% scripts\doctor.py %2 %3
    exit /b %ERRORLEVEL%
)

if "%TARGET%"=="setup" (
    %PYTHON% -m pip install -r requirements.txt
    %PYTHON% scripts\download_models.py
    cd frontend && npm run build && cd ..
    exit /b %ERRORLEVEL%
)

if "%TARGET%"=="dev" (
    %PYTHON% -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
    exit /b %ERRORLEVEL%
)

if "%TARGET%"=="test-smoke" (
    %PYTHON% -m pytest backend\tests\unit\
    exit /b %ERRORLEVEL%
)

if "%TARGET%"=="test" (
    %PYTHON% -m pytest backend\tests\unit\
    %PYTHON% scripts\run_17_tests.py
    exit /b %ERRORLEVEL%
)

if "%TARGET%"=="demo" (
    %PYTHON% scripts\seed_demo.py
    %PYTHON% -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
    exit /b %ERRORLEVEL%
)

if "%TARGET%"=="docker-build" (
    docker compose build
    exit /b %ERRORLEVEL%
)

if "%TARGET%"=="docker-up" (
    docker compose up -d
    exit /b %ERRORLEVEL%
)

if "%TARGET%"=="docker-down" (
    docker compose down
    exit /b %ERRORLEVEL%
)

if "%TARGET%"=="help" (
    echo TruthLens X Build and Development Commands (Windows)
    echo   make doctor        - Verify Python 3.11+, Node 20+, FFmpeg 6+ and local models
    echo   make setup         - Install dependencies, download models, build frontend
    echo   make dev           - Launch local development server (port 8000)
    echo   make test-smoke    - Run fast unit tests
    echo   make test          - Run full test suite (unit + 17-case matrix)
    echo   make demo          - Seed demo case and launch single-port offline server on 8000
    echo   make docker-build  - Build production Docker image
    echo   make docker-up     - Run containerized TruthLens X via docker compose
    echo   make docker-down   - Stop running Docker containers
    exit /b 0
)

echo Unknown target: %TARGET%
exit /b 1
