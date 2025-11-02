#!/bin/bash
# Скрипт для очистки orphan контейнеров

echo "Удаление orphan контейнера n8n-mcp-server..."

ssh root@46.224.17.15 << 'EOF'
cd /root/geodrive_n8n-agents

echo "Остановка и удаление orphan контейнеров..."
docker compose down --remove-orphans

echo "Запуск сервисов..."
docker compose up -d

echo "Статус контейнеров:"
docker compose ps
EOF

echo "Готово!"

