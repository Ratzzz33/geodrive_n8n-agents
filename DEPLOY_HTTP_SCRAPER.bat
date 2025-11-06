@echo off
echo ========================================
echo HTTP Scraper Deployment Script
echo ========================================
echo.

REM Step 1: Commit and push local changes
echo [1/3] Committing changes...
git add .
git commit -m "feat: HTTP scraper with cookie caching - faster and more reliable"
git push origin master
echo.

REM Step 2: Deploy to server via SSH
echo [2/3] Deploying to server...
python deploy_http_scraper_stable.py
echo.

REM Step 3: Done
echo [3/3] Deployment complete!
echo.
pause


