# PowerShell script to set TELEGRAM_ALERT_CHAT_ID on Hetzner server

$SERVER = "root@46.224.17.15"
$PASSWORD = "Geodrive2024SecurePass"
$CHAT_ID = "-5004140602"

Write-Host "`n[*] Setting TELEGRAM_ALERT_CHAT_ID on server..." -ForegroundColor Cyan
Write-Host "[*] Chat ID: $CHAT_ID`n" -ForegroundColor Cyan

$commands = @"
cd /root/geodrive_n8n-agents
echo '[*] Checking current docker-compose.yml...'
grep 'TELEGRAM_ALERT_CHAT_ID' docker-compose.yml || echo '[!] Variable not found'
echo ''
echo '[*] Adding/updating TELEGRAM_ALERT_CHAT_ID...'
if grep -q 'TELEGRAM_ALERT_CHAT_ID' docker-compose.yml; then
    sed -i 's/TELEGRAM_ALERT_CHAT_ID=.*/TELEGRAM_ALERT_CHAT_ID=$CHAT_ID/' docker-compose.yml
    echo '[+] Variable updated'
else
    # Add after the environment: line in n8n service
    sed -i '/services:/,/n8n:/{ /environment:/a\      - TELEGRAM_ALERT_CHAT_ID=$CHAT_ID' docker-compose.yml
    echo '[+] Variable added'
fi
echo ''
echo '[*] Restarting n8n container...'
docker compose restart n8n
echo ''
echo '[*] Waiting 10 seconds for n8n to start...'
sleep 10
echo ''
echo '[*] Verifying environment variable...'
docker exec n8n printenv | grep TELEGRAM
echo ''
echo '[+] Done!'
"@

# Using Python paramiko from setup/server_ssh.py
python -c @"
import sys
sys.path.append('setup')
from server_ssh import ServerSSH

ssh = ServerSSH()
ssh.connect()
output, error, status = ssh.execute('''$commands''')
print(output)
if error:
    print('Errors:', error)
ssh.close()
"@

Write-Host "`n[+] Script completed!" -ForegroundColor Green
Write-Host "[*] Check workflow: https://n8n.rentflow.rentals/workflow/8jkfmWF2dTtnlMHj`n" -ForegroundColor Cyan

