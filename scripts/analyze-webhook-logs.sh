#!/bin/bash
# Скрипт для анализа логов вебхуков
# Использование: ./analyze-webhook-logs.sh [опции]

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Файлы логов
DEBUG_LOG="/var/log/nginx/webhook-debug.log"
ERROR_LOG="/var/log/nginx/webhook-debug-error.log"

echo -e "${BLUE}=== Анализ логов вебхуков ===${NC}\n"

# Проверка существования файлов логов
if [ ! -f "$DEBUG_LOG" ]; then
    echo -e "${RED}Ошибка: файл $DEBUG_LOG не найден${NC}"
    echo "Убедитесь, что nginx перезапущен с новой конфигурацией"
    exit 1
fi

# Функция для показа последних N запросов
show_recent() {
    local count=${1:-20}
    echo -e "${GREEN}Последние $count запросов к вебхукам:${NC}"
    tail -n "$count" "$DEBUG_LOG"
}

# Функция для подсчета статусов ответов
count_statuses() {
    echo -e "\n${GREEN}Статистика HTTP статусов:${NC}"
    awk '{print $9}' "$DEBUG_LOG" | sort | uniq -c | sort -rn
}

# Функция для показа ошибок
show_errors() {
    echo -e "\n${RED}Ошибки 4xx и 5xx:${NC}"
    grep -E " (4[0-9]{2}|5[0-9]{2}) " "$DEBUG_LOG" || echo "Ошибок не найдено"
}

# Функция для показа медленных запросов (>1 секунда)
show_slow_requests() {
    echo -e "\n${YELLOW}Медленные запросы (>1 сек):${NC}"
    awk '$NF ~ /rt=[1-9][0-9]*\./ || $NF ~ /rt=[1-9][0-9]+/' "$DEBUG_LOG" || echo "Медленных запросов не найдено"
}

# Функция для показа запросов к конкретному эндпоинту
show_endpoint() {
    local endpoint=$1
    echo -e "\n${GREEN}Запросы к эндпоинту '$endpoint':${NC}"
    grep "$endpoint" "$DEBUG_LOG" || echo "Запросов к этому эндпоинту не найдено"
}

# Функция для мониторинга в реальном времени
monitor() {
    echo -e "${GREEN}Мониторинг вебхуков в реальном времени (Ctrl+C для выхода):${NC}\n"
    tail -f "$DEBUG_LOG"
}

# Функция для показа статистики за последний час
hourly_stats() {
    echo -e "\n${GREEN}Статистика за последний час:${NC}"
    local one_hour_ago=$(date -d '1 hour ago' '+%d/%b/%Y:%H:%M:%S')
    awk -v time="$one_hour_ago" '$4 > "["time {print}' "$DEBUG_LOG" | wc -l | xargs echo "Всего запросов:"
    awk -v time="$one_hour_ago" '$4 > "["time && $9 == 200 {print}' "$DEBUG_LOG" | wc -l | xargs echo "Успешных (200):"
    awk -v time="$one_hour_ago" '$4 > "["time && $9 >= 400 {print}' "$DEBUG_LOG" | wc -l | xargs echo "Ошибок (4xx/5xx):"
}

# Функция для проверки service-center-webhook
check_service_center() {
    echo -e "\n${BLUE}=== Проверка service-center-webhook ===${NC}"
    echo -e "${GREEN}Запросы к service-center-webhook за последние 24 часа:${NC}"
    grep "service-center-webhook" "$DEBUG_LOG" | tail -n 50 || echo "Запросов к service-center-webhook не найдено"
    
    echo -e "\n${GREEN}Статусы ответов для service-center-webhook:${NC}"
    grep "service-center-webhook" "$DEBUG_LOG" | awk '{print $9}' | sort | uniq -c | sort -rn
    
    echo -e "\n${GREEN}Время ответа для service-center-webhook:${NC}"
    grep "service-center-webhook" "$DEBUG_LOG" | grep -oP 'rt=\K[0-9.]+' | awk '{sum+=$1; count++} END {if(count>0) print "Среднее время ответа:", sum/count, "сек"; else print "Нет данных"}'
}

# Обработка аргументов командной строки
case "${1:-}" in
    -r|--recent)
        show_recent "${2:-20}"
        ;;
    -s|--statuses)
        count_statuses
        ;;
    -e|--errors)
        show_errors
        ;;
    -w|--slow)
        show_slow_requests
        ;;
    -ep|--endpoint)
        show_endpoint "${2}"
        ;;
    -m|--monitor)
        monitor
        ;;
    -h|--hourly)
        hourly_stats
        ;;
    -sc|--service-center)
        check_service_center
        ;;
    --full)
        show_recent 20
        count_statuses
        show_errors
        show_slow_requests
        hourly_stats
        check_service_center
        ;;
    -help|--help)
        echo "Использование: $0 [опция]"
        echo ""
        echo "Опции:"
        echo "  -r, --recent [N]       Показать последние N запросов (по умолчанию 20)"
        echo "  -s, --statuses         Показать статистику HTTP статусов"
        echo "  -e, --errors           Показать все ошибки 4xx и 5xx"
        echo "  -w, --slow             Показать медленные запросы (>1 сек)"
        echo "  -ep, --endpoint PATH   Показать запросы к конкретному эндпоинту"
        echo "  -m, --monitor          Мониторинг в реальном времени"
        echo "  -h, --hourly           Статистика за последний час"
        echo "  -sc, --service-center  Проверка service-center-webhook"
        echo "  --full                 Полный отчет (все статистики)"
        echo "  --help                 Показать эту справку"
        ;;
    *)
        # По умолчанию показываем полный отчет
        show_recent 20
        count_statuses
        show_errors
        hourly_stats
        check_service_center
        echo -e "\n${BLUE}Используйте --help для списка всех опций${NC}"
        ;;
esac
