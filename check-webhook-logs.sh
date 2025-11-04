#!/bin/bash
# Скрипт для проверки логов вебхуков service-center-webhook

echo "=== Проверка логов вебхуков service-center-webhook ==="
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Путь к логам
WEBHOOK_ACCESS_LOG="/var/log/nginx/n8n-webhook-access.log"
WEBHOOK_ERROR_LOG="/var/log/nginx/n8n-webhook-error.log"
WEBHOOK_DEBUG_LOG="/var/log/nginx/n8n-webhook-debug.log"

echo -e "${GREEN}1. Последние 20 запросов к service-center-webhook:${NC}"
if [ -f "$WEBHOOK_ACCESS_LOG" ]; then
    grep "service-center-webhook" "$WEBHOOK_ACCESS_LOG" | tail -20
else
    echo -e "${RED}Файл $WEBHOOK_ACCESS_LOG не найден${NC}"
fi

echo ""
echo -e "${GREEN}2. Последние 10 ошибок вебхуков:${NC}"
if [ -f "$WEBHOOK_ERROR_LOG" ]; then
    tail -10 "$WEBHOOK_ERROR_LOG"
else
    echo -e "${YELLOW}Файл $WEBHOOK_ERROR_LOG не найден (может быть пустым)${NC}"
fi

echo ""
echo -e "${GREEN}3. Статистика запросов за последний час:${NC}"
if [ -f "$WEBHOOK_ACCESS_LOG" ]; then
    ONE_HOUR_AGO=$(date -d '1 hour ago' '+%d/%b/%Y:%H')
    echo "Временной диапазон: $ONE_HOUR_AGO - $(date '+%d/%b/%Y:%H')"
    
    TOTAL=$(grep -c "service-center-webhook" "$WEBHOOK_ACCESS_LOG" 2>/dev/null || echo "0")
    SUCCESS=$(grep "service-center-webhook" "$WEBHOOK_ACCESS_LOG" 2>/dev/null | grep -c " 200 " || echo "0")
    ERRORS=$(grep "service-center-webhook" "$WEBHOOK_ACCESS_LOG" 2>/dev/null | grep -v " 200 " | grep -v " 201 " | wc -l)
    
    echo "Всего запросов: $TOTAL"
    echo "Успешных (200/201): $SUCCESS"
    echo "Ошибок: $ERRORS"
else
    echo -e "${RED}Файл $WEBHOOK_ACCESS_LOG не найден${NC}"
fi

echo ""
echo -e "${GREEN}4. Последние 5 запросов с деталями (все вебхуки):${NC}"
if [ -f "$WEBHOOK_ACCESS_LOG" ]; then
    tail -5 "$WEBHOOK_ACCESS_LOG" | while read line; do
        echo "$line"
        echo "---"
    done
else
    echo -e "${RED}Файл $WEBHOOK_ACCESS_LOG не найден${NC}"
fi

echo ""
echo -e "${GREEN}5. Проверка доступности n8n:${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5678/healthz > /dev/null 2>&1; then
    echo -e "${GREEN}n8n доступен на localhost:5678${NC}"
else
    echo -e "${RED}n8n НЕ доступен на localhost:5678${NC}"
fi

echo ""
echo -e "${GREEN}6. Проверка запущенных workflow в n8n (требует авторизации):${NC}"
echo "Для проверки workflow нужно зайти в n8n UI и проверить активные webhook триггеры"

echo ""
echo -e "${YELLOW}=== Для просмотра логов в реальном времени используйте:${NC}"
echo "tail -f $WEBHOOK_ACCESS_LOG | grep service-center-webhook"
echo "tail -f $WEBHOOK_ERROR_LOG"
