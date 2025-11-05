@echo off
title Updating Playwright Service
cd /d "%~dp0"
echo.
echo ================================================
echo  Updating Playwright Service on Hetzner Server
echo ================================================
echo.
python setup\quick_update.py
echo.
echo ================================================
echo  Press any key to close...
echo ================================================
pause >nul

