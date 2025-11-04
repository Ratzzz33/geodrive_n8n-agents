#!/bin/bash

# Скрипт для диагностики проблем с вебхуками RentProg
# Проверяет все возможные причины отсутствия вебхуков

set -e

echo "=========================================="
echo "🔍 Диагностика вебхуков RentProg"
echo "=========================================="
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для проверки
check() {
    local name=$1
    local command=$2
    echo -n "Проверка: $name... "
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        return 1
    fi
}

# Функция для проверки с выводом результата
check_with_output() {
    local name=$1
    local command=$2
    echo "Проверка: $name"
    echo "Команда: $command"
    echo "Результат:"
    eval "$command" || true
    echo ""
}

WEBHOOK_URL="https://webhook.rentflow.rentals"
WEBHOOK_DOMAIN="webhook.rentflow.rentals"
N8N_URL="http://localhost:5678"
N8N_WEBHOOK_PATH="/webhook/rentprog-webhook"

echo "📋 Конфигурация:"
echo "   Webhook URL: $WEBHOOK_URL"
echo "   N8N Webhook Path: $N8N_WEBHOOK_PATH"
echo ""

# 1. Проверка DNS
echo "🌐 1. Проверка DNS..."
check_with_output "DNS резолюция $WEBHOOK_DOMAIN" "dig +short $WEBHOOK_DOMAIN || nslookup $WEBHOOK_DOMAIN | grep -A 1 'Name:'"
echo ""

# 2. Проверка доступности домена
echo "🔗 2. Проверка доступности домена..."
check_with_output "HTTP доступность" "curl -I -s -o /dev/null -w 'HTTP Status: %{http_code}\nTotal Time: %{time_total}s\n' $WEBHOOK_URL || echo 'Не удалось подключиться'"
echo ""

# 3. Проверка SSL сертификата
echo "🔒 3. Проверка SSL сертификата..."
check_with_output "SSL сертификат" "echo | openssl s_client -connect $WEBHOOK_DOMAIN:443 -servername $WEBHOOK_DOMAIN 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo 'Не удалось проверить SSL'"
echo ""

# 4. Проверка Nginx
echo "🌐 4. Проверка Nginx..."
if check "Nginx запущен" "systemctl is-active --quiet nginx"; then
    check_with_output "Конфигурация Nginx" "nginx -t 2>&1"
    echo ""
    check_with_output "Nginx конфигурация webhook" "grep -A 5 'server_name.*webhook.rentflow.rentals' /etc/nginx/sites-enabled/*.conf 2>/dev/null || echo 'Конфигурация не найдена'"
    echo ""
    check_with_output "Nginx статус" "systemctl status nginx --no-pager -l | head -20"
else
    echo -e "${RED}❌ Nginx не запущен!${NC}"
    echo ""
fi
echo ""

# 5. Проверка n8n
echo "⚙️  5. Проверка n8n..."
if check "n8n контейнер запущен" "docker ps | grep -q n8n"; then
    check_with_output "n8n статус" "docker ps | grep n8n"
    echo ""
    check_with_output "n8n логи (последние 20 строк)" "docker logs n8n --tail 20 2>&1 | tail -20"
else
    echo -e "${RED}❌ n8n контейнер не запущен!${NC}"
    echo ""
fi
echo ""

# 6. Проверка доступности n8n webhook endpoint
echo "🔌 6. Проверка n8n webhook endpoint..."
check_with_output "Прямой доступ к n8n webhook" "curl -X POST -s -o /dev/null -w 'HTTP Status: %{http_code}\n' $N8N_URL$N8N_WEBHOOK_PATH -H 'Content-Type: application/json' -d '{\"test\":\"ping\"}' || echo 'Не удалось подключиться к n8n'"
echo ""

# 7. Проверка логов Nginx
echo "📝 7. Проверка логов Nginx (последние 20 запросов)..."
if [ -f /var/log/nginx/webhook-access.log ]; then
    echo "Последние запросы к webhook:"
    tail -20 /var/log/nginx/webhook-access.log 2>/dev/null || echo "Лог файл пуст или недоступен"
else
    echo -e "${YELLOW}⚠️  Лог файл /var/log/nginx/webhook-access.log не найден${NC}"
fi
echo ""
if [ -f /var/log/nginx/webhook-error.log ]; then
    echo "Последние ошибки webhook:"
    tail -20 /var/log/nginx/webhook-error.log 2>/dev/null || echo "Ошибок нет"
