#!/bin/bash
# Скрипт для быстрого применения обновленной конфигурации nginx
# Применяет изменения для улучшенного логирования вебхуков

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BOLD}=== Применение обновленной конфигурации Nginx ===${NC}\n"

# Проверка прав sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}Скрипт требует sudo привилегии${NC}"
    echo "Перезапускаем с sudo..."
    exec sudo bash "$0" "$@"
fi

# Шаг 1: Бэкап текущей конфигурации
echo -e "${BLUE}[1/6]${NC} Создание бэкапа текущей конфигурации..."
BACKUP_FILE="/etc/nginx/sites-available/webhook.rentflow.rentals.conf.backup.$(date +%Y%m%d_%H%M%S)"
if [ -f "/etc/nginx/sites-available/webhook.rentflow.rentals.conf" ]; then
    cp /etc/nginx/sites-available/webhook.rentflow.rentals.conf "$BACKUP_FILE"
    echo -e "${GREEN}✓ Бэкап создан: $BACKUP_FILE${NC}\n"
else
    echo -e "${YELLOW}⚠ Файл конфигурации не существует, бэкап не требуется${NC}\n"
fi

# Шаг 2: Копирование новой конфигурации
echo -e "${BLUE}[2/6]${NC} Копирование обновленной конфигурации..."
cp /workspace/nginx/webhook.rentflow.rentals.conf /etc/nginx/sites-available/
echo -e "${GREEN}✓ Конфигурация скопирована${NC}\n"

# Шаг 3: Проверка синтаксиса nginx
echo -e "${BLUE}[3/6]${NC} Проверка синтаксиса nginx..."
if nginx -t 2>&1 | grep -q "syntax is ok"; then
    echo -e "${GREEN}✓ Синтаксис корректен${NC}\n"
else
    echo -e "${RED}✗ Ошибка в конфигурации nginx!${NC}"
    echo -e "${YELLOW}Восстанавливаем бэкап...${NC}"
    if [ -f "$BACKUP_FILE" ]; then
        cp "$BACKUP_FILE" /etc/nginx/sites-available/webhook.rentflow.rentals.conf
        echo -e "${GREEN}✓ Бэкап восстановлен${NC}"
    fi
    exit 1
fi

# Шаг 4: Создание лог-файлов если не существуют
echo -e "${BLUE}[4/6]${NC} Создание лог-файлов..."
touch /var/log/nginx/webhook-service-center.log
touch /var/log/nginx/webhook-service-center-error.log
touch /var/log/nginx/webhook-access-simple.log
chmod 644 /var/log/nginx/webhook-service-center.log
chmod 644 /var/log/nginx/webhook-service-center-error.log
chmod 644 /var/log/nginx/webhook-access-simple.log
echo -e "${GREEN}✓ Лог-файлы подготовлены${NC}\n"

# Шаг 5: Перезагрузка nginx
echo -e "${BLUE}[5/6]${NC} Перезагрузка nginx..."
systemctl reload nginx
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx успешно перезагружен${NC}\n"
else
    echo -e "${RED}✗ Ошибка перезагрузки nginx!${NC}"
    echo -e "${YELLOW}Проверьте логи: journalctl -u nginx -n 50${NC}"
    exit 1
fi

# Шаг 6: Проверка работоспособности
echo -e "${BLUE}[6/6]${NC} Проверка работоспособности..."

# Проверка доступности n8n
if curl -s --connect-timeout 5 http://localhost:5678/healthz > /dev/null 2>&1; then
    echo -e "${GREEN}✓ n8n доступен${NC}"
else
    echo -e "${YELLOW}⚠ n8n не отвечает на localhost:5678${NC}"
    echo -e "${YELLOW}  Проверьте: docker ps | grep n8n${NC}"
fi

# Отправка тестового вебхука
echo -e "\nОтправка тестового вебхука..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    https://n8n.rentflow.rentals/webhook/service-center-webhook \
    -H "Content-Type: application/json" \
    -d '{"test": true, "event": "config.test", "timestamp": "'$(date -Iseconds)'"}')

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "404" ]; then
    echo -e "${GREEN}✓ Endpoint отвечает (код: $RESPONSE)${NC}"
    if [ "$RESPONSE" = "404" ]; then
        echo -e "${YELLOW}  Примечание: 404 означает, что nginx работает, но workflow в n8n не настроен${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Неожиданный код ответа: $RESPONSE${NC}"
fi

# Проверка появления в логах
echo -e "\nПроверка записи в логах..."
sleep 1
if grep -q "service-center-webhook" /var/log/nginx/webhook-service-center.log 2>/dev/null; then
    echo -e "${GREEN}✓ Запись появилась в логе service-center${NC}"
    echo -e "\nПоследняя запись:"
    tail -n 1 /var/log/nginx/webhook-service-center.log
else
    echo -e "${YELLOW}⚠ Запись не найдена в логе (возможно, еще не записалась)${NC}"
fi

echo -e "\n${BOLD}${GREEN}=== Конфигурация успешно применена! ===${NC}\n"

echo -e "${BOLD}Следующие шаги:${NC}"
echo -e "1. Мониторинг в реальном времени:"
echo -e "   ${BLUE}./scripts/monitor-webhooks.sh service-center${NC}\n"
echo -e "2. Анализ проблем:"
echo -e "   ${BLUE}./scripts/analyze-webhook-issues.sh${NC}\n"
echo -e "3. Просмотр последних записей:"
echo -e "   ${BLUE}sudo tail -f /var/log/nginx/webhook-service-center.log${NC}\n"
echo -e "4. Проверка статуса n8n workflows:"
echo -e "   ${BLUE}https://n8n.rentflow.rentals${NC}\n"

echo -e "${BOLD}Доступные лог-файлы:${NC}"
echo -e "  • /var/log/nginx/webhook-service-center.log"
echo -e "  • /var/log/nginx/webhook-service-center-error.log"
echo -e "  • /var/log/nginx/webhook-access.log"
echo -e "  • /var/log/nginx/webhook-error.log"

echo -e "\n${GREEN}✓ Готово!${NC}"
