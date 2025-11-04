#!/bin/bash

# Скрипт для применения всех изменений для отладки webhook

set -e

echo "==================================="
echo "Применение изменений для отладки webhook"
echo "==================================="
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Проверка, что скрипт запущен с правами root
if [[ $EUID -ne 0 ]]; then
   print_error "Этот скрипт должен быть запущен с правами root (sudo)"
   exit 1
fi

# Шаг 1: Проверка существующих nginx конфигураций
print_step "Шаг 1: Проверка nginx конфигураций"

NGINX_CONFIGS=(
    "/etc/nginx/sites-available/n8n.rentflow.rentals"
    "/etc/nginx/sites-available/webhook.rentflow.rentals"
    "/etc/nginx/sites-available/webhook-test.rentflow.rentals"
)

# Копируем новые конфигурации
for config in "${NGINX_CONFIGS[@]}"; do
    filename=$(basename "$config")
    source_file="/workspace/nginx/${filename}.conf"
    
    if [ -f "$source_file" ]; then
        print_step "Копирование ${filename}.conf в /etc/nginx/sites-available/"
        cp "$source_file" "$config"
        print_success "Конфигурация ${filename} обновлена"
        
        # Создаем симлинк в sites-enabled если его нет
        if [ ! -L "/etc/nginx/sites-enabled/${filename}" ]; then
            ln -s "$config" "/etc/nginx/sites-enabled/${filename}"
            print_success "Создан симлинк в sites-enabled"
        fi
    else
        print_warning "Файл $source_file не найден, пропускаем"
    fi
done

# Шаг 2: Проверка SSL сертификатов
print_step "Шаг 2: Проверка SSL сертификатов"

check_ssl_cert() {
    local domain=$1
    if [ -f "/etc/letsencrypt/live/${domain}/fullchain.pem" ]; then
        print_success "SSL сертификат для ${domain} найден"
        
        # Проверяем срок действия
        local expiry=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/${domain}/fullchain.pem" | cut -d= -f2)
        print_success "Срок действия до: $expiry"
        return 0
    else
        print_warning "SSL сертификат для ${domain} не найден"
        return 1
    fi
}

# Проверяем сертификаты
SSL_MISSING=0

if ! check_ssl_cert "n8n.rentflow.rentals"; then
    SSL_MISSING=1
    print_warning "Необходимо создать SSL сертификат для n8n.rentflow.rentals"
    echo "  Запустите: sudo certbot certonly --nginx -d n8n.rentflow.rentals"
fi

if ! check_ssl_cert "webhook.rentflow.rentals"; then
    print_warning "SSL сертификат для webhook.rentflow.rentals не найден"
    echo "  Запустите: sudo certbot certonly --nginx -d webhook.rentflow.rentals"
fi

# Шаг 3: Создание лог-файлов
print_step "Шаг 3: Создание лог-файлов"

LOG_FILES=(
    "/var/log/nginx/n8n-webhook-detailed.log"
    "/var/log/nginx/webhook-ratelimit.log"
    "/var/log/nginx/n8n-redirect.log"
)

for logfile in "${LOG_FILES[@]}"; do
    if [ ! -f "$logfile" ]; then
        touch "$logfile"
        chown www-data:adm "$logfile"
        chmod 640 "$logfile"
        print_success "Создан лог-файл: $logfile"
    else
        print_success "Лог-файл существует: $logfile"
    fi
done

# Шаг 4: Тестирование конфигурации nginx
print_step "Шаг 4: Тестирование конфигурации nginx"

if nginx -t 2>&1 | tee /tmp/nginx-test.log; then
    print_success "Конфигурация nginx корректна"
else
    print_error "Ошибка в конфигурации nginx!"
    cat /tmp/nginx-test.log
    echo ""
    print_error "Исправьте ошибки и запустите скрипт снова"
    exit 1
fi

# Шаг 5: Перезагрузка nginx
print_step "Шаг 5: Перезагрузка nginx"