else
    echo -e "${YELLOW}⚠️  Лог файл /var/log/nginx/webhook-error.log не найден${NC}"
fi
echo ""

# 8. Проверка логов n8n на ошибки
echo "📝 8. Проверка логов n8n на ошибки..."
check_with_output "Ошибки в логах n8n" "docker logs n8n --tail 100 2>&1 | grep -i 'error\|fail\|webhook' | tail -10 || echo 'Ошибок не найдено'"
echo ""

# 9. Проверка workflow в n8n
echo "📋 9. Проверка workflow 'RentProg Webhooks Monitor'..."
echo "   Проверьте вручную: http://46.224.17.15:5678"
echo "   Workflow должен быть:"
echo "   - ✅ Активен (Active)"
echo "   - ✅ Webhook node настроен на путь: /webhook/rentprog-webhook"
echo "   - ✅ Production URL: $WEBHOOK_URL"
echo ""

# 10. Проверка файрвола
echo "🔥 10. Проверка файрвола..."
check_with_output "Открытые порты 80, 443" "netstat -tlnp | grep -E ':(80|443)' || ss -tlnp | grep -E ':(80|443)'"
echo ""
check_with_output "UFW статус" "ufw status 2>/dev/null || iptables -L -n | head -10 || echo 'Не удалось проверить файрвол'"
echo ""

# 11. Тестовый запрос к webhook
echo "🧪 11. Тестовый запрос к webhook..."
echo "Отправка тестового POST запроса..."
RESPONSE=$(curl -X POST -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}s\n" \
    "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "X-Test-Request: true" \
    -d '{"event":"test","payload":"{\"id\":\"test_123\",\"type\":\"test\"}","test":true}' \
    2>&1) || RESPONSE="ERROR: Не удалось подключиться"

echo "$RESPONSE"
echo ""

# 12. Проверка переменных окружения n8n
echo "🔧 12. Проверка переменных окружения n8n..."
check_with_output "WEBHOOK_URL в n8n" "docker exec n8n env | grep WEBHOOK_URL || echo 'Переменная не найдена'"
echo ""

# 13. Рекомендации
echo "=========================================="
echo "💡 Рекомендации по настройке в RentProg:"
echo "=========================================="
echo ""
echo "В RentProg должен быть указан URL:"
echo -e "${GREEN}$WEBHOOK_URL${NC}"
echo ""
echo "ВАЖНО:"
echo "  - Без слэша в конце"
echo "  - Без пути /webhook/rentprog-webhook"
echo "  - Просто домен: $WEBHOOK_URL"
echo "  - Метод: POST"
echo "  - Формат: JSON"
echo ""

# 14. Сводка проблем
echo "=========================================="
echo "📊 Сводка проблем:"
echo "=========================================="
echo ""

PROBLEMS=0

# Проверяем основные компоненты
if ! systemctl is-active --quiet nginx 2>/dev/null; then
    echo -e "${RED}❌ Проблема: Nginx не запущен${NC}"
    echo "   Решение: sudo systemctl start nginx"
    PROBLEMS=$((PROBLEMS + 1))
fi

if ! docker ps | grep -q n8n; then
    echo -e "${RED}❌ Проблема: n8n контейнер не запущен${NC}"
    echo "   Решение: docker-compose up -d n8n"
    PROBLEMS=$((PROBLEMS + 1))
fi

if ! curl -s -o /dev/null -w "%{http_code}" "$WEBHOOK_URL" | grep -q "200\|301\|302"; then
    echo -e "${YELLOW}⚠️  Предупреждение: Webhook URL недоступен${NC}"
    echo "   Проверьте DNS и Nginx конфигурацию"
    PROBLEMS=$((PROBLEMS + 1))
fi

if [ $PROBLEMS -eq 0 ]; then
    echo -e "${GREEN}✅ Все основные компоненты работают${NC}"
    echo ""
    echo "Если вебхуки все еще не приходят:"
    echo "  1. Проверьте настройки в RentProg UI"
    echo "  2. Проверьте активность workflow в n8n"
    echo "  3. Проверьте логи Nginx: tail -f /var/log/nginx/webhook-access.log"
    echo "  4. Проверьте логи n8n: docker logs n8n --tail 50 -f"
else
    echo ""
    echo -e "${RED}Найдено проблем: $PROBLEMS${NC}"
fi

echo ""
echo "=========================================="
echo "Диагностика завершена"
echo "=========================================="
