@echo off
title Deploying TypeScript Fixes
cd /d C:\Users\33pok\geodrive_n8n-agents
echo.
echo ================================================
echo   Deploying TypeScript Fixes to Hetzner
echo ================================================
echo.
python deploy_fixes_now.py
echo.
echo ================================================
pause
