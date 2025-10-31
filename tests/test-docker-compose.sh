#!/bin/bash
# Тесты для docker-compose.yml

# Не используем set -e в начале, ошибки обрабатываются явно

# Подготовка окружения для docker compose (создаем временный .env при необходимости)
TEMP_ENV_FILE=""
COMPOSE_ARGS=()

if [ -f ".env" ]; then
    echo "Используется существующий .env"
else
    TEMP_ENV_FILE=".env.ci"
    echo "Создание временного .env ($TEMP_ENV_FILE) для проверки..."
    cat > "$TEMP_ENV_FILE" << 'EOF'
N8N_PASSWORD=test_password
N8N_HOST=0.0.0.0
NEON_HOST=test.neon.tech
NEON_PORT=5432
NEON_DATABASE=testdb
NEON_USER=testuser
NEON_PASSWORD=testpass
NEON_API_KEY=test_api_key
N8N_API_KEY=test_n8n_key
EOF
    COMPOSE_ARGS+=(--env-file "$TEMP_ENV_FILE")
fi

cleanup() {
    if [ -n "$TEMP_ENV_FILE" ] && [ -f "$TEMP_ENV_FILE" ]; then
        rm -f "$TEMP_ENV_FILE"
    fi
}

trap cleanup EXIT

docker_compose() {
    docker compose "${COMPOSE_ARGS[@]}" "$@"
}

echo "=========================================="
echo "Тест 1: Валидация docker-compose.yml"
echo "=========================================="

# Проверка наличия файла
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ FAIL: docker-compose.yml не найден"
    exit 1
fi

# Создаем временный .env для проверки синтаксиса
if [ ! -f ".env" ]; then
    echo "Создание временного .env для проверки..."
    cat > .env << 'EOF'
N8N_PASSWORD=test_password
N8N_HOST=0.0.0.0
NEON_HOST=test.neon.tech
NEON_PORT=5432
NEON_DATABASE=testdb
NEON_USER=testuser
NEON_PASSWORD=testpass
NEON_API_KEY=test_api_key
N8N_API_KEY=test_n8n_key
EOF
    TEMP_ENV=true
else
    TEMP_ENV=false
fi

# Проверка синтаксиса docker-compose
if ! docker_compose config > /dev/null 2>&1; then
    echo "❌ FAIL: docker-compose.yml содержит ошибки синтаксиса"
    docker_compose config 2>&1 | head -20
    exit 1
fi

# Сохраняем вывод конфигурации для дальнейших проверок
CONFIG_OUTPUT=$(docker_compose config 2>/dev/null)

echo "✅ PASS: docker-compose.yml валиден"

echo ""
echo "=========================================="
echo "Тест 2: Проверка обязательных сервисов"
echo "=========================================="

SERVICES=$(echo "$CONFIG_OUTPUT" | grep -E "^\s+[a-z0-9-]+:" | grep -v "version:" | sed 's/:$//' | sed 's/^[[:space:]]*//' | sort -u || docker_compose config --services 2>/dev/null)
REQUIRED_SERVICES=("n8n")

for service in "${REQUIRED_SERVICES[@]}"; do
    if echo "$SERVICES" | grep -q "^${service}$"; then
        echo "✅ PASS: Сервис $service найден"
    else
        echo "❌ FAIL: Сервис $service отсутствует"
        exit 1
    fi
done

echo ""
echo "=========================================="
echo "Тест 3: Проверка переменных окружения"
echo "=========================================="

REQUIRED_ENV_VARS=(
    "N8N_PASSWORD"
    "NEON_HOST"
    "NEON_DATABASE"
    "NEON_USER"
    "NEON_PASSWORD"
)

for var in "${REQUIRED_ENV_VARS[@]}"; do
    if grep -q "\${${var}" docker-compose.yml 2>/dev/null || grep -q "\${${var}:-" docker-compose.yml 2>/dev/null; then
        echo "✅ PASS: Переменная $var используется"
    else
        echo "⚠️  WARN: Переменная $var не найдена в docker-compose.yml"
    fi
done

echo ""
echo "=========================================="
echo "Тест 4: Проверка портов"
echo "=========================================="

# Проверка портов n8n (5678)
if echo "$CONFIG_OUTPUT" | grep -A 3 "n8n:" | grep -q "target: 5678" && echo "$CONFIG_OUTPUT" | grep -A 3 "n8n:" | grep -q "published: \"5678\""; then
    echo "✅ PASS: Порт 5678 для n8n настроен"
elif echo "$CONFIG_OUTPUT" | grep -E "5678:5678|published.*5678" | grep -q "5678"; then
    echo "✅ PASS: Порт 5678 для n8n настроен (альтернативный формат)"
else
    echo "❌ FAIL: Порт 5678 для n8n не настроен"
    echo "Debug output:"
    echo "$CONFIG_OUTPUT" | grep -A 5 "n8n:" | head -10
    exit 1
fi

# mcp-server удален из docker-compose (используется локальный n8n-workflow-builder-mcp)

echo ""
echo "=========================================="
echo "✅ Все тесты docker-compose пройдены!"
echo "=========================================="

