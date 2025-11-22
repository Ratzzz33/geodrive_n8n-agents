#!/bin/bash
# Исправление processDeviceSafe на сервере

echo "🔧 Исправление processDeviceSafe в dist/services/starline-monitor.js..."

cd /root/geodrive_n8n-agents

# Git pull последние изменения
git pull origin main

# Проверка содержимого исправленного файла
echo "📋 Проверка изменений в src/services/starline-monitor.ts:"
grep -A 10 "const detailsArray" src/services/starline-monitor.ts

echo "✅ Изменения проверены"

