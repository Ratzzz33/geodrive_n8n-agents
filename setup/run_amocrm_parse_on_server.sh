#!/bin/bash
# Запуск парсинга AmoCRM на удаленном сервере

SERVER="root@46.224.17.15"
PROJECT_DIR="/root/geodrive_n8n-agents"

echo "Запуск парсинга AmoCRM на сервере..."

ssh $SERVER << 'ENDSSH'
cd /root/geodrive_n8n-agents

echo "Обновляю код..."
git pull || true

echo "Устанавливаю зависимости..."
npm install

echo "Запускаю парсинг..."
export AMOCRM_PLAYWRIGHT_URL=http://localhost:3002
npm run parse:amocrm:all
ENDSSH

