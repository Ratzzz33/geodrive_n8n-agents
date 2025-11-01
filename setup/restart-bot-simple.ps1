# Simple script to restart bot on Hetzner server
$SERVER_IP = "46.224.17.15"
$SERVER_USER = "root"

Write-Host "Restarting bot on server $SERVER_IP" -ForegroundColor Green
Write-Host ""

$commands = @"
cd /root/geodrive_n8n-agents
git pull origin master || git pull origin main || true
pkill -f 'tsx.*index.ts' || pkill -f 'node.*dist/index.js' || true
sleep 2
nohup npm run dev > /root/bot.log 2>&1 &
sleep 3
tail -n 20 /root/bot.log
"@

Write-Host "Connecting to server..." -ForegroundColor Cyan
$commands | ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP}

Write-Host ""
Write-Host "Done! Check logs with: ssh ${SERVER_USER}@${SERVER_IP} 'tail -f /root/bot.log'" -ForegroundColor Green

