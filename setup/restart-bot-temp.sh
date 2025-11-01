#!/bin/bash
SERVER_IP="46.224.17.15"
SERVER_USER="root"
SERVER_PASSWORD="enebit7Lschwrkb93vnm"

export SSH_ASKPASS_REQUIRE=never
export DISPLAY=dummy:0

ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << EOF
$(echo $SERVER_PASSWORD)
set -e
cd /root/geodrive_n8n-agents

echo "📥 Обновляем код из репозитория..."
git pull origin master || git pull origin main || true

echo ""
echo "🔄 Останавливаем бота (если запущен)..."
pkill -f "tsx.*index.ts" || pkill -f "node.*dist/index.js" || true
sleep 2

echo ""
echo "🚀 Запускаем бота (webhook будет автоматически удален)..."
nohup npm run dev > /root/bot.log 2>&1 &

echo ""
echo "⏳ Ждем 3 секунды..."
sleep 3

echo ""
echo "📋 Последние 20 строк логов бота:"
tail -n 20 /root/bot.log

echo ""
echo "✅ Бот перезапущен!"
echo "💡 Для просмотра логов: tail -f /root/bot.log"
EOF

