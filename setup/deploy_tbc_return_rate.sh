#!/bin/bash
# Скрипт для деплоя TBC Bank Return Rate Parser
# Применяет миграцию БД, обновляет playwright-service, импортирует workflow

set -e

echo "=========================================="
echo "🚀 Deploy TBC Bank Return Rate Parser"
echo "=========================================="

# 1. Применить миграцию БД
echo ""
echo "1️⃣  Applying database migration..."
psql $DATABASE_URL -f setup/migrations/0045_add_tbc_return_rate.sql
echo "✅ Migration applied"

# 2. Обновить код и пересобрать
echo ""
echo "2️⃣  Building playwright-service..."
npm run build
echo "✅ Build completed"

# 3. Перезапустить playwright-service
echo ""
echo "3️⃣  Restarting playwright-service..."
pm2 restart playwright-service
echo "✅ Service restarted"

# 4. Импортировать workflow в n8n
echo ""
echo "4️⃣  Importing workflow to n8n..."
node setup/import_workflow_2025.mjs n8n-workflows/tbc-return-rate-parser.json
echo "✅ Workflow imported"

echo ""
echo "=========================================="
echo "✅ Deployment completed!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Activate workflow in n8n UI"
echo "2. Test workflow manually"
echo "3. Check logs: pm2 logs playwright-service"

