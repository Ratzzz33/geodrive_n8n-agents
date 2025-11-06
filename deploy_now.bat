@echo off
cd /d "%~dp0"
echo ============================================
echo   Deploying HTTP Scraper Service
echo ============================================
echo.

python deploy_now.py

echo.
echo ============================================
pause
