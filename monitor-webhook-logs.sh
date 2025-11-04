#!/bin/bash

# Скрипт для мониторинга логов вебхуков service-center-webhook
# Использование: ./monitor-webhook-logs.sh [service-center-webhook]

WEBHOOK_NAME="${1:-service-center-webhook}"

echo "=========================================="
echo "Мониторинг вебхука: $WEBHOOK_NAME"
echo "=========================================="
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Функция для проверки логов nginx
check_nginx_logs() {
    echo -e "${GREEN}=== Логи Nginx (последние 20 запросов) ===${NC}"
    
    if [ -f /var/log/nginx/n8n-webhook-detailed.log ]; then
        echo -e "${YELLOW}Детальный лог вебхуков:${NC}"
        grep "$WEBHOOK_NAME" /var/log/nginx/n8n-webhook-detailed.log | tail -20
        echo ""
    else
        echo -e "${RED}Файл /var/log/nginx/n8n-webhook-detailed.log не найден${NC}"
        echo ""
    fi
    
    if [ -f /var/log/nginx/n8n-webhook-error.log ]; then
        ERROR_COUNT=$(grep -c "$WEBHOOK_NAME" /var/log/nginx/n8n-webhook-error.log 2>/dev/null || echo "0")
        if [ "$ERROR_COUNT" -gt 0 ]; then
            echo -e "${RED}Ошибки в логах вебхуков ($ERROR_COUNT):${NC}"
            grep "$WEBHOOK_NAME" /var/log/nginx/n8n-webhook-error.log | tail -10
            echo ""
        else
            echo -e "${GREEN}Ошибок в логах вебхуков не найдено${NC}"
            echo ""
        fi
    fi
    
    if [ -f /var/log/nginx/n8n-access.log ]; then
        echo -e "${YELLOW}Общий лог доступа (последние 10 запросов к вебхукам):${NC}"
        grep "/webhook/" /var/log/nginx/n8n-access.log | tail -10
        echo ""
    fi
}

# Функция для проверки статуса nginx
check_nginx_status() {
    echo -e "${GREEN}=== Статус Nginx ===${NC}"
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}Nginx работает${NC}"
    else
        echo -e "${RED}Nginx не работает!${NC}"
    fi
    echo ""
    
    # Проверка конфигурации
    echo "Проверка конфигурации nginx:"
    if nginx -t 2>&1 | grep -q "successful"; then
        echo -e "${GREEN}Конфигурация валидна${NC}"
    else
        echo -e "${RED}Ошибки в конфигурации:${NC}"
        nginx -t
    fi
    echo ""
}

# Функция для проверки статуса n8n
check_n8n_status() {
    echo -e "${GREEN}=== Статус n8n ===${NC}"
    if docker ps | grep -q n8n; then
        echo -e "${GREEN}n8n контейнер работает${NC}"
        docker ps --filter "name=n8n" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    else
        echo -e "${RED}n8n контейнер не работает!${NC}"
    fi
    echo ""
    
    # Проверка логов n8n
    if docker ps | grep -q n8n; then
        echo -e "${YELLOW}Последние логи n8n (последние 20 строк):${NC}"
        docker logs n8n --tail 20 2>&1 | grep -i "webhook\|error\|$WEBHOOK_NAME" || echo "Нет записей о вебхуках"
        echo ""
    fi
}

# Функция для проверки доступности вебхука
check_webhook_availability() {
    echo -e "${GREEN}=== Проверка доступности вебхука ===${NC}"
    WEBHOOK_URL="https://n8n.rentflow.rentals/webhook/$WEBHOOK_NAME"
    echo "Проверка URL: $WEBHOOK_URL"
    
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d '{"test": "monitoring"}' 2>&1)
    
    if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "404" ]; then
        echo -e "${GREEN}Вебхук доступен (HTTP $RESPONSE)${NC}"
    else
        echo -e "${RED}Проблема с доступностью вебхука (HTTP $RESPONSE)${NC}"
    fi
    echo ""
}

# Функция для статистики запросов
show_statistics() {
    echo -e "${GREEN}=== Статистика запросов за последний час ===${NC}"
    
    if [ -f /var/log/nginx/n8n-webhook-detailed.log ]; then
        echo "Всего запросов к вебхукам:"
        grep -c "/webhook/" /var/log/nginx/n8n-webhook-detailed.log 2>/dev/null || echo "0"
        echo ""
        
        echo "Запросы к $WEBHOOK_NAME:"
        grep -c "$WEBHOOK_NAME" /var/log/nginx/n8n-webhook-detailed.log 2>/dev/null || echo "0"
        echo ""
        
        echo "Распределение по статусам:"
        grep "$WEBHOOK_NAME" /var/log/nginx/n8n-webhook-detailed.log 2>/dev/null | \
            awk '{print $9}' | sort | uniq -c | sort -rn
        echo ""
        
        echo "Последние 5 запросов с IP адресами:"
        grep "$WEBHOOK_NAME" /var/log/nginx/n8n-webhook-detailed.log 2>/dev/null | \
            tail -5 | awk '{print $1, $4, $9, $7}'
        echo ""
    else
        echo -e "${YELLOW}Детальный лог вебхуков еще не создан (нет запросов)${NC}"
        echo ""
    fi
}

# Основная функция
main() {
    check_nginx_status
    check_n8n_status
    check_webhook_availability
    check_nginx_logs
    show_statistics
    
    echo "=========================================="
    echo "Для просмотра логов в реальном времени:"
    echo "  tail -f /var/log/nginx/n8n-webhook-detailed.log | grep $WEBHOOK_NAME"
    echo "  tail -f /var/log/nginx/n8n-webhook-error.log"
    echo "  docker logs -f n8n | grep $WEBHOOK_NAME"
    echo "=========================================="
}

# Запуск
main
