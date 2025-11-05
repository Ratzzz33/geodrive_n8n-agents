@echo off
cd /d C:\Users\33pok\geodrive_n8n-agents
echo === Git Status ===
git status
echo.
echo === Git Add ===
git add -A
echo.
echo === Git Commit ===
git commit -m "Fix: переписал /link_rentprog на external_refs, исправил TS ошибки"
echo.
echo === Git Push ===
git push
echo.
echo === SSH Deploy ===
ssh root@46.224.17.15 "cd /root/geodrive_n8n-agents && git pull && npm install && npm run build && pm2 restart jarvis-api playwright-service"
echo.
echo ================================================
echo  Deployment complete!
echo ================================================
pause

