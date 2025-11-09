#!/bin/bash
# Quick script to set TELEGRAM_ALERT_CHAT_ID on Hetzner server

CHAT_ID="-5004140602"
SERVER="root@46.224.17.15"

echo "[*] Setting TELEGRAM_ALERT_CHAT_ID on server..."
echo "[*] Chat ID: $CHAT_ID"
echo ""

sshpass -p "Geodrive2024SecurePass" ssh -o StrictHostKeyChecking=no $SERVER << 'ENDSSH'
cd /root/geodrive_n8n-agents

echo "[*] Checking current docker-compose.yml..."
grep "TELEGRAM_ALERT_CHAT_ID" docker-compose.yml || echo "[!] Variable not found in docker-compose.yml"

echo ""
echo "[*] Adding TELEGRAM_ALERT_CHAT_ID to docker-compose.yml..."

# Check if variable already exists
if grep -q "TELEGRAM_ALERT_CHAT_ID" docker-compose.yml; then
    echo "[!] Variable already exists, updating..."
    sed -i 's/TELEGRAM_ALERT_CHAT_ID=.*/TELEGRAM_ALERT_CHAT_ID=-5004140602/' docker-compose.yml
else
    echo "[+] Adding new variable..."
    # Find the environment section and add the variable
    sed -i '/n8n:/,/environment:/{/environment:/a\      - TELEGRAM_ALERT_CHAT_ID=-5004140602
}' docker-compose.yml
fi

echo ""
echo "[*] Restarting n8n container..."
docker compose restart n8n

echo ""
echo "[*] Waiting for n8n to start..."
sleep 10

echo ""
echo "[*] Verifying environment variable..."
docker exec n8n printenv | grep TELEGRAM || echo "[!] Variable not found in container"

echo ""
echo "[+] Done! Check workflow: https://n8n.rentflow.rentals/workflow/8jkfmWF2dTtnlMHj"
ENDSSH

echo ""
echo "[+] Script completed!"

