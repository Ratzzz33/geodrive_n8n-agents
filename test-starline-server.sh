#!/bin/bash
# Тест Starline API endpoints на сервере

echo "🧪 Тестирование Starline API на Hetzner..."
echo ""

# Health check
echo "1️⃣  Health check..."
curl -s http://localhost:3000/health && echo "" || echo "❌ Health check failed"
echo ""

# Wait for API to initialize
echo "⏳ Ждем 5 секунд для инициализации Starline scraper..."
sleep 5
echo ""

# Starline sync status
echo "2️⃣  Starline sync status..."
curl -s http://localhost:3000/starline/sync-status && echo "" || echo "❌ Sync status failed"
echo ""

echo "✅ Тесты завершены!"

