#!/bin/bash
# Скрипт для анализа проблем с вебхуками
# Ищет паттерны блокировок, таймаутов, 429 ошибок

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BOLD}=== Анализ проблем с вебхуками ===${NC}\n"

# Проверка наличия лог-файлов
if [ ! -f "/var/log/nginx/webhook-access.log" ]; then
    echo -e "${RED}✗ Лог-файл не найден: /var/log/nginx/webhook-access.log${NC}"
    exit 1
fi

echo -e "${BOLD}1. Проверка ошибок Rate Limiting (429)${NC}"
rate_limit_errors=$(sudo grep " 429 " /var/log/nginx/webhook-access.log 2>/dev/null | wc -l)
if [ "$rate_limit_errors" -gt 0 ]; then
    echo -e "${RED}✗ Найдено $rate_limit_errors блокировок по rate limit${NC}"
    echo -e "${YELLOW}  Последние 5 случаев:${NC}"
    sudo grep " 429 " /var/log/nginx/webhook-access.log | tail -n 5
    echo ""
    echo -e "${BLUE}  Рекомендация: Увеличить лимит rate_limit в nginx конфигурации${NC}"
else
    echo -e "${GREEN}✓ Rate limit блокировок не обнаружено${NC}"
fi
echo ""

echo -e "${BOLD}2. Проверка таймаутов и ошибок соединения${NC}"
timeout_errors=$(sudo grep -E "(timeout|timed out|upstream)" /var/log/nginx/webhook-error.log 2>/dev/null | wc -l)
if [ "$timeout_errors" -gt 0 ]; then
    echo -e "${RED}✗ Найдено $timeout_errors таймаутов/ошибок upstream${NC}"
    echo -e "${YELLOW}  Последние 5 случаев:${NC}"
    sudo grep -E "(timeout|timed out|upstream)" /var/log/nginx/webhook-error.log | tail -n 5
    echo ""
    echo -e "${BLUE}  Рекомендация: Проверить доступность n8n на localhost:5678${NC}"
else
    echo -e "${GREEN}✓ Таймаутов не обнаружено${NC}"
fi
echo ""

echo -e "${BOLD}3. Проверка 5xx ошибок от n8n${NC}"
server_errors=$(sudo grep -E " 5[0-9]{2} " /var/log/nginx/webhook-access.log 2>/dev/null | wc -l)
if [ "$server_errors" -gt 0 ]; then
    echo -e "${RED}✗ Найдено $server_errors ошибок 5xx от n8n${NC}"
    echo -e "${YELLOW}  Последние 5 случаев:${NC}"
    sudo grep -E " 5[0-9]{2} " /var/log/nginx/webhook-access.log | tail -n 5
    echo ""
    echo -e "${BLUE}  Рекомендация: Проверить логи n8n и статус workflow${NC}"
else
    echo -e "${GREEN}✓ Серверных ошибок не обнаружено${NC}"
fi
echo ""

echo -e "${BOLD}4. Проверка 404 ошибок (неверные пути)${NC}"
not_found_errors=$(sudo grep " 404 " /var/log/nginx/webhook-access.log 2>/dev/null | wc -l)
if [ "$not_found_errors" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Найдено $not_found_errors запросов к несуществующим endpoint${NC}"
    echo -e "${YELLOW}  Уникальные пути:${NC}"
    sudo grep " 404 " /var/log/nginx/webhook-access.log | awk '{print $7}' | sort | uniq -c | sort -rn | head -n 10
    echo ""
else
    echo -e "${GREEN}✓ 404 ошибок не обнаружено${NC}"
fi
echo ""

echo -e "${BOLD}5. Статистика по service-center вебхукам${NC}"
if [ -f "/var/log/nginx/webhook-service-center.log" ]; then
    service_total=$(wc -l < /var/log/nginx/webhook-service-center.log)
    service_success=$(sudo grep " 200 " /var/log/nginx/webhook-service-center.log 2>/dev/null | wc -l)
    service_errors=$(sudo grep -vE " (200|201|204) " /var/log/nginx/webhook-service-center.log 2>/dev/null | wc -l)
    
    echo -e "  Всего запросов: ${BLUE}$service_total${NC}"
    echo -e "  Успешных (2xx): ${GREEN}$service_success${NC}"
    echo -e "  Ошибок: ${RED}$service_errors${NC}"
    
    if [ "$service_errors" -gt 0 ]; then
        echo -e "\n${YELLOW}  Коды ошибок:${NC}"
        sudo grep -vE " (200|201|204) " /var/log/nginx/webhook-service-center.log | \
            awk '{print $9}' | sort | uniq -c | sort -rn
    fi
else
    echo -e "${YELLOW}⚠ Лог service-center не найден (возможно, вебхуков еще не было)${NC}"
fi
echo ""

echo -e "${BOLD}6. Проверка доступности n8n${NC}"
if curl -s --connect-timeout 5 http://localhost:5678/healthz > /dev/null 2>&1; then
    echo -e "${GREEN}✓ n8n отвечает на localhost:5678${NC}"
else
    echo -e "${RED}✗ n8n не отвечает на localhost:5678${NC}"
    echo -e "${BLUE}  Проверьте: docker ps | grep n8n${NC}"
fi
echo ""

echo -e "${BOLD}7. Анализ временных паттернов${NC}"
echo -e "${YELLOW}Запросы по часам за сегодня:${NC}"
sudo grep "$(date '+%d/%b/%Y')" /var/log/nginx/webhook-access.log 2>/dev/null | \
    awk '{print $4}' | cut -d: -f2 | sort | uniq -c | sort -rn | head -n 10
echo ""

echo -e "${BOLD}=== Итоговые рекомендации ===${NC}"

if [ "$rate_limit_errors" -gt 10 ]; then
    echo -e "${YELLOW}• Увеличить rate limit в nginx (сейчас 30 RPS)${NC}"
fi

if [ "$timeout_errors" -gt 5 ]; then
    echo -e "${YELLOW}• Увеличить таймауты в nginx или оптимизировать n8n workflows${NC}"
fi

if [ "$server_errors" -gt 5 ]; then
    echo -e "${YELLOW}• Проверить логи n8n: docker logs n8n${NC}"
    echo -e "${YELLOW}• Проверить активность workflows в n8n UI${NC}"
fi

if [ "$not_found_errors" -gt 0 ]; then
    echo -e "${YELLOW}• Обновить URL вебхуков в RentProg на правильные пути${NC}"
fi

echo ""
echo -e "${GREEN}Анализ завершен!${NC}"
