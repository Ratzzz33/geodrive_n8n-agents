#!/bin/bash
# Health check скрипт для Starline scraper
# Используется systemd для мониторинга состояния

set -e

# Проверяем что API отвечает
if ! curl -sf http://localhost:3000/health > /dev/null; then
  echo "❌ API не отвечает на /health"
  exit 1
fi

# Проверяем что Starline sync status работает
if ! curl -sf http://localhost:3000/starline/sync-status > /dev/null; then
  echo "❌ Starline sync status не работает"
  exit 1
fi

echo "✅ Jarvis API и Starline scraper здоровы"
exit 0

