#!/bin/bash
# Скрипт для добавления n8n переменных окружения в .env файл

ENV_FILE=".env"
ENV_EXAMPLE="env.example"

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Добавление n8n переменных окружения в .env файл...${NC}"

# Проверяем существование .env файла
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Файл .env не найден. Создаю на основе env.example...${NC}"
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        echo -e "${GREEN}Файл .env создан из env.example${NC}"
    else
        echo -e "${RED}Ошибка: файл env.example не найден!${NC}"
        exit 1
    fi
fi

# Проверяем, есть ли уже эти переменные в .env
if grep -q "^RENTPROG_HEALTH_URL=" "$ENV_FILE"; then
    echo -e "${YELLOW}RENTPROG_HEALTH_URL уже существует. Обновляю значение...${NC}"
    # Обновляем существующее значение (работает с sed в Linux/Mac)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' 's|^RENTPROG_HEALTH_URL=.*|RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health|' "$ENV_FILE"
    else
        # Linux
        sed -i 's|^RENTPROG_HEALTH_URL=.*|RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health|' "$ENV_FILE"
    fi
else
    echo "RENTPROG_HEALTH_URL=http://46.224.17.15:3000/rentprog/health" >> "$ENV_FILE"
    echo -e "${GREEN}Добавлено: RENTPROG_HEALTH_URL${NC}"
fi

if grep -q "^TELEGRAM_ALERT_CHAT_ID=" "$ENV_FILE"; then
    echo -e "${YELLOW}TELEGRAM_ALERT_CHAT_ID уже существует. Обновляю значение...${NC}"
    # Обновляем существующее значение
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' 's|^TELEGRAM_ALERT_CHAT_ID=.*|TELEGRAM_ALERT_CHAT_ID=-5004140602|' "$ENV_FILE"
    else
        # Linux
        sed -i 's|^TELEGRAM_ALERT_CHAT_ID=.*|TELEGRAM_ALERT_CHAT_ID=-5004140602|' "$ENV_FILE"
    fi
else
    echo "TELEGRAM_ALERT_CHAT_ID=-5004140602" >> "$ENV_FILE"
    echo -e "${GREEN}Добавлено: TELEGRAM_ALERT_CHAT_ID${NC}"
fi

echo -e "${GREEN}✅ Готово! Переменные добавлены/обновлены в .env${NC}"
echo ""
echo -e "${YELLOW}Следующие шаги:${NC}"
echo "1. Проверьте файл .env, убедитесь что переменные установлены правильно"
echo "2. Перезапустите n8n контейнер: docker compose restart n8n"
echo "3. В n8n UI добавьте эти же переменные в Settings → Environment Variables"

