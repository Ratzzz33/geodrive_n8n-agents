#!/bin/bash
# Тесты для docker-compose.yml

set -e

echo "=========================================="
echo "Тест 1: Валидация docker-compose.yml"
echo "=========================================="

# Проверка наличия файла
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ FAIL: docker-compose.yml не найден"
    exit 1
fi

# Проверка синтаксиса docker-compose
if ! docker compose config > /dev/null 2>&1; then
    echo "❌ FAIL: docker-compose.yml содержит ошибки синтаксиса"
    docker compose config 2>&1 | head -20
    exit 1
fi

echo "✅ PASS: docker-compose.yml валиден"

echo ""
echo "=========================================="
echo "Тест 2: Проверка обязательных сервисов"
echo "=========================================="

SERVICES=$(docker compose config --services)
REQUIRED_SERVICES=("n8n" "mcp-server")

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

# Проверка что порты определены
if docker compose config | grep -q "5678:5678"; then
    echo "✅ PASS: Порт 5678 для n8n настроен"
else
    echo "❌ FAIL: Порт 5678 для n8n не настроен"
    exit 1
fi

if docker compose config | grep -q "1880:1880"; then
    echo "✅ PASS: Порт 1880 для mcp-server настроен"
else
    echo "❌ FAIL: Порт 1880 для mcp-server не настроен"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Все тесты docker-compose пройдены!"
echo "=========================================="

