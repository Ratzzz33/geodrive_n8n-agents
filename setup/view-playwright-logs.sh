#!/bin/bash
# Скрипт для просмотра логов Playwright Service в реальном времени

SERVER="root@46.224.17.15"

echo "📋 Подключение к серверу для просмотра логов Playwright Service..."
echo "   (Нажмите Ctrl+C для выхода)"
echo ""

ssh $SERVER "journalctl -u playwright-amocrm -f --no-pager"

