#!/bin/bash
# Скрипт для получения данных подключения к Neon через API

NEON_API_KEY="napi_zwcney8v8p1k753p6tjaoj6hh77ekf5ptvec7sj6thoqz3ncc05hq1qkf5err7b9"
NEON_API_BASE="https://console.neon.tech/api/v1"

echo "Получение данных подключения к Neon..."
echo ""

# Получаем список проектов
echo "1. Получение списка проектов..."
PROJECTS=$(curl -s -X GET "${NEON_API_BASE}/projects" \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  -H "Content-Type: application/json")

echo "Ответ API проектов: $PROJECTS"
echo ""

# Извлекаем project_id (упрощенная версия)
PROJECT_ID=$(echo "$PROJECTS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PROJECT_ID" ]; then
    echo "Проекты не найдены. Попробуем создать новый..."
    
    # Создаем проект
    PROJECT_RESPONSE=$(curl -s -X POST "${NEON_API_BASE}/projects" \
      -H "Authorization: Bearer ${NEON_API_KEY}" \
      -H "Content-Type: application/json" \
      -d '{
        "project": {
          "name": "geodrive-n8n",
          "region_id": "aws-us-east-2"
        }
      }')
    
    echo "Ответ создания проекта: $PROJECT_RESPONSE"
    PROJECT_ID=$(echo "$PROJECT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$PROJECT_ID" ]; then
    echo "Ошибка: Не удалось получить или создать проект"
    echo ""
    echo "Получите данные подключения вручную:"
    echo "1. Войдите в https://console.neon.tech/"
    echo "2. Создайте проект (если нет)"
    echo "3. Скопируйте строку подключения из Dashboard"
    exit 1
fi

echo "Project ID: $PROJECT_ID"
echo ""

# Получаем детали проекта
echo "2. Получение деталей проекта..."
PROJECT_DETAILS=$(curl -s -X GET "${NEON_API_BASE}/projects/${PROJECT_ID}" \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  -H "Content-Type: application/json")

echo "Детали проекта получены"
echo ""

# Пытаемся извлечь данные из connection_string или из деталей проекта
# Neon обычно предоставляет connection_string в формате:
# postgres://user:password@host/database?sslmode=require

CONNECTION_STRING=$(echo "$PROJECT_DETAILS" | grep -o '"connection_string":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -z "$CONNECTION_STRING" ]; then
    # Пытаемся извлечь данные по частям
    HOST=$(echo "$PROJECT_DETAILS" | grep -o '"host":"[^"]*"' | cut -d'"' -f4 || echo "")
    DATABASE=$(echo "$PROJECT_DETAILS" | grep -o '"database":"[^"]*"' | cut -d'"' -f4 || echo "neondb")
    USER=$(echo "$PROJECT_DETAILS" | grep -o '"user":"[^"]*"' | cut -d'"' -f4 || echo "")
    
    echo "=========================================="
    echo "Данные подключения (частичные):"
    echo "=========================================="
    echo "NEON_HOST=$HOST"
    echo "NEON_PORT=5432"
    echo "NEON_DATABASE=$DATABASE"
    echo "NEON_USER=$USER"
    echo "NEON_PASSWORD=<получите из Neon Console>"
    echo "=========================================="
else
    # Парсим connection_string
    echo "Получена строка подключения, парсинг..."
    # Формат: postgres://user:password@host:port/database
    # Это сложнее парсить в bash, лучше использовать другой инструмент
    echo "Connection string: $CONNECTION_STRING"
    echo ""
    echo "Вручную извлеките данные из строки подключения или используйте её напрямую"
fi

echo ""
echo "Для получения полных данных:"
echo "1. Откройте https://console.neon.tech/"
echo "2. Выберите проект ID: $PROJECT_ID"
echo "3. Скопируйте строку подключения или отдельные параметры"

