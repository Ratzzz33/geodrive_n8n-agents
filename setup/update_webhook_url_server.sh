#!/bin/bash

set -e

echo "=== Обновление WEBHOOK_URL в n8n контейнере ==="
echo ""

# Проверяем текущее значение
echo "1. Проверяем текущее значение WEBHOOK_URL..."
CURRENT_URL=$(docker exec n8n printenv WEBHOOK_URL 2>/dev/null || echo "")
echo "   Текущее: $CURRENT_URL"

if [[ "$CURRENT_URL" == *"webhook.rentflow.rentals"* ]]; then
    echo "   ✅ Уже правильно!"
    exit 0
fi

echo ""
echo "2. Ищем docker-compose.yml..."
COMPOSE_FILE=$(find /root /opt /home -name docker-compose.yml -type f 2>/dev/null | head -1)

if [ -z "$COMPOSE_FILE" ]; then
    echo "   ❌ docker-compose.yml не найден автоматически!"
    echo "   Попробуйте найти его вручную и обновить"
    exit 1
else
    echo "   Найден: $COMPOSE_FILE"
fi

echo ""
echo "3. Обновляем docker-compose.yml..."

# Создаем резервную копию
cp "$COMPOSE_FILE" "${COMPOSE_FILE}.backup.$(date +%Y%m%d_%H%M%S)""

# Заменяем старое значение на новое
sed -i 's|WEBHOOK_URL=https://geodrive\.netlify\.app/|WEBHOOK_URL=https://webhook.rentflow.rentals/|g' "$COMPOSE_FILE"
sed -i 's|WEBHOOK_URL=${WEBHOOK_URL:-https://geodrive\.netlify\.app/}|WEBHOOK_URL=${WEBHOOK_URL:-https://webhook.rentflow.rentals/}|g' "$COMPOSE_FILE"

# Также обновляем N8N_WEBHOOK_URL если есть
sed -i 's|N8N_WEBHOOK_URL=${N8N_WEBHOOK_URL:-https://geodrive\.netlify\.app/}|N8N_WEBHOOK_URL=${N8N_WEBHOOK_URL:-https://webhook.rentflow.rentals/}|g' "$COMPOSE_FILE"

echo "   ✅ Обновлено"

echo ""
echo "4. Перезапускаем контейнер n8n..."
cd "$(dirname "$COMPOSE_FILE")"
docker-compose stop n8n || docker stop n8n
docker-compose up -d n8n || docker start n8n

echo ""
echo "5. Ждем 30 секунд..."
sleep 30

echo ""
echo "6. Проверяем новое значение..."
NEW_URL=$(docker exec n8n printenv WEBHOOK_URL 2>/dev/null || echo "")
echo "   Новое: $NEW_URL"

if [[ "$NEW_URL" == *"webhook.rentflow.rentals"* ]]; then
    echo ""
    echo "✅ УСПЕХ! WEBHOOK_URL обновлен!"
    echo ""
    echo "Теперь проверьте UI n8n:"
    echo "https://n8n.rentflow.rentals/workflow/gNXRKIQpNubEazH7"
    exit 0
else
    echo ""
    echo "⚠️ Переменная не обновилась. Проверьте вручную:"
    echo "   docker exec n8n printenv | grep WEBHOOK"
    exit 1
fi

