#!/bin/bash
# Автоматический перезапуск бота с использованием пароля

SERVER_IP="46.224.17.15"
SERVER_USER="root"
SERVER_PASSWORD="enebit7Lschwrkb93vnm"

echo "=========================================="
echo "Перезапуск бота на сервере $SERVER_IP"
echo "=========================================="
echo ""

# Проверяем наличие sshpass
if ! command -v sshpass &> /dev/null; then
    echo "❌ sshpass не найден. Устанавливаю..."
    # Для Windows через Git Bash может потребоваться установка через package manager
    echo "💡 Для автоматического выполнения установите sshpass или используйте SSH ключ"
    echo ""
    echo "Выполняю без sshpass (потребуется ввод пароля)..."
    ssh ${SERVER_USER}@${SERVER_IP}
    exit 1
fi

sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
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
ENDSSH

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Команды выполнены успешно!"
else
    echo ""
    echo "❌ Ошибка выполнения команд"
    exit 1
fi

