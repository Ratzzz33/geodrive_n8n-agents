#!/bin/bash
SERVER_IP="46.224.17.15"
SERVER_USER="root"
SERVER_PASSWORD="enebit7Lschwrkb93vnm"

echo "Перезапуск бота на сервере $SERVER_IP"
echo ""

# Используем sshpass если доступен, иначе используем plink или ручной ввод
if command -v sshpass &> /dev/null; then
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
cd /root/geodrive_n8n-agents
git pull origin master || git pull origin main || true
pkill -f "tsx.*index.ts" || pkill -f "node.*dist/index.js" || true
sleep 2
nohup npm run dev > /root/bot.log 2>&1 &
sleep 3
tail -n 20 /root/bot.log
ENDSSH
elif command -v plink &> /dev/null; then
    plink -ssh -pw "$SERVER_PASSWORD" ${SERVER_USER}@${SERVER_IP} "cd /root/geodrive_n8n-agents && git pull && pkill -f 'tsx.*index.ts' || pkill -f 'node.*dist/index.js' || true && sleep 2 && nohup npm run dev > /root/bot.log 2>&1 & && sleep 3 && tail -n 20 /root/bot.log"
else
    echo "sshpass или plink не найдены"
    echo "Выполните команды вручную:"
    echo "  ssh ${SERVER_USER}@${SERVER_IP}"
    echo "  (пароль: ${SERVER_PASSWORD})"
    exit 1
fi

