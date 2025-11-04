#!/bin/bash
# Скрипт для проверки проблем с доставкой вебхуков от RentProg

echo "🔍 Проверка проблем с доставкой вебхуков от RentProg"
echo "=================================================="
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Пути к логам
ACCESS_LOG="/var/log/nginx/webhook-access.log"
ERROR_LOG="/var/log/nginx/webhook-error.log"

# Проверка наличия логов
if [ ! -f "$ACCESS_LOG" ]; then
    echo -e "${RED}❌ Лог файл не найден: $ACCESS_LOG${NC}"
    exit 1
fi

if [ ! -f "$ERROR_LOG" ]; then
    echo -e "${RED}❌ Лог файл не найден: $ERROR_LOG${NC}"
    exit 1
fi

echo "📊 Анализ логов за последние 24 часа"
echo "-----------------------------------"
echo ""

# 1. Проверка 429 ошибок (Rate Limiting)
echo "1. Проверка 429 ошибок (Rate Limiting):"
echo "----------------------------------------"
RATE_LIMIT_COUNT=$(grep -c " 429 " "$ACCESS_LOG" 2>/dev/null || echo "0")
if [ "$RATE_LIMIT_COUNT" -gt 0 ]; then
    echo -e "${RED}❌ Найдено $RATE_LIMIT_COUNT запросов с кодом 429${NC}"
    echo "   Последние 10 запросов с 429:"
    grep " 429 " "$ACCESS_LOG" | tail -10 | awk '{print "   " $0}'
    echo ""
    echo -e "${YELLOW}⚠️  Рекомендация: Увеличить rate limit в nginx или проверить частоту отправки вебхуков${NC}"
else
    echo -e "${GREEN}✅ Ошибок 429 не найдено${NC}"
fi
echo ""

# 2. Проверка таймаутов (504, 502)
echo "2. Проверка таймаутов и ошибок проксирования:"
echo "--------------------------------------------"
TIMEOUT_COUNT=$(grep -cE " (502|504|499) " "$ACCESS_LOG" 2>/dev/null || echo "0")
if [ "$TIMEOUT_COUNT" -gt 0 ]; then
    echo -e "${RED}❌ Найдено $TIMEOUT_COUNT запросов с таймаутами/ошибками проксирования${NC}"
    echo "   Детали:"
    grep -E " (502|504|499) " "$ACCESS_LOG" | tail -10 | awk '{print "   " $0}'
    echo ""
    echo -e "${YELLOW}⚠️  Рекомендация: Проверить таймауты в nginx и время обработки в n8n${NC}"
else
    echo -e "${GREEN}✅ Таймаутов не найдено${NC}"
fi
echo ""

# 3. Проверка ошибок в error log
echo "3. Проверка ошибок в error log:"
echo "-------------------------------"
ERROR_COUNT=$(wc -l < "$ERROR_LOG" 2>/dev/null || echo "0")
if [ "$ERROR_COUNT" -gt 0 ]; then
    RECENT_ERRORS=$(tail -20 "$ERROR_LOG" | wc -l)
    echo -e "${YELLOW}⚠️  Найдено $ERROR_COUNT записей в error log (последние 20: $RECENT_ERRORS)${NC}"
    echo "   Последние ошибки:"
    tail -10 "$ERROR_LOG" | sed 's/^/   /'
    echo ""
else
    echo -e "${GREEN}✅ Ошибок в error log не найдено${NC}"
fi
echo ""

# 4. Статистика запросов за последние 24 часа
echo "4. Статистика запросов за последние 24 часа:"
echo "---------------------------------------------"
TOTAL_REQUESTS=$(grep -c "$(date +%d/%b/%Y)" "$ACCESS_LOG" 2>/dev/null || echo "0")
SUCCESS_REQUESTS=$(grep "$(date +%d/%b/%Y)" "$ACCESS_LOG" | grep -c " 200 " 2>/dev/null || echo "0")
ERROR_REQUESTS=$(grep "$(date +%d/%b/%Y)" "$ACCESS_LOG" | grep -cE " (4[0-9]{2}|5[0-9]{2}) " 2>/dev/null || echo "0")

echo "   Всего запросов: $TOTAL_REQUESTS"
echo "   Успешных (200): $SUCCESS_REQUESTS"
echo "   С ошибками: $ERROR_REQUESTS"

if [ "$TOTAL_REQUESTS" -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=2; $SUCCESS_REQUESTS * 100 / $TOTAL_REQUESTS" | bc)
    echo "   Процент успешных: ${SUCCESS_RATE}%"
    
    if (( $(echo "$SUCCESS_RATE < 95" | bc -l) )); then
        echo -e "   ${RED}❌ Процент успешных запросов ниже 95%${NC}"
    else
        echo -e "   ${GREEN}✅ Процент успешных запросов в норме${NC}"
    fi
fi
echo ""

# 5. Проверка времени ответа
echo "5. Анализ времени ответа (последние 100 запросов):"
echo "-------------------------------------------------"
if command -v awk &> /dev/null; then
    # Попытка извлечь время ответа из логов (если включен log_format с $request_time)
    echo "   Проверка времени ответа..."
    # Это зависит от формата лога nginx, может потребоваться адаптация
    echo "   (Требуется настройка log_format для детального анализа)"
fi
echo ""

# 6. Проверка последних запросов
echo "6. Последние 10 запросов:"
echo "------------------------"
tail -10 "$ACCESS_LOG" | awk '{print "   " $0}'
echo ""

# 7. Рекомендации
echo "📋 Рекомендации:"
echo "---------------"
echo ""
if [ "$RATE_LIMIT_COUNT" -gt 0 ]; then
    echo "1. ${YELLOW}Rate Limiting:${NC} Увеличить лимит в nginx или проверить частоту отправки вебхуков"
    echo "   Изменить в nginx/webhook.rentflow.rentals.conf:"
    echo "   limit_req_zone \$binary_remote_addr zone=webhook_limit:10m rate=50r/s;"
    echo ""
fi

if [ "$TIMEOUT_COUNT" -gt 0 ]; then
    echo "2. ${YELLOW}Таймауты:${NC} Убедиться что Response Node в n8n workflow возвращает ответ быстро"
    echo "   Проверить workflow: n8n-workflows/rentprog-webhooks-monitor.json"
    echo ""
fi

echo "3. ${GREEN}Мониторинг:${NC} Регулярно проверять логи на наличие проблем"
echo "   Запустить: ./setup/check_webhook_delivery_issues.sh"
echo ""

echo "4. ${GREEN}Проверка Response Node:${NC} Убедиться что Response Node добавлен в workflow"
echo "   Workflow должен иметь ноду 'Respond to Webhook' сразу после Webhook"
echo ""

echo "✅ Проверка завершена"
