#!/bin/bash
# Финальный деплой с настройкой Neon

SERVER_IP="46.224.17.15"
SERVER_USER="root"

echo "=========================================="
echo "Финальная настройка и запуск сервисов"
echo "=========================================="
echo ""

# Команды для выполнения на сервере
REMOTE_CMD="
cd /root/geodrive_n8n-agents

# Обновление .env файла
cat > .env << 'ENVEOF'
# n8n настройки
N8N_PASSWORD=geodrive_secure_pass_2024
N8N_HOST=0.0.0.0

# Neon PostgreSQL настройки
NEON_HOST=ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech
NEON_PORT=5432
NEON_DATABASE=neondb
NEON_USER=neondb_owner
NEON_PASSWORD=npg_cHIT9Kxfk1Am

# Neon API ключ
NEON_API_KEY=napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9

# n8n API ключ (будет заполнен позже)
N8N_API_KEY=
ENVEOF

echo '✓ .env файл создан'

# Проверка наличия docker-compose
if ! command -v docker compose &> /dev/null; then
    echo 'Docker Compose не найден. Установите Docker сначала.'
    exit 1
fi

# Запуск сервисов
echo 'Запуск сервисов...'
docker compose down 2>/dev/null || true
docker compose up -d

echo ''
echo 'Ожидание запуска (10 секунд)...'
sleep 10

# Проверка статуса
echo ''
echo 'Статус контейнеров:'
docker compose ps

echo ''
echo '=========================================='
echo 'Деплой завершен!'
echo '=========================================='
echo ''
echo 'Доступ к сервисам:'
echo '  n8n: http://46.224.17.15:5678'
echo '  MCP: http://46.224.17.15:1880'
echo ''
echo 'Для просмотра логов:'
echo '  docker compose logs -f'
echo '=========================================='
"

echo "Выполнение команд на сервере..."
echo ""
echo "Подключение: ssh $SERVER_USER@$SERVER_IP"
echo "Пароль: enebit7Lschwrkb93vnm"
echo ""
echo "Или выполните команды вручную на сервере:"
echo "$REMOTE_CMD"

