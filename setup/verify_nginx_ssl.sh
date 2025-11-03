#!/bin/bash
# Проверка SSL конфигурации для webhook.rentflow.rentals

echo "🔍 Проверка SSL конфигурации для webhook.rentflow.rentals..."
echo ""

# 1. Проверить наличие сертификата
echo "1️⃣ Проверка SSL сертификата:"
if [ -f "/etc/letsencrypt/live/webhook.rentflow.rentals/fullchain.pem" ]; then
    echo "   ✅ Сертификат найден"
    echo "   Срок действия:"
    openssl x509 -in /etc/letsencrypt/live/webhook.rentflow.rentals/fullchain.pem -noout -dates 2>/dev/null || echo "   Не удалось прочитать даты"
else
    echo "   ❌ Сертификат НЕ найден"
    echo "   Нужно получить: certbot --nginx -d webhook.rentflow.rentals"
fi

echo ""

# 2. Проверить конфигурацию nginx
echo "2️⃣ Проверка конфигурации nginx:"
if grep -q "listen 443 ssl" /etc/nginx/sites-available/webhook.rentflow.rentals.conf 2>/dev/null; then
    echo "   ✅ HTTPS (443) настроен"
else
    echo "   ❌ HTTPS НЕ настроен - нужно добавить listen 443 ssl"
fi

echo ""

# 3. Проверить доступность HTTPS
echo "3️⃣ Проверка доступности HTTPS:"
if curl -sI https://webhook.rentflow.rentals | head -1 | grep -q "200\|301\|302"; then
    echo "   ✅ HTTPS доступен"
    curl -sI https://webhook.rentflow.rentals | head -1
else
    echo "   ❌ HTTPS недоступен"
fi

echo ""

# 4. Проверить логи nginx
echo "4️⃣ Последние запросы в логах nginx:"
if [ -f "/var/log/nginx/webhook-access.log" ]; then
    echo "   Последние 5 запросов:"
    tail -5 /var/log/nginx/webhook-access.log | head -5
else
    echo "   ⚠️  Файл логов не найден"
fi

echo ""

# 5. Проверить статус nginx
echo "5️⃣ Статус nginx:"
systemctl status nginx --no-pager -l | head -5 || service nginx status | head -5

echo ""
echo "✅ Проверка завершена"

