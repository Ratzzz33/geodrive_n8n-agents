#!/bin/bash
# Тесты для docker-compose.yml

# Не используем set -e в начале, ошибки обрабатываются явно

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
if ! docker compose config > /dev/null 2>&1; then
    echo "❌ FAIL: docker-compose.yml содержит ошибки синтаксиса"
    docker compose config 2>&1 | head -20
    [ "$TEMP_ENV" = "true" ] && rm -f .env
    exit 1
fi

# Удаляем временный .env если создавали
[ "$TEMP_ENV" = "true" ] && rm -f .env

echo "✅ PASS: docker-compose.yml валиден"

echo ""
echo "=========================================="
echo "Тест 2: Проверка обязательных сервисов"
echo "=========================================="

# Создаем временный .env если нужно
if [ ! -f ".env" ]; then
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

SERVICES=$(docker compose config --services 2>/dev/null)
REQUIRED_SERVICES=("n8n" "mcp-server")

for service in "${REQUIRED_SERVICES[@]}"; do
    if echo "$SERVICES" | grep -q "^${service}$"; then
        echo "✅ PASS: Сервис $service найден"
    else
        echo "❌ FAIL: Сервис $service отсутствует"
        [ "$TEMP_ENV" = "true" ] && rm -f .env
        exit 1
    fi
done

[ "$TEMP_ENV" = "true" ] && rm -f .env

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

# Создаем временный .env если нужно
if [ ! -f ".env" ]; then
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

# Проверка что порты определены
if docker compose config 2>/dev/null | grep -q "5678:5678"; then
    echo "✅ PASS: Порт 5678 для n8n настроен"
else
    echo "❌ FAIL: Порт 5678 для n8n не настроен"
    [ "$TEMP_ENV" = "true" ] && rm -f .env
    exit 1
fi

if docker compose config 2>/dev/null | grep -q "1880:1880"; then
    echo "✅ PASS: Порт 1880 для mcp-server настроен"
else
    echo "❌ FAIL: Порт 1880 для mcp-server не настроен"
    [ "$TEMP_ENV" = "true" ] && rm -f .env
    exit 1
fi

[ "$TEMP_ENV" = "true" ] && rm -f .env

echo ""
echo "=========================================="
echo "✅ Все тесты docker-compose пройдены!"
echo "=========================================="

