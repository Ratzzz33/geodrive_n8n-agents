@echo off
echo Committing HTTP scraper files...
git add src/services/rentprogScraper.ts
git add src/services/httpScraperService.ts
git add package.json
git commit -m "Add HTTP scraper with cookie caching"
git push origin master
echo.
echo Done! Now run auto_deploy.py again
pause


