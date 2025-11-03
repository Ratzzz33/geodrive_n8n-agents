#!/bin/bash
# Полная проверка конфигурации Nginx для webhook.rentflow.rentals
# Запустить на сервере: bash setup/verify_nginx_config.sh

echo "🔍 Полная диагностика webhook.rentflow.rentals"
echo "=============================================="
echo ""

# 1. Проверка конфигурации Nginx
echo "1️⃣ Проверка конфигурации Nginx..."
CONFIG_FILE="/etc/nginx/sites-available/webhook.rentflow.rentals.conf"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "   ❌ Файл конфигурации не найден: $CONFIG_FILE"
    exit 1
fi

echo "   ✅ Файл найден: $CONFIG_FILE"
echo ""

# Проверить HTTP (80)
if grep -q "listen 80" "$CONFIG_FILE"; then
    echo "   ✅ HTTP (80) настроен"
    if grep -q "return 301 https" "$CONFIG_FILE"; then
        echo "      ✅ Редирект на HTTPS настроен"
    else
        echo "      ⚠️  Редирект на HTTPS НЕ настроен"
    fi
else
    echo "   ❌ HTTP (80) НЕ настроен"
fi

# Проверить HTTPS (443)
if grep -q "listen 443" "$CONFIG_FILE"; then
    echo "   ✅ HTTPS (443) настроен"
    if grep -q "ssl" "$CONFIG_FILE"; then
        echo "      ✅ SSL включен"
    else
        echo "      ⚠️  SSL НЕ включен (добавьте 'ssl' после 'listen 443')"
    fi
else
    echo "   ❌ HTTPS (443) НЕ настроен - это проблема!"
    echo "      Нужно добавить: listen 443 ssl http2;"
fi

echo ""

# 2. Проверка SSL сертификата
echo "2️⃣ Проверка SSL сертификата..."
CERT_PATH="/etc/letsencrypt/live/webhook.rentflow.rentals/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/webhook.rentflow.rentals/privkey.pem"

