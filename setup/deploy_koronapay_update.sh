#!/bin/bash

# Скрипт обновления для добавления парсинга KoronaPay и фиксации портов
# Запускать на сервере из корневой директории проекта (/root/geodrive_n8n-agents)

echo "🚀 Начинаем обновление..."

# 1. Обновление кода
echo "📥 Обновляем код из репозитория..."
git pull
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при git pull"
    exit 1
fi

# 2. Применение миграции БД
echo "🗄️ Применяем миграцию БД..."
if [ -f "setup/migrations/0044_add_koronapay_exchange_rates.sql" ]; then
    # Используем URL из .env или хардкод (лучше из env, но для надежности проверим)
    DB_URL=${DATABASE_URL:-"postgresql://neondb_owner:npg_cHIT9Kxfk1Am@ep-rough-heart-ahnybmq0-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"}
    psql "$DB_URL" -f setup/migrations/0044_add_koronapay_exchange_rates.sql
else
    echo "⚠️ Файл миграции не найден!"
fi

# 3. Пересборка и перезапуск Docker контейнеров (изменились порты Umnico)
echo "🐳 Пересобираем Docker контейнеры (Umnico порт 3003, AmoCRM порт 3002)..."
docker-compose up -d --build playwright-umnico playwright-amocrm

# 4. Обновление и перезапуск PM2 сервисов
echo "🔄 Перезапускаем PM2 сервисы (Playwright Service с новым endpoint, HTTP Scraper порт 3004)..."
npm install # На случай новых зависимостей
npm run build # Пересобираем TypeScript
pm2 restart ecosystem.config.cjs

# 5. Импорт n8n workflow
echo "⚡ Импортируем n8n workflow..."
if [ -f "n8n-workflows/koronapay-exchange-rates-parser.json" ]; then
    node setup/import_workflow_2025.mjs n8n-workflows/koronapay-exchange-rates-parser.json
else
    echo "⚠️ Файл workflow не найден!"
fi

echo "✅ Обновление завершено!"
echo "📋 Проверьте порты:"
echo "   - Jarvis API: 3000"
echo "   - Playwright (RentProg/Korona): 3001"
echo "   - Playwright AmoCRM: 3002"
echo "   - Playwright Umnico: 3003"
echo "   - HTTP Scraper: 3004"
echo "   - n8n: 5678"
netstat -tulZn | grep 300

