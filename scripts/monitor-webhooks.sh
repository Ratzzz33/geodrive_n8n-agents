#!/bin/bash
# Скрипт для мониторинга вебхуков в реальном времени
# Использование: ./scripts/monitor-webhooks.sh [service-center|all]

set -e

WEBHOOK_TYPE="${1:-all}"
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BOLD}=== Мониторинг вебхуков RentProg ===${NC}\n"

# Проверка существования лог-файлов
check_log_file() {
    local log_file=$1
    if [ ! -f "$log_file" ]; then
        echo -e "${YELLOW}⚠️  Лог-файл не существует: $log_file${NC}"
        echo -e "   Создаем файл..."
        sudo touch "$log_file"
        sudo chmod 644 "$log_file"
    fi
}

# Функция для отображения статистики
show_stats() {
    local log_file=$1
    local name=$2
    
    if [ ! -f "$log_file" ]; then
        echo -e "${RED}✗${NC} $name: файл не найден"
        return
    fi
    
    local total=$(wc -l < "$log_file" 2>/dev/null || echo "0")
    local last_5min=$(find "$log_file" -mmin -5 -ls 2>/dev/null | wc -l)
    local today=$(grep "$(date '+%d/%b/%Y')" "$log_file" 2>/dev/null | wc -l || echo "0")
    
    echo -e "${BOLD}$name:${NC}"
    echo -e "  Всего записей: ${GREEN}$total${NC}"
    echo -e "  За сегодня: ${BLUE}$today${NC}"
    if [ "$last_5min" -gt 0 ]; then
        echo -e "  Активность: ${GREEN}✓ есть записи за последние 5 мин${NC}"
    else
        echo -e "  Активность: ${YELLOW}⚠ нет записей за последние 5 мин${NC}"
    fi
    echo ""
}

# Основная функция мониторинга
monitor_webhooks() {
    case "$WEBHOOK_TYPE" in
        "service-center")
            echo -e "${BOLD}Мониторинг: service-center вебхуки${NC}\n"
            check_log_file "/var/log/nginx/webhook-service-center.log"
            
            echo -e "${BLUE}Следим за логом в реальном времени...${NC}"
            echo -e "${YELLOW}Нажмите Ctrl+C для выхода${NC}\n"
            
            sudo tail -f /var/log/nginx/webhook-service-center.log | while read line; do
                echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $line"
            done
            ;;
            
        "all")
            echo -e "${BOLD}Статистика всех вебхуков:${NC}\n"
            
            check_log_file "/var/log/nginx/webhook-access.log"
            check_log_file "/var/log/nginx/webhook-service-center.log"
            check_log_file "/var/log/nginx/webhook-error.log"
            
            show_stats "/var/log/nginx/webhook-access.log" "Все вебхуки"
            show_stats "/var/log/nginx/webhook-service-center.log" "Service-Center вебхуки"
            show_stats "/var/log/nginx/webhook-error.log" "Ошибки"
            
            echo -e "${BLUE}Следим за всеми вебхуками в реальном времени...${NC}"
            echo -e "${YELLOW}Нажмите Ctrl+C для выхода${NC}\n"
            
            sudo tail -f \
                /var/log/nginx/webhook-access.log \
                /var/log/nginx/webhook-service-center.log \
                /var/log/nginx/webhook-error.log 2>/dev/null | \
            while read line; do
                if [[ "$line" == *"service-center"* ]]; then
                    echo -e "${GREEN}[SERVICE-CENTER]${NC} $line"
                elif [[ "$line" == *"error"* ]] || [[ "$line" == *"ERROR"* ]]; then
                    echo -e "${RED}[ERROR]${NC} $line"
                else
                    echo -e "${BLUE}[WEBHOOK]${NC} $line"
                fi
            done
            ;;
            
        *)
            echo -e "${RED}Неизвестный тип вебхука: $WEBHOOK_TYPE${NC}"
            echo -e "Использование: $0 [service-center|all]"
            exit 1
            ;;
    esac
}

# Функция для отображения последних записей
show_recent() {
    echo -e "${BOLD}=== Последние 10 записей ===${NC}\n"
    
    echo -e "${BOLD}Service-Center вебхуки:${NC}"
    sudo tail -n 10 /var/log/nginx/webhook-service-center.log 2>/dev/null || echo "Нет записей"
    echo ""
    
    echo -e "${BOLD}Ошибки:${NC}"
    sudo tail -n 10 /var/log/nginx/webhook-error.log 2>/dev/null || echo "Нет ошибок"
    echo ""
}

# Проверка аргументов
if [ "$1" == "--recent" ] || [ "$1" == "-r" ]; then
    show_recent
    exit 0
fi

if [ "$1" == "--stats" ] || [ "$1" == "-s" ]; then
    show_stats "/var/log/nginx/webhook-access.log" "Все вебхуки"
    show_stats "/var/log/nginx/webhook-service-center.log" "Service-Center вебхуки"
    show_stats "/var/log/nginx/webhook-error.log" "Ошибки"
    exit 0
fi

# Запуск мониторинга
monitor_webhooks
