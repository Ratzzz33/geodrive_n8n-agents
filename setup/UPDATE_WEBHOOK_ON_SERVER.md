# 🚀 Быстрое обновление WEBHOOK_URL на сервере

## Выполните эти команды на сервере 46.224.17.15:

```bash
# 1. Проверить текущее значение
docker exec n8n printenv WEBHOOK_URL

# 2. Найти docker-compose.yml
find /root /opt /home -name docker-compose.yml -type f 2>/dev/null | head -1

# 3. Обновить (замените /path/to/docker-compose.yml на реальный путь)
COMPOSE_FILE=/path/to/docker-compose.yml
sed -i 's|WEBHOOK_URL=.*geodrive\.netlify\.app|WEBHOOK_URL=https://webhook.rentflow.rentals/|g' $COMPOSE_FILE
sed -i 's|WEBHOOK_URL=\${WEBHOOK_URL:-.*geodrive|WEBHOOK_URL=\${WEBHOOK_URL:-https://webhook.rentflow.rentals/|g' $COMPOSE_FILE

# 4. Перезапустить контейнер
cd $(dirname $COMPOSE_FILE)
docker-compose stop n8n
docker-compose up -d n8n

# 5. Подождать и проверить
sleep 30
docker exec n8n printenv WEBHOOK_URL
```

## Или одной командой:

```bash
COMPOSE_FILE=$(find /root /opt /home -name docker-compose.yml -type f 2>/dev/null | head -1) && \
sed -i 's|WEBHOOK_URL=.*geodrive\.netlify\.app|WEBHOOK_URL=https://webhook.rentflow.rentals/|g' $COMPOSE_FILE && \
sed -i 's|WEBHOOK_URL=\${WEBHOOK_URL:-.*geodrive|WEBHOOK_URL=\${WEBHOOK_URL:-https://webhook.rentflow.rentals/|g' $COMPOSE_FILE && \
cd $(dirname $COMPOSE_FILE) && \
docker-compose stop n8n && \
docker-compose up -d n8n && \
sleep 30 && \
docker exec n8n printenv WEBHOOK_URL
```

## Проверка результата:

После выполнения команд:
- Откройте: `https://n8n.rentflow.rentals/workflow/gNXRKIQpNubEazH7`
- Нажмите на Webhook ноду
- Production URL должен показать: `https://webhook.rentflow.rentals/rentprog-webhook` ✅

