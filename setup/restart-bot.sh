#!/bin/bash
# Скрипт для перезапуска бота на сервере Hetzner
# Автоматически сбросит webhook и запустит бота в polling режиме

SERVER_IP="46.224.17.15"
SERVER_USER="root"

echo "=========================================="
echo "Перезапуск бота на сервере $SERVER_IP"
echo "=========================================="
echo ""

echo "🔌 Подключаемся к серверу и перезапускаем бота..."

ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'EOF'
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
cd /root/geodrive_n8n-agents
nohup npm run dev > /root/bot.log 2>&1 &

echo ""
echo "⏳ Ждем 3 секунды..."
sleep 3

echo ""
echo "📋 Проверяем логи бота..."
tail -n 20 /root/bot.log

echo ""
echo "✅ Бот перезапущен!"
echo "💡 Для просмотра логов: tail -f /root/bot.log"
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Команды выполнены успешно!"
else
    echo ""
    echo "❌ Ошибка выполнения команд"
    exit 1
fi

