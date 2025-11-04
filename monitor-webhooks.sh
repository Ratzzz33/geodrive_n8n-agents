#!/bin/bash

# Скрипт для мониторинга webhook запросов в реальном времени
# Показывает все входящие запросы на webhook endpoints с детальной информацией

echo "==================================="
echo "Мониторинг webhook запросов"
echo "==================================="
echo ""
echo "Мониторим следующие лог-файлы:"
echo "  - /var/log/nginx/webhook-access.log (webhook.rentflow.rentals)"
echo "  - /var/log/nginx/n8n-webhook-detailed.log (n8n.rentflow.rentals/webhook/*)"
echo "  - /var/log/nginx/webhook-error.log (ошибки)"
echo "  - /var/log/nginx/webhook-ratelimit.log (rate limiting)"
echo ""
echo "Нажмите Ctrl+C для остановки"
echo "==================================="
echo ""

# Функция для цветного вывода
print_colored() {
    local color=$1
    local text=$2
    case $color in
        "green")  echo -e "\033[0;32m$text\033[0m" ;;
        "red")    echo -e "\033[0;31m$text\033[0m" ;;
        "yellow") echo -e "\033[0;33m$text\033[0m" ;;
        "blue")   echo -e "\033[0;34m$text\033[0m" ;;
        *)        echo "$text" ;;
    esac
}

# Проверяем существование лог-файлов
check_logs() {
    local missing=0
    
    if [ ! -f "/var/log/nginx/webhook-access.log" ]; then
        print_colored "yellow" "⚠️  Файл /var/log/nginx/webhook-access.log не найден (будет создан при первом запросе)"
        missing=1
    fi
    
    if [ ! -f "/var/log/nginx/n8n-webhook-detailed.log" ]; then
        print_colored "yellow" "⚠️  Файл /var/log/nginx/n8n-webhook-detailed.log не найден (будет создан при первом запросе)"
        missing=1
    fi
    
    if [ $missing -eq 1 ]; then
        echo ""
        print_colored "blue" "ℹ️  Перезагрузите nginx для применения новой конфигурации:"
        echo "    sudo nginx -t && sudo systemctl reload nginx"
        echo ""
    fi
}

check_logs

# Функция для форматирования вывода лога
format_log() {
    local source=$1
    while IFS= read -r line; do
        local timestamp=$(echo "$line" | grep -oP '\[\K[^\]]+')
        local method=$(echo "$line" | grep -oP '"(GET|POST|PUT|DELETE|PATCH)')
        local path=$(echo "$line" | grep -oP '(GET|POST|PUT|DELETE|PATCH) \K[^ ]+')
        local status=$(echo "$line" | grep -oP 'HTTP/[0-9.]+ \K[0-9]+')
        local ip=$(echo "$line" | grep -oP '^[0-9.]+')
        
        if [[ -n "$status" ]]; then
            if [[ "$status" =~ ^2[0-9]{2}$ ]]; then
                print_colored "green" "✓ [$source] $timestamp | $ip | $method $path | Status: $status"
            elif [[ "$status" =~ ^4[0-9]{2}$ ]]; then
                print_colored "yellow" "⚠ [$source] $timestamp | $ip | $method $path | Status: $status"
            else
                print_colored "red" "✗ [$source] $timestamp | $ip | $method $path | Status: $status"
            fi
        else
            echo "[$source] $line"
        fi
    done
}

# Мониторим все файлы одновременно
(
    # Если файлы существуют, мониторим их
    [ -f "/var/log/nginx/webhook-access.log" ] && tail -f /var/log/nginx/webhook-access.log 2>/dev/null | while read line; do
        echo "[webhook.rentflow] $line"
    done
) &

(
    [ -f "/var/log/nginx/n8n-webhook-detailed.log" ] && tail -f /var/log/nginx/n8n-webhook-detailed.log 2>/dev/null | while read line; do
        echo "[n8n.rentflow/webhook] $line"
    done
) &

(
    [ -f "/var/log/nginx/webhook-error.log" ] && tail -f /var/log/nginx/webhook-error.log 2>/dev/null | while read line; do
        print_colored "red" "[ERROR] $line"
    done
) &

(
    [ -f "/var/log/nginx/webhook-ratelimit.log" ] && tail -f /var/log/nginx/webhook-ratelimit.log 2>/dev/null | while read line; do
        print_colored "yellow" "[RATE-LIMIT] $line"
    done
) &

# Ждем прерывания
wait
