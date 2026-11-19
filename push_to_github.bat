@echo off
title TruthLens X - Push to GitHub
cd /d "%~dp0"
echo ====================================================
echo Pushing TruthLens X to GitHub (@ravi-nettie)
echo ====================================================
echo.
echo Remote configured:
git remote -v
echo.
echo Make sure you have created the repository 'truthlens-x' at:
echo   https://github.com/new
echo.
echo If your repository has a different name, run:
echo   git remote set-url origin https://github.com/ravi-nettie/<YOUR-REPO-NAME>.git
echo.
echo Pushing 'main' branch to origin...
git push -u origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Push failed or authentication was cancelled.
    echo If you use SSH keys instead of HTTPS, run:
    echo   git remote set-url origin git@github.com:ravi-nettie/truthlens-x.git
    echo   git push -u origin main
) else (
    echo.
    echo ====================================================
    echo [OK] Successfully pushed to https://github.com/ravi-nettie/truthlens-x!
    echo ====================================================
)
pause
