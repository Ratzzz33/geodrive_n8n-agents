#!/bin/bash
# Быстрый деплой исправлений Starline API

echo "🔄 Обновляю код..."
cd /root/geodrive_n8n-agents
git pull

echo "🔨 Собираю TypeScript..."
npm run build

echo "🔄 Перезапускаю API..."
pm2 restart jarvis-api

echo "⏳ Жду 3 секунды..."
sleep 3

echo "📊 Статус API:"
pm2 status jarvis-api

echo "✅ Готово! API доступен на http://172.17.0.1:3000/starline/update-gps"

