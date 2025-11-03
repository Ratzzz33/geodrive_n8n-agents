#!/bin/bash
# Проверка логов nginx для вебхуков

echo "📊 Проверка последних запросов в Nginx..."
echo ""

# Последние 20 запросов к webhook
echo "Последние 20 запросов к webhook.rentflow.rentals:"
tail -20 /var/log/nginx/webhook-access.log 2>/dev/null || echo "Файл не найден"

echo ""
echo "📈 Статистика запросов (последний час):"
grep "$(date +%d/%b/%Y:%H)" /var/log/nginx/webhook-access.log 2>/dev/null | tail -10 || echo "Нет записей"

echo ""
echo "❌ Ошибки (последние 10):"
tail -10 /var/log/nginx/webhook-error.log 2>/dev/null || echo "Ошибок нет"

