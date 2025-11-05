#!/bin/bash

echo "🔄 Updating Playwright service..."

cd /root/geodrive_n8n-agents

echo "1️⃣ Git pull..."
git pull

echo "2️⃣ Installing Playwright Chromium..."
npx playwright install chromium

echo "3️⃣ Restarting PM2 service..."
pm2 restart playwright-service

echo "4️⃣ Checking health..."
sleep 2
curl -s http://localhost:3001/health

echo ""
echo "✅ Done!"

