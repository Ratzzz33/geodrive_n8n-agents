#!/bin/bash
# Скрипт для настройки тестового домена webhook-test.rentflow.rentals

set -e

SERVER_IP="46.224.17.15"
TEST_DOMAIN="webhook-test.rentflow.rentals"

echo "🚀 Настройка тестового домена для вебхуков"
echo ""

echo "📋 Шаг 1: Проверка DNS"
echo "Необходимо добавить A-запись в DNS:"
echo "  $TEST_DOMAIN  A  $SERVER_IP"
echo ""
read -p "DNS запись добавлена? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Добавьте DNS запись и запустите скрипт снова"
    exit 1
fi

echo "📋 Шаг 2: Копирование конфигурации Nginx"
sudo cp nginx/webhook-test.rentflow.rentals.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/webhook-test.rentflow.rentals.conf /etc/nginx/sites-enabled/

echo "📋 Шаг 3: Проверка конфигурации Nginx"
sudo nginx -t

echo "📋 Шаг 4: Перезагрузка Nginx"
sudo systemctl reload nginx

echo "📋 Шаг 5: Получение SSL сертификата"
sudo certbot --nginx -d $TEST_DOMAIN --non-interactive --agree-tos --email admin@rentflow.rentals --redirect

echo ""
echo "✅ Тестовый домен настроен!"
echo ""
echo "🔗 Адреса:"
echo "  Продакшн:  https://webhook.rentflow.rentals"
echo "  Тестовый:  https://$TEST_DOMAIN"
echo ""
echo "📝 Следующие шаги:"
echo "1. Создать отдельный workflow в n8n для тестового окружения"
echo "2. Или использовать query параметр ?env=test для разделения"
echo ""