if [ $SSL_MISSING -eq 1 ]; then
    print_warning "SSL сертификат для n8n.rentflow.rentals отсутствует"
    print_warning "Nginx может не запуститься без этого сертификата"
    echo ""
    read -p "Всё равно перезагрузить nginx? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Перезагрузка nginx отменена"
        echo ""
        print_step "Создайте SSL сертификат вручную:"
        echo "  sudo certbot certonly --nginx -d n8n.rentflow.rentals"
        echo ""
        print_step "Затем перезапустите nginx:"
        echo "  sudo systemctl reload nginx"
        exit 0
    fi
fi

if systemctl reload nginx; then
    print_success "Nginx успешно перезагружен"
else
    print_error "Ошибка при перезагрузке nginx"
    systemctl status nginx --no-pager
    exit 1
fi

# Шаг 6: Проверка статуса nginx
print_step "Шаг 6: Проверка статуса nginx"

if systemctl is-active --quiet nginx; then
    print_success "Nginx работает"
    
    # Проверяем, что nginx слушает на нужных портах
    if netstat -tlnp | grep -q ":443.*nginx"; then
        print_success "Nginx слушает на порту 443 (HTTPS)"
    else
        print_warning "Nginx не слушает на порту 443"
    fi
    
    if netstat -tlnp | grep -q ":80.*nginx"; then
        print_success "Nginx слушает на порту 80 (HTTP)"
    else
        print_warning "Nginx не слушает на порту 80"
    fi
else
    print_error "Nginx не запущен!"
    systemctl status nginx --no-pager
    exit 1
fi

# Шаг 7: Проверка n8n
print_step "Шаг 7: Проверка n8n"

if docker ps | grep -q "n8n"; then
    print_success "Контейнер n8n работает"
    
    if netstat -tlnp | grep -q ":5678"; then
        print_success "n8n слушает на порту 5678"
    else
        print_warning "n8n не слушает на порту 5678"
    fi
else
    print_warning "Контейнер n8n не запущен"
    echo "  Запустите: cd /workspace && sudo docker-compose up -d n8n"
fi

# Шаг 8: Тестирование доступности
print_step "Шаг 8: Тестирование доступности endpoints"

test_endpoint() {
    local url=$1
    local name=$2
    
    if curl -sSf -o /dev/null -w "%{http_code}" -m 5 "$url" 2>&1 | grep -q "200\|301\|302\|404"; then
        print_success "$name доступен"
        return 0
    else
        print_warning "$name недоступен (возможна проблема с SSL или сетью)"
        return 1
    fi
}

# Тестируем локально
test_endpoint "http://localhost:5678" "n8n (localhost)"
test_endpoint "http://localhost:80" "nginx (localhost)"

# Тестируем через домены (если DNS настроен)
print_warning "Проверка доменов (требует правильной настройки DNS)"
test_endpoint "https://n8n.rentflow.rentals" "n8n.rentflow.rentals" || true
test_endpoint "https://webhook.rentflow.rentals" "webhook.rentflow.rentals" || true

echo ""
echo "==================================="
print_success "Установка завершена!"
echo "==================================="
echo ""

print_step "Следующие шаги:"
echo ""
echo "1. Запустите мониторинг webhook запросов:"
echo "   sudo /workspace/monitor-webhooks.sh"
echo ""
echo "2. Проверьте детальные логи:"
echo "   sudo tail -f /var/log/nginx/n8n-webhook-detailed.log"
echo ""
echo "3. Если SSL сертификат отсутствует, создайте его:"
echo "   sudo certbot certonly --nginx -d n8n.rentflow.rentals"
echo ""
echo "4. Протестируйте webhook вручную:"
echo "   curl -X POST https://n8n.rentflow.rentals/webhook/service-center-webhook \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"test\": \"data\"}'"
echo ""
echo "Полное руководство: /workspace/WEBHOOK_DEBUG_GUIDE.md"
echo ""
