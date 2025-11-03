#!/bin/bash
# Применение оптимизаций памяти для n8n на сервере
# Использование: ./apply_n8n_memory_optimization.sh

set -e

echo "🚀 Применение оптимизаций памяти для n8n..."

# Определяем путь к docker-compose.yml
COMPOSE_FILE="/root/geodrive_n8n-agents/docker-compose.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ Файл $COMPOSE_FILE не найден"
    exit 1
fi

echo "📝 Обновление docker-compose.yml..."
cd /root/geodrive_n8n-agents
git pull || echo "⚠️  git pull не выполнен (возможно локальные изменения)"

echo "🔄 Перезапуск n8n с новыми настройками памяти..."
docker compose down n8n
docker compose up -d n8n

echo "⏳ Ожидание запуска n8n..."
sleep 10

# Проверка статуса
if docker ps | grep -q n8n; then
    echo "✅ n8n запущен"
    echo "📊 Статус памяти:"
    docker stats n8n --no-stream --format "Memory: {{.MemUsage}} | Limit: {{.MemLimit}}"
else
    echo "❌ n8n не запустился, проверьте логи:"
    echo "   docker logs n8n --tail 50"
    exit 1
fi

echo "✅ Оптимизация применена"

