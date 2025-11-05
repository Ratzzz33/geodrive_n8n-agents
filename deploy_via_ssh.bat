@echo off
title Deploying Playwright Service
echo.
echo ================================================
echo  Deploying Playwright Service to Hetzner
echo ================================================
echo.
echo Connecting to server via SSH...
echo.

ssh root@46.224.17.15 "cd /root/geodrive_n8n-agents && git pull && npm install && npm run build && npx playwright install chromium && pm2 restart playwright-service && sleep 3 && curl -s http://localhost:3001/health"

echo.
echo ================================================
echo  Deployment complete!
echo ================================================
pause

