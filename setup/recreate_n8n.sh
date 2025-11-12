#!/bin/bash
# Скрипт для пересоздания контейнера n8n с новыми переменными окружения

cd /root/geodrive_n8n-agents

echo "🛑 Остановка контейнера n8n..."
docker stop n8n

echo "🗑️  Удаление контейнера n8n..."
docker rm n8n

echo "🚀 Создание нового контейнера n8n..."
docker compose up -d --no-deps n8n

echo "⏳ Ожидание запуска (10 секунд)..."
sleep 10

echo "✅ Проверка статуса..."
docker ps | grep n8n

echo "📋 Проверка переменных окружения..."
docker exec n8n printenv | grep -E 'N8N_RUNNERS_ENABLED|N8N_BLOCK_ENV_ACCESS|N8N_GIT_NODE_DISABLE|EXECUTIONS_PROCESS'

echo "📊 Последние логи..."
docker logs n8n --tail 20 | grep -E 'deprecation|RUNNERS|started|Version' || docker logs n8n --tail 10

echo ""
echo "✅ Готово! n8n пересоздан с новыми переменными."

