@echo off
echo ========================================
echo   Final Commit and Deploy
echo ========================================
echo.

echo 1. Adding files...
git add claude.md
git add src/services/rentprogScraper.ts
git add src/services/httpScraperService.ts
git add package.json
git add auto_deploy.py
git add commit_and_push.bat
git add DEPLOY_INSTRUCTIONS.md

echo.
echo 2. Committing...
git commit -m "Add HTTP scraper with cookie caching + terminal setup docs"

echo.
echo 3. Pushing to GitHub...
git push origin master

echo.
echo 4. Running deploy on server...
python auto_deploy.py

echo.
echo 5. Checking deploy log...
timeout /t 10 /nobreak
type deploy.log

echo.
echo ========================================
echo   Done! Check deploy.log for details
echo ========================================
pause


