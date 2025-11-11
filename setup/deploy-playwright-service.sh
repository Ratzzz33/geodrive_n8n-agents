#!/bin/bash
# Скрипт для деплоя Playwright Service на удаленный сервер

set -e

SERVER="root@46.224.17.15"
PROJECT_DIR="/root/geodrive_n8n-agents"
SERVICE_NAME="playwright-amocrm"

echo "🚀 Деплой Playwright Service на сервер..."

# Копируем файлы на сервер
echo "📦 Копирование файлов..."
scp services/playwright-amocrm.ts $SERVER:$PROJECT_DIR/services/
scp package.json $SERVER:$PROJECT_DIR/
scp .env $SERVER:$PROJECT_DIR/ 2>/dev/null || echo "⚠️ .env не найден, пропускаю"

# Подключаемся к серверу и настраиваем
ssh $SERVER << 'ENDSSH'
cd /root/geodrive_n8n-agents

echo "📥 Установка зависимостей..."
npm install

echo "🔧 Создание systemd service..."

# Создаем systemd service файл
cat > /etc/systemd/system/playwright-amocrm.service << 'EOFSERVICE'
[Unit]
Description=AmoCRM Playwright Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/geodrive_n8n-agents
Environment="NODE_ENV=production"
EnvironmentFile=/root/geodrive_n8n-agents/.env
ExecStart=/usr/bin/npx tsx services/playwright-amocrm.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOFSERVICE

echo "🔄 Перезагрузка systemd..."
systemctl daemon-reload

echo "🛑 Остановка старого сервиса (если запущен)..."
systemctl stop playwright-amocrm || true

echo "▶️ Запуск Playwright Service..."
systemctl enable playwright-amocrm
systemctl start playwright-amocrm

echo "✅ Сервис запущен!"
echo ""
echo "📋 Полезные команды:"
echo "  Просмотр логов: journalctl -u playwright-amocrm -f"
echo "  Статус: systemctl status playwright-amocrm"
echo "  Остановка: systemctl stop playwright-amocrm"
echo "  Перезапуск: systemctl restart playwright-amocrm"
ENDSSH

echo ""
echo "✅ Деплой завершен!"
echo ""
echo "📋 Для просмотра логов выполните:"
echo "  ssh $SERVER 'journalctl -u playwright-amocrm -f'"