if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
    echo "   ✅ Сертификат найден"
    
    # Проверить срок действия
    if command -v openssl &> /dev/null; then
        CERT_END=$(openssl x509 -in "$CERT_PATH" -noout -enddate 2>/dev/null | cut -d= -f2)
        if [ -n "$CERT_END" ]; then
            CERT_END_EPOCH=$(date -d "$CERT_END" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$CERT_END" +%s 2>/dev/null)
            NOW_EPOCH=$(date +%s)
            DAYS_LEFT=$(( ($CERT_END_EPOCH - $NOW_EPOCH) / 86400 ))
            
            if [ $DAYS_LEFT -gt 0 ]; then
                echo "      ✅ Действителен еще $DAYS_LEFT дней (до $CERT_END)"
            else
                echo "      ❌ Сертификат истек ($CERT_END)"
            fi
        fi
    fi
else
    echo "   ❌ Сертификат НЕ найден"
    echo "      Получить: certbot --nginx -d webhook.rentflow.rentals"
fi

echo ""

# 3. Проверка синтаксиса конфигурации
echo "3️⃣ Проверка синтаксиса Nginx..."
if command -v nginx &> /dev/null; then
    if nginx -t &> /dev/null; then
        echo "   ✅ Синтаксис правильный"
    else
        echo "   ❌ Ошибки в синтаксисе:"
        nginx -t 2>&1 | grep -E "error|fail" || true
    fi
else
    echo "   ⚠️  nginx не найден в PATH"
fi

echo ""

# 4. Проверка статуса Nginx
echo "4️⃣ Проверка статуса Nginx..."
if systemctl is-active --quiet nginx; then
    echo "   ✅ Nginx работает"
else
    echo "   ❌ Nginx не работает"
    systemctl status nginx --no-pager -l | head -5
fi

echo ""

# 5. Проверка логов
echo "5️⃣ Проверка логов Nginx..."
ACCESS_LOG="/var/log/nginx/webhook-access.log"
ERROR_LOG="/var/log/nginx/webhook-error.log"

if [ -f "$ACCESS_LOG" ]; then
    echo "   ✅ Access log найден: $ACCESS_LOG"
    RECENT_REQUESTS=$(tail -10 "$ACCESS_LOG" 2>/dev/null | wc -l)
    echo "      Последние запросы (последние 10):"
    tail -10 "$ACCESS_LOG" 2>/dev/null | head -5 || echo "      (пусто)"
    
    # Проверить запросы от RentProg (по IP или user-agent)
    RENTPROG_REQUESTS=$(grep -i "rentprog\|node-fetch" "$ACCESS_LOG" 2>/dev/null | tail -5 | wc -l)
    if [ "$RENTPROG_REQUESTS" -gt 0 ]; then
        echo "      ✅ Найдены запросы от RentProg"
    else
        echo "      ⚠️  Запросов от RentProg не найдено (возможно еще не было)"
    fi
else
    echo "   ⚠️  Access log не найден: $ACCESS_LOG"
fi

if [ -f "$ERROR_LOG" ]; then
    ERROR_COUNT=$(tail -20 "$ERROR_LOG" 2>/dev/null | grep -i "error" | wc -l)
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo "   ⚠️  Найдены ошибки в error log (последние 5):"
        tail -20 "$ERROR_LOG" 2>/dev/null | grep -i "error" | tail -5
    else
        echo "   ✅ Ошибок в error log нет"
    fi
else
    echo "   ⚠️  Error log не найден: $ERROR_LOG"
fi

echo ""

# 6. Проверка доступности портов
echo "6️⃣ Проверка доступности портов..."
if command -v netstat &> /dev/null; then
    PORT_80=$(netstat -tlnp 2>/dev/null | grep ":80 " | wc -l)
    PORT_443=$(netstat -tlnp 2>/dev/null | grep ":443 " | wc -l)
    
    if [ "$PORT_80" -gt 0 ]; then
        echo "   ✅ Порт 80 слушается"
    else
        echo "   ❌ Порт 80 НЕ слушается"
    fi
    
    if [ "$PORT_443" -gt 0 ]; then
        echo "   ✅ Порт 443 слушается"
    else
        echo "   ❌ Порт 443 НЕ слушается - HTTPS не работает!"
    fi
elif command -v ss &> /dev/null; then
    PORT_80=$(ss -tlnp | grep ":80 " | wc -l)
    PORT_443=$(ss -tlnp | grep ":443 " | wc -l)
    
    if [ "$PORT_80" -gt 0 ]; then
        echo "   ✅ Порт 80 слушается"
    else
        echo "   ❌ Порт 80 НЕ слушается"
    fi
    
    if [ "$PORT_443" -gt 0 ]; then
        echo "   ✅ Порт 443 слушается"
    else
        echo "   ❌ Порт 443 НЕ слушается - HTTPS не работает!"
    fi
else
    echo "   ⚠️  netstat/ss не найдены, пропускаем проверку портов"
fi

echo ""

# 7. Итоговые рекомендации
echo "=============================================="
echo "📋 Итоговые рекомендации:"
echo ""

if ! grep -q "listen 443 ssl" "$CONFIG_FILE"; then
    echo "❌ КРИТИЧНО: HTTPS не настроен!"
    echo "   1. Скопируйте обновленную конфигурацию из репозитория"
    echo "   2. Или добавьте вручную секцию для HTTPS (443) в $CONFIG_FILE"
    echo "   3. Выполните: nginx -t && systemctl reload nginx"
    echo ""
fi

if [ ! -f "$CERT_PATH" ]; then
    echo "⚠️  SSL сертификат не найден"
    echo "   Получить: certbot --nginx -d webhook.rentflow.rentals"
    echo ""
fi

echo "✅ Проверка завершена"
echo ""
echo "Для мониторинга запросов в реальном времени:"
echo "  tail -f /var/log/nginx/webhook-access.log"

